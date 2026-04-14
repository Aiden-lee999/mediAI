import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크', '아토르바스타틴'];

async function main() {
  const missingPriceClause = {
    OR: [{ priceLabel: null }, { priceLabel: '' }, { priceLabel: { contains: '가격정보없음' } }],
  } as const;

  const originalClause = {
    OR: [
      ...originalMakers.map((maker) => ({ company: { contains: maker } })),
      ...originalNames.map((name) => ({ productName: { contains: name } })),
    ],
  } as const;

  const totalOriginal = await prisma.drug.count({ where: originalClause });

  const missingOriginal = await prisma.drug.count({
    where: {
      AND: [missingPriceClause, originalClause],
    },
  });

  const missingOriginalGeubyeo = await prisma.drug.count({
    where: {
      AND: [missingPriceClause, originalClause, { reimbursement: '급여' }],
    },
  });

  const missingOriginalBigeubyeo = await prisma.drug.count({
    where: {
      AND: [missingPriceClause, originalClause, { reimbursement: '비급여' }],
    },
  });

  const sampleMissingOriginal = await prisma.drug.findMany({
    where: {
      AND: [missingPriceClause, originalClause],
    },
    select: {
      productName: true,
      company: true,
      reimbursement: true,
      standardCode: true,
      insuranceCode: true,
      priceLabel: true,
    },
    take: 30,
    orderBy: { updatedAt: 'asc' },
  });

  console.log(
    JSON.stringify(
      {
        totalOriginal,
        missingOriginal,
        missingOriginalGeubyeo,
        missingOriginalBigeubyeo,
        sampleMissingOriginal,
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
