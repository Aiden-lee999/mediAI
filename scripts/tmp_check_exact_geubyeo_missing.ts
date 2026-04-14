import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const whereMissing = {
    OR: [{ priceLabel: null }, { priceLabel: '' }, { priceLabel: { contains: '가격정보없음' } }],
  } as const;

  const total = await prisma.drug.count({
    where: {
      ...whereMissing,
      reimbursement: '급여',
    },
  });

  const sample = await prisma.drug.findMany({
    where: {
      ...whereMissing,
      reimbursement: '급여',
    },
    select: {
      productName: true,
      company: true,
      reimbursement: true,
      standardCode: true,
      insuranceCode: true,
      atcCode: true,
      priceLabel: true,
    },
    take: 30,
  });

  console.log(JSON.stringify({ missingExactGeubyeo: total, sample }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
