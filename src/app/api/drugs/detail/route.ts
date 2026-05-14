import { NextResponse } from 'next/server';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';
import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DetailBody = {
  productName: string;
  company?: string;
  standardCode?: string;
  insuranceCode?: string;
  atcCode?: string;
  fastOnly?: boolean;
};

type CompactImageIndexRow = {
  itemName: string;
  company: string;
  imageUrl: string;
  itemSeq: string;
  stdCodes: string[];
};

type DurSectionKey =
  | 'pregnancyContraindication'
  | 'interactionContraindication'
  | 'ageContraindication'
  | 'elderlyCaution'
  | 'doseCaution'
  | 'durationCaution'
  | 'efficacyDuplicate'
  | 'sustainedReleaseSplitCaution';

type DurIndexRow = {
  section: DurSectionKey;
  typeName: string;
  itemSeq: string;
  itemName: string;
  company: string;
  ingredientCode: string;
  ingredientName: string;
  content: string;
  mixtureItemSeq: string;
  mixtureItemName: string;
  mixtureIngredientName: string;
  mixtureCompany: string;
  className: string;
  formName: string;
  notificationDate: string;
  changeDate: string;
};

const IMAGE_INDEX_CACHE_TTL_MS = 1000 * 60 * 10;
const DUR_INDEX_CACHE_TTL_MS = 1000 * 60 * 10;
let compactImageRowsCache: { expiresAt: number; rows: CompactImageIndexRow[] } | null = null;
let durIndexRowsCache: { expiresAt: number; rows: DurIndexRow[] } | null = null;

const DUR_SECTION_TITLES: Record<DurSectionKey, string> = {
  pregnancyContraindication: '임부투여안전성/임부금기',
  interactionContraindication: '상호작용/병용금기',
  ageContraindication: '특정연령대금기',
  elderlyCaution: '노인주의',
  doseCaution: '용량주의',
  durationCaution: '투여기간주의',
  efficacyDuplicate: '효능군중복주의',
  sustainedReleaseSplitCaution: '서방정분할주의',
};

const DUR_SECTION_ORDER = Object.keys(DUR_SECTION_TITLES) as DurSectionKey[];

function firstItem(payload: any) {
  return extractItems(payload)[0] || null;
}

function normalizeLine(value: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string) {
  return (value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function isNoiseText(value: string) {
  const clean = normalizeLine(value).toLowerCase();
  if (!clean) return true;
  const noiseTokens = ['null', 'undefined', 'nan', '없음', '해당없음', '자료없음', '데이터없음'];
  return noiseTokens.some((token) => clean === token || clean.includes(`:${token}`));
}

function cleanLongText(value: string) {
  const stripped = stripHtml(value || '');
  const lines = stripped
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\-\*\u2022\s]+/, '').trim())
    .filter((line) => !isNoiseText(line));

  const deduped: string[] = [];
  for (const line of lines) {
    if (!deduped.includes(line)) deduped.push(line);
  }

  const output = deduped.join('\n').trim();
  return output || '';
}

function isPlaceholderDetailText(value: string) {
  const clean = normalizeLine(value || '');
  return !clean || ['데이터 없음', '효능효과 정보 확인중', '주의사항 정보 확인중', '식별정보 확인중', '-'].includes(clean);
}

