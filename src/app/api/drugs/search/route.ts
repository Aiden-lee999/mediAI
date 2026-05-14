import { NextResponse } from 'next/server';
import { loadIngredientCodeMap, loadRichDrugPrices, searchProductsByIngredient, type DrugPriceData } from '@/lib/drugPricesCsv';
import { prisma } from '@/lib/prisma';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { DATA_GO_KR_FALLBACK_SERVICE_KEY, PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';
import fs from 'node:fs/promises';
import path from 'node:path';

type SearchItem = {
  id: string;
  productName: string;
  ingredientName: string;
  company: string;
  imageUrl: string;
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

type RawJsonLike = {
  itemImage?: string;
  ITEM_IMAGE?: string;
  itemImage1?: string;
  ITEM_IMAGE1?: string;
  BIG_ITEM_IMAGE_DOCID?: string;
  SMALL_ITEM_IMAGE_DOCID?: string;
};

type QueryPayload = {
  productName?: string;
  ingredientName?: string;
  company?: string;
  limit?: number;
  includeImages?: boolean;
};

type GrainImageIndexEntry = {
  itemName: string;
  company: string;
  imageUrl: string;
  itemSeq: string;
  stdCodes: string[];
};

type CompactImageIndexRow = GrainImageIndexEntry;

type AcetaminophenSourceRow = {
  code: string;
  productName: string;
  productEnglishName: string;
  company: string;
  ingredient: string;
  additive: string;
  atcCode: string;
  type: string;
  releaseDate: string;
  status: string;
  price: string;
};

type GrainImageIndex = {
  rows: GrainImageIndexEntry[];
  byStdCode: Map<string, string>;
  byItemSeq: Map<string, string>;
  byStdCodeName: Map<string, string>;
  byItemSeqName: Map<string, string>;
};

type PermitImageIndex = {
  byCode: Map<string, string>;
  byCodeName: Map<string, string>;
  byNameCompany: Map<string, string>;
  byName: Map<string, string>;
};

const SEARCH_CACHE_TTL_MS = 1000 * 30;
const DEFAULT_SEARCH_LIMIT = 2000;
const MAX_SEARCH_LIMIT = 2000;
const searchCache = new Map<string, { expiresAt: number; data: { success: boolean; count: number; items: SearchItem[]; fallbackUsed: boolean } }>();
const PERMIT_CODE_CACHE_TTL_MS = 1000 * 60 * 10;
let acetaminophenPermitCodesCache: { expiresAt: number; codes: string[] } | null = null;
let acetaminophenPermitNamesCache: { expiresAt: number; names: string[] } | null = null;
let acetaminophenSourceRowsCache: { expiresAt: number; rows: AcetaminophenSourceRow[] } | null = null;
let grainImageIndexCache: { expiresAt: number; index: GrainImageIndex } | null = null;
let permitImageIndexCache: { expiresAt: number; index: PermitImageIndex } | null = null;
let compactImageRowsCache: { expiresAt: number; rows: CompactImageIndexRow[] } | null = null;
const liveGrainSearchCache = new Map<string, { expiresAt: number; items: SearchItem[] }>();

const EMPTY_GRAIN_IMAGE_INDEX: GrainImageIndex = {
  rows: [],
  byStdCode: new Map<string, string>(),
  byItemSeq: new Map<string, string>(),
  byStdCodeName: new Map<string, string>(),
  byItemSeqName: new Map<string, string>(),
};

const EMPTY_PERMIT_IMAGE_INDEX: PermitImageIndex = {
  byCode: new Map<string, string>(),
  byCodeName: new Map<string, string>(),
  byNameCompany: new Map<string, string>(),
  byName: new Map<string, string>(),
};

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

function recoverMojibakeKorean(value: string) {
  const text = (value || '').trim();
  if (!text) return text;
  if (hasKoreanText(text)) return text;
  if (!looksLikeMojibake(text)) return text;

  try {
    const recovered = Buffer.from(text, 'latin1').toString('utf8').trim();
    if (recovered && hasKoreanText(recovered)) return recovered;
    return text;
  } catch {
    return text;
  }
}

function normalizeBaseProductName(name: string) {
  return name
    .replace(/&nbsp;/gi, ' ')
    .split('(')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDrugNameKey(name: string) {
  return normalizeBaseProductName(name)
    .toLowerCase()
    .replace(/[\s\-_/.,()[\]{}]/g, '')
    .trim();
}

function normalizeCompanyKey(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/[\s()]/g, '')
    .trim();
}
function hasKoreanText(value: string) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(value || '');
}

function makeNameCompanyKey(productName: string, company: string) {
  return `${normalizeDrugNameKey(productName)}__${normalizeCompanyKey(company)}`;
}

function addImageIndexKeys(index: PermitImageIndex, productName: string, company: string, imageUrl: string) {
  const nameKey = normalizeDrugNameKey(productName);
  if (!nameKey || !imageUrl) return;

  if (!index.byName.has(nameKey)) index.byName.set(nameKey, imageUrl);

  const baseKey = normalizeDrugNameKey(normalizeBaseProductName(productName));
  if (baseKey && !index.byName.has(baseKey)) index.byName.set(baseKey, imageUrl);

  const companyKey = normalizeCompanyKey(company);
  if (companyKey) {
    const key = makeNameCompanyKey(productName, company);
    if (!index.byNameCompany.has(key)) index.byNameCompany.set(key, imageUrl);

    const baseNameCompanyKey = `${baseKey}__${companyKey}`;
    if (baseKey && !index.byNameCompany.has(baseNameCompanyKey)) {
      index.byNameCompany.set(baseNameCompanyKey, imageUrl);
    }
  }
}

async function loadCompactImageRows() {
  const now = Date.now();
  if (compactImageRowsCache && compactImageRowsCache.expiresAt > now) {
    return compactImageRowsCache.rows;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'public_api_dumps', 'drug_image_index.json');
    const text = await fs.readFile(filePath, 'utf8');
    const rawRows = JSON.parse(text) as Array<Partial<CompactImageIndexRow>>;
    const rows = rawRows
      .map((row) => ({
        itemName: String(row.itemName || '').trim(),
        company: String(row.company || '').trim(),
        imageUrl: toAbsoluteImageUrl(String(row.imageUrl || '').trim()),
        itemSeq: toDigits(String(row.itemSeq || '')),
        stdCodes: Array.isArray(row.stdCodes)
          ? row.stdCodes.map((code) => toDigits(String(code))).filter(Boolean)
          : [],
      }))
      .filter((row) => row.itemName && row.imageUrl);

    compactImageRowsCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      rows,
    };
    return rows;
  } catch {
    compactImageRowsCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      rows: [],
    };
    return [] as CompactImageIndexRow[];
  }
}

