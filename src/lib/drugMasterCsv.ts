import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import readline from 'readline';

export type DrugMasterRow = {
  productName: string;
  ingredientText: string;
  ingredientCode: string;
  company: string;
  spec: string;
  unitPrice: string;
  coverageType: string;
  otcType: string;
  standardCode: string;
  atcCode: string;
  raw: Record<string, string>;
};

let cache: DrugMasterRow[] | null = null;
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


async function readCsvText(filePath: string) {
  const fsPromises = await import('fs/promises');
  const raw = await fsPromises.default.readFile(filePath);
  return await import('iconv-lite').then(iconv => iconv.default.decode(raw, 'euc-kr'));
}

export function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function normHeader(header: string) {
  return header.replace(/\s+/g, '').toLowerCase();
}

export function findHeaderByPatterns(headers: string[], patterns: string[]) {
  const normalized = headers.map((header) => ({
    original: header,
    normalized: normHeader(header),
  }));

  const found = normalized.find((entry) =>
    patterns.some((pattern) => entry.normalized.includes(pattern))
  );

  return found?.original;
}

export async function loadDrugMasterRows() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_TTL_MS) {
    return cache;
  }

  const filePath = process.env.DRUG_MASTER_CSV_PATH || path.join(process.cwd(), 'data', 'drug_master_codes.csv');
  const text = await readCsvText(filePath);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    cache = [];
    cachedAt = now;
    return cache;
  }

  const headers = parseCsvLine(lines[0]);
  const productHeader = findHeaderByPatterns(headers, ['제품명', '상품명', '품명', '의약품명', 'itemname', 'product']);
  const companyHeader = findHeaderByPatterns(headers, ['업체명', '제약사', '회사명', 'entp', 'company']);
  const ingredientHeader = findHeaderByPatterns(headers, ['성분', '주성분', '원료', '일반명', 'ingredient', 'ingr']);
  const ingredientCodeHeader = findHeaderByPatterns(headers, ['일반명코드', '성분명코드', 'ingrcode', 'cmpn']);
  const specHeader = findHeaderByPatterns(headers, ['규격', '함량', '제형', 'spec']);
  const priceHeader = findHeaderByPatterns(headers, ['약가', '상한금액', '금액', '단가', 'price', 'amt']);
  const coverageHeader = findHeaderByPatterns(headers, ['급여', '비급여', '보험구분', '급여구분', 'pay']);
  const otcTypeHeader = findHeaderByPatterns(headers, ['전문일반구분', '전문일반', '전문', '일반']);
  const standardCodeHeader = findHeaderByPatterns(headers, ['표준코드', '보험코드', 'stdcode', 'edi']);
  const atcHeader = findHeaderByPatterns(headers, ['atc코드', 'atccode', '표준분류코드(atc코드)', '표준분류코드']);
  const rows: DrugMasterRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0) continue;

    const raw: Record<string, string> = {};
    headers.forEach((header, idx) => {
      raw[header] = cols[idx] || '';
    });

    const productName = pick(raw, [productHeader || '', '제품명', '품명', '의약품명', headers[0]]);
    const company = pick(raw, [companyHeader || '', '업체명', '제약사', headers[1]]);
    const ingredientText = pick(raw, [ingredientHeader || '', '성분명', '주성분명', '주성분']);
    const ingredientCode = pick(raw, [ingredientCodeHeader || '', '일반명코드(성분명코드)', '성분코드']);
    const spec = pick(raw, [specHeader || '', '규격', '함량', '제형']);
    const unitPrice = pick(raw, [priceHeader || '', '약가', '상한금액', '금액', '단가']);
    const coverageType = pick(raw, [coverageHeader || '', '급여구분', '보험구분']);
    const otcType = pick(raw, [otcTypeHeader || '', '전문일반구분']);
    const standardCode = pick(raw, [standardCodeHeader || '', '표준코드', '표준 코드', '보험코드']);
    const atcCode = pick(raw, [atcHeader || '', 'ATC코드', 'ATC 코드', '표준분류코드(ATC코드)']);

    if (!productName && !company && !standardCode) continue;

    rows.push({
      productName,
      ingredientText,
      ingredientCode,
      company,
      spec,
      unitPrice,
      coverageType,
      otcType,
      standardCode,
      atcCode,
      raw,
    });
  }

  cache = rows;
  cachedAt = now;
  return rows;
}