function ingredientFallbackText(productName: string, ingredientName?: string, atcCode?: string) {
  const text = `${productName || ''} ${ingredientName || ''}`.toLowerCase();
  const atc = (atcCode || '').toUpperCase();

  if (text.includes('아세트아미노펜') || text.includes('acetaminophen') || text.includes('paracetamol') || text.includes('프로파세타몰') || text.includes('propacetamol') || atc.startsWith('N02BE')) {
    return {
      efficacy: '아세트아미노펜 계열 약제는 해열 및 진통 목적으로 사용됩니다. 두통, 치통, 근육통, 월경통 등 통증 완화와 감기 등에서 동반되는 발열 완화에 사용되는 성분입니다.',
      usage: '제품별 함량과 제형에 따라 용법·용량이 다르므로 허가사항과 처방 지시를 우선 확인해야 합니다. 동일 성분 중복 복용 및 1일 최대용량 초과를 피해야 합니다.',
      caution: '과량 복용 시 간독성 위험이 증가합니다. 간질환, 만성 음주, 와파린 복용, 다른 감기약·진통제와의 중복 복용 여부를 확인하세요.',
    };
  }

  if (text.includes('이부프로펜') || text.includes('ibuprofen') || atc.startsWith('M01AE')) {
    return {
      efficacy: '이부프로펜은 비스테로이드성 소염진통제(NSAID)로 통증, 염증 및 발열 완화에 사용됩니다.',
      usage: '위장관 부담을 줄이기 위해 식후 복용이 권장되는 경우가 많으며, 제품별 허가 용량을 확인해야 합니다.',
      caution: '소화성 궤양, 신기능 저하, 항응고제 복용, NSAID 과민 병력이 있는 경우 주의가 필요합니다.',
    };
  }

  if (text.includes('메트포르민') || text.includes('metformin') || atc.startsWith('A10BA')) {
    return {
      efficacy: '메트포르민은 제2형 당뇨병에서 혈당 조절을 위해 사용되는 경구 혈당강하제입니다.',
      usage: '위장관 이상반응을 줄이기 위해 식사와 함께 복용하는 경우가 많으며, 신기능에 따라 용량 조절이 필요할 수 있습니다.',
      caution: '신기능 저하, 조영제 사용 예정, 중증 감염·탈수·저산소증 상황에서는 젖산산증 위험을 고려해야 합니다.',
    };
  }

  const label = ingredientName || productName || '해당 약제';
  return {
    efficacy: `${label}의 공식 효능·효과 원문이 로컬 DB에 충분히 저장되어 있지 않습니다. 제품명, 성분명, ATC 코드와 허가사항을 기준으로 상세 원문을 추가 확인하세요.`,
    usage: `${label}의 용법·용량은 제형, 함량, 적응증, 환자 상태에 따라 달라질 수 있으므로 허가사항과 처방 지시를 우선 적용하세요.`,
    caution: `${label} 복용 전 알레르기, 임신·수유, 소아·고령, 간·신장 기능, 병용약 및 중복 성분 여부를 확인하세요.`,
  };
}

function pickLongestText(item: any, keys: string[]) {
  const candidates = keys
    .map((key) => item?.[key])
    .filter((v): v is string => typeof v === 'string')
    .map((v) => cleanLongText(v))
    .filter(Boolean);

  return candidates.sort((a, b) => b.length - a.length)[0] || '';
}

function scorePermitItem(item: any, productName: string, company?: string) {
  const name = normalizeLine(pick(item, ['itemName', 'ITEM_NAME', '품목명'])).toLowerCase();
  const entp = normalizeLine(pick(item, ['entpName', 'ENTP_NAME', '업체명'])).toLowerCase();
  const targetName = normalizeLine(productName).toLowerCase();
  const targetCompany = normalizeLine(company || '').toLowerCase();

  let score = 0;
  if (name && targetName) {
    if (name === targetName) score += 5;
    else if (name.includes(targetName) || targetName.includes(name)) score += 3;
  }
  if (targetCompany && entp) {
    if (entp === targetCompany) score += 4;
    else if (entp.includes(targetCompany) || targetCompany.includes(entp)) score += 2;
  }
  if (pick(item, ['itemSeq', 'ITEM_SEQ', 'ediCode'])) score += 1;
  return score;
}

function bestPermitItem(items: any[], productName: string, company?: string) {
  if (!items.length) return null;
  return [...items].sort((a, b) => scorePermitItem(b, productName, company) - scorePermitItem(a, productName, company))[0] || null;
}

