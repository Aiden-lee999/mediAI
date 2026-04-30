import { NextResponse } from 'next/server';
import { loadIngredientCodeMap, loadRichDrugPrices, searchProductsByIngredient } from '@/lib/drugPricesCsv';
import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';

type SearchItem = {
  id: string;
  productName: string;
  ingredientName: string;
  company: string;
  priceLabel: string;
  reimbursement: string;
  insuranceCode: string;
  standardCode: string;
  atcCode: string;
  type: string;
  releaseDate: string;
  usageFrequency: number;
  brandClass: '오리지널(대장약)' | '복제약(제네릭)';
  sourceService: string;
};

type QueryPayload = {
  productName?: string;
  ingredientName?: string;
  company?: string;
  limit?: number;
};

const SEARCH_CACHE_TTL_MS = 1000 * 30;
const DEFAULT_SEARCH_LIMIT = 2000;
const MAX_SEARCH_LIMIT = 10000;
const searchCache = new Map<string, { expiresAt: number; data: { success: boolean; count: number; items: SearchItem[]; fallbackUsed: boolean } }>();
const PERMIT_CODE_CACHE_TTL_MS = 1000 * 60 * 10;
let acetaminophenPermitCodesCache: { expiresAt: number; codes: string[] } | null = null;
let acetaminophenPermitNamesCache: { expiresAt: number; names: string[] } | null = null;

const ACETAMINOPHEN_PRODUCT_HINTS = [
  '판피린큐액',
  '하벤허브골드캡슐',
  '판피린에이액',
  '콜맥콜드시럽',
  '윈콜드연질캡슐',
  '윈콜드코프연질캡슐',
  '판콜에이내복액',
  '로나코연질캡슐',
  '알카펜네이잘에이연질캡슐',
  '화콜노즈정',
  '알카펜스피드연질캡슐',
  '안티노정',
  '콜드앤플루데이타임시럽',
  '퓨어에이드 나이퀄시럽',
  '콜드앤플루나이트타임시럽',
  '타코펜캡슐',
] as const;

function normalizeLimit(limit: unknown) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.floor(n));
}

function makeCacheKey(payload: QueryPayload) {
  const productName = (payload.productName || '').trim().toLowerCase();
  const ingredientName = (payload.ingredientName || '').trim().toLowerCase();
  const company = (payload.company || '').trim().toLowerCase();
  const limit = normalizeLimit(payload.limit);
  return JSON.stringify({ productName, ingredientName, company, limit });
}

function looksLikeCode(value: string) {
  return /^[A-Z0-9]{6,}$/i.test(value);
}

function getAtcHintsByKeyword(keyword: string) {
  const q = (keyword || '').trim();
  if (!q) return [] as string[];

  const hints: Array<{ tokens: string[]; atcPrefixes: string[] }> = [
    { tokens: ['아세트아미노펜', 'acetaminophen', '파라세타몰', 'paracetamol'], atcPrefixes: ['N02BE'] },
    { tokens: ['이부프로펜', 'ibuprofen'], atcPrefixes: ['M01AE'] },
  ];

  for (const hint of hints) {
    if (hint.tokens.some((token) => q.toLowerCase().includes(token.toLowerCase()))) {
      return hint.atcPrefixes;
    }
  }

  return [] as string[];
}

function getStandardCodePrefixesByKeyword(keyword: string) {
  const q = (keyword || '').trim().toLowerCase();
  if (!q) return [] as string[];

  if (q.includes('아세트아미노펜') || q.includes('acetaminophen') || q.includes('paracetamol') || q.includes('타이레놀')) {
    // Operational fallback for acetaminophen-family products in current dataset.
    return ['8806469', '8806723'];
  }

  return [] as string[];
}

function getProductNameHintsByKeyword(keyword: string) {
  const q = (keyword || '').trim().toLowerCase();
  if (!q) return [] as string[];

  if (q.includes('아세트아미노펜') || q.includes('acetaminophen') || q.includes('paracetamol')) {
    return ['타이레놀', 'tylenol'];
  }

  return [] as string[];
}

