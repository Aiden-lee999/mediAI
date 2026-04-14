import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const insuranceTargets = await prisma.drug.count({
    where: {
      OR: [{ insuranceCode: null }, { insuranceCode: '' }],
    },
  });

  const insuranceUpdated = await prisma.$executeRawUnsafe(`
    UPDATE "Drug"
    SET "insuranceCode" = COALESCE(NULLIF("insuranceCode", ''), "standardCode", '-')
    WHERE "insuranceCode" IS NULL OR "insuranceCode" = ''
  `);

  const atcUpdated = await prisma.drug.updateMany({
    where: { OR: [{ atcCode: null }, { atcCode: '' }] },
    data: { atcCode: '-' },
  });

  const typeUpdated = await prisma.drug.updateMany({
    where: { OR: [{ type: null }, { type: '' }] },
    data: { type: '-' },
  });

  const releaseDateUpdated = await prisma.drug.updateMany({
    where: { OR: [{ releaseDate: null }, { releaseDate: '' }] },
    data: { releaseDate: '-' },
  });

  console.log(
    JSON.stringify(
      {
        insuranceTargets,
        insuranceUpdated,
        atcUpdated: atcUpdated.count,
        typeUpdated: typeUpdated.count,
        releaseDateUpdated: releaseDateUpdated.count,
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