async function loadGrainImageIndex() {
  const now = Date.now();
  if (grainImageIndexCache && grainImageIndexCache.expiresAt > now) {
    return grainImageIndexCache.index;
  }

  try {
    const normalized = await loadCompactImageRows();

    const byStdCode = new Map<string, string>();
    const byItemSeq = new Map<string, string>();
    const byStdCodeName = new Map<string, string>();
    const byItemSeqName = new Map<string, string>();
    for (const row of normalized) {
      for (const alias of codeAliases(row.itemSeq)) {
        if (!byItemSeq.has(alias)) byItemSeq.set(alias, row.imageUrl);
        if (!byItemSeqName.has(alias)) byItemSeqName.set(alias, row.itemName);
      }
      for (const code of row.stdCodes) {
        for (const alias of codeAliases(code)) {
          if (!byStdCode.has(alias)) byStdCode.set(alias, row.imageUrl);
          if (!byStdCodeName.has(alias)) byStdCodeName.set(alias, row.itemName);
        }
      }
    }

    const index: GrainImageIndex = {
      rows: normalized,
      byStdCode,
      byItemSeq,
      byStdCodeName,
      byItemSeqName,
    };

    grainImageIndexCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      index,
    };
    return index;
  } catch {
    const emptyIndex: GrainImageIndex = {
      rows: [],
      byStdCode: new Map<string, string>(),
      byItemSeq: new Map<string, string>(),
      byStdCodeName: new Map<string, string>(),
      byItemSeqName: new Map<string, string>(),
    };
    grainImageIndexCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      index: emptyIndex,
    };
    return emptyIndex;
  }
}

