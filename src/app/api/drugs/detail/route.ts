import { NextResponse } from 'next/server';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DetailBody = {
  productName: string;
  company?: string;
  standardCode?: string;
  insuranceCode?: string;
  atcCode?: string;
};

function firstItem(payload: any) {
  return extractItems(payload)[0] || null;
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
            operation: '/getDURPrdlstInfoList03',
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
        },
      }),
    ]);

    const [easy, permitByName, permitByCode, grain, bundle, durProduct, dbDrug] = calls.map((r) =>
      r.status === 'fulfilled' ? r.value : null
    );

    const easyItem = firstItem(easy);
    const permitItem = firstItem(permitByName) || firstItem(permitByCode);
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
      .filter(Boolean);

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

    const detail = {
      productName:
        pick(dbDrug || {}, ['productName']) ||
        pick(easyItem || permitItem || grainItem || {}, ['itemName', 'ITEM_NAME', '품목명']) ||
        body.productName,
      type:
        pick(dbDrug || {}, ['type']) ||
        pick(easyItem || durItem || {}, ['etcOtcCode', 'ETC_OTC_NAME', '전문일반구분', 'specializedGeneral']) ||
        '-',
      company:
        pick(dbDrug || {}, ['company']) ||
        pick(permitItem || easyItem || {}, ['entpName', 'ENTP_NAME', '업체명']) ||
        body.company ||
        '-',
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
      additives:
        pick(permitItem || {}, ['eeDocData', 'EE_DOC_DATA', 'etcOtcName', 'EFCY_QESITM']) ||
        '-',
      packageInfo: packageInfo.length > 0 ? packageInfo : [{ label: '-', standardCode: standardCode || '-' }],
      imageUrl:
        pick(grainItem || easyItem || {}, ['itemImage', 'ITEM_IMAGE', 'itemImage1', 'ITEM_IMAGE1', 'imgRegistTs']) ||
        '',
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
