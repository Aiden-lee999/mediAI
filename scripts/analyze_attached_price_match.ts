import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const raw = fs.readFileSync('tmp_attached_price_full_map_norm.json', 'utf8').replace(/^\uFEFF/, '');
  const json = JSON.parse(raw);
  const items = json.items || {};
  const keys = Object.keys(items);

  const rows = await prisma.drug.findMany({
    where: {
      OR: [{ standardCode: { in: keys } }, { insuranceCode: { in: keys } }],
    },
    select: { id: true, reimbursement: true, standardCode: true, insuranceCode: true },
  });

  const matchedNull = rows.filter((r) => !r.reimbursement || !r.reimbursement.trim()).length;
  const matchedUnknown = rows.filter(
    (r) => !r.reimbursement || !r.reimbursement.trim() || r.reimbursement === '급여구분미확인'
  ).length;

  const insuranceExact = rows.filter((r) => !!r.insuranceCode && keys.includes(r.insuranceCode)).length;
  const standardExact = rows.filter((r) => !!r.standardCode && keys.includes(r.standardCode)).length;

  console.log(
    JSON.stringify(
      {
        mapKeys: keys.length,
        matched: rows.length,
        standardExact,
        insuranceExact,
        matchedNull,
        matchedUnknown,
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
