import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { callPublicDrugApi, extractItems } from '../src/lib/publicDrugApiClient';

type ApiItem = Record<string, unknown>;

type NormalizedEasyDrug = {
  standardCode: string;
  insuranceCode: string;
  productName: string;
  ingredientName: string | null;
  company: string | null;
  type: string | null;
  releaseDate: string | null;
  rawJson: string;
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

function argStr(name: string, fallback: string) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = arg.split('=')[1];
  return value?.trim() ? value.trim() : fallback;
}

function pickString(item: ApiItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function safeParse(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function normalizeItem(item: ApiItem, profile: 'easy' | 'prmsn'): NormalizedEasyDrug | null {
  const itemSeq =
    pickString(item, ['ITEM_SEQ', 'itemSeq', 'PRDLST_STDR_CODE', 'BAR_CODE']) ||
    pickString(item, ['ITEM_SEQ']);
  if (!itemSeq) return null;

  const productName = pickString(item, ['ITEM_NAME', 'itemName']);
  if (!productName) return null;

  const ingredientName =
    pickString(item, ['MATERIAL_NAME', 'materialName', 'MAIN_ITEM_INGR', 'MAIN_INGR_ENG']) || null;
  const company = pickString(item, ['ENTP_NAME', 'entpName']) || null;
  const type =
    pickString(item, ['ETC_OTC_NAME', 'etcOtcName', 'SPCLTY_PBLC_CODE', 'SPCLTY_PBLC']) ||
    (profile === 'prmsn' ? '허가정보API' : null);
  const releaseDate = pickString(item, ['INSERT_DATE', 'insertDate', 'ITEM_PERMIT_DATE']) || null;

  return {
    standardCode: itemSeq,
    insuranceCode: itemSeq,
    productName,
    ingredientName,
    company,
    type,
    releaseDate,
    rawJson: JSON.stringify({ easyDrug: item }),
  };
}

async function fetchAllApiItems(baseUrl: string, operation: string, pageSize: number, maxPages: number) {

  const first = await callPublicDrugApi({
    baseUrl,
    operation,
    query: { numOfRows: pageSize, pageNo: 1 },
    timeoutMs: 30000,
    retries: 5,
  });

  const extractTotalCount = (payload: any) => {
    const direct = Number(payload?.body?.totalCount || payload?.response?.body?.totalCount || 0);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const rawText = String(payload?.rawText || '');
    const m = rawText.match(/<totalCount>\s*(\d+)\s*<\/totalCount>/i);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : 0;
  };

  const totalCount = extractTotalCount(first);
  const totalPages = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 0;
  const cappedPages = totalPages > 0 ? Math.min(totalPages, maxPages) : maxPages;
  const allItems: ApiItem[] = extractItems(first);

  console.log(
    JSON.stringify(
      {
        mode: 'easy-drug-localize-start',
        totalCount,
        totalPages: totalPages || null,
        cappedPages,
        firstPageItems: allItems.length,
      },
      null,
      2
    )
  );

  for (let page = 2; page <= cappedPages; page += 1) {
    const payload = await callPublicDrugApi({
      baseUrl,
      operation,
      query: { numOfRows: pageSize, pageNo: page },
      timeoutMs: 30000,
      retries: 5,
    });

    const pageItems = extractItems(payload);
    if (pageItems.length === 0) {
      console.log(JSON.stringify({ page, pageItems: 0, stopReason: 'empty-page' }));
      break;
    }

    allItems.push(...pageItems);

    if (page % 20 === 0 || page === cappedPages) {
      console.log(JSON.stringify({ page, pageItems: pageItems.length, accumulated: allItems.length }));
    }
  }

  return {
    totalCount,
    totalPages,
    fetchedPages: cappedPages,
    allItems,
  };
}

async function main() {
  const pageSize = argNum('page-size', 100);
  const maxPages = argNum('max-pages', 10000);
  const dumpOnly = hasFlag('dump-only');
  const profile = argStr('profile', 'prmsn') === 'easy' ? 'easy' : 'prmsn';

  const serviceName = profile === 'easy' ? 'DrbEasyDrugInfoService' : 'DrugPrdtPrmsnInfoService07';
  const operation = profile === 'easy' ? '/getDrbEasyDrugList' : '/getDrugPrdtPrmsnInq07';
  const baseUrl = `https://apis.data.go.kr/1471000/${serviceName}`;

  const dumpDir = path.join(process.cwd(), 'data', 'public_api_dumps', serviceName);
  await mkdir(dumpDir, { recursive: true });

  const { totalCount, totalPages, fetchedPages, allItems } = await fetchAllApiItems(baseUrl, operation, pageSize, maxPages);

  const opName = operation.replace(/^\//, '');
  const rawDumpPath = path.join(dumpDir, `${opName}.all.json`);
  await writeFile(rawDumpPath, JSON.stringify(allItems, null, 2), 'utf8');

  const normalizedMap = new Map<string, NormalizedEasyDrug>();
  for (const item of allItems) {
    const normalized = normalizeItem(item, profile);
    if (!normalized) continue;
    if (!normalizedMap.has(normalized.standardCode)) {
      normalizedMap.set(normalized.standardCode, normalized);
    }
  }

  const normalizedItems = [...normalizedMap.values()];
  const normalizedPath = path.join(dumpDir, `${opName}.normalized.json`);
  await writeFile(normalizedPath, JSON.stringify(normalizedItems, null, 2), 'utf8');

  if (dumpOnly) {
    console.log(
      JSON.stringify(
        {
          mode: 'dump-only-complete',
          serviceName,
          operation,
          totalCount,
          totalPages,
          fetchedPages,
          normalizedCount: normalizedItems.length,
          rawDumpPath,
          normalizedPath,
        },
        null,
        2
      )
    );
    return;
  }

  const existingRows = await prisma.drug.findMany({
    select: {
      id: true,
      standardCode: true,
      rawJson: true,
      productName: true,
      ingredientName: true,
      company: true,
      insuranceCode: true,
      type: true,
      releaseDate: true,
    },
    where: { standardCode: { not: null } },
  });

  const existingByCode = new Map(existingRows.map((row) => [String(row.standardCode), row]));

  const toCreate: NormalizedEasyDrug[] = [];
  let updateCount = 0;
  let createCandidateCount = 0;

  for (const item of normalizedItems) {
    const existing = existingByCode.get(item.standardCode);
    if (!existing) {
      toCreate.push(item);
      createCandidateCount += 1;
      continue;
    }

    const parsed = safeParse(existing.rawJson);
    const mergedRaw = { ...parsed, easyDrug: safeParse(item.rawJson).easyDrug };

    await prisma.drug.update({
      where: { id: existing.id },
      data: {
        productName: existing.productName || item.productName,
        ingredientName: existing.ingredientName || item.ingredientName,
        company: existing.company || item.company,
        insuranceCode: existing.insuranceCode || item.insuranceCode,
        type: existing.type || item.type,
        releaseDate: existing.releaseDate || item.releaseDate,
        rawJson: JSON.stringify(mergedRaw),
      },
    });
    updateCount += 1;
  }

  let insertedCount = 0;
  const CHUNK = 1000;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const chunk = toCreate.slice(i, i + CHUNK).map((item) => ({
      productName: item.productName,
      ingredientName: item.ingredientName,
      company: item.company,
      standardCode: item.standardCode,
      insuranceCode: item.insuranceCode,
      atcCode: null,
      priceLabel: null,
      reimbursement: null,
      type: item.type,
      releaseDate: item.releaseDate,
      usageFrequency: 0,
      rawJson: item.rawJson,
    }));

    const result = await prisma.drug.createMany({ data: chunk, skipDuplicates: true });
    insertedCount += result.count;
  }

  const dbTotal = await prisma.drug.count();

  console.log(
    JSON.stringify(
      {
        mode: 'merge-complete',
        serviceName,
        operation,
        profile,
        sourceTotalCount: totalCount,
        sourceFetchedPages: fetchedPages,
        sourceNormalizedCount: normalizedItems.length,
        updatedMatchedRows: updateCount,
        createCandidates: createCandidateCount,
        insertedCount,
        dbTotal,
        rawDumpPath,
        normalizedPath,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
