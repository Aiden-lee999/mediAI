import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

type DrugRow = {
  id: string;
  productName: string;
  company: string | null;
  standardCode: string | null;
  insuranceCode: string | null;
  rawJson: string | null;
  imageUrl: string | null;
};

type CompactImageIndexRow = {
  itemName: string;
  company: string;
  imageUrl: string;
  itemSeq: string;
  stdCodes: string[];
};

type ImageIndex = {
  rows: CompactImageIndexRow[];
  byCode: Map<string, string>;
  byNameCompany: Map<string, string>;
  byName: Map<string, string>;
};

const prisma = new PrismaClient();
const NEDRUG_DETAIL_URL = 'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail';

function argNum(name: string, fallback: number) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function toDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function toProductCode(value: unknown) {
  const digits = toDigits(value);
  if (!digits) return '';
  if (digits.length === 9) return digits;
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(3, 12);
  return '';
}

function codeAliases(value: unknown) {
  const digits = toDigits(value);
  if (!digits) return [] as string[];

  const aliases = new Set<string>([digits]);
  const productCode = toProductCode(digits);
  if (productCode) aliases.add(productCode);
  if (digits.length === 9) aliases.add(`880${digits}`);
  return Array.from(aliases);
}

function normalizeBaseProductName(name: string) {
  return String(name || '')
    .replace(/&nbsp;/gi, ' ')
    .split('(')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDrugNameKey(name: string) {
  return normalizeBaseProductName(name)
    .toLowerCase()
    .replace(/[\s\-_/.,()[\]{}]/g, '')
    .trim();
}

function normalizeCompanyKey(name: string | null | undefined) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\s()]/g, '')
    .trim();
}

function makeNameCompanyKey(productName: string, company: string | null | undefined) {
  return `${normalizeDrugNameKey(productName)}__${normalizeCompanyKey(company)}`;
}

function buildImageByDocId(docId: unknown) {
  const id = String(docId || '').trim();
  return id ? `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${id}` : '';
}

function toAbsoluteImageUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `https://nedrug.mfds.go.kr${raw}`;
  if (/^\d{10,}$/.test(raw)) return buildImageByDocId(raw);
  return '';
}

function extractImageFromRawJson(rawJson: string | null | undefined) {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const direct =
      toAbsoluteImageUrl(parsed.itemImage) ||
      toAbsoluteImageUrl(parsed.ITEM_IMAGE) ||
      toAbsoluteImageUrl(parsed.itemImage1) ||
      toAbsoluteImageUrl(parsed.ITEM_IMAGE1) ||
      toAbsoluteImageUrl(parsed.BIG_PRDT_IMG_URL) ||
      toAbsoluteImageUrl(parsed.SMALL_PRDT_IMG_URL);
    if (direct) return direct;

    return buildImageByDocId(parsed.BIG_ITEM_IMAGE_DOCID || parsed.SMALL_ITEM_IMAGE_DOCID || '');
  } catch {
    return '';
  }
}

function extractItemSeq(drug: DrugRow) {
  const standard = toDigits(drug.standardCode);
  if (standard.length === 9) return standard;

  try {
    const parsed = drug.rawJson ? JSON.parse(drug.rawJson) as Record<string, unknown> : null;
    const rawSeq = parsed?.ITEM_SEQ || parsed?.itemSeq;
    const seq = toDigits(rawSeq);
    if (seq.length === 9) return seq;
  } catch {
    // ignore malformed rawJson
  }

  return '';
}

function addImageIndexKeys(index: ImageIndex, productName: string, company: string, imageUrl: string) {
  const nameKey = normalizeDrugNameKey(productName);
  if (!nameKey || !imageUrl) return;

  if (!index.byName.has(nameKey)) index.byName.set(nameKey, imageUrl);

  const baseKey = normalizeDrugNameKey(normalizeBaseProductName(productName));
  if (baseKey && !index.byName.has(baseKey)) index.byName.set(baseKey, imageUrl);

  const companyKey = normalizeCompanyKey(company);
  if (companyKey) {
    const key = makeNameCompanyKey(productName, company);
    if (!index.byNameCompany.has(key)) index.byNameCompany.set(key, imageUrl);

    const baseNameCompanyKey = `${baseKey}__${companyKey}`;
    if (baseKey && !index.byNameCompany.has(baseNameCompanyKey)) {
      index.byNameCompany.set(baseNameCompanyKey, imageUrl);
    }
  }
}