async function loadPermitImageIndex() {
  const now = Date.now();
  if (permitImageIndexCache && permitImageIndexCache.expiresAt > now) {
    return permitImageIndexCache.index;
  }

  try {
    const byCode = new Map<string, string>();
    const byCodeName = new Map<string, string>();
    const byNameCompany = new Map<string, string>();
    const byName = new Map<string, string>();
    const index: PermitImageIndex = { byCode, byCodeName, byNameCompany, byName };

    const rows = await loadCompactImageRows();
    for (const row of rows) {
      const imageUrl = row.imageUrl;
      const productName = row.itemName;
      const company = row.company;
      const itemSeq = row.itemSeq;
      for (const alias of codeAliases(itemSeq)) {
        if (!byCode.has(alias)) byCode.set(alias, imageUrl);
        if (!byCodeName.has(alias) && productName) byCodeName.set(alias, productName);
      }
      for (const code of row.stdCodes) {
        for (const alias of codeAliases(code)) {
          if (!byCode.has(alias)) byCode.set(alias, imageUrl);
          if (!byCodeName.has(alias) && productName) byCodeName.set(alias, productName);
        }
      }

      addImageIndexKeys(index, productName, company, imageUrl);
    }

    permitImageIndexCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      index,
    };
    return index;
  } catch {
    const empty: PermitImageIndex = { byCode: new Map<string, string>(), byCodeName: new Map<string, string>(), byNameCompany: new Map<string, string>(), byName: new Map<string, string>() };
    permitImageIndexCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      index: empty,
    };
    return empty;
  }
}

