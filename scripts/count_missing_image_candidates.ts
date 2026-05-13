import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function digits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

async function main() {
  const rows = await prisma.drug.findMany({
    select: {
      standardCode: true,
      insuranceCode: true,
    },
  });

  let withImageCode = 0;
  let withoutImageCode = 0;

  for (const row of rows) {
    const s = digits(row.standardCode);
    const i = digits(row.insuranceCode);
    const hasImageCode = s.length >= 9 || i.length >= 9;
    if (hasImageCode) withImageCode += 1;
    else withoutImageCode += 1;
  }

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        withImageCode,
        withoutImageCode,
      },
      null,
      2,
    ),
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
