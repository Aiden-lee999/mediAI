import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.drug.findMany({
    where: { OR: [{ reimbursement: null }, { reimbursement: '급여구분미확인' }] },
    select: {
      id: true,
      productName: true,
      standardCode: true,
      insuranceCode: true,
      reimbursement: true,
    },
    take: 30,
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
