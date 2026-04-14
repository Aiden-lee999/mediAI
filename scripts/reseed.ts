import { PrismaClient } from '@prisma/client';
import { loadDrugMasterRows } from '../src/lib/drugMasterCsv';
import { loadDrugPrices } from '../src/lib/drugPricesCsv';

const prisma = new PrismaClient();

function parseUsageFromRow(row: { raw: Record<string, string> }) {
  const keys = [
    'useCnt',
    'prescriptCnt',
    'usage',
    'freq',
    '건수',
    '처방건수',
    '사용량',
  ];

  for (const key of keys) {
    const value = row.raw?.[key];
    if (!value) continue;
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return 0;
}

async function reseed() {
  console.log('Starting DB Reseed...');
  
  console.log('1. Clearing existing Drug table...');
  await prisma.drug.deleteMany({});
  console.log('Cleared!');

  console.log('2. Loading prices...');
  const priceMap = await loadDrugPrices();
  console.log(`Loaded ${priceMap.size} prices.`);

  console.log('3. Loading drug master rows...');
  const rows = await loadDrugMasterRows();
  console.log(`Loaded ${rows.length} master rows.`);

  console.log('4. Inserting into DB...');
  const BATCH_SIZE = 1000;
  
  // We need to ensure we don't have duplicate standardCode within the insert
  const seenStdCode = new Set<string>();
  const toInsert = [];

  for (const row of rows) {
    let standardCode = row.standardCode || null;
    
    // Some basic deductions
    let priceLabel = row.unitPrice;
    if (!priceLabel && standardCode && standardCode.startsWith('880') && standardCode.length >= 12) {
      const productCode = standardCode.substring(3, 12);
      priceLabel = priceMap.get(productCode) || '';
    }
    
    if (standardCode && seenStdCode.has(standardCode)) {
       standardCode = null; // don't use unique if duplicate
    }
    if (standardCode) {
       seenStdCode.add(standardCode);
    }
    
    const usageFrequency = parseUsageFromRow(row);

    toInsert.push({
      productName: row.productName,
      ingredientName: row.ingredientText || row.ingredientCode || '-',
      company: row.company || '-',
      standardCode: standardCode,
      atcCode: row.atcCode || null,
      priceLabel: priceLabel ? `${priceLabel}` : null,
      reimbursement: row.coverageType || (priceLabel ? '급여' : '비급여'),
      type: row.otcType || null,
      releaseDate: row.raw['품목허가일자'] || null,
      usageFrequency,
      rawJson: JSON.stringify(row.raw)
    });
  }

  let count = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await prisma.drug.createMany({
      data: batch,
      skipDuplicates: true
    });
    count += batch.length;
    console.log(`Inserted ${count}/${toInsert.length}...`);
  }

  console.log('Done reseeding!');
}

reseed()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
