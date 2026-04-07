import { DATA_GO_KR_FALLBACK_SERVICE_KEY } from '@/lib/publicDrugApiCatalog';

type GenericItem = Record<string, unknown>;

type ApiCallOptions = {
  baseUrl: string;
  operation: string;
  query?: Record<string, string | number | undefined>;
  serviceName?: string;
};

export type NormalizedDrugItem = {
  id: string;
  productName: string;
  ingredientName: string;
  company: string;
  priceLabel: string;
  insuranceCode: string;
  standardCode: string;
  atcCode: string;
  reimbursement: string;
  type: string;
  releaseDate: string;
  usageFrequency: number;
  sourceService: string;
  raw: GenericItem;
};

function pickNumber(item: GenericItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

export function getDataGoKrKey() {
  return process.env.DATA_GO_KR_SERVICE_KEY || DATA_GO_KR_FALLBACK_SERVICE_KEY;
}

function parseXmlItems(xml: string): GenericItem[] {
  const items: GenericItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const block = itemMatch[1];
    const obj: GenericItem = {};
    const fieldRegex = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const key = fieldMatch[1];
      const raw = fieldMatch[2]
        .replace(/<!\[CDATA\[/g, '')
        .replace(/\]\]>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      obj[key] = raw;
    }

    if (Object.keys(obj).length > 0) {
      items.push(obj);
    }
  }

  return items;
}

