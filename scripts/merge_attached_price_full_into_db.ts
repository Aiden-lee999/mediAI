import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PriceEntry = {
  price: string;
  productName?: string;
  company?: string;
  type?: string;
};

type Payload = {
  source: string;
  count: number;
  items: Record<string, PriceEntry>;
};

function digits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function toProductCode(value: string | null | undefined) {
  const d = digits(value);
  if (!d) return '';
  if (d.length === 9) return d;
  if (d.length === 13 && d.startsWith('880')) return d.slice(3, 12);
  if (d.length > 9) return d.slice(-9);
  return d.padStart(9, '0');
}

function toWon(value: string) {
  const d = digits(value);
  return d ? `${d}원` : '';
}

function normalizeDrugType(value: string | undefined) {
  const t = (value || '').trim();
  if (!t) return null;
  if (t.includes('전문')) return '전문의약품';
  if (t.includes('일반')) return '일반의약품';
  return null;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function updateWithRetry(
  id: string,
  data: {
    priceLabel?: string;
    reimbursement?: string;
    productName?: string;
    company?: string;
    type?: string;
  },
  retries = 3,
) {
  for (let i = 0; i < retries; i += 1) {
    try {
      await prisma.drug.update({ where: { id }, data });
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
}

async function main() {
  const jsonPath = process.argv[2] || 'tmp_attached_price_full_map.json';
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw) as Payload;
  const itemMap = payload.items || {};

  const allCodes = Object.keys(itemMap).map((code) => toProductCode(code)).filter(Boolean);
  const uniqueCodes = Array.from(new Set(allCodes));

  const rows = await prisma.drug.findMany({
    select: {
      id: true,
      standardCode: true,
      insuranceCode: true,
      priceLabel: true,
      reimbursement: true,
      productName: true,
      company: true,
      type: true,
    },
  });

  const codeIndex = new Set<string>();
  for (const row of rows) {
    const std = toProductCode(row.standardCode);
    if (std) codeIndex.add(std);

    const insuranceTokens = (row.insuranceCode || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    for (const token of insuranceTokens) {
      const c = toProductCode(token);
      if (c) codeIndex.add(c);
    }
  }

  let matchedRows = 0;
  const updates = new Map<string, {
    priceLabel?: string;
    reimbursement?: string;
    productName?: string;
    company?: string;
    type?: string;
  }>();

  for (const row of rows) {
    const candidates: string[] = [];

    const std = toProductCode(row.standardCode);
    if (std) candidates.push(std);

    const insuranceTokens = (row.insuranceCode || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    for (const token of insuranceTokens) {
      const c = toProductCode(token);
      if (c) candidates.push(c);
    }

    const matchedCode = candidates.find((c) => !!itemMap[c]);
    if (!matchedCode) continue;

    matchedRows += 1;
    const src = itemMap[matchedCode];
    const patch: {
      priceLabel?: string;
      reimbursement?: string;
      productName?: string;
      company?: string;
      type?: string;
    } = {};

    const priceLabel = toWon(src.price || '');
    if (priceLabel && row.priceLabel !== priceLabel) {
      patch.priceLabel = priceLabel;
    }

    if (!(row.reimbursement || '').trim() || (row.reimbursement || '').includes('급여구분미확인')) {
      patch.reimbursement = '급여';
    }

    const name = (src.productName || '').trim();
    if (name && !(row.productName || '').trim()) {
      patch.productName = name;
    }

    const company = (src.company || '').trim();
    if (company && !(row.company || '').trim()) {
      patch.company = company;
    }

    const normType = normalizeDrugType(src.type);
    if (normType && !(row.type || '').trim()) {
      patch.type = normType;
    }

    if (Object.keys(patch).length > 0) {
      updates.set(row.id, patch);
    }
  }

  const missingCodes = uniqueCodes.filter((code) => !codeIndex.has(code));

  const creates = missingCodes.map((code) => {
    const src = itemMap[code];
    return {
      productName: (src?.productName || '').trim() || `약가목록_${code}`,
      ingredientName: null,
      company: (src?.company || '').trim() || null,
      standardCode: code,
      insuranceCode: code,
      atcCode: null,
      priceLabel: toWon(src?.price || ''),
      reimbursement: '급여',
      type: normalizeDrugType(src?.type) || '약가목록',
      usageFrequency: 0,
    };
  });

  const updateList = Array.from(updates.entries()).map(([id, data]) => ({ id, data }));

  for (const c of chunk(updateList, 100)) {
    for (const u of c) {
      await updateWithRetry(u.id, u.data);
    }
  }

  for (const c of chunk(creates, 500)) {
    await prisma.drug.createMany({ data: c, skipDuplicates: true });
  }

  console.log(
    JSON.stringify(
      {
        source: payload.source,
        inputCodes: payload.count,
        uniqueCodes: uniqueCodes.length,
        matchedRows,
        updatedRows: updateList.length,
        missingCodesCreated: creates.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
