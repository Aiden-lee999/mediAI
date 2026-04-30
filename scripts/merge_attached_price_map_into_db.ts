import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PriceMapPayload = {
  source: string;
  count: number;
  items: Record<string, string>;
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
  return d;
}

function hasNumericPrice(value: string | null | undefined) {
  const v = (value || '').trim();
  return !!v && /\d/.test(v) && !v.includes('가격정보없음');
}

function formatWon(value: string) {
  const d = digits(value);
  return d ? `${d}원` : '';
}

async function main() {
  const jsonPath = process.argv[2] || 'tmp_attached_price_map.json';
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw) as PriceMapPayload;
  const priceMap = payload.items || {};

  const rows = await prisma.drug.findMany({
    select: {
      id: true,
      standardCode: true,
      insuranceCode: true,
      priceLabel: true,
      reimbursement: true,
    },
  });

  let scanned = 0;
  let matched = 0;
  let updated = 0;
  let reimbursementUpdated = 0;

  const updateBatch: Array<{ id: string; data: { priceLabel?: string; reimbursement?: string } }> = [];

  for (const row of rows) {
    scanned += 1;

    const candidates = new Set<string>();
    candidates.add(toProductCode(row.standardCode));

    const insuranceTokens = (row.insuranceCode || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    for (const token of insuranceTokens) {
      candidates.add(toProductCode(token));
    }

    const code = Array.from(candidates).find((c) => !!c && !!priceMap[c]);
    if (!code) continue;

    matched += 1;
    const formatted = formatWon(priceMap[code]);
    if (!formatted) continue;

    const patch: { priceLabel?: string; reimbursement?: string } = {};
    if (!hasNumericPrice(row.priceLabel)) {
      patch.priceLabel = formatted;
    }
    if (!(row.reimbursement || '').trim()) {
      patch.reimbursement = '급여';
      reimbursementUpdated += 1;
    }

    if (patch.priceLabel || patch.reimbursement) {
      updateBatch.push({ id: row.id, data: patch });
      updated += 1;
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < updateBatch.length; i += CHUNK) {
    const chunk = updateBatch.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((u) => prisma.drug.update({ where: { id: u.id }, data: u.data })),
    );
  }

  console.log(
    JSON.stringify(
      {
        source: payload.source,
        inputPriceCodes: payload.count,
        scanned,
        matched,
        updated,
        reimbursementUpdated,
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
