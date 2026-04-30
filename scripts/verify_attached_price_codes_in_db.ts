import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Payload = {
  totalRows: number;
  uniqueCodes: number;
  uniqueCodesWithPrice: number;
  codesWithPrice: string[];
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function hasNumericPrice(value: string | null) {
  const v = (value || '').trim();
  return !!v && /\d/.test(v) && !v.includes('가격정보없음');
}

function digits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function aliases(raw: string | null | undefined) {
  const d = digits(raw);
  if (!d) return [] as string[];
  const set = new Set<string>([d]);
  if (d.length === 13 && d.startsWith('880')) set.add(d.slice(3, 12));
  return Array.from(set);
}

async function main() {
  const jsonPath = process.argv[2] || 'tmp_attached_price_codes.json';
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw) as Payload;

  const codes = new Set(payload.codesWithPrice || []);

  const dbRows = await prisma.drug.findMany({
    select: { id: true, standardCode: true, insuranceCode: true, priceLabel: true },
  });

  let matchedRows = 0;
  let matchedRowsWithNumericPrice = 0;
  const dbCodeIndex = new Set<string>();

  for (const row of dbRows) {
    const matchedCodes = new Set<string>();

    for (const a of aliases(row.standardCode)) {
      dbCodeIndex.add(a);
      if (codes.has(a)) matchedCodes.add(a);
    }

    const insuranceTokens = (row.insuranceCode || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    for (const token of insuranceTokens) {
      for (const a of aliases(token)) {
        dbCodeIndex.add(a);
        if (codes.has(a)) matchedCodes.add(a);
      }
    }

    if (matchedCodes.size === 0) continue;

    matchedRows += 1;
    if (hasNumericPrice(row.priceLabel)) {
      matchedRowsWithNumericPrice += 1;
    }
  }

  let coveredCodes = 0;
  for (const code of codes) {
    if (dbCodeIndex.has(code)) coveredCodes += 1;
  }

  const dbTotalRows = await prisma.drug.count();
  const dbRowsWithNumericPrice = await prisma.drug.count({
    where: {
      AND: [
        { priceLabel: { not: null } },
        { NOT: { priceLabel: { contains: '가격정보없음' } } },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        csvTotalRows: payload.totalRows,
        csvUniqueCodes: payload.uniqueCodes,
        csvUniqueCodesWithPrice: payload.uniqueCodesWithPrice,
        dbTotalRows,
        dbRowsWithNumericPrice,
        dbMatchedRowsAnyCodeField: matchedRows,
        dbMatchedWithNumericPrice: matchedRowsWithNumericPrice,
        coveredCodes,
        codeCoverageRate: payload.uniqueCodesWithPrice
          ? Number((coveredCodes / payload.uniqueCodesWithPrice).toFixed(4))
          : 0,
        priceCoverageWithinMatched: matchedRows
          ? Number((matchedRowsWithNumericPrice / matchedRows).toFixed(4))
          : 0,
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
