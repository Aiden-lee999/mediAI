import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID = new Set([
  '상태:취하',
  '상태:유효기간만료',
  '상태:폐업',
  '상태:행정(취소)',
]);

async function main() {
  const rows = await prisma.drug.findMany({
    where: { reimbursement: { startsWith: '상태:' } },
    select: { id: true, reimbursement: true },
  });

  let invalid = 0;
  for (const row of rows) {
    const value = row.reimbursement || '';
    if (VALID.has(value)) continue;
    invalid += 1;
    await prisma.drug.update({
      where: { id: row.id },
      data: { reimbursement: null },
    });
  }

  console.log(JSON.stringify({ totalStatusRows: rows.length, invalidCleaned: invalid }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
