import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

type GrainRow = {
  ITEM_NAME?: string;
  ENTP_NAME?: string;
  ITEM_IMAGE?: string;
  ITEM_SEQ?: string;
  STD_CD?: string;
};

type PermitNormRow = {
  productName?: string;
  company?: string;
  standardCode?: string;
  insuranceCode?: string;
  rawJson?: string;
};

type RawJsonLike = {
  itemImage?: string;
  ITEM_IMAGE?: string;
  itemImage1?: string;
  ITEM_IMAGE1?: string;
  BIG_ITEM_IMAGE_DOCID?: string;
  SMALL_ITEM_IMAGE_DOCID?: string;
  BIG_PRDT_IMG_URL?: string;
  SMALL_PRDT_IMG_URL?: string;
  bigPrdtImgUrl?: string;
  smallPrdtImgUrl?: string;
};

type GrainImageIndex = {
  byStdCode: Map<string, string>;
  byItemSeq: Map<string, string>;
  rows: Array<{ itemName: string; company: string; imageUrl: string }>;
};

type PermitImageIndex = {
  byCode: Map<string, string>;
  byNameCompany: Map<string, string>;
};

const prisma = new PrismaClient();

function toDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function normalizeBaseProductName(name: string) {
  return name
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

function normalizeCompanyKey(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/[\s()]/g, '')
    .trim();
}

function makeNameCompanyKey(productName: string, company: string) {
  return `${normalizeDrugNameKey(productName)}__${normalizeCompanyKey(company)}`;
}

function toAbsoluteImageUrl(value: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `https://nedrug.mfds.go.kr${raw}`;
  return '';
}

function extractImageFromRawJson(rawJson: string | null | undefined) {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as RawJsonLike;

    const direct =
      toAbsoluteImageUrl(parsed.itemImage || '') ||
      toAbsoluteImageUrl(parsed.ITEM_IMAGE || '') ||
      toAbsoluteImageUrl(parsed.itemImage1 || '') ||
      toAbsoluteImageUrl(parsed.ITEM_IMAGE1 || '') ||
      toAbsoluteImageUrl(parsed.BIG_PRDT_IMG_URL || '') ||
      toAbsoluteImageUrl(parsed.SMALL_PRDT_IMG_URL || '') ||
      toAbsoluteImageUrl(parsed.bigPrdtImgUrl || '') ||
      toAbsoluteImageUrl(parsed.smallPrdtImgUrl || '');

    if (direct) return direct;

    const docId = String(parsed.itemImage || parsed.BIG_ITEM_IMAGE_DOCID || parsed.SMALL_ITEM_IMAGE_DOCID || '').trim();
    if (!docId) return '';
    return `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${docId}`;
  } catch {
    return '';
  }
}

async function loadGrainImageIndex() {
  const filePath = path.join(
    process.cwd(),
    'data',
    'public_api_dumps',
    '식품의약품안전처_의약품 낱알식별 정보',
    'getMdcinGrnIdntfcInfoList03.all.json',
  );
  const text = await fs.readFile(filePath, 'utf8');
  const rows = JSON.parse(text) as GrainRow[];

  const byStdCode = new Map<string, string>();
  const byItemSeq = new Map<string, string>();
  const normRows: Array<{ itemName: string; company: string; imageUrl: string }> = [];

  for (const row of rows) {
    const imageUrl = toAbsoluteImageUrl(String(row.ITEM_IMAGE || ''));
    if (!imageUrl) continue;

    const itemName = String(row.ITEM_NAME || '').trim();
    const company = String(row.ENTP_NAME || '').trim();
    const itemSeq = toDigits(String(row.ITEM_SEQ || ''));

    if (itemName) {
      normRows.push({ itemName, company, imageUrl });
    }

    if (itemSeq && !byItemSeq.has(itemSeq)) {
      byItemSeq.set(itemSeq, imageUrl);
    }

    const stdCodes = String(row.STD_CD || '')
      .split(',')
      .map((c) => toDigits(c))
      .filter(Boolean);

    for (const code of stdCodes) {
      if (!byStdCode.has(code)) {
        byStdCode.set(code, imageUrl);
      }
    }
  }

  const index: GrainImageIndex = { byStdCode, byItemSeq, rows: normRows };
  return index;
}