function pickString(item: GenericItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toArray(input: unknown): GenericItem[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as GenericItem[];
  if (typeof input === 'object') return [input as GenericItem];
  return [];
}

export async function callPublicDrugApi(options: ApiCallOptions) {
  const serviceKey = getDataGoKrKey();
  const params = new URLSearchParams({
    serviceKey,
    _type: 'json',
    numOfRows: '50',
    pageNo: '1',
  });

  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      params.set(key, `${value}`);
    }
  });

  const url = `${options.baseUrl}${options.operation}?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`공공 API 호출 실패 (${res.status}): ${text.slice(0, 180)}`);
  }

  try {
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      service: options.serviceName || options.baseUrl,
    };
  } catch {
    const xmlItems = parseXmlItems(text);
    return {
      service: options.serviceName || options.baseUrl,
      rawText: text,
      response: {
        body: {
          items: {
            item: xmlItems,
          },
        },
      },
    };
  }
}

export function extractItems(payload: any): GenericItem[] {
  const candidates = [
    payload?.body?.items,
    payload?.response?.body?.items,
    payload?.body?.items?.item,
    payload?.response?.body?.items?.item,
    payload?.items,
    payload?.item,
  ];

  for (const candidate of candidates) {
    const arr = toArray(candidate?.item ?? candidate);
    if (arr.length > 0) return arr;
  }

  return [];
}

export function normalizeDrugItem(item: GenericItem, sourceService: string): NormalizedDrugItem {
  const productName = pickString(item, [
    'itemName',
    'ITEM_NAME',
    'trustItemName',
    'cnsgnItemName',
    '품목명',
    'PRDUCT',
    'prdtNm',
  ]);
  const ingredientName = pickString(item, [
    'mainIngr',
    'MAIN_INGR',
    'ITEM_INGR_NAME',
    'trustMainingr',
    'INGR_NAME',
    '재료명',
    'ingrName',
  ]);
  const company = pickString(item, [
    'entpName',
    'ENTP_NAME',
    'trustEntpName',
    'cnsgnEntpName',
    '업체명',
    'companyName',
  ]);
  const insuranceCode = pickString(item, [
    'ediCode',
    'EDI_CODE',
    'trustHiraPrductCode',
    '보험코드',
    'itemSeq',
    'ITEM_SEQ',
    'itemCode',
  ]);
  const standardCode = pickString(item, [
    'stdCode',
    'STD_CD',
    'PRDLST_STDR_CODE',
    'trustHiraPrductCode',
    '표준코드',
    'barCode',
    'BAR_CODE',
  ]);
  const atcCode = pickString(item, ['atcCode', 'ATC_CODE', 'ATCCODE', 'trustAtcCode']);
  const reimbursement = pickString(item, ['reim', 'payYn', '급여구분']);
  const type = pickString(item, ['etcOtcCode', '전문일반', 'drugType', 'SPCLTY_PBLC', 'ETC_OTC_NAME', 'PRDUCT_TYPE']);
  const releaseDate = pickString(item, [
    'itemPermitDate',
    'ITEM_PERMIT_DATE',
    'trustItemPermitDate',
    'cnsgnItemPermitDate',
    '허가일자',
    'openDe',
    'releaseDate',
  ]);
  const usageFrequency = pickNumber(item, [
    'useCnt',
    'prescriptCnt',
    'freq',
    'usage',
    'use_count',
    'cnt',
    'totCnt',
    'totUseCnt',
    'totUseQty',
  ]);
  const priceRaw = pickString(item, [
    'maxAmt',
    'price',
    'amt',
    '약가',
    '보험약가',
    'unitPrice',
    'trustQntList',
    'dgamt',
    'upprAmt',
    'ceilAmt',
    'supplyAmt',
  ]);
  const safeType = type === '-' ? '' : type;
  const safeReim = reimbursement === '-' ? '' : reimbursement;
  const safePriceRaw = priceRaw === '-' ? '' : priceRaw;
  const priceLabel = safePriceRaw;

  return {
    id: insuranceCode || `${sourceService}:${productName}:${company}`,
    productName,
    ingredientName,
    company,
    priceLabel,
    insuranceCode,
    standardCode,
    atcCode,
    reimbursement,
    type,
    releaseDate,
    usageFrequency,
    sourceService,
    raw: item,
  };
}

export function mergeAndFilterDrugItems(items: NormalizedDrugItem[], filters: { productName?: string; ingredientName?: string; company?: string; }) {
  const meaningful = (value?: string) => {
    const normalized = (value || '').trim();
    return Boolean(
      normalized &&
      normalized !== '-' &&
      normalized !== '- / -'
    );
  };

  const byId = new Map<string, NormalizedDrugItem>();
  for (const item of items) {
    if (!item.productName && !item.ingredientName) continue;
    
    // Merge by Product Name and Company because public APIs omit or use different codes (itemSeq vs standardCode)
    const mergeKey = `${(item.productName || '').trim()}|${(item.company || '').trim()}`;
    
    if (!byId.has(mergeKey)) {
      byId.set(mergeKey, item);
      continue;
    }
    // 먼저 들어온 값을 유지하되 비어있는 필드는 뒤에서 보강
    const prev = byId.get(mergeKey)!;
    byId.set(mergeKey, {
      ...prev,
      productName: prev.productName || item.productName,
      ingredientName: prev.ingredientName || item.ingredientName,
      company: prev.company || item.company,
      priceLabel: meaningful(prev.priceLabel) ? prev.priceLabel : item.priceLabel,
      insuranceCode: prev.insuranceCode || item.insuranceCode,
      standardCode: prev.standardCode || item.standardCode,
      atcCode: prev.atcCode || item.atcCode,
      reimbursement: meaningful(prev.reimbursement) ? prev.reimbursement : item.reimbursement,
      type: meaningful(prev.type) ? prev.type : item.type,
      releaseDate: prev.releaseDate || item.releaseDate,
      usageFrequency: Math.max(prev.usageFrequency || 0, item.usageFrequency || 0),
    });
  }

  const p = (filters.productName || '').trim().toLowerCase();
  const i = (filters.ingredientName || '').trim().toLowerCase();
  const c = (filters.company || '').trim().toLowerCase();

  return [...byId.values()].filter((item) => {
    // 제품명 입력칸에 주성분을 입력하는 사용 케이스를 허용합니다.
    const productOk =
      !p ||
      item.productName.toLowerCase().includes(p) ||
      item.ingredientName.toLowerCase().includes(p);
    const ingredientOk = !i || item.ingredientName.toLowerCase().includes(i);
    const companyOk = !c || item.company.toLowerCase().includes(c);
    return productOk && ingredientOk && companyOk;
  });
}
