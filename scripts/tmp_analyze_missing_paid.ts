import { PrismaClient } from '@prisma/client';
import { loadRichDrugPrices } from '../src/lib/drugPricesCsv';

const prisma = new PrismaClient();

function toDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function toProductCode(value: string | null | undefined) {
  const digits = toDigits(value);
  if (!digits) return '';
  if (digits.length === 9) return digits;
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(3, 12);
  return '';
}

async function main() {
  const csv = await loadRichDrugPrices();

  const missingPaid = await prisma.drug.findMany({
    where: {
      reimbursement: { contains: '급여' },
      OR: [{ priceLabel: null }, { priceLabel: '' }, { priceLabel: { contains: '가격정보없음' } }],
    },
    select: {
      id: true,
      productName: true,
      standardCode: true,
      insuranceCode: true,
      reimbursement: true,
      company: true,
      atcCode: true,
    },
    take: 200000,
  });

  let csvHit = 0;
  let withInsuranceCode = 0;
  let withStandardCode = 0;
  let withProductCode = 0;

  const sampleCsvMiss: Array<{ productName: string; company: string | null; standardCode: string | null; insuranceCode: string | null; atcCode: string | null }> = [];

  for (const row of missingPaid) {
    if (row.insuranceCode) withInsuranceCode += 1;
    if (row.standardCode) withStandardCode += 1;
    const productCode = toProductCode(row.standardCode) || toProductCode(row.insuranceCode);
    if (productCode) withProductCode += 1;

    const lookupCodes = [
      row.standardCode || '',
      row.insuranceCode || '',
      toDigits(row.standardCode),
      toDigits(row.insuranceCode),
      toProductCode(row.standardCode),
      toProductCode(row.insuranceCode),
    ].filter(Boolean);

    const matched = lookupCodes.some((code) => csv.has(code));
    if (matched) {
      csvHit += 1;
    } else if (sampleCsvMiss.length < 30) {
      sampleCsvMiss.push({
        productName: row.productName,
        company: row.company,
        standardCode: row.standardCode,
        insuranceCode: row.insuranceCode,
        atcCode: row.atcCode,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        totalMissingPaid: missingPaid.length,
        withInsuranceCode,
        withStandardCode,
        withDerivedProductCode: withProductCode,
        csvHit,
        csvHitPct: missingPaid.length > 0 ? Number(((csvHit / missingPaid.length) * 100).toFixed(2)) : 0,
        sampleCsvMiss,
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
