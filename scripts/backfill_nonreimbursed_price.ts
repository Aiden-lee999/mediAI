import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const whereMissing = {
    OR: [{ priceLabel: null }, { priceLabel: '' }, { priceLabel: { contains: '가격정보없음' } }],
  };

  const targetCount = await prisma.drug.count({
    where: {
      AND: [whereMissing, { reimbursement: '비급여' }],
    },
  });

  const result = await prisma.drug.updateMany({
    where: {
      AND: [whereMissing, { reimbursement: '비급여' }],
    },
    data: {
      priceLabel: '비급여',
    },
  });

  console.log(
    JSON.stringify(
      {
        targetCount,
        updatedCount: result.count,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