function pick(item: any, keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toDigits(value: string) {
  return (value || '').replace(/\D/g, '');
}

function toProductCode(value: string) {
  const digits = toDigits(value || '');
  if (!digits) return '';
  if (digits.length === 9) return digits;
  if (digits.length === 13 && digits.startsWith('880')) {
    return digits.slice(3, 12);
  }
  return '';
}

function compact<T>(arr: Array<T | null | undefined | ''>) {
  return arr.filter(Boolean) as T[];
}

function unique<T>(arr: T[]) {
  return [...new Set(arr)];
}

function normalizeText(value: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteImageUrl(value: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `https://nedrug.mfds.go.kr${raw}`;
  if (/^\d{10,}$/.test(raw)) return `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${raw}`;
  return '';
}

function buildImageUrl(...candidates: Array<string | undefined>) {
  for (const c of candidates) {
    const url = toAbsoluteImageUrl(c || '');
    if (url) return url;
  }
  return '';
}

function extractImageFromRawJson(rawJson: string | null | undefined) {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const direct = buildImageUrl(
      String(parsed.itemImage || ''),
      String(parsed.ITEM_IMAGE || ''),
      String(parsed.itemImage1 || ''),
      String(parsed.ITEM_IMAGE1 || ''),
      String(parsed.BIG_PRDT_IMG_URL || ''),
      String(parsed.SMALL_PRDT_IMG_URL || ''),
      String(parsed.bigPrdtImgUrl || ''),
      String(parsed.smallPrdtImgUrl || ''),
    );
    if (direct) return direct;

    const docId = String(parsed.itemImage || parsed.BIG_ITEM_IMAGE_DOCID || parsed.SMALL_ITEM_IMAGE_DOCID || '');
    if (docId) return `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${docId}`;
    return '';
  } catch {
    return '';
  }
}

function codeAliases(value: string) {
  const digits = toDigits(value || '');
  if (!digits) return [] as string[];

  const aliases = new Set<string>();
  aliases.add(digits);

  const productCode = toProductCode(digits);
  if (productCode) aliases.add(productCode);
  if (digits.length === 9) aliases.add(`880${digits}`);

  return Array.from(aliases);
}

function normalizeBaseProductName(name: string) {
  return (name || '')
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

    compactImageRowsCache = { expiresAt: now + IMAGE_INDEX_CACHE_TTL_MS, rows };
    return rows;
  } catch {
    compactImageRowsCache = { expiresAt: now + IMAGE_INDEX_CACHE_TTL_MS, rows: [] };
    return [] as CompactImageIndexRow[];
  }
}

async function findImageFromCompactIndex(productName: string, company: string | undefined, standardCode: string, insuranceCode: string) {
  const rows = await loadCompactImageRows();
  if (!rows.length) return '';

  const codeCandidates = [standardCode, insuranceCode]
    .flatMap((raw) => String(raw || '').split(','))
    .flatMap((code) => codeAliases(code))
    .filter(Boolean);

  for (const row of rows) {
    const aliases = [...codeAliases(row.itemSeq), ...row.stdCodes.flatMap((code) => codeAliases(code))];
    if (aliases.some((alias) => codeCandidates.includes(alias))) return row.imageUrl;
  }

  const nameKey = normalizeDrugNameKey(productName || '');
  if (!nameKey) return '';

  const companyKey = normalizeCompanyKey(company || '');
  const exactWithCompany = rows.find((row) =>
    normalizeDrugNameKey(row.itemName) === nameKey &&
    companyKey &&
    normalizeCompanyKey(row.company) === companyKey,
  );
  if (exactWithCompany?.imageUrl) return exactWithCompany.imageUrl;

  const exact = rows.find((row) => normalizeDrugNameKey(row.itemName) === nameKey);
  if (exact?.imageUrl) return exact.imageUrl;

  const baseKey = normalizeDrugNameKey(normalizeBaseProductName(productName || ''));
  if (!baseKey || baseKey === nameKey) return '';

  const baseWithCompany = rows.find((row) =>
    normalizeDrugNameKey(normalizeBaseProductName(row.itemName)) === baseKey &&
    companyKey &&
    normalizeCompanyKey(row.company) === companyKey,
  );
  if (baseWithCompany?.imageUrl) return baseWithCompany.imageUrl;

  const baseExact = rows.find((row) => normalizeDrugNameKey(normalizeBaseProductName(row.itemName)) === baseKey);
  return baseExact?.imageUrl || '';
}