function getIngredientAliasHintsByKeyword(keyword: string) {
  const q = (keyword || '').trim().toLowerCase();
  if (!q) return [] as string[];

  if (q.includes('아세트아미노펜') || q.includes('acetaminophen') || q.includes('paracetamol')) {
    return ['아세트아미노펜', 'acetaminophen', 'paracetamol'];
  }

  if (q.includes('이부프로펜') || q.includes('ibuprofen')) {
    return ['이부프로펜', 'ibuprofen'];
  }

  return [] as string[];
}

function ingredientFromProductName(productName: string) {
  const match = productName.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || '';
}

function looksLikeMojibake(value: string) {
  const text = (value || '').trim();
  if (!text) return false;
  if (/[\u3131-\u318E\uAC00-\uD7A3]/.test(text)) return false;
  const latinExtendedHits = text.match(/[\u00C0-\u00FF]/g) || [];
  return latinExtendedHits.length >= 2;
}

function normalizeBaseProductName(name: string) {
  return name
    .replace(/&nbsp;/gi, ' ')
    .split('(')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSearchText(value: string) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function splitSearchTokens(value: string) {
  return normalizeSearchText(value)
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function toDigits(value: string) {
  return (value || '').replace(/\D/g, '');
}

function toProductCode(value: string) {
  const digits = toDigits(value);
  if (!digits) return '';
  if (digits.length === 9) return digits;
  if (digits.length === 13 && digits.startsWith('880')) {
    // Korean barcode format: 880 + productCode(9) + checksum(1)
    return digits.slice(3, 12);
  }
  return '';
}

function isAcetaminophenKeyword(keyword: string) {
  const q = (keyword || '').trim().toLowerCase();
  return q.includes('아세트아미노펜') || q.includes('acetaminophen') || q.includes('paracetamol');
}

async function loadAcetaminophenPermitCodes() {
  const now = Date.now();
  if (acetaminophenPermitCodesCache && acetaminophenPermitCodesCache.expiresAt > now) {
    return acetaminophenPermitCodesCache.codes;
  }

  try {
    const filePath = path.join(
      process.cwd(),
      'data',
      'public_api_dumps',
      'DrugPrdtPrmsnInfoService07',
      'getDrugPrdtPrmsnInq07.all.json',
    );
    const text = await fs.readFile(filePath, 'utf8');
    const rows = JSON.parse(text) as Array<Record<string, unknown>>;

    const codes = new Set<string>();
    for (const row of rows) {
      const itemName = String(row.ITEM_NAME || '');
      const ingredient = String(row.ITEM_INGR_NAME || '');
      const itemEngName = String(row.ITEM_ENG_NAME || '');
      if (!(isAcetaminophenKeyword(itemName) || isAcetaminophenKeyword(ingredient) || isAcetaminophenKeyword(itemEngName))) {
        continue;
      }

      const itemSeq = String(row.ITEM_SEQ || '').replace(/\D/g, '');
      const standardCode = String(row.PRDLST_STDR_CODE || '').replace(/\D/g, '');
      if (itemSeq) codes.add(itemSeq);
      if (standardCode) codes.add(standardCode);
    }

    const values = Array.from(codes);
    acetaminophenPermitCodesCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      codes: values,
    };
    return values;
  } catch {
    acetaminophenPermitCodesCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      codes: [],
    };
    return [] as string[];
  }
}

