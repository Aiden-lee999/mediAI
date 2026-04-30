import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.drug.count();
  const unknown = await prisma.drug.count({
    where: {
      OR: [
        { reimbursement: null },
        { reimbursement: '' },
        { reimbursement: { contains: '급여구분미확인' } },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        total,
        unknown,
        unknownRate: total > 0 ? Number((unknown / total).toFixed(4)) : 0,
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