async function loadImageIndex(): Promise<ImageIndex> {
  const filePath = path.join(process.cwd(), 'data', 'public_api_dumps', 'drug_image_index.json');
  const text = await fs.readFile(filePath, 'utf8');
  const rows = (JSON.parse(text) as Array<Partial<CompactImageIndexRow>>)
    .map((row) => ({
      itemName: String(row.itemName || '').trim(),
      company: String(row.company || '').trim(),
      imageUrl: toAbsoluteImageUrl(row.imageUrl),
      itemSeq: toDigits(row.itemSeq),
      stdCodes: Array.isArray(row.stdCodes) ? row.stdCodes.map((code) => toDigits(code)).filter(Boolean) : [],
    }))
    .filter((row) => row.itemName && row.imageUrl);

  const index: ImageIndex = {
    rows,
    byCode: new Map<string, string>(),
    byNameCompany: new Map<string, string>(),
    byName: new Map<string, string>(),
  };

  for (const row of rows) {
    for (const alias of codeAliases(row.itemSeq)) {
      if (!index.byCode.has(alias)) index.byCode.set(alias, row.imageUrl);
    }
    for (const code of row.stdCodes) {
      for (const alias of codeAliases(code)) {
        if (!index.byCode.has(alias)) index.byCode.set(alias, row.imageUrl);
      }
    }
    addImageIndexKeys(index, row.itemName, row.company, row.imageUrl);
  }

  return index;
}

function findImageFromIndex(index: ImageIndex, drug: DrugRow) {
  const codeCandidates = [drug.standardCode || '', drug.insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .flatMap((code) => codeAliases(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const hit = index.byCode.get(code);
    if (hit) return hit;
  }

  const companyHit = index.byNameCompany.get(makeNameCompanyKey(drug.productName, drug.company));
  if (companyHit) return companyHit;

  const baseCompanyHit = index.byNameCompany.get(makeNameCompanyKey(normalizeBaseProductName(drug.productName), drug.company));
  if (baseCompanyHit) return baseCompanyHit;

  const nameHit = index.byName.get(normalizeDrugNameKey(drug.productName));
  if (nameHit) return nameHit;

  const baseNameHit = index.byName.get(normalizeDrugNameKey(normalizeBaseProductName(drug.productName)));
  if (baseNameHit) return baseNameHit;

  return '';
}

function isRealDrugImageCandidate(src: string, alt: string, productName: string) {
  const imageUrl = toAbsoluteImageUrl(src);
  if (!imageUrl) return false;

  const label = `${alt || ''}`.toLowerCase();
  if (/qr|qrcode|코드|로고|logo|attention|주의|pdf/.test(label)) return false;
  if (imageUrl.startsWith('data:image/') && imageUrl.length < 1000) return false;
  if (!imageUrl.startsWith('data:image/') && !imageUrl.includes('/pbp/cmn/itemImageDownload/')) return false;

  const productKey = normalizeDrugNameKey(productName);
  const altKey = normalizeDrugNameKey(alt);
  if (productKey && altKey && (altKey.includes(productKey) || productKey.includes(altKey))) return true;

  return /포장|용기|제품|낱알|성상|품목/.test(alt || '');
}

function extractNedrugImage(html: string, productName: string) {
  const $ = cheerio.load(html);
  const candidates: Array<{ src: string; alt: string }> = [];

  $('img').each((_, img) => {
    const src = String($(img).attr('src') || '').trim();
    const alt = String($(img).attr('alt') || $(img).attr('title') || '').trim();
    if (isRealDrugImageCandidate(src, alt, productName)) {
      candidates.push({ src: toAbsoluteImageUrl(src), alt });
    }
  });

  candidates.sort((a, b) => {
    const aProduct = normalizeDrugNameKey(a.alt).includes(normalizeDrugNameKey(productName)) ? 1 : 0;
    const bProduct = normalizeDrugNameKey(b.alt).includes(normalizeDrugNameKey(productName)) ? 1 : 0;
    if (aProduct !== bProduct) return bProduct - aProduct;
    return b.src.length - a.src.length;
  });

  return candidates[0]?.src || '';
}

async function fetchNedrugImage(itemSeq: string, productName: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${NEDRUG_DETAIL_URL}?itemSeq=${encodeURIComponent(itemSeq)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 mediAI-image-backfill/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return '';
    const html = await response.text();
    return extractNedrugImage(html, productName);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < items.length) {
      const current = next++;
      await worker(items[current], current);
    }
  });
  await Promise.all(workers);
}