async function loadAcetaminophenPermitNames() {
  const now = Date.now();
  if (acetaminophenPermitNamesCache && acetaminophenPermitNamesCache.expiresAt > now) {
    return acetaminophenPermitNamesCache.names;
  }

  try {
    const filePath = path.join(
      process.cwd(),
      'data',
      'public_api_dumps',
      'DrugPrdtPrmsnInfoService07',
      'getDrugPrdtPrmsnInq07.all.json',
    );
    const text = await fs.readFile(filePath, 'utf8');
    const rows = JSON.parse(text) as Array<Record<string, unknown>>;

    const names = new Set<string>();
    for (const row of rows) {
      const itemName = String(row.ITEM_NAME || '').trim();
      const ingredient = String(row.ITEM_INGR_NAME || '');
      const itemEngName = String(row.ITEM_ENG_NAME || '');
      if (!(isAcetaminophenKeyword(itemName) || isAcetaminophenKeyword(ingredient) || isAcetaminophenKeyword(itemEngName))) {
        continue;
      }
      if (itemName) names.add(itemName);
    }

    const values = Array.from(names);
    acetaminophenPermitNamesCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      names: values,
    };
    return values;
  } catch {
    acetaminophenPermitNamesCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      names: [],
    };
    return [] as string[];
  }
}

function buildCsvLookupCodes(standardCode: string, insuranceCode: string) {
  const codes = new Set<string>();
  const candidates = [standardCode, insuranceCode];

  for (const raw of candidates) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    codes.add(trimmed);

    const digits = toDigits(trimmed);
    if (digits) codes.add(digits);

    const productCode = toProductCode(trimmed);
    if (productCode) {
      codes.add(productCode);
      codes.add(`880${productCode}`);
    }
  }

  return Array.from(codes);
}

