import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PUBLIC_DRUG_API_ENDPOINTS } from '../src/lib/publicDrugApiCatalog';
import { callPublicDrugApi, extractItems } from '../src/lib/publicDrugApiClient';

type AnyItem = Record<string, unknown>;

type LocalizedChunk = {
  serviceName: string;
  operation: string;
  totalCount: number;
  fetchedPages: number;
  fetchedItems: number;
  filePath: string;
};

type NormalizedDrug = {
  sourceService: string;
  sourceOperation: string;
  code: string;
  insuranceCode: string;
  productName: string;
  ingredientName: string | null;
  company: string | null;
  atcCode: string | null;
  priceLabel: string | null;
  reimbursement: string | null;
  type: string | null;
  releaseDate: string | null;
  raw: AnyItem;
};

type MergeSummary = {
  localized: LocalizedChunk[];
  normalizedCount: number;
  matchedUpdates: number;
  inserted: number;
  unmatched: number;
  enrichedIngredient: number;
  enrichedAtc: number;
  enrichedPrice: number;
  enrichedReimbursement: number;
  enrichedType: number;
  enrichedReleaseDate: number;
  finalDrugCount: number;
};

type ExistingDrugRow = {
  id: string;
  productName: string;
  company: string | null;
  standardCode: string | null;
  insuranceCode: string | null;
  ingredientName: string | null;
  atcCode: string | null;
  priceLabel: string | null;
  reimbursement: string | null;
  type: string | null;
  releaseDate: string | null;
};

type AggregatedUpdate = {
  row: ExistingDrugRow;
  ingredientName: string | null;
  atcCode: string | null;
  priceLabel: string | null;
  reimbursement: string | null;
  type: string | null;
  releaseDate: string | null;
};

type AggregatedCreate = {
  productName: string;
  ingredientName: string | null;
  company: string | null;
  standardCode: string;
  insuranceCode: string;
  atcCode: string | null;
  priceLabel: string | null;
  reimbursement: string | null;
  type: string | null;
  releaseDate: string | null;
  usageFrequency: number;
};

const prisma = new PrismaClient();

function argNum(name: string, fallback: number) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function clean(v: unknown) {
  return typeof v === 'string' ? v.trim() : '';
}

function digits(v: string) {
  return v.replace(/\D/g, '');
}

function toProductCode(value: string) {
  const d = digits(value);
  if (!d) return '';
  if (d.length === 9) return d;
  if (d.length === 13 && d.startsWith('880')) return d.slice(3, 12);
  return '';
}

function codeAliases(value: string) {
  const raw = clean(value);
  const d = digits(raw);
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (d) out.add(d);

  const p = toProductCode(raw);
  if (p) {
    out.add(p);
    out.add(`880${p}`);
  }

  return Array.from(out).filter(Boolean);
}

function normalizeReimbursement(value: string | null) {
  const v = clean(value);
  if (!v) return null;
  const u = v.toUpperCase();
  if (u === 'Y' || u === 'PAY' || u === '급여' || v.includes('급여')) return '급여';
  if (u === 'N' || u === 'NONPAY' || u === '비급여' || v.includes('비급여')) return '비급여';
  return null;
}

function isUnknownReimbursement(value: string | null | undefined) {
  const v = clean(value);
  if (!v) return true;
  return v.includes('급여구분미확인');
}

function parsePrice(v: string) {
  const n = digits(v);
  return n ? `${n}원` : null;
}

