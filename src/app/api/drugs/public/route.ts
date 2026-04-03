import { NextResponse } from 'next/server';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type PublicBody = {
  productName: string;
  ingredientName?: string;
  company?: string;
};

type TableSection = {
  label: string;
  ok: boolean;
  total: number;
  columns: string[];
  rows: string[][];
  error?: string;
};

function pick(item: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return `${value}`.trim();
    }
  }
  return '-';
}

function normalizeSectionRows(label: string, items: any[]): { columns: string[]; rows: string[][] } {
  const top = items.slice(0, 30);

  if (label === '비급여 진료비') {
    const columns = ['항목명', '코드', '기관명', '금액/단위'];
    const rows = top.map((item) => [
      pick(item, ['itemNm', 'itemName', 'PRDLST_NM', '항목명']),
      pick(item, ['itemCd', 'itemCode', 'ediCode', '코드']),
      pick(item, ['yadmNm', 'entpName', '기관명']),
      pick(item, ['amt', 'price', 'spec', '금액']),
    ]);
    return { columns, rows };
  }

  if (label === '질병 코드/통계') {
    const columns = ['질병명', '질병코드', '참고'];
    const rows = top.map((item) => [
      pick(item, ['sickNm', 'dissName', '상병명']),
      pick(item, ['sickCd', 'dissCd', '질병코드']),
      pick(item, ['note', 'stdrYear', '참고']),
    ]);
    return { columns, rows };
  }

  if (label === '성분 약효') {
    const columns = ['성분명', '약효분류', '코드'];
    const rows = top.map((item) => [
      pick(item, ['cmpnNm', 'ingrName', '성분명']),
      pick(item, ['meftNm', 'efcyClsf', '약효']),
      pick(item, ['cmpnCd', 'code', '코드']),
    ]);
    return { columns, rows };
  }

  if (label === '의약품 사용 통계') {
    const columns = ['ATC 코드', '분류명', '사용량/건수'];
    const rows = top.map((item) => [
      pick(item, ['atcCd', 'atcCode', 'ATC_CODE']),
      pick(item, ['atcNm', 'classNm', '분류명']),
      pick(item, ['useCnt', 'qty', 'cnt', '건수']),
    ]);
    return { columns, rows };
  }

  const columns = ['제품명', '코드', '가격/기준'];
  const rows = top.map((item) => [
    pick(item, ['itemNm', 'itemName', '품목명']),
    pick(item, ['itemCd', 'ediCode', 'code', '코드']),
    pick(item, ['amt', 'price', '기준가', 'spec']),
  ]);
  return { columns, rows };
}

async function safeSection(label: string, fn: () => Promise<any>) {
  try {
    const payload = await fn();
    const items = extractItems(payload);
    const table = normalizeSectionRows(label, items);
    return {
      label,
      ok: true,
      total: items.length,
      columns: table.columns,
      rows: table.rows,
    };
  } catch (error: any) {
    return {
      label,
      ok: false,
      total: 0,
      columns: [],
      rows: [],
      error: error?.message || '조회 실패',
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PublicBody;
    if (!body.productName?.trim()) {
      return NextResponse.json({ success: false, message: 'productName 이 필요합니다.' }, { status: 400 });
    }

    const nonPayment = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('nonPaymentDamtInfoService'));
    const disease = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('diseaseInfoService1'));
    const componentEffect = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('msupCmpnMeftInfoService'));
    const usage = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('msupUserInfoService1.2'));
    const priceRef = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('dgamtrCtrInfoService1.2'));

    const sections = (await Promise.all([
      safeSection('비급여 진료비', () => {
        if (!nonPayment) throw new Error('서비스 없음');
        return callPublicDrugApi({
          serviceName: nonPayment.serviceName,
          baseUrl: nonPayment.baseUrl,
          operation: '/getNonPaymentItmemCodeList2',
          query: {
            yadmNm: body.company,
            itemNm: body.productName,
            item_name: body.productName,
            itemName: body.productName,
          },
        });
      }),
      safeSection('질병 코드/통계', () => {
        if (!disease) throw new Error('서비스 없음');
        return callPublicDrugApi({
          serviceName: disease.serviceName,
          baseUrl: disease.baseUrl,
          operation: '/getDissNameCodeList1',
          query: {
            sickNm: body.productName,
            itemNm: body.productName,
          },
        });
      }),
      safeSection('성분 약효', () => {
        if (!componentEffect) throw new Error('서비스 없음');
        return callPublicDrugApi({
          serviceName: componentEffect.serviceName,
          baseUrl: componentEffect.baseUrl,
          operation: '/getMajorCmpnNmCdList',
          query: {
            cmpnNm: body.ingredientName || body.productName,
            ingrName: body.ingredientName || body.productName,
          },
        });
      }),
      safeSection('의약품 사용 통계', () => {
        if (!usage) throw new Error('서비스 없음');
        return callPublicDrugApi({
          serviceName: usage.serviceName,
          baseUrl: usage.baseUrl,
          operation: '/getAtcStp4ClList1.2',
          query: {
            cmpnNm: body.ingredientName || body.productName,
            ingrName: body.ingredientName || body.productName,
          },
        });
      }),
      safeSection('약가 기준 정보', () => {
        if (!priceRef) throw new Error('서비스 없음');
        return callPublicDrugApi({
          serviceName: priceRef.serviceName,
          baseUrl: priceRef.baseUrl,
          operation: '/getDgamtList',
          query: {
            itemNm: body.productName,
            item_name: body.productName,
            itemName: body.productName,
          },
        });
      }),
    ])) as TableSection[];

    return NextResponse.json({ success: true, sections });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || '공공 데이터 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