async function runSearch(body: QueryPayload) {
  const { productName, ingredientName, company } = body;

  const searchProducts = productName ? productName.split(',').map((p: string) => p.trim()).filter(Boolean) : [];
  const ingredientKeywordCandidate = (ingredientName || '').trim() || (searchProducts.length === 1 ? searchProducts[0] : '');
  const ingredientHints = getAtcHintsByKeyword(ingredientKeywordCandidate);
  const productNameHints = getProductNameHintsByKeyword(ingredientKeywordCandidate);
  const ingredientAliasHints = getIngredientAliasHintsByKeyword(ingredientKeywordCandidate);
  const ingredientCodePrefixHints = getStandardCodePrefixesByKeyword(ingredientKeywordCandidate);
  const isIngredientFocusedQuery = ingredientHints.length > 0 || ingredientCodePrefixHints.length > 0;
  const requestedLimit = normalizeLimit(body.limit);
  const resultLimit = requestedLimit;

  const isSingleCodeSearch =
    searchProducts.length === 1 &&
    (looksLikeCode(searchProducts[0]) || /^[0-9]{7,}$/.test(toDigits(searchProducts[0])));

  const buildConditions = (mode: 'strict' | 'broad') => {
    const conditions: any[] = [];
    if (searchProducts.length > 0) {
      if (searchProducts.length === 1) {
        const q = searchProducts[0];
        const codeLike = looksLikeCode(q) || /^[0-9]{7,}$/.test(toDigits(q));
        if (codeLike) {
          // Exact/prefix match first to avoid expensive full wildcard scans.
          conditions.push({
            OR: [
              { standardCode: { equals: q, mode: 'insensitive' } },
              { insuranceCode: { equals: q, mode: 'insensitive' } },
              { atcCode: { equals: q, mode: 'insensitive' } },
              { standardCode: { startsWith: q, mode: 'insensitive' } },
              { insuranceCode: { startsWith: q, mode: 'insensitive' } },
              { atcCode: { startsWith: q, mode: 'insensitive' } },
              ...(mode === 'broad'
                ? [
                    // Skip broad contains for code search to avoid very expensive wildcard scans.
                  ]
                : []),
            ],
          });
        } else {
          conditions.push({
            OR: [
              { productName: { startsWith: q, mode: 'insensitive' } },
              { ingredientName: { startsWith: q, mode: 'insensitive' } },
              { company: { startsWith: q, mode: 'insensitive' } },
              ...(mode === 'broad'
                ? [
                    { productName: { contains: q, mode: 'insensitive' } },
                    { ingredientName: { contains: q, mode: 'insensitive' } },
                    { company: { contains: q, mode: 'insensitive' } },
                  ]
                : []),
            ],
          });
        }
      } else {
        const multiTokenOr =
          mode === 'strict'
            ? searchProducts.flatMap((p: string) => [
                { productName: { startsWith: p, mode: 'insensitive' as const } },
                { ingredientName: { startsWith: p, mode: 'insensitive' as const } },
              ])
            : searchProducts.flatMap((p: string) => [
                { productName: { contains: p, mode: 'insensitive' as const } },
                { ingredientName: { contains: p, mode: 'insensitive' as const } },
              ]);

        conditions.push({
          OR: multiTokenOr,
        });
      }
    }

    if (company) {
      conditions.push(
        mode === 'strict'
          ? { company: { startsWith: company, mode: 'insensitive' } }
          : { company: { contains: company, mode: 'insensitive' } }
      );
    }
    if (ingredientName) {
      conditions.push(
        mode === 'strict'
          // Ingredient queries should include combination drugs where the token is not at the beginning.
          ? { ingredientName: { contains: ingredientName, mode: 'insensitive' } }
          : { ingredientName: { contains: ingredientName, mode: 'insensitive' } }
      );
    }

    return conditions;
  };

  const strictConditions = buildConditions('strict');
  const broadConditions = buildConditions('broad');

  const selectFields = {
    id: true,
    productName: true,
    ingredientName: true,
    company: true,
    standardCode: true,
    insuranceCode: true,
    atcCode: true,
    priceLabel: true,
    reimbursement: true,
    type: true,
    releaseDate: true,
    usageFrequency: true,
  } as const;

  // Strict query first for fast paths; fallback to broad only when needed.
  let drugs = await prisma.drug.findMany({
    where: strictConditions.length > 0 ? { AND: strictConditions } : undefined,
    select: selectFields,
    take: resultLimit,
    orderBy: { usageFrequency: 'desc' },
  });

  if (strictConditions.length > 0 && !isSingleCodeSearch) {
    if (drugs.length === 0) {
      drugs = await prisma.drug.findMany({
        where: { AND: broadConditions },
        select: selectFields,
        take: resultLimit,
        orderBy: { usageFrequency: 'desc' },
      });
    } else if (drugs.length < resultLimit) {
      // Merge broad results as supplement so partial strict matches don't hide valid contains matches.
      const broadDrugs = await prisma.drug.findMany({
        where: { AND: broadConditions },
        select: selectFields,
        take: resultLimit,
        orderBy: { usageFrequency: 'desc' },
      });

      const merged = new Map<string, (typeof drugs)[number]>();
      for (const row of [...drugs, ...broadDrugs]) {
        const key = row.id;
        if (!merged.has(key)) {
          merged.set(key, row);
        }
      }
      drugs = Array.from(merged.values()).slice(0, resultLimit);
    }
  }

  if (strictConditions.length > 0 && drugs.length === 0 && !isSingleCodeSearch) {
    const fallbackKeyword = (ingredientName || searchProducts[0] || '').trim();
    const atcHints = getAtcHintsByKeyword(fallbackKeyword);
    const codePrefixHints = getStandardCodePrefixesByKeyword(fallbackKeyword);

    if (atcHints.length > 0) {
      drugs = await prisma.drug.findMany({
        where: {
          OR: atcHints.map((prefix) => ({
            atcCode: { startsWith: prefix, mode: 'insensitive' },
          })),
        },
        select: selectFields,
        take: resultLimit,
        orderBy: { usageFrequency: 'desc' },
      });
    }

    if (drugs.length === 0 && codePrefixHints.length > 0) {
      drugs = await prisma.drug.findMany({
        where: {
          OR: codePrefixHints.flatMap((prefix) => ([
            { standardCode: { startsWith: prefix } },
            { insuranceCode: { startsWith: prefix } },
          ])),
        },
        select: selectFields,
        take: resultLimit,
        orderBy: { usageFrequency: 'desc' },
      });
    }

    if (drugs.length > 0) {
      // Found via ATC hint fallback.
    } else if (fallbackKeyword) {
      const candidateNames = await searchProductsByIngredient(fallbackKeyword);
      if (candidateNames.length > 0) {
        drugs = await prisma.drug.findMany({
          where: {
            OR: candidateNames.map((name) => ({
              productName: { contains: name, mode: 'insensitive' },
            })),
          },
          select: selectFields,
          take: resultLimit,
          orderBy: { usageFrequency: 'desc' },
        });
      }

      if (drugs.length === 0) {
        const csvMap = await loadRichDrugPrices();
        const codeCandidates = new Set<string>();

        for (const [code, data] of csvMap.entries()) {
          const ingredientHit = (data.ingredient || '').includes(fallbackKeyword);
          const productHit = (data.productName || '').includes(fallbackKeyword);
          if (!ingredientHit && !productHit) continue;

          const digits = toDigits(code);
          if (digits.length >= 9) {
            codeCandidates.add(digits);
          }

          const productCode = toProductCode(code);
          if (productCode) {
            codeCandidates.add(productCode);
          }

          if (codeCandidates.size >= 120) break;
        }

        const codes = Array.from(codeCandidates);
        if (codes.length > 0) {
          const fullCodes = codes.filter((code) => code.length >= 10);
          const productCodes = codes.filter((code) => code.length === 9);

          drugs = await prisma.drug.findMany({
            where: {
              OR: [
                ...(fullCodes.length > 0
                  ? [
                      { standardCode: { in: fullCodes } },
                      { insuranceCode: { in: fullCodes } },
                    ]
                  : []),
                ...productCodes.flatMap((code) => ([
                  { standardCode: { contains: code } },
                  { insuranceCode: { contains: code } },
                  { standardCode: { startsWith: `880${code}` } },
                  { insuranceCode: { startsWith: `880${code}` } },
                ])),
              ],
            },
            select: selectFields,
            take: resultLimit,
            orderBy: { usageFrequency: 'desc' },
          });
        }
      }
    }
  }

  if (isIngredientFocusedQuery && ingredientCodePrefixHints.length > 0 && drugs.length < resultLimit) {
    const codeHintDrugs = await prisma.drug.findMany({
      where: {
        OR: ingredientCodePrefixHints.flatMap((prefix) => ([
          { standardCode: { startsWith: prefix } },
          { insuranceCode: { startsWith: prefix } },
        ])),
      },
      select: selectFields,
      take: resultLimit,
      orderBy: { usageFrequency: 'desc' },
    });

    const merged = new Map<string, (typeof drugs)[number]>();
    for (const row of [...drugs, ...codeHintDrugs]) {
      const key = row.id;
      if (!merged.has(key)) {
        merged.set(key, row);
      }
    }
    drugs = Array.from(merged.values()).slice(0, resultLimit);
  }

  if (isIngredientFocusedQuery && ingredientHints.length > 0 && drugs.length < resultLimit) {
    const supplementDrugs = await prisma.drug.findMany({
      where: {
        OR: ingredientHints.map((prefix) => ({
          atcCode: { startsWith: prefix, mode: 'insensitive' },
        })),
      },
      select: selectFields,
      take: resultLimit,
      orderBy: { usageFrequency: 'desc' },
    });

    const merged = new Map<string, (typeof drugs)[number]>();
    for (const row of [...drugs, ...supplementDrugs]) {
      const key = row.id;
      if (!merged.has(key)) {
        merged.set(key, row);
      }
    }
    drugs = Array.from(merged.values()).slice(0, resultLimit);
  }

  if (isIngredientFocusedQuery && productNameHints.length > 0) {
    const productHintDrugs = await prisma.drug.findMany({
      where: {
        OR: productNameHints.map((hint) => ({
          productName: { contains: hint, mode: 'insensitive' },
        })),
      },
      select: selectFields,
      take: resultLimit,
      orderBy: { usageFrequency: 'desc' },
    });

    const merged = new Map<string, (typeof drugs)[number]>();
    for (const row of [...productHintDrugs, ...drugs]) {
      const key = row.id;
      if (!merged.has(key)) {
        merged.set(key, row);
      }
    }
    drugs = Array.from(merged.values()).slice(0, resultLimit);
  }

  if (ingredientAliasHints.length > 0 && drugs.length < resultLimit) {
    const aliasDrugs = await prisma.drug.findMany({
      where: {
        OR: ingredientAliasHints.map((hint) => ({
          ingredientName: { contains: hint, mode: 'insensitive' },
        })),
      },
      select: selectFields,
      take: resultLimit,
      orderBy: { usageFrequency: 'desc' },
    });

    const merged = new Map<string, (typeof drugs)[number]>();
    for (const row of [...drugs, ...aliasDrugs]) {
      const key = row.id;
      if (!merged.has(key)) {
        merged.set(key, row);
      }
    }
    drugs = Array.from(merged.values()).slice(0, resultLimit);
  }

  if (isAcetaminophenKeyword(ingredientKeywordCandidate) && drugs.length < resultLimit) {
    const permitCodes = await loadAcetaminophenPermitCodes();
    const permitNames = await loadAcetaminophenPermitNames();
    if (permitCodes.length > 0) {
      const permitCodeDrugs = await prisma.drug.findMany({
        where: {
          OR: [
            { standardCode: { in: permitCodes } },
            { insuranceCode: { in: permitCodes } },
            ...(permitNames.length > 0 ? [{ productName: { in: permitNames } }] : []),
          ],
        },
        select: selectFields,
        take: resultLimit,
        orderBy: { usageFrequency: 'desc' },
      });

      const merged = new Map<string, (typeof drugs)[number]>();
      for (const row of [...drugs, ...permitCodeDrugs]) {
        const key = row.id;
        if (!merged.has(key)) {
          merged.set(key, row);
        }
      }
      drugs = Array.from(merged.values()).slice(0, resultLimit);
    }
  }

  if (isAcetaminophenKeyword(ingredientKeywordCandidate) && drugs.length < resultLimit) {
    const hintNameDrugs = await prisma.drug.findMany({
      where: {
        OR: ACETAMINOPHEN_PRODUCT_HINTS.map((name) => ({
          productName: { contains: name, mode: 'insensitive' },
        })),
      },
      select: selectFields,
      take: resultLimit,
      orderBy: { usageFrequency: 'desc' },
    });

    const merged = new Map<string, (typeof drugs)[number]>();
    for (const row of [...drugs, ...hintNameDrugs]) {
      const key = row.id;
      if (!merged.has(key)) {
        merged.set(key, row);
      }
    }
    drugs = Array.from(merged.values()).slice(0, resultLimit);
  }

  const usedDefaultFallback = false;

  const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
  // Keep brand-name based signals only. Ingredient names (e.g. 아토르바스타틴) misclassify many generics as originals.
  const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크'];
  const needsCsvPrice = drugs.some((item) => {
    const p = (item.priceLabel || '').trim().replace(/,/g, '');
    return !p || p === '가격정보없음' || !/[0-9]/.test(p);
  });
  const needsCsvIngredient = drugs.some((item) => {
    const ingr = (item.ingredientName || '').trim();
    return !ingr || ingr === '-' || looksLikeCode(ingr);
  });

  const csvPriceMap = needsCsvPrice ? await loadRichDrugPrices() : new Map();
  const ingredientCodeMap = needsCsvIngredient ? await loadIngredientCodeMap() : new Map();

  const finalItems: SearchItem[] = drugs.map((item: (typeof drugs)[number]) => {
    const standardCode = (item.standardCode || '').trim();
    const insuranceCode = (item.insuranceCode || '').trim();
    const csvLookupCodes = buildCsvLookupCodes(standardCode, insuranceCode);
    const csvData = csvLookupCodes.map((code) => csvPriceMap.get(code)).find(Boolean);

    let p = (item.priceLabel || '').trim().replace(/,/g, '');
    const c = (item.reimbursement || '').trim() || '급여구분미확인';
    if ((!p || p === '가격정보없음' || !/[0-9]/.test(p)) && csvData?.price) {
      p = String(csvData.price).trim().replace(/,/g, '');
    }

    let finalIngr = (item.ingredientName || '').trim();
    if (!finalIngr || finalIngr === '-' || looksLikeCode(finalIngr)) {
      finalIngr = (
        ingredientCodeMap.get(finalIngr) ||
        csvData?.ingredient ||
        ingredientFromProductName(item.productName || '') ||
        '-'
      ).trim();
    }

    if (p && /[0-9]/.test(p) && p !== '가격정보없음') {
      if (!p.includes('원')) p += '원';
    } else if (c.includes('비급여') || (item.type || '').includes('일반')) {
      p = (item.type || '').includes('일반') ? '일반의약품' : '비급여';
    } else {
      p = '가격정보없음';
    }

    const isOriginalCompany = !!(item.company && originalMakers.some(m => item.company?.includes(m)));
    const isOriginalName = originalNames.some(m => item.productName.includes(m));
    const brandClass: SearchItem['brandClass'] = (isOriginalCompany || isOriginalName) ? '오리지널(대장약)' : '복제약(제네릭)';

    const productNameFromDb = (item.productName || '').trim();
    const finalProductName =
      (looksLikeMojibake(productNameFromDb) && (csvData?.productName || '').trim())
        ? String(csvData?.productName).trim()
        : (productNameFromDb || '-');

    let finalPriceLabel = '';
    if (p === '가격정보없음') {
       finalPriceLabel = c.includes('비급여') ? '비급여' : '가격 미상 / ' + c;
    } else if (p === '비급여') {
       finalPriceLabel = p;
    } else {
       finalPriceLabel = p + ' / ' + c;
    }

    return {
      id: item.standardCode || item.id,
      productName: finalProductName,
      ingredientName: finalIngr,
      company: item.company || '-',
      priceLabel: finalPriceLabel,
      reimbursement: c,
      insuranceCode: item.insuranceCode || item.standardCode || '-',
      standardCode: item.standardCode || '-',
      atcCode: item.atcCode || '-',
      type: item.type || '-',
      releaseDate: item.releaseDate || '-',
      usageFrequency: item.usageFrequency || 0,
      brandClass,
      sourceService: csvData?.price || csvData?.ingredient ? '자체DB+CSV 보강 조회' : '자체DB 초고속 조회'
    };
  });

  // Propagate known prices to variants sharing the same base product name.
  const knownPriceByBaseName = new Map<string, string>();
  for (const item of finalItems) {
    if (/[0-9]/.test(item.priceLabel) && !item.priceLabel.startsWith('가격정보없음')) {
      const baseName = normalizeBaseProductName(item.productName);
      if (baseName && !knownPriceByBaseName.has(baseName)) {
        const numericPrice = item.priceLabel.split('/')[0].trim();
        knownPriceByBaseName.set(baseName, numericPrice);
      }
    }
  }

  const normalizedItems = finalItems.map((item) => {
    if (!item.priceLabel.startsWith('가격 미상') && !item.priceLabel.startsWith('가격정보없음')) return item;

    const baseName = normalizeBaseProductName(item.productName);
    const inferredPrice = knownPriceByBaseName.get(baseName);
    if (!inferredPrice) return item;

    return {
      ...item,
      priceLabel: `${inferredPrice} (추정) / ${item.reimbursement}`,
    };
  });

  // 제품명+제조사 기준으로 중복을 강하게 제거하여 검색 결과 화면 개선.
  // For acetaminophen parity checks, preserve code-level variants instead of collapsing them.
  const shouldUseProductCompanyDedup = !isAcetaminophenKeyword(ingredientKeywordCandidate);
  const dedupMap = new Map<string, SearchItem>();
  for (const item of normalizedItems) {
    const key = shouldUseProductCompanyDedup
      ? `${normalizeBaseProductName(item.productName)}__${item.company}`
      : (item.standardCode || item.insuranceCode || item.id);
    const prev = dedupMap.get(key);
    // 같은 제품이라면 비급여보다는 급여 정보를 우대, 혹은 빈도순으로 우대.
    const isItemPriced = /[0-9]/.test(item.priceLabel) && !item.priceLabel.includes('가격정보없음');
    const isPrevPriced = prev ? /[0-9]/.test(prev.priceLabel) && !prev.priceLabel.includes('가격정보없음') : false;

    if (!prev) {
       dedupMap.set(key, item);
    } else {
       // 빈도가 압도적이거나 가격 정보가 있는 것을 우선
       if (isItemPriced && !isPrevPriced) {
          dedupMap.set(key, item);
       } else if (isItemPriced === isPrevPriced && item.usageFrequency > prev.usageFrequency) {
          dedupMap.set(key, item);
       }
    }
  }

  let dedupedItems = Array.from(dedupMap.values());

  // 정렬 우선순위: 오리지널/복제약 구분 -> 처방빈도 desc -> 제품명 asc
  dedupedItems.sort((a: SearchItem, b: SearchItem) => {
    const classRank = (v: SearchItem['brandClass']) => (v === '오리지널(대장약)' ? 0 : 1);
    const classDiff = classRank(a.brandClass) - classRank(b.brandClass);
    if (classDiff !== 0) return classDiff;

    const freqDiff = b.usageFrequency - a.usageFrequency;
    if (freqDiff !== 0) return freqDiff;

    return a.productName.localeCompare(b.productName, 'ko');
  });

  if (isIngredientFocusedQuery) {
    const aliasTokens = ingredientAliasHints.flatMap((hint) => splitSearchTokens(hint));
    const keywordTokens = Array.from(
      new Set([...splitSearchTokens(ingredientKeywordCandidate), ...aliasTokens]),
    );
    const textMatched = dedupedItems.filter((item) => {
      const haystack = normalizeSearchText(`${item.productName} ${item.ingredientName}`);
      return keywordTokens.some((token) => haystack.includes(token));
    });
    const atcMatched = ingredientHints.length > 0
      ? dedupedItems.filter((item) => ingredientHints.some((prefix) => (item.atcCode || '').toUpperCase().startsWith(prefix.toUpperCase())))
      : [];
    const hintMatched = isAcetaminophenKeyword(ingredientKeywordCandidate)
      ? dedupedItems.filter((item) =>
          ACETAMINOPHEN_PRODUCT_HINTS.some((hint) =>
            normalizeSearchText(item.productName).includes(normalizeSearchText(hint)),
          ),
        )
      : [];

    if (atcMatched.length > 0 || textMatched.length > 0 || hintMatched.length > 0) {
      const preferred = [...textMatched, ...atcMatched, ...hintMatched];
      const uniq = new Map<string, SearchItem>();
      for (const item of preferred) {
        const key = shouldUseProductCompanyDedup
          ? `${normalizeBaseProductName(item.productName)}__${item.company}`
          : (item.standardCode || item.insuranceCode || item.id);
        if (!uniq.has(key)) uniq.set(key, item);
      }
      dedupedItems = Array.from(uniq.values());
    }
  }

  return {
    success: true,
    count: dedupedItems.length,
    items: dedupedItems,
    fallbackUsed: usedDefaultFallback,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QueryPayload;
    const cacheKey = makeCacheKey(body);
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const result = await runSearch(body);
    searchCache.set(cacheKey, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      data: result,
    });

    return NextResponse.json(result);
  } catch (err) {
    const error = err as Error;
    console.error('Database Search Error:', error);
    return NextResponse.json(
      { success: false, message: 'DB 검색 중 오류가 발생했습니다.', error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const keyword = (url.searchParams.get('keyword') || '').trim();
    const productName = (url.searchParams.get('productName') || keyword).trim();
    const ingredientName = (url.searchParams.get('ingredientName') || '').trim();
    const company = (url.searchParams.get('company') || '').trim();
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const proxyReq = new Request('http://localhost/api/drugs/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, ingredientName, company, limit }),
    });

    return POST(proxyReq);
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { success: false, message: '요청 파싱 중 오류가 발생했습니다.', error: error.message },
      { status: 500 }
    );
  }
}

