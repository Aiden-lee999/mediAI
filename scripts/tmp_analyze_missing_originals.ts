import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크', '아토르바스타틴'];

async function main() {
  const missingWhere = {
    OR: [{ priceLabel: null }, { priceLabel: '' }, { priceLabel: { contains: '가격정보없음' } }],
  } as const;

  const totalMissing = await prisma.drug.count({ where: missingWhere });

  const missingOriginalCompany = await prisma.drug.count({
    where: {
      ...missingWhere,
      OR: originalMakers.map((maker) => ({ company: { contains: maker } })),
    },
  });

  const missingOriginalName = await prisma.drug.count({
    where: {
      ...missingWhere,
      OR: originalNames.map((name) => ({ productName: { contains: name } })),
    },
  });

  const sampleMissingOriginals = await prisma.drug.findMany({
    where: {
      ...missingWhere,
      OR: [
        ...originalMakers.map((maker) => ({ company: { contains: maker } })),
        ...originalNames.map((name) => ({ productName: { contains: name } })),
      ],
    },
    select: {
      productName: true,
      company: true,
      reimbursement: true,
      standardCode: true,
      insuranceCode: true,
      atcCode: true,
      releaseDate: true,
    },
    take: 40,
    orderBy: { updatedAt: 'asc' },
  });

  const missingOriginalsReimbursement = await prisma.drug.groupBy({
    by: ['reimbursement'],
    where: {
      ...missingWhere,
      OR: [
        ...originalMakers.map((maker) => ({ company: { contains: maker } })),
        ...originalNames.map((name) => ({ productName: { contains: name } })),
      ],
    },
    _count: { reimbursement: true },
    orderBy: { _count: { reimbursement: 'desc' } },
  });

  console.log(
    JSON.stringify(
      {
        totalMissing,
        missingOriginalCompany,
        missingOriginalName,
        missingOriginalsReimbursement,
        sampleMissingOriginals,
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
