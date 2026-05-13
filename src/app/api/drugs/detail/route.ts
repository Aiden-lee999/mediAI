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
