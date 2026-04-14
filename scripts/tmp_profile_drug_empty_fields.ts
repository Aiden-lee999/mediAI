import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countMissingString(field: 'ingredientName' | 'company' | 'standardCode' | 'insuranceCode' | 'atcCode' | 'priceLabel' | 'reimbursement' | 'type' | 'releaseDate' | 'rawJson') {
  return prisma.drug.count({
    where: {
      OR: [{ [field]: null }, { [field]: '' }],
    },
  });
}

async function main() {
  const total = await prisma.drug.count();

  const ingredientNameMissing = await countMissingString('ingredientName');
  const companyMissing = await countMissingString('company');
  const standardCodeMissing = await countMissingString('standardCode');
  const insuranceCodeMissing = await countMissingString('insuranceCode');
  const atcCodeMissing = await countMissingString('atcCode');
  const priceLabelMissing = await countMissingString('priceLabel');
  const reimbursementMissing = await countMissingString('reimbursement');
  const typeMissing = await countMissingString('type');
  const releaseDateMissing = await countMissingString('releaseDate');
  const rawJsonMissing = await countMissingString('rawJson');

  const usageZero = await prisma.drug.count({ where: { usageFrequency: 0 } });

  console.log(
    JSON.stringify(
      {
        total,
        missing: {
          ingredientName: ingredientNameMissing,
          company: companyMissing,
          standardCode: standardCodeMissing,
          insuranceCode: insuranceCodeMissing,
          atcCode: atcCodeMissing,
          priceLabel: priceLabelMissing,
          reimbursement: reimbursementMissing,
          type: typeMissing,
          releaseDate: releaseDateMissing,
          rawJson: rawJsonMissing,
          usageFrequencyZero: usageZero,
        },
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
