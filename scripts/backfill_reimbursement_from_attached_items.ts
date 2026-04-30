import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function digits(v: string | null | undefined) {
  return (v || '').replace(/\D/g, '');
}

function codeAliases(standardCode: string | null, insuranceCode: string | null) {
  const set = new Set<string>();

  const add = (v: string) => {
    const d = digits(v);
    if (!d) return;
    set.add(d);
    if (d.length > 9) set.add(d.slice(0, 9));
  };

  add(standardCode || '');
  add(insuranceCode || '');

  const raw = insuranceCode || '';
  for (const token of raw.split(/[\s,;|/]+/g)) {
    add(token);
  }

  return Array.from(set);
}

async function main() {
  const raw = fs.readFileSync('tmp_attached_price_full_map_norm.json', 'utf8').replace(/^\uFEFF/, '');
  const json = JSON.parse(raw);
  const items = json.items || {};
  const covered = new Set<string>(Object.keys(items));

  const rows = await prisma.drug.findMany({
    where: {
      OR: [{ reimbursement: null }, { reimbursement: '급여구분미확인' }],
    },
    select: {
      id: true,
      standardCode: true,
      insuranceCode: true,
      reimbursement: true,
    },
  });

  let targets = 0;
  let updated = 0;

  for (const row of rows) {
    const aliases = codeAliases(row.standardCode, row.insuranceCode);
    if (!aliases.some((k) => covered.has(k))) continue;

    targets += 1;
    await prisma.drug.update({
      where: { id: row.id },
      data: { reimbursement: '급여' },
    });
    updated += 1;
  }

  console.log(JSON.stringify({ unknownCandidates: rows.length, targets, updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
