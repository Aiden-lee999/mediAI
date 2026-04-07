import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';
import { loadDrugPrices } from '@/lib/drugPricesCsv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SearchBody = {
  productName?: string;
  ingredientName?: string;
  company?: string;
};

// 1. 공공 데이터 API 비동기 처방빈도 조회 함수 (맵으로 반환)
async function fetchUsageScan(keyword: string): Promise<Record<string, number>> {
  const usageInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('msupUserInfoService1.2'));
  if (!usageInfo || !keyword.trim()) return {};

  const usageMap: Record<string, number> = {};
  
  try {
    const dates = ['202301', '202306', '202312', '202401'];
    
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
          const name = (item.itemName || item.itemNm || item.ITEM_NAME || '').split('(')[0].trim() || 'UNKNOWN';
          if (!isNaN(qty) && name) {
            usageMap[name] = (usageMap[name] || 0) + qty;
          }
        });
      } catch (err) {}
    }));

    return usageMap;
  } catch (error) {
    return {};
  }
}

// 2. 공공 데이터 API 비동기 식약처 조회 함수 (성분 보완 및 자체 검색용)
async function fetchIngredientScan(productKw: string, ingrKw: string, compKw: string) {
  const easyDrug = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbEasyDrugInfoService'));
  if (!easyDrug || (!productKw.trim() && !ingrKw.trim())) return [];

  const queryParams: Record<string, string | number> = { numOfRows: 100, pageNo: 1 };
  if (productKw.trim()) {
    queryParams.itemName = productKw.trim();
    queryParams.item_name = productKw.trim();
  }
  if (ingrKw.trim()) {
    queryParams.ingrName = ingrKw.trim();
    queryParams.ingr_name = ingrKw.trim();
  }
  if (compKw.trim()) {
    queryParams.entpName = compKw.trim();
    queryParams.entp_name = compKw.trim();
  }

  try {
    const payload = await callPublicDrugApi({
      serviceName: easyDrug.serviceName,
      baseUrl: easyDrug.baseUrl,
      operation: '/getDrbEasyDrugList',
      query: queryParams,
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

    // 1. 초고속 로컬 DB 검색 (대소문자 구분 없는 영문 검색 지원)
    const conditions: any[] = [];
    if (productName) conditions.push({ productName: { contains: productName, mode: 'insensitive' } });
    if (ingredientName) conditions.push({ ingredientName: { contains: ingredientName, mode: 'insensitive' } });
    if (company) conditions.push({ company: { contains: company, mode: 'insensitive' } });

    const drugs = await prisma.drug.findMany({
      where: { AND: conditions },
      take: 150,
    });

    // 2. 하이브리드 공공API (실시간) 보완 호출
    const targetKeyword = productName || ingredientName || '';
    
    // DB 데이터가 비어있어도 공공데이터 갱신시도를 같이 한다.
    const [fetchedUsageMap, fetchedIngredients, priceMap] = await Promise.all([
      targetKeyword ? fetchUsageScan(targetKeyword) : Promise.resolve({}),
      (productName || ingredientName) ? fetchIngredientScan(productName, ingredientName, company) : Promise.resolve([]),
      loadDrugPrices().catch(() => new Map<string, string>())
    ]);

    // 3. 결합 (하이브리드 병합)
    // DB에서 찾지 못한 성분검색 결과가 공공데이터에 있다면 DB 리스트에 동적으로 추가해줌.
    const hybridDrugs: any[] = [...drugs];

    fetchedIngredients.forEach((apiItem: any) => {
      const title = (apiItem.itemName || apiItem.ITEM_NAME || apiItem.item_name || '').split('(')[0].trim();
      const exists = hybridDrugs.find(d => d.productName.includes(title));
      
      // DB에 없는 약품이면 (특히 성분 검색시) 리스트에 추가
      if (!exists && title) {
        const pCode = String(apiItem.itemSeq || apiItem.ITEM_SEQ || '');
        const fallbackPrice = pCode ? priceMap.get(pCode) : undefined;

        hybridDrugs.push({
           id: pCode || Math.random().toString(),
           productName: title,
           ingredientName: apiItem.itemIngrName || apiItem.item_ingr_name || apiItem.ITEM_INGR_NAME || ingredientName || '-',
           company: apiItem.entpName || apiItem.entp_name || '-',
           priceLabel: fallbackPrice ? `${fallbackPrice}원` : '가격정보없음',
           reimbursement: fallbackPrice ? '급여' : '비급여',
           insuranceCode: '',
           standardCode: pCode,
           atcCode: '',
           type: '',
           releaseDate: '',
           usageFrequency: 0,
           _isApiFallback: true,
        });
      }
    });

    // 4. 매핑 및 형변환
    const finalItems = hybridDrugs.map((item) => {
      let p = (item.priceLabel || '').trim();
      const c = (item.reimbursement || '').trim() || '비급여';
      
      const dbPcode = String(item.standardCode || item.id || '');
      const dynamicPrice = dbPcode ? priceMap.get(dbPcode) : undefined;
      
      if (!p || p === '가격정보없음') {
         if (dynamicPrice) {
             p = `${dynamicPrice}원`;
         }
      }

      if (p && /[0-9]/.test(p) && p !== '가격정보없음') {
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
      
      // 5. 처방빈도 맵에서 현재 약품 이름으로 매칭해서 가져오기
      const pNameTrimmed = item.productName.split('(')[0].trim().toLowerCase();
      // 맵을 순회하며 이름이 포함되면 가져옴. (가장 유사하게)
      let foundFreq = 0;
      for (const [key, val] of Object.entries(fetchedUsageMap)) {
        if (key.toLowerCase().includes(pNameTrimmed) || pNameTrimmed.includes(key.toLowerCase())) {
          foundFreq += val as number;
        }
      }

      if (finalFreq === 0 && foundFreq > 0) {
        finalFreq = foundFreq;
        isAugmented = true; // 플래그 켜기
      }

      return {
        id: item.standardCode || item.id,
        productName: item.productName || '-',
        ingredientName: finalIngr,
        company: item.company || '-',
        priceLabel: p === '가격정보없음' ? '가격정보없음 / ' + c : p + ' / ' + c,
        reimbursement: c,
        insuranceCode: item.insuranceCode || '',
        standardCode: item.standardCode || '',
        atcCode: item.atcCode || '',
        type: item.type || '',
        releaseDate: item.releaseDate || '',
        usageFrequency: finalFreq,
        // 강화된 데이터인 경우 태그를 추가하여 알려줌. 완전 API 출신이면 분기.
        sourceService: item._isApiFallback ? '공공API(자체DB 누락)' : (isAugmented ? '자체DB(Supabase) + 공공API(실시간 채움)' : '자체DB(Supabase)'),
      };
    });

    // 5. 처방빈도(사용량) 기준으로 내림차순 정렬 (타이레놀 같은 오리지널 대장약이 가장 위로 올라오게)
    finalItems.sort((a, b) => b.usageFrequency - a.usageFrequency);

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

