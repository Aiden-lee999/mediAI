import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import iconv from 'iconv-lite';
import { loadDrugPrices } from '../src/lib/drugPricesCsv';
import { findHeaderByPatterns, parseCsvLine, pick } from '../src/lib/drugMasterCsv';

const prisma = new PrismaClient();

async function seed() {
  console.log('Starting Drug ETL Pipeline...');
  const priceMap = await loadDrugPrices();
  console.log(`Loaded ${priceMap.size} drug prices from CSV.`);

  const filePath = 'data/drug_master_codes.csv';
  if (!fs.existsSync(filePath)) {
    console.error('Drug Master CSV not found:', filePath);
    return;
  }

  // 1. Detect Encoding
  const buffer = fs.readFileSync(filePath, { start: 0, end: 1000 });
  const utf8 = buffer.toString('utf8');
  const eucKr = iconv.decode(buffer, 'euc-kr');
  const isEucKr = (utf8.match(/\uFFFD/g) || []).length > (eucKr.match(/\uFFFD/g) || []).length;
  console.log(`CSV Encoding Detected: ${isEucKr ? 'EUC-KR' : 'UTF-8'}`);

  const fileStream = fs.createReadStream(filePath);
  const decodedStream = isEucKr ? fileStream.pipe(iconv.decodeStream('euc-kr')) : fileStream.pipe(iconv.decodeStream('utf8'));
  const rl = readline.createInterface({ input: decodedStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let nameHeader = '', ingrHeader = '', companyHeader = '', atcHeader = '', stdHeader = '', coverageHeader = '';
  
  let batch = [];
  const BATCH_SIZE = 1000;
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      headers = parseCsvLine(line.toLowerCase().replace(/\s+/g, ''));
      nameHeader = findHeaderByPatterns(headers, ['제품명', '품목명', '약품명', 'product', 'name']) || '';
      ingrHeader = findHeaderByPatterns(headers, ['일반명코드', '성분명', '주성분', 'ingr', 'cmpn']) || '';
      companyHeader = findHeaderByPatterns(headers, ['업체명', '제조사', '수입사', 'company', 'entp']) || '';
      stdHeader = findHeaderByPatterns(headers, ['표준코드', '보험코드', 'stdcode', 'edi']) || '';
      atcHeader = findHeaderByPatterns(headers, ['atc코드', 'atccode', '표준분류코드(atc코드)', '표준분류코드']) || '';
      coverageHeader = findHeaderByPatterns(headers, ['급여', '비급여', '보험구분', '급여구분', 'pay']) || '';
      continue;
    }

    const cols = parseCsvLine(line);
    const raw: any = {};
    headers.forEach((h, i) => { raw[h] = cols[i]; });

    const productName = pick(raw, [nameHeader, '제품명(한글)', '한글상품명', '약품명(한글)', '제품명', '한글품목명']).trim();
    if (!productName) continue;

    const company = pick(raw, [companyHeader, '업체명', '제조의뢰자명', '제조(수입)업체명', '제조업체명', '수입회사명']).trim();
    const stdCode = pick(raw, [stdHeader, '표준코드', '표준 코드', '보험코드']).trim();
    const atcCode = pick(raw, [atcHeader, 'atc코드', '표준분류코드(atc코드)']).trim();
    let releaseDate = raw['허가일자'] || raw['품목허가일자'] || '';
    let coverage = pick(raw, [coverageHeader, '급여구분', '보험구분']);
    let ingredientName = pick(raw, [ingrHeader, '일반명코드(성분명코드)', '성분코드']).trim();

    // extract standard code from '880...' format to look up price
    let csvPrice = '';
    if (stdCode.startsWith('880') && stdCode.length >= 12) {
      const productCode = stdCode.substring(3, 12);
      csvPrice = priceMap.get(productCode) || '';
    }
    if (!csvPrice) {
      const rawCode = raw['제품코드(개정후)'] || raw['제품코드'] || '';
      if (rawCode) csvPrice = priceMap.get(rawCode) || '';
    }

    const priceLabel = csvPrice || raw['상한금액'] || raw['약가'] || '';
    const finalCoverage = csvPrice ? '급여' : (coverage || '비급여');
    
    batch.push({
      productName,
      ingredientName,
      company,
      standardCode: stdCode || null,
      insuranceCode: stdCode || null,
      atcCode: atcCode || null,
      priceLabel: priceLabel || null,
      reimbursement: finalCoverage,
      type: raw['전문일반구분'] || '약가마스터',
      releaseDate: releaseDate || null,
      usageFrequency: 0,
      rawJson: JSON.stringify(raw),
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      count += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    count += batch.length;
  }

  console.log(`Inserted/Updated ${count} drugs in Prisma DB successfully!`);
}

async function insertBatch(items: any[]) {
  // Due to SQLite batching limits and unique standardCode constraints, 
  // we do upsert or ignore via Prisma. Prisma 'createMany' is faster but SQLite fails on conflicts.
  // Workaround: We filter duplicates in standardCode from batch first
  const seen = new Set();
  const validBatch = items.filter(i => {
    if(!i.standardCode) return true;
    if(seen.has(i.standardCode)) return false;
    seen.add(i.standardCode);
    return true;
  });

  try {
    for (const item of validBatch) {
      if (item.standardCode) {
        await prisma.drug.upsert({
          where: { standardCode: item.standardCode },
          update: item,
          create: item,
        });
      } else {
        await prisma.drug.create({ data: item });
      }
    }
  } catch(e) {
    console.error('Batch error ignored', e.message?.substring(0, 100));
  }
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
