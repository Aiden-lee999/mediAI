import { NextResponse } from 'next/server';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DetailBody = {
  productName: string;
  company?: string;
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DetailBody;
    if (!body.productName?.trim()) {
      return NextResponse.json({ success: false, message: 'productName 이 필요합니다.' }, { status: 400 });
    }

    const easyDrug = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbEasyDrugInfoService'));
    const permitInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrugPrdtPrmsnInfoService07'));
    const grainIdentify = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('MdcinGrnIdntfcInfoService03'));
    const bundleInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbBundleInfoService02'));

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
    ]);

    const [easy, permit, grain, bundle] = calls.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const easyItem = firstItem(easy);
    const permitItem = firstItem(permit);
    const grainItem = firstItem(grain);
    const bundleItem = firstItem(bundle);

    const detail = {
      productName: pick(easyItem || permitItem || grainItem || {}, ['itemName', 'ITEM_NAME', '품목명']),
      ingredientName: pick(easyItem || grainItem || {}, ['mainIngr', 'MAIN_INGR', 'ingrName', '성분명']),
      company: pick(permitItem || easyItem || {}, ['entpName', 'ENTP_NAME', '업체명']),
      permitNo: pick(permitItem || {}, ['itemPermitDate', 'ITEM_PERMIT_DATE', '허가일자']),
      className: pick(easyItem || {}, ['etcOtcCode', 'ETC_OTC_NAME', '전문일반구분']),
      atcCode: pick(grainItem || easyItem || {}, ['atcCode', 'ATC_CODE']),
      standardCode: pick(grainItem || bundleItem || {}, ['stdCode', '표준코드', 'barCode', 'BAR_CODE']),
      insuranceCode: pick(bundleItem || permitItem || {}, ['ediCode', '보험코드', 'itemSeq', 'ITEM_SEQ']),
      reimbursement: pick(bundleItem || easyItem || {}, ['급여구분', 'payYn', 'reim']),
      raw: {
        easyItem,
        permitItem,
        grainItem,
        bundleItem,
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