export async function searchDrugMasterRows(filters: {
  productName?: string;
  ingredientName?: string;
  company?: string;
  limit?: number;
}) {
  const p = (filters.productName || '').trim().toLowerCase();
  const c = (filters.company || '').trim().toLowerCase();
  const i = (filters.ingredientName || '').trim().toLowerCase();
  const ingredientFallback = i || p;
  const limit = filters.limit ?? 100;

  const hasSearchKeyword = Boolean(p || c || i);
  if (hasSearchKeyword) {
    const filePath = process.env.DRUG_MASTER_CSV_PATH || path.join(process.cwd(), 'data', 'drug_master_codes.csv');
    const streamed = await searchDrugMasterRowsByStream(filePath, { p, c, ingredientFallback, limit });
    if (streamed.length > 0) return streamed;
  }

  const rows = await loadDrugMasterRows();

  const matched = rows.filter((row) => {
    const productOk =
      !p ||
      row.productName.toLowerCase().includes(p) ||
      row.ingredientText.toLowerCase().includes(p) ||
      JSON.stringify(row.raw).toLowerCase().includes(p);
    const companyOk = !c || row.company.toLowerCase().includes(c);
    const ingredientOk =
      !ingredientFallback ||
      row.ingredientText.toLowerCase().includes(ingredientFallback) ||
      JSON.stringify(row.raw).toLowerCase().includes(ingredientFallback);
    return productOk && companyOk && ingredientOk;
  });

  if (matched.length > 0 || !ingredientFallback) {
    return matched.slice(0, limit);
  }

  // 최종 fallback: 파싱된 헤더 매칭에 실패해도 원본 CSV 라인에서 키워드 직접 탐색
  const filePath = process.env.DRUG_MASTER_CSV_PATH || path.join(process.cwd(), 'data', 'drug_master_codes.csv');
  const text = await readCsvText(filePath);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const fallbackRows: DrugMasterRow[] = [];

  for (let idx = 1; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const lower = line.toLowerCase();
    if (!lower.includes(ingredientFallback)) continue;

    const cols = parseCsvLine(line);
    const productName = (cols[0] || '').trim();
    const company = (cols[1] || '').trim();
    const spec = (cols[2] || '').trim();
    const classText = (cols[8] || '').trim();
    const standardCode = (cols[10] || '').trim() || (cols[9] || '').trim();
    const ingredientCode = (cols[12] || '').trim();
    const atcCode = (cols[19] || '').trim();

    if (c && !company.toLowerCase().includes(c)) continue;

    fallbackRows.push({
      productName,
      ingredientText: line,
      ingredientCode,
      company,
      spec,
      unitPrice: '',
      coverageType: '',
      otcType: classText,
      standardCode,
      atcCode,
      raw: {
        한글상품명: productName,
        업체명: company,
        약품규격: spec,
        약품구분: classText,
        표준코드: standardCode,
        ATC코드: atcCode,
      },
    });

    if (fallbackRows.length >= limit) break;
  }

  return fallbackRows;
}

