import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Payload = {
  codesWithPrice: string[];
};

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

function hasNumericPrice(value: string | null) {
  const v = (value || '').trim();
  return !!v && /\d/.test(v) && !v.includes('가격정보없음');
}

async function main() {
  const jsonPath = process.argv[2] || 'tmp_attached_price_numeric_payload.json';
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw) as Payload;
  const codes = new Set(payload.codesWithPrice || []);

  const rows = await prisma.drug.findMany({
    select: {
      id: true,
      productName: true,
      standardCode: true,
      insuranceCode: true,
      priceLabel: true,
      reimbursement: true,
    },
  });

  const nonNumericMatched: Array<Record<string, string | null>> = [];

  for (const row of rows) {
    let matched = false;
    for (const a of aliases(row.standardCode)) {
      if (codes.has(a)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      const insuranceTokens = (row.insuranceCode || '').split(',').map((v) => v.trim()).filter(Boolean);
      for (const token of insuranceTokens) {
        for (const a of aliases(token)) {
          if (codes.has(a)) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    if (matched && !hasNumericPrice(row.priceLabel)) {
      nonNumericMatched.push({
        id: row.id,
        productName: row.productName,
        standardCode: row.standardCode,
        insuranceCode: row.insuranceCode,
        priceLabel: row.priceLabel,
        reimbursement: row.reimbursement,
      });
    }
  }

  console.log(JSON.stringify({ count: nonNumericMatched.length, rows: nonNumericMatched.slice(0, 20) }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
