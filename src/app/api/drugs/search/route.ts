import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SearchBody = {
  productName?: string;
  ingredientName?: string;
  company?: string;
};

// 1. 공공 데이터 API 비동기 처방빈도 조회 함수 (한 번만 호출)
async function fetchUsageScan(keyword: string) {
  const usageInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('msupUserInfoService1.2'));
  if (!usageInfo || !keyword.trim()) return 0;

  try {
    const dates = ['202301', '202306', '202312', '202401'];
    let totalQty = 0;
    
    await Promise.all(dates.map(async (ym) => {
      try {
        const payload = await callPublicDrugApi({
          serviceName: '처방통계조회',
          baseUrl: usageInfo.baseUrl,
          operation: '/getCmpnAreaList1.2',
          query: {
            numOfRows: 100,
            pageNo: 1,
            mdcareYm: ym,
            mdcinCmpnGnrlNm: keyword,
          },
        });

        const items = extractItems(payload);
        items.forEach((item: any) => {
          const qty = Number(item.totUseQty || item.useQty || 0);
          if (!isNaN(qty)) totalQty += qty;
        });
      } catch (err) {}
    }));

    return totalQty;
  } catch (error) {
    return 0;
  }
}

// 2. 공공 데이터 API 비동기 식약처 조회 함수 (성분 보완용)
async function fetchIngredientScan(keyword: string) {
  const easyDrug = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbEasyDrugInfoService'));
  if (!easyDrug || !keyword.trim()) return [];

  try {
    const payload = await callPublicDrugApi({
      serviceName: easyDrug.serviceName,
      baseUrl: easyDrug.baseUrl,
      operation: '/getDrbEasyDrugList',
      query: { itemName: keyword, numOfRows: 30, pageNo: 1 },
    });
    return extractItems(payload);
  } catch (err) {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchBody;
    const productName = (body.productName || '').trim();
    const ingredientName = (body.ingredientName || '').trim();
    const company = (body.company || '').trim();
    
    if (!productName && !ingredientName && !company) {
      return NextResponse.json({
        success: true,
        items: []
      });
    }

    // 1. 초고속 로컬 DB 검색
    const conditions: any[] = [];
    if (productName) conditions.push({ productName: { contains: productName } });
    if (ingredientName) conditions.push({ ingredientName: { contains: ingredientName } });
    if (company) conditions.push({ company: { contains: company } });

    const drugs = await prisma.drug.findMany({
      where: { AND: conditions },
      take: 150,
    });

    // 2. 하이브리드 공공API (실시간) 보완 호출
    const targetKeyword = productName || ingredientName || '';
    
    // DB 데이터가 비어있어도 공공데이터 갱신시도를 같이 한다.
    const [fetchedUsageQty, fetchedIngredients] = await Promise.all([
      targetKeyword ? fetchUsageScan(targetKeyword) : Promise.resolve(0),
      productName ? fetchIngredientScan(productName) : Promise.resolve([])
    ]);

    // 3. 결합 및 반환
    const finalItems = drugs.map((item) => {
      let p = (item.priceLabel || '').trim();
      const c = (item.reimbursement || '').trim() || '비급여';
      
      if (p && /[0-9]/.test(p)) {
        if (!p.includes('원')) p += '원';
      } else {
        p = '가격정보없음';
      }

      let isAugmented = false;
      let finalIngr = item.ingredientName || '-';

      // 이름이 비슷한 식약처 아이템이 있다면 성분채우기
      if (finalIngr === '-' || !finalIngr) {
        const found = fetchedIngredients.find((fi: any) => 
           (fi.itemName || '').includes(item.productName.split('(')[0])
        );
        if (found && (found.itemIngrName || found.item_ingr_name)) {
           finalIngr = String(found.itemIngrName || found.item_ingr_name);
           isAugmented = true;
        }
      }

      let finalFreq = item.usageFrequency || 0;
      if (finalFreq === 0 && fetchedUsageQty > 0) {
        finalFreq = fetchedUsageQty;
        isAugmented = true; // 플래그 켜기
      }

      return {
        id: item.standardCode || item.id,
        productName: item.productName || '-',
        ingredientName: finalIngr,
        company: item.company || '-',
        priceLabel: p + ' / ' + c,
        reimbursement: c,
        insuranceCode: item.insuranceCode || '',
        standardCode: item.standardCode || '',
        atcCode: item.atcCode || '',
        type: item.type || '',
        releaseDate: item.releaseDate || '',
        usageFrequency: finalFreq,
        // 강화된 데이터인 경우 태그를 추가하여 알려줌
        sourceService: isAugmented ? '자체DB(Supabase) + 공공API(실시간 채움)' : '자체DB(Supabase)',
      };
    });

    return NextResponse.json({
      success: true,
      count: finalItems.length,
      items: finalItems,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Database Search Error:', error);
    return NextResponse.json(
      { success: false, message: 'DB 검색 중 오류가 발생했습니다.', error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