async function loadPermitImageIndex() {
  const filePath = path.join(
    process.cwd(),
    'data',
    'public_api_dumps',
    'DrugPrdtPrmsnInfoService07',
    'getDrugPrdtPrmsnInq07.normalized.json',
  );
  const text = await fs.readFile(filePath, 'utf8');
  const rows = JSON.parse(text) as PermitNormRow[];

  const byCode = new Map<string, string>();
  const byNameCompany = new Map<string, string>();

  for (const row of rows) {
    const raw = String(row.rawJson || '');
    if (!raw) continue;

    const imageUrl = extractImageFromRawJson(raw);
    if (!imageUrl) continue;

    const standardCode = toDigits(String(row.standardCode || ''));
    const insuranceCode = toDigits(String(row.insuranceCode || ''));

    if (standardCode && !byCode.has(standardCode)) byCode.set(standardCode, imageUrl);
    if (insuranceCode && !byCode.has(insuranceCode)) byCode.set(insuranceCode, imageUrl);

    const productName = String(row.productName || '').trim();
    const company = String(row.company || '').trim();
    if (productName && company) {
      const key = makeNameCompanyKey(productName, company);
      if (!byNameCompany.has(key)) {
        byNameCompany.set(key, imageUrl);
      }
    }
  }

  const index: PermitImageIndex = { byCode, byNameCompany };
  return index;
}

function findImageFromGrain(index: GrainImageIndex, productName: string, company: string, standardCode?: string, insuranceCode?: string) {
  const codeCandidates = [standardCode || '', insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .map((code) => toDigits(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const byStd = index.byStdCode.get(code);
    if (byStd) return byStd;
    const bySeq = index.byItemSeq.get(code);
    if (bySeq) return bySeq;
  }

  const nameKey = normalizeDrugNameKey(productName || '');
  const companyKey = normalizeCompanyKey(company || '');
  if (!nameKey) return '';

  const exactWithCompany = index.rows.find((row) =>
    normalizeDrugNameKey(row.itemName) === nameKey &&
    companyKey &&
    normalizeCompanyKey(row.company) === companyKey,
  );
  if (exactWithCompany?.imageUrl) return exactWithCompany.imageUrl;

  const exact = index.rows.find((row) => normalizeDrugNameKey(row.itemName) === nameKey);
  if (exact?.imageUrl) return exact.imageUrl;

  return '';
}

function findImageFromPermit(index: PermitImageIndex, productName: string, company: string, standardCode?: string, insuranceCode?: string) {
  const codeCandidates = [standardCode || '', insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .map((code) => toDigits(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const hit = index.byCode.get(code);
    if (hit) return hit;
  }

  const key = makeNameCompanyKey(productName || '', company || '');
  return index.byNameCompany.get(key) || '';
}

async function main() {
  const [grainIndex, permitIndex, rows] = await Promise.all([
    loadGrainImageIndex(),
    loadPermitImageIndex(),
    prisma.drug.findMany({
      select: {
        id: true,
        productName: true,
        company: true,
        standardCode: true,
        insuranceCode: true,
        rawJson: true,
      },
    }),
  ]);

  let withRaw = 0;
  let withGrain = 0;
  let withPermit = 0;
  let withAny = 0;

  for (const row of rows) {
    const raw = extractImageFromRawJson(row.rawJson);
    const grain = findImageFromGrain(
      grainIndex,
      row.productName || '',
      row.company || '',
      row.standardCode || '',
      row.insuranceCode || '',
    );
    const permit = findImageFromPermit(
      permitIndex,
      row.productName || '',
      row.company || '',
      row.standardCode || '',
      row.insuranceCode || '',
    );

    if (raw) withRaw += 1;
    if (!raw && grain) withGrain += 1;
    if (!raw && !grain && permit) withPermit += 1;
    if (raw || grain || permit) withAny += 1;
  }

  const total = rows.length;
  const blank = total - withAny;

  console.log(
    JSON.stringify(
      {
        total,
        withAnyImage: withAny,
        blankImage: blank,
        blankImagePct: total > 0 ? Number(((blank / total) * 100).toFixed(2)) : 0,
        sourceBreakdown: {
          rawJsonHit: withRaw,
          grainDumpHit: withGrain,
          permitDumpHit: withPermit,
        },
      },
      null,
      2,
    ),
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
