import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.drug.groupBy({
    by: ['reimbursement'],
    where: {
      OR: [
        { priceLabel: null },
        { priceLabel: '' },
        { priceLabel: { contains: '가격정보없음' } },
      ],
    },
    _count: { reimbursement: true },
    orderBy: { _count: { reimbursement: 'desc' } },
    take: 20,
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