async function loadDurIndexRows() {
  const now = Date.now();
  if (durIndexRowsCache && durIndexRowsCache.expiresAt > now) {
    return durIndexRowsCache.rows;
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'public_api_dumps', 'drug_dur_index.json');
    const text = await fs.readFile(filePath, 'utf8');
    const rawRows = JSON.parse(text) as Array<Partial<DurIndexRow>>;
    const rows = rawRows
      .map((row) => ({
        section: row.section as DurSectionKey,
        typeName: String(row.typeName || '').trim(),
        itemSeq: toDigits(String(row.itemSeq || '')),
        itemName: String(row.itemName || '').trim(),
        company: String(row.company || '').trim(),
        ingredientCode: String(row.ingredientCode || '').trim(),
        ingredientName: String(row.ingredientName || '').trim(),
        content: cleanLongText(String(row.content || '').trim()),
        mixtureItemSeq: toDigits(String(row.mixtureItemSeq || '')),
        mixtureItemName: String(row.mixtureItemName || '').trim(),
        mixtureIngredientName: String(row.mixtureIngredientName || '').trim(),
        mixtureCompany: String(row.mixtureCompany || '').trim(),
        className: String(row.className || '').trim(),
        formName: String(row.formName || '').trim(),
        notificationDate: String(row.notificationDate || '').trim(),
        changeDate: String(row.changeDate || '').trim(),
      }))
      .filter((row) => DUR_SECTION_ORDER.includes(row.section) && (row.itemSeq || row.itemName || row.ingredientName));

    durIndexRowsCache = { expiresAt: now + DUR_INDEX_CACHE_TTL_MS, rows };
    return rows;
  } catch {
    durIndexRowsCache = { expiresAt: now + DUR_INDEX_CACHE_TTL_MS, rows: [] };
    return [] as DurIndexRow[];
  }
}

