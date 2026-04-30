import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function digits(value: string) {
  return (value || '').replace(/\D/g, '');
}

function normalizePrice(value: string) {
  return (value || '').replace(/[",\s]/g, '');
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: tsx scripts/verify_attached_price_csv_coverage.ts <csvPath>');

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV is empty');

  const headers = parseCsvLine(lines[0]);
  const codeIdx = headers.findIndex((h) => h.includes('제품코드') || h.includes('표준코드') || h.includes('품목기준코드'));
  const priceIdx = headers.findIndex((h) => h.includes('상한금액') || h.includes('금액') || h.includes('약가'));

  if (codeIdx < 0 || priceIdx < 0) {
    throw new Error(`Could not locate code/price columns. headers=${headers.join('|')}`);
  }

  const csvCodesWithPrice = new Set<string>();
  let csvRows = 0;
  let csvPriceRows = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    csvRows += 1;
    const code = digits(cols[codeIdx] || '');
    const price = normalizePrice(cols[priceIdx] || '');
    if (!code) continue;
    if (!price) continue;
    csvPriceRows += 1;
    csvCodesWithPrice.add(code);
  }

  const codeList = Array.from(csvCodesWithPrice);
  const chunks = chunk(codeList, 500);

  let dbRowsByCode = 0;
  let dbRowsWithNumericPrice = 0;

  for (const codes of chunks) {
    const rows = await prisma.drug.findMany({
      where: {
        standardCode: { in: codes },
      },
      select: {
        id: true,
        priceLabel: true,
      },
    });

    dbRowsByCode += rows.length;
    for (const row of rows) {
      if (/\d/.test((row.priceLabel || '').replace(/,/g, '')) && !(row.priceLabel || '').includes('가격정보없음')) {
        dbRowsWithNumericPrice += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        filePath,
        csvRows,
        csvPriceRows,
        csvUniqueCodesWithPrice: codeList.length,
        dbMatchedRowsByStandardCode: dbRowsByCode,
        dbMatchedRowsWithNumericPrice: dbRowsWithNumericPrice,
        dbCodeMatchRate: codeList.length ? Number((dbRowsByCode / codeList.length).toFixed(4)) : 0,
        dbPriceFillRateWithinMatched: dbRowsByCode
          ? Number((dbRowsWithNumericPrice / dbRowsByCode).toFixed(4))
          : 0,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
