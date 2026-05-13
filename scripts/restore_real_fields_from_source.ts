import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DUMMY = {
  ingredientName: new Set(['성분정보확인중']),
  company: new Set(['제조사정보확인중']),
  atcCode: new Set(['ATC-미분류']),
  reimbursement: new Set(['급여구분확인중']),
  type: new Set(['구분확인중']),
  releaseDate: new Set(['허가일확인중']),
  efficacy: new Set(['효능효과 정보 확인중']),
  precaution: new Set(['주의사항 정보 확인중']),
  identification: new Set(['식별정보 확인중']),
  durInfo: new Set(['["DUR 점검정보 확인중"]']),
  priceLabel: new Set(['0원']),
};

type DrugRow = {
  id: string;
  productName: string;
  ingredientName: string | null;
  company: string | null;
  atcCode: string | null;
  reimbursement: string | null;
  type: string | null;
  releaseDate: string | null;
  efficacy: string | null;
  precaution: string | null;
  identification: string | null;
  durInfo: string | null;
  priceLabel: string | null;
  usageFrequency: number;
  publicApiDump: string | null;
  rawJson: string | null;
};

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeParse(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function parsePrice(value: string): string {
  const digits = toDigits(value);
  return digits ? `${digits}원` : '';
}

function normalizeReimbursement(value: string): string {
  const v = cleanText(value);
  if (!v) return '';
  const u = v.toUpperCase();
  if (u === 'Y' || u === 'PAY' || v.includes('급여')) return '급여';
  if (u === 'N' || u === 'NONPAY' || v.includes('비급여')) return '비급여';
  return '';
}

function isDummy(field: keyof typeof DUMMY, value: string | null | undefined): boolean {
  if (!value) return false;
  return DUMMY[field].has(value);
}

function walk(node: unknown, visitor: (key: string, value: unknown) => void, depth = 0): void {
  if (depth > 14 || node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visitor, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    visitor(key, value);
    walk(value, visitor, depth + 1);
  }
}

function collectStringsByKeys(source: unknown, keys: string[]): string[] {
  const keySet = new Set(keys);
  const values: string[] = [];

  walk(source, (key, value) => {
    if (!keySet.has(key)) return;
    if (typeof value === 'string') {
      const cleaned = cleanText(value);
      if (cleaned) values.push(cleaned);
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      values.push(String(value));
    }
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function pickLongest(values: string[], minLength = 1): string {
  const filtered = values.filter((v) => v.length >= minLength);
  return filtered.sort((a, b) => b.length - a.length)[0] || '';
}

function extractRealValues(row: DrugRow) {
  const dump = safeParse(row.publicApiDump);
  const raw = safeParse(row.rawJson);
  const sources = [dump, raw].filter(Boolean);

  const read = (keys: string[]) => {
    const values = sources.flatMap((source) => collectStringsByKeys(source, keys));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  };

  const ingredientName = pickLongest(
    read(['INGR_NAME', 'MTRAL_NM', 'MAIN_INGR', 'MATERIAL_NAME', 'ITEM_INGR_NAME', 'mainIngr', 'materialName']),
    2,
  );
  const company = pickLongest(read(['ENTP_NAME', 'entpName', '업체명', 'ENTRPS']), 2);
  const atcCode = pickLongest(read(['ATC_CODE', 'ATCCODE', 'atcCode']), 3);

  const reimbursementRaw = read(['payYn', '급여구분', 'reim', 'reimbursement']);
  const reimbursement = reimbursementRaw.map((v) => normalizeReimbursement(v)).find(Boolean) || '';

  const type = pickLongest(read(['ETC_OTC_NAME', 'SPCLTY_PBLC', 'etcOtcName', '전문일반구분']), 2);
  const releaseDate = pickLongest(read(['ITEM_PERMIT_DATE', 'itemPermitDate', '허가일자']), 6);

  const efficacy = pickLongest(read(['efcyQesitm', 'EFCY_QESITM', 'EE_DOC_DATA', 'eeDocData']), 12);
  const precaution = pickLongest(
    read(['atpnWarnQesitm', 'ATPN_WARN_QESITM', 'atpnQesitm', 'ATPN_QESITM', 'NB_DOC_DATA', 'nbDocData', 'prohbtContent']),
    12,
  );

  const chart = pickLongest(read(['CHART', 'chart']), 2);
  const shape = pickLongest(read(['DRUG_SHAPE', 'drugShape']), 2);
  const color1 = pickLongest(read(['COLOR_CLASS1', 'colorClass1']), 1);
  const color2 = pickLongest(read(['COLOR_CLASS2', 'colorClass2']), 1);
  const printFront = pickLongest(read(['PRINT_FRONT', 'printFront']), 1);
  const printBack = pickLongest(read(['PRINT_BACK', 'printBack']), 1);
  const identificationParts = [chart, shape, color1, color2, printFront, printBack].filter(Boolean);
  const identification = identificationParts.join(' / ');

  const durLines = read([
    'prohbtContent',
    'mixTabooDurs',
    'tabooMix',
    'ageInfo',
    'pregInfo',
    'ATPN_QESITM',
    '주의사항',
    'mixProhbtCn',
  ]).filter((v) => v.length >= 3);
  const durInfo = durLines.length > 0 ? JSON.stringify(durLines.slice(0, 20)) : '';

  const priceCandidates = read(['maxAmt', 'amt', 'price', 'dgamt', 'upprAmt', 'ceilAmt']);
  const priceLabel = priceCandidates.map((v) => parsePrice(v)).find(Boolean) || '';

  return {
    ingredientName,
    company,
    atcCode,
    reimbursement,
    type,
    releaseDate,
    efficacy,
    precaution,
    identification,
    durInfo,
    priceLabel,
  };
}

async function main() {
  const limitArg = process.argv.find((x) => x.startsWith('--limit='));
  const limit = limitArg ? Math.max(100, Number(limitArg.split('=')[1]) || 20000) : 50000;
  const batchSize = 500;
  let cursorId: string | undefined;
  const rows: DrugRow[] = [];

  while (rows.length < limit) {
    const page = (await prisma.drug.findMany({
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        productName: true,
        ingredientName: true,
        company: true,
        atcCode: true,
        reimbursement: true,
        type: true,
        releaseDate: true,
        efficacy: true,
        precaution: true,
        identification: true,
        durInfo: true,
        priceLabel: true,
        usageFrequency: true,
        publicApiDump: true,
        rawJson: true,
      },
    })) as DrugRow[];

    if (page.length === 0) break;
    cursorId = page[page.length - 1].id;

    for (const row of page) {
      const hasDummy =
        isDummy('ingredientName', row.ingredientName) ||
        isDummy('company', row.company) ||
        isDummy('atcCode', row.atcCode) ||
        isDummy('reimbursement', row.reimbursement) ||
        isDummy('type', row.type) ||
        isDummy('releaseDate', row.releaseDate) ||
        isDummy('efficacy', row.efficacy) ||
        isDummy('precaution', row.precaution) ||
        isDummy('identification', row.identification) ||
        isDummy('durInfo', row.durInfo) ||
        isDummy('priceLabel', row.priceLabel) ||
        row.usageFrequency === 1;

      if (hasDummy) rows.push(row);
      if (rows.length >= limit) break;
    }
  }

  let updated = 0;
  let restored = 0;
  let nulled = 0;

  for (const row of rows as DrugRow[]) {
    const extracted = extractRealValues(row);
    const data: Record<string, unknown> = {};

    const apply = (field: keyof typeof DUMMY, extractedValue: string) => {
      const currentValue = row[field as keyof DrugRow] as string | null;
      if (!isDummy(field, currentValue)) return;
      if (extractedValue) {
        data[field] = extractedValue;
        restored += 1;
      } else {
        data[field] = null;
        nulled += 1;
      }
    };

    apply('ingredientName', extracted.ingredientName);
    apply('company', extracted.company);
    apply('atcCode', extracted.atcCode);
    apply('reimbursement', extracted.reimbursement);
    apply('type', extracted.type);
    apply('releaseDate', extracted.releaseDate);
    apply('efficacy', extracted.efficacy);
    apply('precaution', extracted.precaution);
    apply('identification', extracted.identification);
    apply('durInfo', extracted.durInfo);
    apply('priceLabel', extracted.priceLabel);

    // usageFrequency=1 was previously used as a proxy filler value. Reset to unknown(0).
    if (row.usageFrequency === 1) {
      data.usageFrequency = 0;
    }

    if (Object.keys(data).length > 0) {
      await prisma.drug.update({ where: { id: row.id }, data });
      updated += 1;
    }
  }

  const remaining = {
    ingredient_dummy: await prisma.drug.count({ where: { ingredientName: '성분정보확인중' } }),
    company_dummy: await prisma.drug.count({ where: { company: '제조사정보확인중' } }),
    atc_dummy: await prisma.drug.count({ where: { atcCode: 'ATC-미분류' } }),
    reimb_dummy: await prisma.drug.count({ where: { reimbursement: '급여구분확인중' } }),
    type_dummy: await prisma.drug.count({ where: { type: '구분확인중' } }),
    release_dummy: await prisma.drug.count({ where: { releaseDate: '허가일확인중' } }),
    efficacy_dummy: await prisma.drug.count({ where: { efficacy: '효능효과 정보 확인중' } }),
    precaution_dummy: await prisma.drug.count({ where: { precaution: '주의사항 정보 확인중' } }),
    identification_dummy: await prisma.drug.count({ where: { identification: '식별정보 확인중' } }),
    dur_dummy: await prisma.drug.count({ where: { durInfo: '["DUR 점검정보 확인중"]' } }),
    price_zero_dummy: await prisma.drug.count({ where: { priceLabel: '0원' } }),
    usage_proxy_one: await prisma.drug.count({ where: { usageFrequency: 1 } }),
  };

  console.log(
    JSON.stringify(
      {
        targetedRows: rows.length,
        updatedRows: updated,
        restoredFields: restored,
        nulledFields: nulled,
        remaining,
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
