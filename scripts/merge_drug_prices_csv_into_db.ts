import { PrismaClient } from '@prisma/client';
import { loadRichDrugPrices } from '../src/lib/drugPricesCsv';

const prisma = new PrismaClient();

type DrugRow = {
  id: string;
  standardCode: string | null;
  insuranceCode: string | null;
  priceLabel: string | null;
  reimbursement: string | null;
  ingredientName: string | null;
};

function digits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function toProductCode(value: string | null | undefined) {
  const d = digits(value);
  if (!d) return '';
  if (d.length === 9) return d;
  if (d.length === 13 && d.startsWith('880')) return d.slice(3, 12);
  return '';
}

function hasPrice(value: string | null | undefined) {
  const v = (value || '').trim();
  if (!v) return false;
  if (v.includes('가격정보없음')) return false;
  return /\d/.test(v);
}

function toWon(value: string) {
  const d = value.replace(/\D/g, '');
  return d ? `${d}원` : '';
}

async function main() {
  const csv = await loadRichDrugPrices();

  const rows: DrugRow[] = await prisma.drug.findMany({
    select: {
      id: true,
      standardCode: true,
      insuranceCode: true,
      priceLabel: true,
      reimbursement: true,
      ingredientName: true,
    },
  });

  let scanned = 0;
  let codeMatched = 0;
  let priceUpdated = 0;
  let ingredientUpdated = 0;
  let reimbursementUpdated = 0;

  const updates: Array<{ id: string; data: Record<string, string> }> = [];

  for (const row of rows) {
    scanned += 1;

    const lookupCodes = [
      row.standardCode || '',
      row.insuranceCode || '',
      digits(row.standardCode),
      digits(row.insuranceCode),
      toProductCode(row.standardCode),
      toProductCode(row.insuranceCode),
    ].filter(Boolean);

    const csvData = lookupCodes.map((c) => csv.get(c)).find(Boolean);
    if (!csvData) continue;

    codeMatched += 1;
    const patch: Record<string, string> = {};

    const newPrice = toWon(csvData.price || '');
    if (newPrice && !hasPrice(row.priceLabel)) {
      patch.priceLabel = newPrice;
      priceUpdated += 1;
    }

    const csvIngredient = (csvData.ingredient || '').trim();
    if (csvIngredient && !(row.ingredientName || '').trim()) {
      patch.ingredientName = csvIngredient;
      ingredientUpdated += 1;
    }

    if (newPrice && !(row.reimbursement || '').trim()) {
      patch.reimbursement = '급여';
      reimbursementUpdated += 1;
    }

    if (Object.keys(patch).length > 0) {
      updates.push({ id: row.id, data: patch });
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((u) => prisma.drug.update({ where: { id: u.id }, data: u.data })),
    );
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        csvRows: csv.size,
        codeMatched,
        updatedRows: updates.length,
        priceUpdated,
        ingredientUpdated,
        reimbursementUpdated,
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
