import fs from 'fs/promises';
import path from 'path';
import iconv from 'iconv-lite';

export type DrugPriceRow = {
  productCode: string;
  ceilingPrice: string;
  raw: Record<string, string>;
};

let cache: Map<string, string> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 10;

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result;
}

function scoreCsvHeader(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const normalized = firstLine.replace(/\s+/g, '').toLowerCase();
  const mojibakePenalty = (firstLine.match(/[^a-z0-9가-힣]/g) || []).length;
  const keywordBonus = ['제품코드', '상한금액', '약가', '가격', '단가'].reduce(
    (acc, token) => (normalized.includes(token) ? acc + 2 : acc),
    0
  );

  return keywordBonus - mojibakePenalty;
}

async function readCsvText(filePath: string) {
  const raw = await fs.readFile(filePath);
  const utf8 = raw.toString('utf8');
  const eucKr = iconv.decode(raw, 'euc-kr');

  return scoreCsvHeader(eucKr) >= scoreCsvHeader(utf8) ? eucKr : utf8;
}

export async function loadDrugPrices(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_TTL_MS) {
    return cache;
  }

  const filePath = process.env.DRUG_PRICES_CSV_PATH || path.join(process.cwd(), 'data', 'drug_prices.csv');

  try {
    const text = await readCsvText(filePath);
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      cache = new Map();
      cachedAt = now;
      return cache;
    }

    const headers = parseCsvLine(lines[0]);
    // 제품코드는 9번째 (index 8), 상한금액은 14번째 (index 13)
    const productCodeIdx = headers.findIndex(h => h.includes('제품코드')) > -1 ? headers.findIndex(h => h.includes('제품코드')) : 8;
    const priceIdx = headers.findIndex(h => h.includes('상한금액')) > -1 ? headers.findIndex(h => h.includes('상한금액')) : 13;

    const priceMap = new Map<string, string>();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < Math.max(productCodeIdx, priceIdx) + 1) continue;

      const productCode = (cols[productCodeIdx] || '').trim();
      let price = (cols[priceIdx] || '').trim().replace(/[",\s]/g, '');

      if (productCode && price) {
        priceMap.set(productCode, price);
      }
    }

    cache = priceMap;
    cachedAt = now;
    return priceMap;
  } catch (error) {
    console.error('Error loading drug prices CSV:', error);
    cache = new Map();
    cachedAt = now;
    return cache;
  }
}

export async function getPriceByProductCode(productCode: string): Promise<string> {
  const priceMap = await loadDrugPrices();
  return priceMap.get(productCode) || '';
}