function normalizeName(v: string) {
  return v
    .replace(/&nbsp;/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasKorean(v: string | null | undefined) {
  if (!v) return false;
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(v);
}

// Prefer richer ingredient labels; upgrade when the incoming value is clearly better.
function shouldUpgradeIngredient(current: string | null, incoming: string | null) {
  const cur = clean(current);
  const inc = clean(incoming);
  if (!inc) return false;
  if (!cur) return true;

  const curKo = hasKorean(cur);
  const incKo = hasKorean(inc);
  if (!curKo && incKo) return true;
  if (curKo === incKo && inc.length > cur.length) return true;
  return false;
}

function pick(item: AnyItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  const nested = item.item as AnyItem | undefined;
  if (nested && typeof nested === 'object') {
    for (const key of keys) {
      const value = nested[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }

  return '';
}

function extractTotalCount(payload: any) {
  const direct = Number(payload?.body?.totalCount || payload?.response?.body?.totalCount || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const rawText = String(payload?.rawText || '');
  const m = rawText.match(/<totalCount>\s*(\d+)\s*<\/totalCount>/i);
  return m ? Number(m[1]) : 0;
}

function normalizeDrugFromItem(item: AnyItem, serviceName: string, operation: string): NormalizedDrug | null {
  // Product name: standard fields + bundle-specific fields
  const productName = pick(item, [
    'ITEM_NAME', 'itemName', 'PRDUCT', 'prdtNm',
    'trustItemName', 'cnsgnItemName',
  ]);
  // Primary code: ITEM_SEQ preferred, then various code fields
  const code = pick(item, [
    'ITEM_SEQ', 'itemSeq',
    'PRDLST_STDR_CODE',
    'STD_CD',               // identification API comma-separated barcodes
    'EDI_CODE', 'ediCode',
    'trustIndutyCode',      // bundle API trust-side seq
    'trustHiraPrductCode',  // bundle API HIRA code
    'cnsgnItemSeq',
    'trustItemSeq',
    'itemCode',
    'BAR_CODE',
  ]);

  if (!productName || !code) return null;

  // Use the first code token (STD_CD can be comma-separated)
  const primaryCode = (typeof code === 'string' ? code.split(',')[0].trim() : String(code));

  // Ingredient name: 한글 먼저, 영문은 대체재 (아세트아미노펜처럼 한글 성분명으로 검색 가능하게)
  const ingredientName =
    pick(item, [
      'INGR_NAME',          // 한글 DUR: "아미노필린"
      'MTRAL_NM',           // 한글 성분상세: "포도당"
      'MAIN_INGR',          // 한글 DUR: "[M223100]아미노필린수화물"
      'trustMainingr',      // 한글 묶음: "디클로페낙나트륨"
      'MATERIAL_NAME',      // 한글 대체
      'ITEM_INGR_NAME',     // 영문 허가정보: "Glucose/Sodium Chloride"
      'MAIN_INGR_ENG',      // 영문 성분상세
      'materialName', 'MAIN_ITEM_INGR', 'mainIngr',
    ]) || null;

  const company = pick(item, [
    'ENTP_NAME', 'entpName',
    'trustEntpName', 'cnsgnEntpName',
    'ENTRPS',
  ]) || null;

  const atcCode = pick(item, [
    'ATC_CODE', 'ATCCODE', 'atcCode',
    'trustAtcCode',   // 묶음: "M01AB05 (diclofenac)"
  ]) || null;

  const priceLabel = parsePrice(
    pick(item, ['maxAmt', 'amt', 'price', 'dgamt', 'upprAmt', 'ceilAmt']) || '',
  );
  const reimbursement = normalizeReimbursement(pick(item, ['payYn', 'reim', '급여구분']) || null);

  // type: ETC_OTC_NAME comes from DUR + identification, SPCLTY_PBLC from permit
  const type = pick(item, [
    'ETC_OTC_NAME', 'etcOtcName',
    'SPCLTY_PBLC',         // permit: "전문의약품"
    'SPCLTY_PBLC_CODE',
  ]) || null;

  const releaseDate =
    pick(item, [
      'ITEM_PERMIT_DATE', 'itemPermitDate',
      'trustItemPermitDate', 'cnsgnItemPermitDate',
      'INSERT_DATE', 'insertDate',
    ]) || null;

  const codeDigits = digits(primaryCode);

  return {
    sourceService: serviceName,
    sourceOperation: operation,
    code: codeDigits || primaryCode,
    insuranceCode: codeDigits || primaryCode,
    productName: normalizeName(productName),
    ingredientName,
    company,
    atcCode,
    priceLabel,
    reimbursement,
    type,
    releaseDate,
    raw: item,
  };
}

async function localizeEndpoint(serviceName: string, baseUrl: string, operation: string, pageSize: number, maxPages: number) {
  const dumpDir = path.join(process.cwd(), 'data', 'public_api_dumps', serviceName);
  await mkdir(dumpDir, { recursive: true });

  const first = await callPublicDrugApi({
    baseUrl,
    operation,
    query: { numOfRows: pageSize, pageNo: 1 },
    timeoutMs: 30000,
    retries: 5,
  });

  const totalCount = extractTotalCount(first);
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : maxPages;
  const cappedPages = Math.min(totalPages, maxPages);
  const items = extractItems(first);

  for (let page = 2; page <= cappedPages; page += 1) {
    const payload = await callPublicDrugApi({
      baseUrl,
      operation,
      query: { numOfRows: pageSize, pageNo: page },
      timeoutMs: 30000,
      retries: 5,
    });

    const pageItems = extractItems(payload);
    if (pageItems.length === 0) break;
    items.push(...pageItems);

    if (page % 20 === 0 || page === cappedPages) {
      console.log(JSON.stringify({ serviceName, operation, page, accumulated: items.length }));
    }
  }

  const opName = operation.replace(/^\//, '');
  const filePath = path.join(dumpDir, `${opName}.all.json`);
  await writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');

  return {
    serviceName,
    operation,
    totalCount,
    fetchedPages: cappedPages,
    fetchedItems: items.length,
    filePath,
    items,
  };
}

// rawJson dump functions removed — we only enrich fields, not accumulate raw API payloads into existing rows

async function main() {
  const pageSize = argNum('page-size', 100);
  const maxPages = argNum('max-pages', 600);
  const dumpOnly = hasFlag('dump-only');
  const mergeOnly = hasFlag('merge-only');
  const maxNormalized = argNum('max-normalized', Number.MAX_SAFE_INTEGER);

  const localized: LocalizedChunk[] = [];
  const normalized: NormalizedDrug[] = [];

  console.log(JSON.stringify({ mode: 'start', dumpOnly, mergeOnly, pageSize, maxPages, maxNormalized }));

  if (!mergeOnly) {
    for (const endpoint of PUBLIC_DRUG_API_ENDPOINTS) {
      for (const operation of endpoint.operations) {
        try {
          const result = await localizeEndpoint(endpoint.serviceName, endpoint.baseUrl, operation, pageSize, maxPages);
          localized.push({
            serviceName: result.serviceName,
            operation: result.operation,
            totalCount: result.totalCount,
            fetchedPages: result.fetchedPages,
            fetchedItems: result.fetchedItems,
            filePath: result.filePath,
          });

          for (const item of result.items) {
            const n = normalizeDrugFromItem(item, endpoint.serviceName, operation);
            if (n) normalized.push(n);
          }
        } catch (error: any) {
          localized.push({
            serviceName: endpoint.serviceName,
            operation,
            totalCount: 0,
            fetchedPages: 0,
            fetchedItems: 0,
            filePath: `ERROR: ${String(error?.message || error)}`,
          });
        }
      }
    }
  } else {
    const root = path.join(process.cwd(), 'data', 'public_api_dumps');
    const serviceDirs = await readdir(root, { withFileTypes: true });
    console.log(JSON.stringify({ mode: 'merge-only-load', services: serviceDirs.filter((x) => x.isDirectory()).length }));

    for (const dir of serviceDirs) {
      if (!dir.isDirectory()) continue;
      const serviceName = dir.name;
      const servicePath = path.join(root, serviceName);
      const files = await readdir(servicePath, { withFileTypes: true });

      for (const f of files) {
        if (!f.isFile() || !f.name.endsWith('.all.json')) continue;
        const opName = f.name.replace(/\.all\.json$/i, '');
        const operation = `/${opName}`;
        const filePath = path.join(servicePath, f.name);
        const raw = await readFile(filePath, 'utf8');
        const items = JSON.parse(raw) as AnyItem[];

        localized.push({
          serviceName,
          operation,
          totalCount: items.length,
          fetchedPages: 0,
          fetchedItems: items.length,
          filePath,
        });

        for (const item of items) {
          const n = normalizeDrugFromItem(item, serviceName, operation);
          if (n) normalized.push(n);
          if (normalized.length >= maxNormalized) break;
        }

        console.log(JSON.stringify({ mode: 'merge-only-file-loaded', serviceName, operation, items: items.length, normalized: normalized.length }));
        if (normalized.length >= maxNormalized) break;
      }

      if (normalized.length >= maxNormalized) break;
    }
  }

  if (normalized.length > maxNormalized) {
    normalized.length = maxNormalized;
  }

  const summaryPath = path.join(process.cwd(), 'data', 'public_api_dumps', 'localize_all_summary.json');
  await writeFile(summaryPath, JSON.stringify({ localized, normalizedCount: normalized.length }, null, 2), 'utf8');

  console.log(JSON.stringify({ mode: 'normalized-ready', localizedChunks: localized.length, normalizedCount: normalized.length, summaryPath }));

  if (dumpOnly) {
    console.log(JSON.stringify({ mode: 'dump-only', summaryPath, localized, normalizedCount: normalized.length }, null, 2));
    return;
  }

  const existing: ExistingDrugRow[] = await prisma.drug.findMany({
    select: {
      id: true,
      productName: true,
      company: true,
      standardCode: true,
      insuranceCode: true,
      ingredientName: true,
      atcCode: true,
      priceLabel: true,
      reimbursement: true,
      type: true,
      releaseDate: true,
    },
  });

  const byCode = new Map<string, (typeof existing)[number]>();
  const byNameCompany = new Map<string, (typeof existing)[number]>();

  for (const row of existing) {
    const s = clean(row.standardCode);
    const i = clean(row.insuranceCode);

    for (const alias of codeAliases(s)) {
      byCode.set(alias, row);
    }

    if (i) {
      const tokens = i.split(',').map((v) => v.trim()).filter(Boolean);
      for (const token of tokens) {
        for (const alias of codeAliases(token)) {
          byCode.set(alias, row);
        }
      }
    }

    const nc = `${normalizeName(row.productName).toLowerCase()}|${clean(row.company).toLowerCase()}`;
    byNameCompany.set(nc, row);
  }

  let matchedUpdates = 0;
  let inserted = 0;
  let unmatched = 0;
  let enrichedIngredient = 0;
  let enrichedAtc = 0;
  let enrichedPrice = 0;
  let enrichedReimbursement = 0;
  let enrichedType = 0;
  let enrichedReleaseDate = 0;
  let processed = 0;
  const updatePlans = new Map<string, AggregatedUpdate>();
  const createPlans = new Map<string, AggregatedCreate>();

  for (const item of normalized) {
    const c = digits(item.code) || item.code;
    const aliases = codeAliases(c);
    const nc = `${item.productName.toLowerCase()}|${clean(item.company).toLowerCase()}`;
    const row = aliases.map((x) => byCode.get(x)).find(Boolean) || byNameCompany.get(nc);

    if (!row) {
      const existingCreate = createPlans.get(c);
      if (!existingCreate) {
        createPlans.set(c, {
          productName: item.productName,
          ingredientName: item.ingredientName,
          company: item.company,
          standardCode: c,
          insuranceCode: item.insuranceCode,
          atcCode: item.atcCode,
          priceLabel: item.priceLabel,
          reimbursement: item.reimbursement,
          type: item.type,
          releaseDate: item.releaseDate,
          usageFrequency: 0,
        });
      } else {
        if (!existingCreate.ingredientName && item.ingredientName) existingCreate.ingredientName = item.ingredientName;
        if (!existingCreate.atcCode && item.atcCode) existingCreate.atcCode = item.atcCode;
        if (!existingCreate.priceLabel && item.priceLabel) existingCreate.priceLabel = item.priceLabel;
        if (!existingCreate.reimbursement && item.reimbursement) existingCreate.reimbursement = item.reimbursement;
        if (!existingCreate.type && item.type) existingCreate.type = item.type;
        if (!existingCreate.releaseDate && item.releaseDate) existingCreate.releaseDate = item.releaseDate;
      }

      processed += 1;
      if (processed % 1000 === 0) {
        console.log(JSON.stringify({ mode: 'aggregate-progress', processed, matchedRows: updatePlans.size, createRows: createPlans.size }));
      }
      continue;
    }

    let plan = updatePlans.get(row.id);
    if (!plan) {
      plan = {
        row,
        ingredientName: row.ingredientName,
        atcCode: row.atcCode,
        priceLabel: row.priceLabel,
        reimbursement: row.reimbursement,
        type: row.type,
        releaseDate: row.releaseDate,
      };
      updatePlans.set(row.id, plan);
    }

    if (shouldUpgradeIngredient(plan.ingredientName, item.ingredientName)) {
      plan.ingredientName = item.ingredientName;
    }
    if (!plan.atcCode && item.atcCode) plan.atcCode = item.atcCode;
    if (!plan.priceLabel && item.priceLabel) plan.priceLabel = item.priceLabel;
    if ((isUnknownReimbursement(plan.reimbursement) || !plan.reimbursement) && item.reimbursement) {
      plan.reimbursement = normalizeReimbursement(item.reimbursement);
    }
    if (!plan.type && item.type) plan.type = item.type;
    if (!plan.releaseDate && item.releaseDate) plan.releaseDate = item.releaseDate;

    processed += 1;
    if (processed % 1000 === 0) {
      console.log(JSON.stringify({ mode: 'aggregate-progress', processed, matchedRows: updatePlans.size, createRows: createPlans.size }));
    }
  }

  console.log(JSON.stringify({ mode: 'aggregate-complete', processed, matchedRows: updatePlans.size, createRows: createPlans.size }));

  const updateData = Array.from(updatePlans.values())
    .map((plan) => {
    const patch: Record<string, unknown> = {};

    if (clean(plan.ingredientName) && clean(plan.ingredientName) !== clean(plan.row.ingredientName)) {
      patch.ingredientName = plan.ingredientName;
      enrichedIngredient += 1;
    }
    if (!plan.row.atcCode && plan.atcCode) {
      patch.atcCode = plan.atcCode;
      enrichedAtc += 1;
    }
    if (!plan.row.priceLabel && plan.priceLabel) {
      patch.priceLabel = plan.priceLabel;
      enrichedPrice += 1;
    }
    if ((isUnknownReimbursement(plan.row.reimbursement) || !plan.row.reimbursement) && plan.reimbursement) {
      patch.reimbursement = plan.reimbursement;
      enrichedReimbursement += 1;
    }
    if (!plan.row.type && plan.type) {
      patch.type = plan.type;
      enrichedType += 1;
    }
    if (!plan.row.releaseDate && plan.releaseDate) {
      patch.releaseDate = plan.releaseDate;
      enrichedReleaseDate += 1;
    }

    return Object.keys(patch).length > 0 ? { id: plan.row.id, patch } : null;
  }).filter((x): x is { id: string; patch: Record<string, unknown> } => x !== null);

  const UPDATE_CHUNK = 250;
  for (let i = 0; i < updateData.length; i += UPDATE_CHUNK) {
    const chunk = updateData.slice(i, i + UPDATE_CHUNK);
    await prisma.$transaction(
      chunk.map((entry) => prisma.drug.update({ where: { id: entry.id }, data: entry.patch })),
    );
    matchedUpdates += chunk.length;
    console.log(JSON.stringify({ mode: 'update-progress', matchedUpdates, totalUpdates: updateData.length, offset: i }));
  }

  const dedupCreate = Array.from(createPlans.values()).map((entry) => ({
    productName: entry.productName,
    ingredientName: entry.ingredientName,
    company: entry.company,
    standardCode: entry.standardCode,
    insuranceCode: entry.insuranceCode,
    atcCode: entry.atcCode,
    priceLabel: entry.priceLabel,
    reimbursement: entry.reimbursement,
    type: entry.type,
    releaseDate: entry.releaseDate,
    usageFrequency: entry.usageFrequency,
  }));

  const CHUNK = 1000;
  for (let i = 0; i < dedupCreate.length; i += CHUNK) {
    const chunk = dedupCreate.slice(i, i + CHUNK);
    const result = await prisma.drug.createMany({ data: chunk, skipDuplicates: true });
    inserted += result.count;
    console.log(JSON.stringify({ mode: 'insert-progress', inserted, batchSize: chunk.length, offset: i }));
  }

  unmatched = Math.max(0, normalized.length - matchedUpdates - inserted);

  const finalDrugCount = await prisma.drug.count();

  const report: MergeSummary = {
    localized,
    normalizedCount: normalized.length,
    matchedUpdates,
    inserted,
    unmatched,
    enrichedIngredient,
    enrichedAtc,
    enrichedPrice,
    enrichedReimbursement,
    enrichedType,
    enrichedReleaseDate,
    finalDrugCount,
  };

  const mergeReportPath = path.join(process.cwd(), 'data', 'public_api_dumps', 'merge_all_summary.json');
  await writeFile(mergeReportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(JSON.stringify({ mode: 'merge-complete', mergeReportPath, ...report }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