async function findDurSections(options: {
  productName: string;
  company?: string;
  standardCode?: string;
  insuranceCode?: string;
  itemSeqCandidates?: string[];
  ingredientCandidates?: string[];
}) {
  const rows = await loadDurIndexRows();
  const codeCandidates = new Set(
    unique(
      [options.standardCode || '', options.insuranceCode || '', ...(options.itemSeqCandidates || [])]
        .flatMap((raw) => String(raw || '').split(','))
        .flatMap((code) => codeAliases(code))
        .filter(Boolean)
    )
  );

  const productNameKey = normalizeDrugNameKey(options.productName || '');
  const baseNameKey = normalizeDrugNameKey(normalizeBaseProductName(options.productName || ''));
  const companyKey = normalizeCompanyKey(options.company || '');
  const ingredientKeys = unique(
    (options.ingredientCandidates || [])
      .flatMap((value) => String(value || '').split(/[\n,;/|]+/))
      .map((value) => normalizeDrugNameKey(value))
      .filter((value) => value.length >= 2)
  );

  const matched = rows.filter((row) => {
    const rowCodes = [...codeAliases(row.itemSeq), ...codeAliases(row.mixtureItemSeq)];
    if (rowCodes.some((code) => codeCandidates.has(code))) return true;

    if (!row.itemName && row.ingredientName && ingredientKeys.length > 0) {
      const rowIngredientKey = normalizeDrugNameKey(row.ingredientName);
      if (rowIngredientKey && ingredientKeys.some((key) => key === rowIngredientKey || key.includes(rowIngredientKey) || rowIngredientKey.includes(key))) {
        return true;
      }
    }

    const rowNameKey = normalizeDrugNameKey(row.itemName || '');
    const rowBaseNameKey = normalizeDrugNameKey(normalizeBaseProductName(row.itemName || ''));
    if (!productNameKey || !rowNameKey) return false;

    const nameMatched = rowNameKey === productNameKey || rowBaseNameKey === baseNameKey;
    if (!nameMatched) return false;
    if (!companyKey) return true;
    const rowCompanyKey = normalizeCompanyKey(row.company || '');
    return !rowCompanyKey || rowCompanyKey === companyKey;
  });

  return DUR_SECTION_ORDER.map((key) => {
    const seen = new Set<string>();
    const items = matched
      .filter((row) => row.section === key)
      .filter((row) => {
        const dedupeKey = [row.itemSeq, row.itemName, row.ingredientName, row.content, row.mixtureItemName].join('|');
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      })
      .slice(0, key === 'interactionContraindication' ? 30 : 12);

    return {
      key,
      title: DUR_SECTION_TITLES[key],
      items,
      source: '식품의약품안전처 의약품안전사용서비스(DUR) 품목정보',
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DetailBody;
    if (!body.productName?.trim()) {
      return NextResponse.json({ success: false, message: 'productName 이 필요합니다.' }, { status: 400 });
    }

    const insuranceDigits = toDigits(body.insuranceCode || '');
    const standardDigits = toDigits(body.standardCode || '');
    const productCodeCandidates = unique(
      compact([
        toProductCode(body.insuranceCode || ''),
        toProductCode(body.standardCode || ''),
        insuranceDigits,
        standardDigits,
      ])
    );

    if (body.fastOnly) {
      const dbDrug = await prisma.drug.findFirst({
        where: {
          OR: [
            ...(body.standardCode ? [{ standardCode: body.standardCode }] : []),
            ...(body.insuranceCode ? [{ insuranceCode: body.insuranceCode }] : []),
            { productName: { contains: body.productName } },
          ],
        },
        select: {
          productName: true,
          ingredientName: true,
          company: true,
          reimbursement: true,
          priceLabel: true,
          insuranceCode: true,
          standardCode: true,
          atcCode: true,
          type: true,
          releaseDate: true,
          imageUrl: true,
          efficacy: true,
          precaution: true,
          identification: true,
          rawJson: true,
        },
      });

      const detailProductName = pick(dbDrug || {}, ['productName']) || body.productName;
      const ingredientName = pick(dbDrug || {}, ['ingredientName']);
      const atcCode = pick(dbDrug || {}, ['atcCode']) || body.atcCode || '-';
      const fallback = ingredientFallbackText(detailProductName, ingredientName, atcCode);
      const efficacyText = cleanLongText(pick(dbDrug || {}, ['efficacy']));
      const usageText = cleanLongText(pick(dbDrug || {}, ['identification']));
      const cautionText = cleanLongText(pick(dbDrug || {}, ['precaution']));
      const insuranceCode = pick(dbDrug || {}, ['insuranceCode']) || body.insuranceCode || '-';
      const standardCode = pick(dbDrug || {}, ['standardCode']) || body.standardCode || '-';
      const priceLabel = pick(dbDrug || {}, ['priceLabel']);
      const reimbursement = pick(dbDrug || {}, ['reimbursement']) || '급여구분미확인';

      return NextResponse.json({
        success: true,
        detail: {
          productName: detailProductName,
          type: pick(dbDrug || {}, ['type']) || '-',
          company: pick(dbDrug || {}, ['company']) || body.company || '-',
          seller: pick(dbDrug || {}, ['company']) || body.company || '-',
          productionStatus: pick(dbDrug || {}, ['releaseDate']) || '-',
          insuranceInfo: [insuranceCode, priceLabel, reimbursement].filter(Boolean).join(' / ') || '-',
          ministryClass: '-',
          kimsClass: pick(dbDrug || {}, ['type']) || '-',
          atcCode,
          ingredientCode: ingredientName || '-',
          ingredientContent: ingredientName || '-',
          efficacyText: isPlaceholderDetailText(efficacyText) ? fallback.efficacy : efficacyText,
          usageText: isPlaceholderDetailText(usageText) ? fallback.usage : usageText,
          cautionText: isPlaceholderDetailText(cautionText) ? fallback.caution : cautionText,
          durSections: [],
          unavailableOfficialSections: [],
          additives: '-',
          packageInfo: [{ label: '-', standardCode }],
          imageUrl: buildImageUrl(pick(dbDrug || {}, ['imageUrl']), extractImageFromRawJson((dbDrug as any)?.rawJson || null)),
          ingredientName,
          permitNo: '-',
          className: pick(dbDrug || {}, ['type']) || '-',
          standardCode,
          insuranceCode,
          reimbursement,
          raw: { dbDrug },
        },
      });
    }

    const easyDrug = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbEasyDrugInfoService'));
    const permitInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrugPrdtPrmsnInfoService07'));
    const grainIdentify = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('MdcinGrnIdntfcInfoService03'));
    const bundleInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbBundleInfoService02'));
    const durProductInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DURPrdlstInfoService03'));

    const calls = await Promise.allSettled([
      easyDrug
        ? callPublicDrugApi({
            serviceName: easyDrug.serviceName,
            baseUrl: easyDrug.baseUrl,
            operation: '/getDrbEasyDrugList',
            query: { itemName: body.productName, entpName: body.company },
          })
        : Promise.resolve(null),
      permitInfo
        ? callPublicDrugApi({
            serviceName: permitInfo.serviceName,
            baseUrl: permitInfo.baseUrl,
            operation: '/getDrugPrdtPrmsnDtlInq06',
            query: { item_name: body.productName, entp_name: body.company },
          })
        : Promise.resolve(null),
      permitInfo && productCodeCandidates.length > 0
        ? callPublicDrugApi({
            serviceName: permitInfo.serviceName,
            baseUrl: permitInfo.baseUrl,
            operation: '/getDrugPrdtPrmsnDtlInq06',
            query: { item_seq: productCodeCandidates[0] },
          })
        : Promise.resolve(null),
      grainIdentify
        ? callPublicDrugApi({
            serviceName: grainIdentify.serviceName,
            baseUrl: grainIdentify.baseUrl,
            operation: '/getMdcinGrnIdntfcInfoList03',
            query: { item_name: body.productName, entp_name: body.company },
          })
        : Promise.resolve(null),
      bundleInfo
        ? callPublicDrugApi({
            serviceName: bundleInfo.serviceName,
            baseUrl: bundleInfo.baseUrl,
            operation: '/getDrbBundleList02',
            query: { item_name: body.productName },
          })
        : Promise.resolve(null),
      durProductInfo
        ? callPublicDrugApi({
            serviceName: durProductInfo.serviceName,
            baseUrl: durProductInfo.baseUrl,
            operation: '/getDurPrdlstInfoList03',
            query: { itemName: body.productName },
          })
        : Promise.resolve(null),
      prisma.drug.findFirst({
        where: {
          OR: [
            ...(body.standardCode ? [{ standardCode: body.standardCode }] : []),
            ...(body.insuranceCode ? [{ insuranceCode: body.insuranceCode }] : []),
            { productName: { contains: body.productName } },
          ],
        },
        select: {
          productName: true,
          ingredientName: true,
          company: true,
          reimbursement: true,
          priceLabel: true,
          insuranceCode: true,
          standardCode: true,
          atcCode: true,
          type: true,
          releaseDate: true,
          imageUrl: true,
          efficacy: true,
          precaution: true,
          identification: true,
          rawJson: true,
        },
      }),
    ]);

    const [easy, permitByName, permitByCode, grain, bundle, durProduct, dbDrug] = calls.map((r) =>
      r.status === 'fulfilled' ? r.value : null
    );

    const easyItem = firstItem(easy);
    const permitItems = [...extractItems(permitByName), ...extractItems(permitByCode)];
    const permitItem = bestPermitItem(permitItems, body.productName, body.company) || firstItem(permitByName) || firstItem(permitByCode);
    const grainItem = firstItem(grain);
    const bundleItems = extractItems(bundle);
    const bundleItem = bundleItems[0] || null;
    const durItem = firstItem(durProduct);

    const packageInfo = bundleItems
      .map((item) => {
        const quantity = pick(item, ['packUnit', 'PACK_UNIT', 'packQty', 'PACK_QTY', '포장단위']);
        const standardCode = pick(item, ['barCode', 'BAR_CODE', '표준코드', 'stdCode', 'STD_CD']);
        const packageType = pick(item, ['pkgType', 'PKG_TYPE', 'packageType']);
        const label = normalizeText([quantity, packageType].filter(Boolean).join(' / '));
        if (!label && !standardCode) return null;
        return {
          label: label || '-',
          standardCode: standardCode || '-',
        };
      })
      .filter(Boolean)
      .filter((item, idx, arr) => arr.findIndex((a: any) => a.label === (item as any).label && a.standardCode === (item as any).standardCode) === idx)
      .slice(0, 6);

    const storedImageFromDb = buildImageUrl(pick(dbDrug || {}, ['imageUrl']));
    const rawImageFromDb = extractImageFromRawJson((dbDrug as any)?.rawJson || null);

    const efficacyText =
      pickLongestText(easyItem, ['efcyQesitm', 'EFCY_QESITM', 'EE_DOC_DATA']) ||
      pickLongestText(permitItem, ['eeDocData', 'EE_DOC_DATA']) ||
      cleanLongText(pick(dbDrug || {}, ['efficacy']));
    const usageText =
      pickLongestText(easyItem, ['useMethodQesitm', 'USE_METHOD_QESITM', 'UD_DOC_DATA']) ||
      pickLongestText(permitItem, ['udDocData', 'UD_DOC_DATA']) ||
      cleanLongText(pick(dbDrug || {}, ['identification']));
    const cautionText =
      pickLongestText(easyItem, ['atpnWarnQesitm', 'ATPN_WARN_QESITM', 'atpnQesitm', 'ATPN_QESITM', 'NB_DOC_DATA']) ||
      pickLongestText(permitItem, ['nbDocData', 'NB_DOC_DATA']) ||
      cleanLongText(pick(dbDrug || {}, ['precaution']));

    const reimbursement = pick(dbDrug || {}, ['reimbursement']) || pick(bundleItem || {}, ['payYn', '급여구분']);
    const priceLabel = pick(dbDrug || {}, ['priceLabel']) || pick(bundleItem || {}, ['maxAmt', 'amt', 'price', '약가']);
    const insuranceCode =
      pick(dbDrug || {}, ['insuranceCode']) ||
      pick(bundleItem || permitItem || {}, ['ediCode', '보험코드', 'itemSeq', 'ITEM_SEQ']) ||
      body.insuranceCode ||
      '-';
    const standardCode =
      pick(dbDrug || {}, ['standardCode']) ||
      pick(grainItem || bundleItem || {}, ['stdCode', '표준코드', 'barCode', 'BAR_CODE']) ||
      body.standardCode ||
      '-';

    const insuranceInfoParts = [
      insuranceCode && insuranceCode !== '-' ? insuranceCode : '',
      priceLabel,
      reimbursement,
    ].filter(Boolean);

    const detailProductName =
      pick(dbDrug || {}, ['productName']) ||
      pick(easyItem || permitItem || grainItem || {}, ['itemName', 'ITEM_NAME', '품목명']) ||
      body.productName;
    const detailCompany =
      pick(dbDrug || {}, ['company']) ||
      pick(permitItem || easyItem || {}, ['entpName', 'ENTP_NAME', '업체명']) ||
      body.company ||
      '-';
    const indexedImageUrl = await findImageFromCompactIndex(detailProductName, detailCompany, standardCode, insuranceCode);
    const durSections = await findDurSections({
      productName: detailProductName,
      company: detailCompany,
      standardCode,
      insuranceCode,
      itemSeqCandidates: compact([
        ...productCodeCandidates,
        pick(permitItem || {}, ['itemSeq', 'ITEM_SEQ']),
        pick(durItem || {}, ['itemSeq', 'ITEM_SEQ']),
        pick(grainItem || {}, ['itemSeq', 'ITEM_SEQ']),
      ]),
      ingredientCandidates: compact([
        detailProductName,
        pick(dbDrug || {}, ['ingredientName']),
        pick(permitItem || durItem || easyItem || {}, ['materialName', 'MATERIAL_NAME', 'mainIngr', 'MAIN_INGR', '성분']),
        pick(durItem || grainItem || {}, ['ingrName', 'INGR_NAME', 'INGR_KOR_NAME', 'mainItemIngr', 'MAIN_ITEM_INGR']),
        pick(easyItem || grainItem || {}, ['mainIngr', 'MAIN_INGR', 'ingrName', '성분명']),
      ]),
    });

    const detail = {
      productName: detailProductName,
      type:
        pick(dbDrug || {}, ['type']) ||
        pick(easyItem || durItem || {}, ['etcOtcCode', 'ETC_OTC_NAME', '전문일반구분', 'specializedGeneral']) ||
        '-',
      company: detailCompany,
      seller:
        pick(permitItem || {}, ['bizrno', 'BIZRNO', '업체명', 'entpName']) ||
        body.company ||
        '-',
      productionStatus: normalizeText(
        [
          pick(permitItem || {}, ['prductPrmisnDe', 'ITEM_PERMIT_DATE', 'itemPermitDate', '허가일자']),
          pick(dbDrug || {}, ['releaseDate']) || pick(permitItem || {}, ['openDe', 'releaseDate']),
        ]
          .filter(Boolean)
          .join(' / ')
      ) || '-',
      insuranceInfo: insuranceInfoParts.length > 0 ? insuranceInfoParts.join(' / ') : '-',
      ministryClass:
        pick(permitItem || durItem || {}, ['classNo', 'CLASS_NO', 'className', 'CLASS_NAME']) ||
        '-',
      kimsClass:
        pick(easyItem || permitItem || {}, ['chart', 'CHART', 'className', 'CLASS_NAME']) ||
        pick(dbDrug || {}, ['type']) ||
        '-',
      atcCode:
        pick(dbDrug || {}, ['atcCode']) ||
        pick(grainItem || easyItem || {}, ['atcCode', 'ATC_CODE']) ||
        body.atcCode ||
        '-',
      ingredientCode:
        pick(durItem || grainItem || {}, ['ingrCode', 'INGR_CODE', 'mainItemIngr', 'MAIN_ITEM_INGR']) ||
        pick(dbDrug || {}, ['ingredientName']) ||
        '-',
      ingredientContent:
        pick(permitItem || durItem || easyItem || {}, ['materialName', 'MATERIAL_NAME', 'mainIngr', 'MAIN_INGR', '성분']) ||
        pick(dbDrug || {}, ['ingredientName']) ||
        '-',
      efficacyText: efficacyText || '데이터 없음',
      usageText: usageText || '데이터 없음',
      cautionText: cautionText || '데이터 없음',
      durSections,
      unavailableOfficialSections: [
        '상병코드',
        '약가이력정보',
        '급여심사기준',
        '안전성서한',
        '대체가능의약품',
        '간장애주의',
        '신장애주의',
        '경구제 복용법',
        '분할분쇄주의정보',
      ],
      additives:
        pick(permitItem || {}, ['eeDocData', 'EE_DOC_DATA', 'etcOtcName', 'EFCY_QESITM']) ||
        '-',
      packageInfo: packageInfo.length > 0 ? packageInfo : [{ label: '-', standardCode: standardCode || '-' }],
      imageUrl: buildImageUrl(
        storedImageFromDb,
        rawImageFromDb,
        pick(grainItem || {}, ['ITEM_IMAGE', 'itemImage', 'ITEM_IMAGE1', 'itemImage1']),
        pick(easyItem || {}, ['itemImage', 'ITEM_IMAGE', 'itemImage1', 'ITEM_IMAGE1']),
        pick(permitItem || {}, [
          'itemImage',
          'ITEM_IMAGE',
          'bigPrdtImgUrl',
          'BIG_PRDT_IMG_URL',
          'smallPrdtImgUrl',
          'SMALL_PRDT_IMG_URL',
        ]),
        indexedImageUrl,
      ),
      ingredientName: pick(easyItem || grainItem || {}, ['mainIngr', 'MAIN_INGR', 'ingrName', '성분명']),
      permitNo: pick(permitItem || {}, ['itemPermitDate', 'ITEM_PERMIT_DATE', '허가일자']),
      className: pick(easyItem || {}, ['etcOtcCode', 'ETC_OTC_NAME', '전문일반구분']),
      standardCode,
      insuranceCode,
      reimbursement,
      raw: {
        easyItem,
        permitItem,
        grainItem,
        bundleItem,
        durItem,
        dbDrug,
      },
    };

    return NextResponse.json({ success: true, detail });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || '약제 상세 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
