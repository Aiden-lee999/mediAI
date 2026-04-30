import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PriceEntry = {
  price: string;
};

type Payload = {
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

function isUnknown(value: string | null | undefined) {
  const v = (value || '').trim();
  return !v || v.includes('급여구분미확인');
}

async function main() {
  const jsonPath = process.argv[2] || 'tmp_attached_price_full_map_norm.json';
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw) as Payload;
  const codes = new Set(Object.keys(payload.items || {}));

  const rows = await prisma.drug.findMany({
    select: { id: true, standardCode: true, insuranceCode: true, reimbursement: true },
  });

  const targets: string[] = [];

  for (const row of rows) {
    if (!isUnknown(row.reimbursement)) continue;

    let matched = false;
    const std = toProductCode(row.standardCode);
    if (std && codes.has(std)) matched = true;

    if (!matched) {
      const tokens = (row.insuranceCode || '').split(',').map((v) => v.trim()).filter(Boolean);
      for (const token of tokens) {
        const c = toProductCode(token);
        if (c && codes.has(c)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) targets.push(row.id);
  }

  const CHUNK = 500;
  let updated = 0;

  for (let i = 0; i < targets.length; i += CHUNK) {
    const batch = targets.slice(i, i + CHUNK);
    const result = await prisma.drug.updateMany({
      where: { id: { in: batch } },
      data: { reimbursement: '급여' },
    });
    updated += result.count;
  }

  console.log(JSON.stringify({ targets: targets.length, updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