function findImageFromPermitIndex(index: PermitImageIndex, productName: string, company: string | null | undefined, standardCode?: string, insuranceCode?: string) {
  const codeCandidates = [standardCode || '', insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .flatMap((code) => codeAliases(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const hit = index.byCode.get(code);
    if (hit) return hit;
  }

  const key = makeNameCompanyKey(productName || '', company || '');
  const companyHit = index.byNameCompany.get(key);
  if (companyHit) return companyHit;

  const baseCompanyKey = makeNameCompanyKey(normalizeBaseProductName(productName || ''), company || '');
  const baseCompanyHit = index.byNameCompany.get(baseCompanyKey);
  if (baseCompanyHit) return baseCompanyHit;

  const nameKey = normalizeDrugNameKey(productName || '');
  const nameHit = index.byName.get(nameKey);
  if (nameHit) return nameHit;

  const baseNameKey = normalizeDrugNameKey(normalizeBaseProductName(productName || ''));
  const baseNameHit = index.byName.get(baseNameKey);
  if (baseNameHit) return baseNameHit;

  return '';
}

function findImageFromGrainIndex(index: GrainImageIndex, productName: string, company?: string | null, standardCode?: string, insuranceCode?: string) {
  const codeCandidates = [standardCode || '', insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .flatMap((code) => codeAliases(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const byStd = index.byStdCode.get(code);
    if (byStd) return byStd;
  }

  for (const code of codeCandidates) {
    const bySeq = index.byItemSeq.get(code);
    if (bySeq) return bySeq;
  }

  const nameKey = normalizeDrugNameKey(productName || '');
  const companyKey = normalizeCompanyKey(company || '');
  if (!nameKey) return '';

  const exactWithCompany = index.rows.find((row) =>
    normalizeDrugNameKey(row.itemName) === nameKey &&
    companyKey &&
    normalizeCompanyKey(row.company) === companyKey,
  );
  if (exactWithCompany?.imageUrl) return exactWithCompany.imageUrl;

  const exact = index.rows.find((row) => normalizeDrugNameKey(row.itemName) === nameKey);
  if (exact?.imageUrl) return exact.imageUrl;

  const partial = index.rows.find((row) => {
    const k = normalizeDrugNameKey(row.itemName);
    return k.includes(nameKey) || nameKey.includes(k);
  });
  return partial?.imageUrl || '';
}

function findNameFromPermitIndex(index: PermitImageIndex, standardCode?: string, insuranceCode?: string) {
  const codeCandidates = [standardCode || '', insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .flatMap((code) => codeAliases(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const hit = index.byCodeName.get(code);
    if (hit) return hit;
  }

  return '';
}

function findNameFromGrainIndex(index: GrainImageIndex, standardCode?: string, insuranceCode?: string) {
  const codeCandidates = [standardCode || '', insuranceCode || '']
    .flatMap((raw) => String(raw).split(','))
    .flatMap((code) => codeAliases(code))
    .filter(Boolean);

  for (const code of codeCandidates) {
    const hit = index.byStdCodeName.get(code);
    if (hit) return hit;
  }

  for (const code of codeCandidates) {
    const hit = index.byItemSeqName.get(code);
    if (hit) return hit;
  }

  return '';
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

function normalizeDrugType(value: string) {
  const t = (value || '').trim();
  if (!t) return '-';
  if (t.includes('전문')) return '전문의약품';
  if (t.includes('일반')) return '일반의약품';
  return t;
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

function codeAliases(value: string) {
  const digits = toDigits(value);
  if (!digits) return [] as string[];

  const aliases = new Set<string>();
  aliases.add(digits);

  const productCode = toProductCode(digits);
  if (productCode) aliases.add(productCode);

  // Some sources store product code as 9 digits, others as 13-digit barcode-like values.
  if (digits.length === 9) {
    aliases.add(`880${digits}`);
  }

  return Array.from(aliases);
}

function toAbsoluteImageUrl(value: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(raw)) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `https://nedrug.mfds.go.kr${raw}`;
  if (/^\d{10,}$/.test(raw)) return buildImageByDocId(raw);
  return '';
}

function buildImageByDocId(docId: string) {
  const id = (docId || '').trim();
  if (!id) return '';
  return `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${id}`;
}

function extractImageFromRawJson(rawJson: string | null | undefined) {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as RawJsonLike;
    const direct =
      toAbsoluteImageUrl(parsed.itemImage || '') ||
      toAbsoluteImageUrl(parsed.ITEM_IMAGE || '') ||
      toAbsoluteImageUrl(parsed.itemImage1 || '') ||
      toAbsoluteImageUrl(parsed.ITEM_IMAGE1 || '');
    if (direct) return direct;

    const doc = parsed.itemImage || parsed.BIG_ITEM_IMAGE_DOCID || parsed.SMALL_ITEM_IMAGE_DOCID || '';
    return buildImageByDocId(String(doc));
  } catch {
    return '';
  }
}

function pickField(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

async function fetchLiveGrainSearchItems(keyword: string, company: string, resultLimit: number) {
  const q = (keyword || '').trim();
  if (!q) return [] as SearchItem[];

  const cacheKey = `${q.toLowerCase()}__${(company || '').trim().toLowerCase()}__${resultLimit}`;
  const cached = liveGrainSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const grainService = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('MdcinGrnIdntfcInfoService03'));
  if (!grainService) return [] as SearchItem[];

  try {
    let payload: any;
    try {
      payload = await callPublicDrugApi({
        serviceName: grainService.serviceName,
        baseUrl: grainService.baseUrl,
        operation: '/getMdcinGrnIdntfcInfoList03',
        query: {
          item_name: q,
          entp_name: (company || '').trim() || undefined,
          numOfRows: Math.min(200, Math.max(20, resultLimit)),
          pageNo: 1,
        },
        timeoutMs: 3500,
        retries: 0,
      });
    } catch {
      // Retry with explicit known-good fallback key when deployment env key is invalid.
      const params = new URLSearchParams({
        serviceKey: DATA_GO_KR_FALLBACK_SERVICE_KEY,
        type: 'json',
        numOfRows: String(Math.min(200, Math.max(20, resultLimit))),
        pageNo: '1',
        item_name: q,
      });
      const entpName = (company || '').trim();
      if (entpName) params.set('entp_name', entpName);

      const url = `${grainService.baseUrl}/getMdcinGrnIdntfcInfoList03?${params.toString()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('MFDS live fallback fetch failed');
      const raw = await res.text();
      payload = JSON.parse(raw);
    }

    const rows = extractItems(payload) as Array<Record<string, unknown>>;
    const rawMapped: Array<SearchItem | null> = rows
      .map((row): SearchItem | null => {
        const productName = pickField(row, ['ITEM_NAME', 'itemName']);
        const companyName = pickField(row, ['ENTP_NAME', 'entpName']) || '-';
        const itemSeq = toDigits(pickField(row, ['ITEM_SEQ', 'itemSeq']));
        const stdCdRaw = pickField(row, ['STD_CD', 'stdCode', 'barCode']);
        const stdCd = toDigits(stdCdRaw.split(',')[0] || '');
        const imageUrl = toAbsoluteImageUrl(pickField(row, ['ITEM_IMAGE', 'itemImage', 'ITEM_IMAGE1', 'itemImage1']));
        const type = pickField(row, ['ETC_OTC_NAME', 'etcOtcName']) || '-';
        const releaseDate = pickField(row, ['ITEM_PERMIT_DATE', 'itemPermitDate']) || '-';

        if (!productName) return null;

        const code = stdCd || itemSeq || '';
        return {
          id: code || `${normalizeDrugNameKey(productName)}__${normalizeCompanyKey(companyName)}`,
          productName,
          ingredientName: '-',
          company: companyName,
          imageUrl,
          priceLabel: '가격정보없음 / 급여구분미확인',
          reimbursement: '급여구분미확인',
          insuranceCode: code || '-',
          standardCode: code || '-',
          atcCode: '-',
          type,
          releaseDate,
          usageFrequency: 0,
          brandClass: '복제약(제네릭)' as SearchItem['brandClass'],
          sourceService: 'MFDS 낱알식별 실시간 조회',
        };
      })
      ;

    const mapped = rawMapped.filter((x): x is SearchItem => x !== null);

    const dedup = new Map<string, SearchItem>();
    for (const item of mapped) {
      const key = `${item.standardCode}__${normalizeDrugNameKey(item.productName)}__${normalizeCompanyKey(item.company)}`;
      if (!dedup.has(key)) dedup.set(key, item);
    }

    const result = Array.from(dedup.values()).slice(0, resultLimit);
    liveGrainSearchCache.set(cacheKey, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      items: result,
    });
    return result;
  } catch {
    return [] as SearchItem[];
  }
}

function isAcetaminophenKeyword(keyword: string) {
  const q = (keyword || '').trim().toLowerCase();
  return q.includes('아세트아미노펜') || q.includes('acetaminophen') || q.includes('paracetamol') || q.includes('프로파세타몰') || q.includes('propacetamol');
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

async function loadAcetaminophenSourceRows() {
  const now = Date.now();
  if (acetaminophenSourceRowsCache && acetaminophenSourceRowsCache.expiresAt > now) {
    return acetaminophenSourceRowsCache.rows;
  }

  try {
    const jsonPath = path.join(process.cwd(), 'data', 'acetaminophen_products.json');
    try {
      const jsonText = await fs.readFile(jsonPath, 'utf8');
      const jsonRows = JSON.parse(jsonText) as AcetaminophenSourceRow[];
      const normalizedRows = jsonRows
        .map((row) => ({
          ...row,
          code: toDigits(String(row.code || '')),
          productName: String(row.productName || '').trim(),
          productEnglishName: String(row.productEnglishName || '').trim(),
          company: String(row.company || '').trim(),
          ingredient: String(row.ingredient || '').trim(),
          additive: String(row.additive || '').trim(),
          atcCode: String(row.atcCode || '').trim(),
          type: normalizeDrugType(String(row.type || '')),
          releaseDate: String(row.releaseDate || '').trim(),
          status: String(row.status || '').trim(),
          price: String(row.price || '').trim().replace(/,/g, ''),
        }))
        .filter((row) => row.code && row.productName);
      acetaminophenSourceRowsCache = {
        expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
        rows: normalizedRows,
      };
      return normalizedRows;
    } catch {
      // Fall back to parsing the CSV below.
    }

    const filePath = path.join(process.cwd(), 'data', 'acetaminophen_products.csv');
    const text = await fs.readFile(filePath, 'utf8');
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [] as AcetaminophenSourceRow[];

    const headers = parseCsvLine(lines[0]);
    const findIndex = (label: string) => headers.findIndex((header) => header.includes(label));
    const idxCode = findIndex('품목기준코드');
    const idxName = findIndex('제품명');
    const idxEnglishName = findIndex('제품영문명');
    const idxCompany = findIndex('업체명');
    const idxReleaseDate = findIndex('허가일');
    const idxStatus = findIndex('취소/취하');
    const idxIngredient = findIndex('주성분');
    const idxAdditive = findIndex('첨가제');
    const idxType = findIndex('전문의약품');
    const idxAtcCode = findIndex('ATC코드');

    const rows = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const code = toDigits(cols[idxCode] || '');
      const productName = (cols[idxName] || '').trim();
      const productEnglishName = (cols[idxEnglishName] || '').trim();
      const ingredient = (cols[idxIngredient] || '').trim();
      const additive = (cols[idxAdditive] || '').trim();
      if (!code || !productName || !(isAcetaminophenKeyword(productName) || isAcetaminophenKeyword(productEnglishName) || isAcetaminophenKeyword(ingredient) || isAcetaminophenKeyword(additive))) {
        return null;
      }

      return {
        code,
        productName,
        productEnglishName,
        company: (cols[idxCompany] || '').trim(),
        ingredient,
        additive,
        atcCode: (cols[idxAtcCode] || '').trim(),
        type: normalizeDrugType(cols[idxType] || ''),
        releaseDate: (cols[idxReleaseDate] || '').trim(),
        status: (cols[idxStatus] || '').trim(),
        price: '',
      } satisfies AcetaminophenSourceRow;
    }).filter((row): row is AcetaminophenSourceRow => row !== null);

    const unique = new Map<string, AcetaminophenSourceRow>();
    for (const row of rows) {
      if (!unique.has(row.code)) unique.set(row.code, row);
    }

    const values = Array.from(unique.values());
    acetaminophenSourceRowsCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      rows: values,
    };
    return values;
  } catch {
    acetaminophenSourceRowsCache = {
      expiresAt: now + PERMIT_CODE_CACHE_TTL_MS,
      rows: [],
    };
    return [] as AcetaminophenSourceRow[];
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

function parsePositivePrice(value: string | number | null | undefined) {
  const firstSegment = String(value ?? '').split('/')[0].replace(/,/g, '').trim();
  const match = firstSegment.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!match) return null;

  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasPositivePrice(value: string | number | null | undefined) {
  return parsePositivePrice(value) !== null;
}

function makeAcetaminophenSourceItem(row: AcetaminophenSourceRow, priceLabel: string, imageUrl: string): SearchItem {
  const type = row.type || '-';
  const fallbackPrice = type.includes('일반') ? '일반의약품 / 급여구분미확인' : '가격 미상 / 급여구분미확인';
  return {
    id: row.code,
    productName: row.productName,
    ingredientName: row.ingredient || row.productEnglishName || row.additive || '아세트아미노펜',
    company: row.company || '-',
    imageUrl,
    priceLabel: priceLabel || fallbackPrice,
    reimbursement: '급여구분미확인',
    insuranceCode: row.code,
    standardCode: row.code,
    atcCode: row.atcCode || '-',
    type,
    releaseDate: row.releaseDate || '-',
    usageFrequency: 0,
    brandClass: row.company.includes('존슨앤드존슨') || row.productName.includes('타이레놀') ? '오리지널(대장약)' : '복제약(제네릭)',
    sourceService: '사용자 제공 아세트아미노펜 원본 CSV',
  };
}

async function runAcetaminophenSourceSearch(resultLimit: number, company?: string) {
  const sourceRows = await loadAcetaminophenSourceRows();
  const companyFilter = normalizeCompanyKey(company || '');
  const filteredRows = companyFilter
    ? sourceRows.filter((row) => normalizeCompanyKey(row.company).includes(companyFilter))
    : sourceRows;
  const hasPrecomputedPrices = filteredRows.some((row) => hasPositivePrice(row.price));
  const csvPriceMap = hasPrecomputedPrices ? new Map<string, DrugPriceData>() : await loadRichDrugPrices();
  const csvPriceByName = new Map<string, string>();

  if (!hasPrecomputedPrices) {
    for (const data of csvPriceMap.values()) {
      if (!data.productName || !hasPositivePrice(data.price)) continue;
      const price = String(data.price).trim().replace(/,/g, '');
      const nameKeys = [
        normalizeDrugNameKey(data.productName),
        normalizeDrugNameKey(normalizeBaseProductName(data.productName)),
      ].filter(Boolean);
      for (const key of nameKeys) {
        if (!csvPriceByName.has(key)) csvPriceByName.set(key, price);
      }
    }
  }

  const items = filteredRows.map((row) => {
    const csvData = buildCsvLookupCodes(row.code, row.code).map((code) => csvPriceMap.get(code)).find(Boolean);
    const namePrice = csvPriceByName.get(normalizeDrugNameKey(row.productName)) ||
      csvPriceByName.get(normalizeDrugNameKey(normalizeBaseProductName(row.productName)));
    const rawPrice = row.price && hasPositivePrice(row.price) ? row.price : (csvData?.price && hasPositivePrice(csvData.price) ? csvData.price : namePrice);
    const priceLabel = rawPrice && hasPositivePrice(rawPrice) ? `${String(rawPrice).trim().replace(/,/g, '')}원 / 급여구분미확인` : '';
    return makeAcetaminophenSourceItem(row, priceLabel, '');
  });

  items.sort((a, b) => {
    const priceA = parsePositivePrice(a.priceLabel);
    const priceB = parsePositivePrice(b.priceLabel);
    if (priceA !== null && priceB !== null && priceA !== priceB) return priceA - priceB;
    if (priceA !== null && priceB === null) return -1;
    if (priceA === null && priceB !== null) return 1;
    return a.productName.localeCompare(b.productName, 'ko');
  });

  const limited = items.slice(0, resultLimit);
  return {
    success: true,
    count: limited.length,
    items: limited,
    fallbackUsed: false,
  };
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

  if (isAcetaminophenKeyword(ingredientKeywordCandidate) && !isSingleCodeSearch) {
    return runAcetaminophenSourceSearch(resultLimit, company);
  }

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
    imageUrl: true,
    usageFrequency: true,
    rawJson: true,
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
    return !hasPositivePrice(p);
  });
  const needsCsvIngredient = drugs.some((item) => {
    const ingr = (item.ingredientName || '').trim();
    return !ingr || ingr === '-' || looksLikeCode(ingr);
  });

  const csvPriceMap = needsCsvPrice ? await loadRichDrugPrices() : new Map();
  const ingredientCodeMap = needsCsvIngredient ? await loadIngredientCodeMap() : new Map();
  const shouldLoadImageIndexes = body.includeImages === true;
  const grainImageIndex = shouldLoadImageIndexes ? await loadGrainImageIndex() : EMPTY_GRAIN_IMAGE_INDEX;
  const permitImageIndex = shouldLoadImageIndexes ? await loadPermitImageIndex() : EMPTY_PERMIT_IMAGE_INDEX;

  const finalItems: SearchItem[] = drugs.map((item: (typeof drugs)[number]) => {
    const standardCode = (item.standardCode || '').trim();
    const insuranceCode = (item.insuranceCode || '').trim();
    const csvLookupCodes = buildCsvLookupCodes(standardCode, insuranceCode);
    const csvData = csvLookupCodes.map((code) => csvPriceMap.get(code)).find(Boolean);

    let p = (item.priceLabel || '').trim().replace(/,/g, '');
    const c = (item.reimbursement || '').trim() || '급여구분미확인';
    if (!hasPositivePrice(p) && csvData?.price && hasPositivePrice(csvData.price)) {
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

    if (hasPositivePrice(p)) {
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
    let finalProductName = productNameFromDb || '-';
    if (looksLikeMojibake(productNameFromDb)) {
      const permitName = findNameFromPermitIndex(
        permitImageIndex,
        item.standardCode || '',
        item.insuranceCode || '',
      );
      const grainName = findNameFromGrainIndex(
        grainImageIndex,
        item.standardCode || '',
        item.insuranceCode || '',
      );
      const csvName = String(csvData?.productName || '').trim();
      finalProductName = permitName || grainName || csvName || productNameFromDb || '-';
    }
    finalProductName = recoverMojibakeKorean(finalProductName);

    let finalPriceLabel = '';
    if (p === '가격정보없음') {
       finalPriceLabel = c.includes('비급여') ? '비급여' : '가격 미상 / ' + c;
    } else if (p === '비급여') {
       finalPriceLabel = p;
    } else {
       finalPriceLabel = p + ' / ' + c;
    }

    const imageUrlFromDb = toAbsoluteImageUrl(item.imageUrl || '');
    const imageUrlFromRaw = extractImageFromRawJson(item.rawJson);
    const imageUrlFromGrain = findImageFromGrainIndex(
      grainImageIndex,
      finalProductName,
      item.company || '',
      item.standardCode || '',
      item.insuranceCode || '',
    );
    const imageUrlFromPermit = findImageFromPermitIndex(
      permitImageIndex,
      finalProductName,
      item.company || '',
      item.standardCode || '',
      item.insuranceCode || '',
    );

    return {
      id: item.standardCode || item.id,
      productName: finalProductName,
      ingredientName: finalIngr,
      company: item.company || '-',
      imageUrl: imageUrlFromDb || imageUrlFromRaw || imageUrlFromGrain || imageUrlFromPermit,
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
    if (hasPositivePrice(item.priceLabel)) {
      const baseName = normalizeBaseProductName(item.productName);
      if (baseName && !knownPriceByBaseName.has(baseName)) {
        const numericPrice = item.priceLabel.split('/')[0].trim();
        knownPriceByBaseName.set(baseName, numericPrice);
      }
    }
  }

  let normalizedItems = finalItems.map((item) => {
    if (!item.priceLabel.startsWith('가격 미상') && !item.priceLabel.startsWith('가격정보없음')) return item;

    const baseName = normalizeBaseProductName(item.productName);
    const inferredPrice = knownPriceByBaseName.get(baseName);
    if (!inferredPrice) return item;

    return {
      ...item,
      priceLabel: `${inferredPrice} (추정) / ${item.reimbursement}`,
    };
  });

  if (isAcetaminophenKeyword(ingredientKeywordCandidate)) {
    const sourceRows = await loadAcetaminophenSourceRows();
    const sourceItems = sourceRows.map((row) => {
      const csvData = buildCsvLookupCodes(row.code, row.code).map((code) => csvPriceMap.get(code)).find(Boolean);
      const priceLabel = csvData?.price && hasPositivePrice(csvData.price) ? `${String(csvData.price).trim().replace(/,/g, '')}원 / 급여구분미확인` : '';
      const imageUrl = findImageFromGrainIndex(grainImageIndex, row.productName, row.company, row.code, row.code) ||
        findImageFromPermitIndex(permitImageIndex, row.productName, row.company, row.code, row.code);
      return makeAcetaminophenSourceItem(row, priceLabel, imageUrl);
    });

    const merged = new Map<string, SearchItem>();
    for (const item of [...normalizedItems, ...sourceItems]) {
      const key = item.standardCode || item.insuranceCode || item.id;
      const prev = merged.get(key);
      if (!prev || (hasPositivePrice(item.priceLabel) && !hasPositivePrice(prev.priceLabel))) {
        merged.set(key, item);
      }
    }
    normalizedItems = Array.from(merged.values());
  }

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
    const isItemPriced = hasPositivePrice(item.priceLabel);
    const isPrevPriced = prev ? hasPositivePrice(prev.priceLabel) : false;

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

  // If DB-side recall is poor (e.g. mojibake/corrupted product names),
  // supplement search results with live MFDS grain identification API.
  if (searchProducts.length === 1 && dedupedItems.length === 0) {
    const liveItems = await fetchLiveGrainSearchItems(searchProducts[0], company || '', resultLimit);
    if (liveItems.length > 0) {
      const merged = new Map<string, SearchItem>();
      for (const item of [...dedupedItems, ...liveItems]) {
        const key = `${item.standardCode}__${normalizeDrugNameKey(item.productName)}__${normalizeCompanyKey(item.company)}`;
        if (!merged.has(key)) merged.set(key, item);
      }
      dedupedItems = Array.from(merged.values()).slice(0, resultLimit);
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

