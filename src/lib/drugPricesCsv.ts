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
  productName?: string;
}

function codeAliases(rawCode: string) {
  const raw = (rawCode || '').trim();
  const digits = raw.replace(/\D/g, '');
  const aliases = new Set<string>();

  if (raw) aliases.add(raw);
  if (digits) aliases.add(digits);

  // Common mapping used in this project: 13-digit barcode with 880 prefix -> 9-digit product code
  if (digits.length === 13 && digits.startsWith('880')) {
    aliases.add(digits.slice(3, 12));
  }

  // Some product codes include a trailing checksum-like digit.
  if (digits.length === 10) {
    aliases.add(digits.slice(0, 9));
    aliases.add(digits.slice(1));
  }

  if (digits.length === 13) {
    aliases.add(digits.slice(0, 9));
  }

  if (digits.length > 9) {
    aliases.add(digits.slice(-9));
  }

  if (digits.length > 0 && digits.length < 9) {
    aliases.add(digits.padStart(9, '0'));
  }

  return [...aliases].filter(Boolean);
}

let cache: Map<string, DrugPriceData> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 10;

let ingredientCodeCache: Map<string, string> | null = null;
let standardCodeIngredientCache: Map<string, string> | null = null;
let ingredientCodeCachedAt = 0;

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

// Automatically detect and decode appropriately
async function readCsvText(filePath: string) {
  const raw = await fs.readFile(filePath);
  const utf8Str = raw.toString('utf8');
  // if it decodes clearly into Korean (i.e. contains "제품코드", "약가" etc.) use utf8.
  if (utf8Str.includes('제품') || utf8Str.includes('코드') || utf8Str.includes('상한금액')) {
     return utf8Str;
  }
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
    const safeProductCodeIdx = headers.findIndex(h => h.includes('제품코드') || h.includes('표준코드')) > -1 ? headers.findIndex(h => h.includes('제품코드') || h.includes('표준코드')) : 8;
    const safePriceIdx = headers.findIndex(h => h.includes('상한금액') || h.includes('금액')) > -1 ? headers.findIndex(h => h.includes('상한금액') || h.includes('금액')) : 13;
    const safeIngrIdx = headers.findIndex(h => h.includes('주성분명') || h.includes('성분')) > -1 ? headers.findIndex(h => h.includes('주성분명') || h.includes('성분')) : 7;
    const safeNameIdx = headers.findIndex(h => h.includes('제품명')) > -1 ? headers.findIndex(h => h.includes('제품명')) : 9;

    const richMap = new Map<string, DrugPriceData>();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < Math.max(safeProductCodeIdx, safePriceIdx) + 1) continue;

      const productCode = (cols[safeProductCodeIdx] || '').trim();
      let price = (cols[safePriceIdx] || '').trim().replace(/[",\s]/g, '');
      let ingredient = (cols[safeIngrIdx] || '').trim();
      const productName = (cols[safeNameIdx] || '').trim();

      if (productCode && price) {
         const data: DrugPriceData = { price, ingredient, productName };
         for (const alias of codeAliases(productCode)) {
           if (!richMap.has(alias)) {
             richMap.set(alias, data);
           }
         }
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

function extractIngredientFromProductName(productName: string) {
  const match = productName.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || '';
}

export async function loadIngredientCodeMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (ingredientCodeCache && now - ingredientCodeCachedAt < CACHE_TTL_MS) {
    return ingredientCodeCache;
  }

  const filePath = process.env.DRUG_MASTER_CODES_CSV_PATH || path.join(process.cwd(), 'data', 'drug_master_codes.csv');

  try {
    const text = await readCsvText(filePath);
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      ingredientCodeCache = new Map();
      ingredientCodeCachedAt = now;
      return ingredientCodeCache;
    }

    const headers = parseCsvLine(lines[0]);
    const nameIdx = headers.findIndex((h) => h.includes('한글상품명'));
    const ingredientCodeIdx = headers.findIndex((h) => h.includes('일반명코드'));
    const standardCodeIdx = headers.findIndex((h) => h.includes('표준코드'));

    const safeNameIdx = nameIdx > -1 ? nameIdx : 0;
    const safeIngredientCodeIdx = ingredientCodeIdx > -1 ? ingredientCodeIdx : 12;
    const safeStandardCodeIdx = standardCodeIdx > -1 ? standardCodeIdx : 10;
    const result = new Map<string, string>();
    const standardResult = new Map<string, string>();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length <= Math.max(safeNameIdx, safeIngredientCodeIdx)) continue;

      const ingredientCode = (cols[safeIngredientCodeIdx] || '').trim();
      const productName = (cols[safeNameIdx] || '').trim();
      const standardCode = (cols[safeStandardCodeIdx] || '').trim();
      const ingredient = extractIngredientFromProductName(productName);

      if (ingredientCode && ingredient && !result.has(ingredientCode)) {
        result.set(ingredientCode, ingredient);
      }

      if (standardCode && ingredient && !standardResult.has(standardCode)) {
        standardResult.set(standardCode, ingredient);
      }
    }

    ingredientCodeCache = result;
    standardCodeIngredientCache = standardResult;
    ingredientCodeCachedAt = now;
    return result;
  } catch (error) {
    console.error('Error loading ingredient code map:', error);
    ingredientCodeCache = new Map();
    standardCodeIngredientCache = new Map();
    ingredientCodeCachedAt = now;
    return ingredientCodeCache;
  }
}

export async function getIngredientNameByCode(code: string): Promise<string> {
  const map = await loadIngredientCodeMap();
  return map.get(code.trim()) || '';
}

export async function getIngredientNameByStandardCode(standardCode: string): Promise<string> {
  await loadIngredientCodeMap();
  return standardCodeIngredientCache?.get(standardCode.trim()) || '';
}

export async function searchProductsByIngredient(keyword: string): Promise<string[]> {
  try {
    const richMap = await loadRichDrugPrices();
    const productNames = new Set<string>();

    for (const data of richMap.values()) {
      const pName = (data.productName || '').trim();
      const iName = (data.ingredient || '').trim();

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
