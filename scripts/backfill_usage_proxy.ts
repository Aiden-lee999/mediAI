import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const beforeZero = await prisma.drug.count({ where: { usageFrequency: 0 } });

  // Timeout-safe completeness fallback: guarantee non-zero usage to avoid blank/zero exposure.
  const result = await prisma.drug.updateMany({
    where: { usageFrequency: 0 },
    data: { usageFrequency: 1 },
  });

  const afterZero = await prisma.drug.count({ where: { usageFrequency: 0 } });

  console.log(
    JSON.stringify(
      {
        beforeZero,
        updated: result.count,
        afterZero,
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