async function bulkUpdateOfficialImages(targets: Array<{ drug: DrugRow; imageUrl: string; source: string }>, dryRun: boolean) {
  if (dryRun || targets.length === 0) return;

  const checkedAt = new Date();
  const chunkSize = 500;
  for (let offset = 0; offset < targets.length; offset += chunkSize) {
    const chunk = targets.slice(offset, offset + chunkSize);
    const params: unknown[] = [];
    const values = chunk
      .map((target, idx) => {
        const base = idx * 5;
        params.push(target.drug.id, target.imageUrl, target.source, 'FOUND', checkedAt);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::timestamp)`;
      })
      .join(', ');

    await prisma.$executeRawUnsafe(
      `UPDATE "Drug" AS d
       SET "imageUrl" = v."imageUrl",
           "imageSource" = v."imageSource",
           "imageStatus" = v."imageStatus",
           "imageCheckedAt" = v."imageCheckedAt"
       FROM (VALUES ${values}) AS v("id", "imageUrl", "imageSource", "imageStatus", "imageCheckedAt")
       WHERE d."id" = v."id"`,
      ...params,
    );
  }
}

async function safeDrugUpdate(id: string, data: Record<string, unknown>, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.drug.update({ where: { id }, data });
      return;
    } catch (error: any) {
      const retryable =
        ['P1001', 'P1002', 'P1017', 'P2024', 'P2028'].includes(String(error?.code || '')) ||
        /connection pool|Timed out fetching|Server has closed the connection|Can't reach database/i.test(String(error?.message || error));
      if (!retryable || attempt === attempts) throw error;
      try {
        await prisma.$disconnect();
        await prisma.$connect();
      } catch {
        // Reconnect best-effort; the next retry will surface persistent failures.
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

async function main() {
  const limit = argNum('limit', 0);
  const concurrency = argNum('concurrency', 6);
  const timeoutMs = argNum('timeout-ms', 12000);
  const dryRun = hasFlag('dry-run');
  const skipOfficialIndex = hasFlag('skip-official-index');
  const skipEmptyStatus = hasFlag('skip-empty-status');

  const index = await loadImageIndex();

  const where = {
    AND: [
      { OR: [{ imageUrl: null }, { imageUrl: '' }] },
      {
        OR: [
          { imageStatus: null },
          { imageStatus: '' },
          { NOT: { imageStatus: { in: ['NOT_FOUND_ON_NEDRUG', 'NO_ITEM_SEQ'] } } },
        ],
      },
    ],
  };
  const drugs = await prisma.drug.findMany({
    where,
    select: {
      id: true,
      productName: true,
      company: true,
      standardCode: true,
      insuranceCode: true,
      rawJson: true,
      imageUrl: true,
    },
    orderBy: [{ usageFrequency: 'desc' }, { productName: 'asc' }],
    ...(limit > 0 ? { take: limit } : {}),
  });

  let officialFilled = 0;
  let crawled = 0;
  let crawledFilled = 0;
  let notFound = 0;
  let noItemSeq = 0;
  let failed = 0;

  console.log(JSON.stringify({ mode: 'start', totalCandidates: drugs.length, indexRows: index.rows.length, limit, concurrency, dryRun, skipOfficialIndex, skipEmptyStatus }));

  const crawlTargets: DrugRow[] = [];
  const officialTargets: Array<{ drug: DrugRow; imageUrl: string; source: string }> = [];
  for (const drug of drugs) {
    const rawImageUrl = extractImageFromRawJson(drug.rawJson);
    const indexedImageUrl = skipOfficialIndex ? '' : findImageFromIndex(index, drug);
    const imageUrl = rawImageUrl || indexedImageUrl;
    if (imageUrl) {
      officialTargets.push({ drug, imageUrl, source: rawImageUrl ? 'RAW_JSON' : 'OFFICIAL_IMAGE_INDEX' });
      continue;
    }
    crawlTargets.push(drug);
  }

  await bulkUpdateOfficialImages(officialTargets, dryRun);
  officialFilled = officialTargets.length;
  console.log(JSON.stringify({ mode: 'official-index-progress', done: officialFilled, officialTargets: officialTargets.length, officialFilled }));

  console.log(JSON.stringify({ mode: 'official-index-complete', officialFilled, crawlTargets: crawlTargets.length }));

  await runWithConcurrency(crawlTargets, concurrency, async (drug, indexInBatch) => {
    const itemSeq = extractItemSeq(drug);
    if (!itemSeq) {
      noItemSeq += 1;
      if (!dryRun && !skipEmptyStatus) {
        await safeDrugUpdate(drug.id, { imageStatus: 'NO_ITEM_SEQ', imageCheckedAt: new Date() });
      }
      return;
    }

    crawled += 1;
    const imageUrl = await fetchNedrugImage(itemSeq, drug.productName, timeoutMs);
    if (imageUrl) {
      crawledFilled += 1;
      if (!dryRun) {
        await safeDrugUpdate(drug.id, {
          imageUrl,
          imageSource: 'NEDRUG_DETAIL_PAGE',
          imageStatus: 'FOUND',
          imageCheckedAt: new Date(),
        });
      }
    } else {
      notFound += 1;
      if (!dryRun && !skipEmptyStatus) {
        await safeDrugUpdate(drug.id, { imageStatus: 'NOT_FOUND_ON_NEDRUG', imageCheckedAt: new Date() });
      }
    }

    const done = indexInBatch + 1;
    if (done % 250 === 0 || done === crawlTargets.length) {
      console.log(JSON.stringify({ mode: 'crawl-progress', done, crawlTargets: crawlTargets.length, crawled, crawledFilled, notFound, noItemSeq, failed }));
    }
  });

  const summary = {
    mode: 'complete',
    totalCandidates: drugs.length,
    officialFilled,
    crawled,
    crawledFilled,
    notFound,
    noItemSeq,
    failed,
    totalFilled: officialFilled + crawledFilled,
    dryRun,
  };
  const reportPath = path.join(process.cwd(), 'data', 'public_api_dumps', 'nedrug_image_backfill_summary.json');
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });