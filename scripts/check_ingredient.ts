import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check 아세트아미노펜
  const result = await prisma.drug.findMany({
    where: {
      ingredientName: {
        contains: '아세트아미노펜',
      },
    },
    select: {
      id: true,
      productName: true,
      ingredientName: true,
    },
    take: 10,
  });

  console.log(`DB에서 아세트아미노펜 검색: ${result.length}건`);
  result.forEach((r) => {
    console.log(`  - ${r.productName} | ${r.ingredientName}`);
  });

  const totalCount = await prisma.drug.count();
  console.log(`전체 약품: ${totalCount}건`);

  const withIngredient = await prisma.drug.count({
    where: {
      ingredientName: {
        not: null,
      },
    },
  });
  console.log(`성분명 있는 약품: ${withIngredient}건`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
