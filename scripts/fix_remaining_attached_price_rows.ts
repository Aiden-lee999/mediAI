import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Payload = {
  items: Record<string, { price: string }>;
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

function hasNumericPrice(value: string | null | undefined) {
  const v = (value || '').trim();
  return !!v && /\d/.test(v) && !v.includes('가격정보없음');
}

function toWon(value: string | undefined) {
  const d = digits(value);
  return d ? `${d}원` : '';
}

async function main() {
  const path = process.argv[2] || 'tmp_attached_price_full_map.json';
  const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw) as Payload;

  const rows = await prisma.drug.findMany({
    select: {
      id: true,
      standardCode: true,
      insuranceCode: true,
      priceLabel: true,
    },
  });

  const targets: Array<{ id: string; code: string; price: string; currentPrice: string | null }> = [];

  for (const row of rows) {
    const candidates: string[] = [];
    const std = toProductCode(row.standardCode);
    if (std) candidates.push(std);

    const insuranceTokens = (row.insuranceCode || '').split(',').map((v) => v.trim()).filter(Boolean);
    for (const token of insuranceTokens) {
      const c = toProductCode(token);
      if (c) candidates.push(c);
    }

    const matched = candidates.find((c) => !!payload.items[c]);
    if (!matched) continue;

    if (!hasNumericPrice(row.priceLabel)) {
      const nextPrice = toWon(payload.items[matched]?.price);
      if (nextPrice) {
        targets.push({ id: row.id, code: matched, price: nextPrice, currentPrice: row.priceLabel });
      }
    }
  }

  for (const t of targets) {
    await prisma.drug.update({
      where: { id: t.id },
      data: { priceLabel: t.price, reimbursement: '급여' },
    });
  }

  console.log(JSON.stringify({ remainingFound: targets.length, sample: targets.slice(0, 10) }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