async function searchDrugMasterRowsByStream(
  filePath: string,
  params: { p: string; c: string; ingredientFallback: string; limit: number }
) {
  const stream = createReadStream(filePath).pipe(iconv.decodeStream('euc-kr'));
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const out: DrugMasterRow[] = [];
  let headers: string[] = [];
  let productHeader = '';
  let companyHeader = '';
  let ingredientHeader = '';
  let ingredientCodeHeader = '';
  let specHeader = '';
  let priceHeader = '';
  let coverageHeader = '';
  let otcTypeHeader = '';
  let standardCodeHeader = '';
  let atcHeader = '';

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (headers.length === 0) {
      headers = parseCsvLine(line);
      productHeader = findHeaderByPatterns(headers, ['제품명', '상품명', '품명', '의약품명', 'itemname', 'product']) || '';
      companyHeader = findHeaderByPatterns(headers, ['업체명', '제약사', '회사명', 'entp', 'company']) || '';
      ingredientHeader = findHeaderByPatterns(headers, ['성분', '주성분', '원료', '일반명', 'ingredient', 'ingr']) || '';
      ingredientCodeHeader = findHeaderByPatterns(headers, ['일반명코드', '성분명코드', 'ingrcode', 'cmpn']) || '';
      specHeader = findHeaderByPatterns(headers, ['규격', '함량', '제형', 'spec']) || '';
      priceHeader = findHeaderByPatterns(headers, ['약가', '상한금액', '금액', '단가', 'price', 'amt']) || '';
      coverageHeader = findHeaderByPatterns(headers, ['급여', '비급여', '보험구분', '급여구분', 'pay']) || '';
      otcTypeHeader = findHeaderByPatterns(headers, ['전문일반구분', '전문일반', '전문', '일반']) || '';
      standardCodeHeader = findHeaderByPatterns(headers, ['표준코드', '보험코드', 'stdcode', 'edi']) || '';
      atcHeader = findHeaderByPatterns(headers, ['atc코드', 'atccode', '표준분류코드(atc코드)', '표준분류코드']) || '';
      continue;
    }

    const cols = parseCsvLine(line);
    if (!cols.length) continue;

    const raw: Record<string, string> = {};
    headers.forEach((header, idx) => {
      raw[header] = cols[idx] || '';
    });

    const productName = pick(raw, [productHeader, '제품명', '상품명', '품명', '의약품명', headers[0]].filter(Boolean));
    const company = pick(raw, [companyHeader, '업체명', '제약사', headers[1]].filter(Boolean));
    const ingredientText = pick(raw, [ingredientHeader, '성분명', '주성분명', '주성분'].filter(Boolean));
    const ingredientCode = pick(raw, [ingredientCodeHeader, '일반명코드(성분명코드)', '성분코드'].filter(Boolean));
    const spec = pick(raw, [specHeader, '규격', '함량', '제형'].filter(Boolean));
    const unitPrice = pick(raw, [priceHeader, '약가', '상한금액', '금액', '단가'].filter(Boolean));
    const coverageType = pick(raw, [coverageHeader, '급여구분', '보험구분'].filter(Boolean));
    const otcType = pick(raw, [otcTypeHeader, '전문일반구분'].filter(Boolean));
    const standardCode = pick(raw, [standardCodeHeader, '표준코드', '표준 코드', '보험코드'].filter(Boolean));
    const atcCode = pick(raw, [atcHeader, 'ATC코드', 'ATC 코드', '표준분류코드(ATC코드)'].filter(Boolean));

    const lowerRaw = JSON.stringify(raw).toLowerCase();
    const productOk = !params.p || productName.toLowerCase().includes(params.p) || ingredientText.toLowerCase().includes(params.p) || lowerRaw.includes(params.p);
    const companyOk = !params.c || company.toLowerCase().includes(params.c);
    const ingredientOk = !params.ingredientFallback || ingredientText.toLowerCase().includes(params.ingredientFallback) || lowerRaw.includes(params.ingredientFallback);
    if (!productOk || !companyOk || !ingredientOk) continue;

    out.push({
      productName,
      ingredientText: ingredientText || line,
      ingredientCode,
      company,
      spec,
      unitPrice,
      coverageType,
      otcType,
      standardCode,
      atcCode,
      raw,
    });

    if (out.length >= params.limit) {
      rl.close();
      break;
    }
  }

  return out;
}
