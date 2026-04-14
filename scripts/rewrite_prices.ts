import fs from 'fs/promises';
import path from 'path';
import iconv from 'iconv-lite';

export type DrugPriceRow = {
  productCode: string;
  ceilingPrice: string;
  raw: Record<string, string>;
};

export type DrugPriceData = {
  price: string;
  ingredient: string;
}

let cache: Map<string, DrugPriceData> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 10;

export function parseCsvLine(line: string) {
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

// Just safely decode EUC-KR directly since government CSVs are Euc-Kr
async function readCsvText(filePath: string) {
  const raw = await fs.readFile(filePath);
  return iconv.decode(raw, 'euc-kr');
}

export async function loadDrugPrices(): Promise<Map<string, string>> {
  // Backwards compatibility layer for those only wanting price string
  const richMap = await loadRichDrugPrices();
  const priceMap = new Map<string, string>();
  for (const [key, val] of richMap.entries()) {
    priceMap.set(key, val.price);
  }
  return priceMap;
}

export async function loadRichDrugPrices(): Promise<Map<string, DrugPriceData>> {
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
    const safeProductCodeIdx = headers.findIndex(h => h.includes('제품코드')) > -1 ? headers.findIndex(h => h.includes('제품코드')) : 8;
    const safePriceIdx = headers.findIndex(h => h.includes('상한금액')) > -1 ? headers.findIndex(h => h.includes('상한금액')) : 13;
    const safeIngrIdx = headers.findIndex(h => h.includes('주성분명')) > -1 ? headers.findIndex(h => h.includes('주성분명')) : 7;

    const richMap = new Map<string, DrugPriceData>();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < Math.max(safeProductCodeIdx, safePriceIdx) + 1) continue;

      const productCode = (cols[safeProductCodeIdx] || '').trim();
      let price = (cols[safePriceIdx] || '').trim().replace(/[",\s]/g, '');
      let ingredient = (cols[safeIngrIdx] || '').trim();

      if (productCode && price) {
         richMap.set(productCode, { price, ingredient });
      }
    }

    cache = richMap;
    cachedAt = now;
    return richMap;
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

export async function searchProductsByIngredient(keyword: string): Promise<string[]> {
  const filePath = process.env.DRUG_PRICES_CSV_PATH || path.join(process.cwd(), 'data', 'drug_prices.csv');
  try {
    const text = await readCsvText(filePath);
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]);
    const nameIdx = headers.findIndex(h => h.includes('제품명'));
    const ingrIdx = headers.findIndex(h => h.includes('주성분명'));
    const productNames = new Set<string>();

    const safeNameIdx = nameIdx > -1 ? nameIdx : 9;
    const safeIngrIdx = ingrIdx > -1 ? ingrIdx : 7;

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length <= Math.max(safeNameIdx, safeIngrIdx)) continue;
      
      const pName = (cols[safeNameIdx] || '').trim();
      const iName = (cols[safeIngrIdx] || '').trim();
      
      if (pName.includes(keyword) || iName.includes(keyword)) {
         const basePName = pName.split('(')[0].trim();
         if (basePName) {
            productNames.add(basePName);
         }
      }
      if (productNames.size >= 10) break;
    }
    return Array.from(productNames);
  } catch (err) {
    return [];
  }
}
