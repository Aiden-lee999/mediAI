import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function norm(v: string | null | undefined) {
  return (v || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\(\)\[\]\-_,.\/]/g, '')
    .trim();
}

type Item = { productName?: string; company?: string };

async function main() {
  const raw = fs.readFileSync('tmp_attached_price_full_map_norm.json', 'utf8').replace(/^\uFEFF/, '');
  const json = JSON.parse(raw);
  const items: Record<string, Item> = json.items || {};

  const byName = new Map<string, { companyNorm: string }[]>();
  for (const value of Object.values(items)) {
    const n = norm(value.productName || '');
    if (!n) continue;
    const c = norm(value.company || '');
    const arr = byName.get(n) || [];
    arr.push({ companyNorm: c });
    byName.set(n, arr);
  }

  const rows = await prisma.drug.findMany({
    where: {
      OR: [{ reimbursement: null }, { reimbursement: '급여구분미확인' }],
    },
    select: {
      id: true,
      productName: true,
      company: true,
    },
  });

  let nameOnlyUnique = 0;
  let nameCompanyUnique = 0;

  for (const row of rows) {
    const n = norm(row.productName);
    if (!n) continue;
    const candidates = byName.get(n) || [];
    if (candidates.length === 1) nameOnlyUnique += 1;

    const c = norm(row.company);
    const companyMatched = candidates.filter((x) => !!c && x.companyNorm === c);
    if (companyMatched.length === 1) nameCompanyUnique += 1;
  }

  console.log(
    JSON.stringify(
      {
        unknownCandidates: rows.length,
        nameOnlyUnique,
        nameCompanyUnique,
      },
      null,
      2
    )
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
