import { NextResponse } from 'next/server';
import {
  callPublicDrugApi,
  extractItems,
  mergeAndFilterDrugItems,
  normalizeDrugItem,
} from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';
import { searchDrugMasterRows } from '@/lib/drugMasterCsv';
import { getPriceByProductCode, loadDrugPrices } from '@/lib/drugPricesCsv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SearchBody = {
  productName?: string;
  ingredientName?: string;
  company?: string;
};

function normalizeIngredientText(value: string, keyword: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return keyword;

  // CSV fallback 라인의 전체 문자열이 들어온 경우, 괄호 안 성분명 또는 검색 키워드로 축약
  const paren = trimmed.match(/\(([^()]+)\)/);
  if (paren?.[1]) {
    const inside = paren[1].trim();
    if (inside.length <= 60) return inside;
  }

  if (trimmed.length > 80) {
    return keyword || trimmed.slice(0, 80);
  }

  return trimmed;
}

function composePriceCoverageLabel(price: string, coverage: string) {
  let p = (price || '').trim();
  const c = (coverage || '').trim();
  
  // 상한금액 숫자가 있으면 "원" 붙임
  if (p && /[0-9]/.test(p)) {
    if (!p.includes('원')) {
      p = `${p}원`;
    }
  } else if (!(p.includes('/') || p.includes('구분'))) {
    p = '가격정보없음';
  }
  
  const priceText = p || '가격정보없음';
  const coverageText = c || '급여구분미확인';
  return `${priceText} / ${coverageText}`;
}

async function fallbackIngredientScan(keyword: string) {
  const permitInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrugPrdtPrmsnInfoService07'));
  if (!permitInfo || !keyword.trim()) return [];

  const lower = keyword.trim().toLowerCase();
  const found: any[] = [];

  for (let page = 1; page <= 20; page += 1) {
    try {
      const payload = await callPublicDrugApi({
        serviceName: `${permitInfo.serviceName}:fallback-scan`,
        baseUrl: permitInfo.baseUrl,
        operation: '/getDrugPrdtPrmsnInq07',
        query: {
          numOfRows: 200,
          pageNo: page,
        },
      });

      const items = extractItems(payload);
      if (!items.length) break;

      const matched = items.filter((item: any) => {
        const ingr = (item.ITEM_INGR_NAME || item.mainIngr || '').toString().toLowerCase();
        const name = (item.ITEM_NAME || item.itemName || '').toString().toLowerCase();
        return ingr.includes(lower) || name.includes(lower);
      });

      found.push(...matched.map((item: any) => normalizeDrugItem(item, payload?.service || 'fallback-scan')));

      if (found.length >= 150) break;
    } catch {
      break;
    }
  }

  return found;
}

async function fallbackUsageScan(keyword: string) {
  const usageInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('msupUserInfoService1.2'));
  if (!usageInfo || !keyword.trim()) return 0;

  try {
    // 2023년 상하반기 범위 샘플을 조회하여 합산 (범위 조회)
    const dates = ["202301", "202306", "202312", "202401"];
    let totalQty = 0;
    
    // 여러 진료년월 범위에서 처방 데이터를 합산
    await Promise.all(dates.map(async (ym) => {
      try {
        const payload = await callPublicDrugApi({
          serviceName: '건강보험심사평가원_의약품사용정보조회서비스',
          baseUrl: usageInfo.baseUrl,
          operation: '/getCmpnAreaList1.2',
          query: {
            numOfRows: 200,
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
      } catch (err) {
        // 개별 통신 에러 무시
      }
    }));

    return totalQty;
  } catch (error) {
    return 0;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchBody;
    const keyword = (body.productName || '').trim();
    const ingredientKeyword = (body.ingredientName || '').trim() || keyword;

    const easyDrug = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrbEasyDrugInfoService'));
    const grainIdentify = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('MdcinGrnIdntfcInfoService03'));
    const permitInfo = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DrugPrdtPrmsnInfoService07'));

    const requests: Promise<any>[] = [];

    if (easyDrug) {
      requests.push(
        callPublicDrugApi({
          serviceName: easyDrug.serviceName,
          baseUrl: easyDrug.baseUrl,
          operation: '/getDrbEasyDrugList',
          query: {
            itemName: keyword,
            item_name: keyword,
            itemNm: keyword,
            ingrName: ingredientKeyword,
            ingr_name: ingredientKeyword,
            entpName: body.company,
            entp_name: body.company,
            entpNm: body.company,
          },
        })
      );
    }

    if (grainIdentify) {
      requests.push(
        callPublicDrugApi({
          serviceName: grainIdentify.serviceName,
          baseUrl: grainIdentify.baseUrl,
          operation: '/getMdcinGrnIdntfcInfoList03',
          query: {
            itemName: keyword,
            item_name: keyword,
            itemNm: keyword,
            ingrName: ingredientKeyword,
            ingr_name: ingredientKeyword,
            entpName: body.company,
            entp_name: body.company,
            entpNm: body.company,
          },
        })
      );
    }

    if (permitInfo) {
      requests.push(
        callPublicDrugApi({
          serviceName: permitInfo.serviceName,
          baseUrl: permitInfo.baseUrl,
          operation: '/getDrugPrdtPrmsnInq07',
          query: {
            itemName: keyword,
            item_name: keyword,
            itemNm: keyword,
            ingrName: ingredientKeyword,
            ingr_name: ingredientKeyword,
            entpName: body.company,
            entp_name: body.company,
            entpNm: body.company,
          },
        })
      );
    }

    const results = await Promise.allSettled(requests);

    const normalized = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .flatMap((result) => {
        const payload = result.value;
        const items = extractItems(payload);
        return items.map((item) => normalizeDrugItem(item, payload?.service || 'data.go.kr'));
      });

    const merged = mergeAndFilterDrugItems(normalized, {
      productName: body.productName,
      ingredientName: body.ingredientName,
      company: body.company,
    });

    const masterRows = await searchDrugMasterRows({
      productName: body.productName,
      ingredientName: body.ingredientName,
      company: body.company,
      limit: 120,
    });

    const priceMap = await loadDrugPrices().catch(() => new Map<string, string>());

    const fromMaster = masterRows.map((row, idx) => {
      let csvPrice = '';
      
      // 1. standardCode에서 직접 추출 (880 + 제품코드 9자리 + 확인코드 1자리)
      const stdCode = (row.standardCode || '').trim();
      if (stdCode.startsWith('880') && stdCode.length >= 12) {
        const productCode = stdCode.substring(3, 12);
        csvPrice = priceMap.get(productCode) || '';
      }
      
      // 2. raw 데이터에서 제품코드 필드 확인
      if (!csvPrice) {
        const rawCode = row.raw['제품코드(개정후)'] || row.raw['제품코드'] || '';
        if (rawCode) csvPrice = priceMap.get(rawCode) || '';
      }

      const finalPrice = csvPrice || row.unitPrice || '';
      const inferredCoverage = csvPrice ? '급여' : '비급여';

      return {
        id: row.standardCode || `master:${row.productName}:${row.company}:${idx}`,
        productName: row.productName,
        ingredientName: normalizeIngredientText(row.ingredientText, ingredientKeyword),
        company: row.company,
        priceLabel: finalPrice, // Do not duplicate composePriceCoverageLabel
        reimbursement: row.coverageType || inferredCoverage,
        insuranceCode: row.standardCode,
        standardCode: row.standardCode,
        atcCode: row.atcCode,
        type: row.otcType || '약가마스터',
        releaseDate:
          row.raw['허가일자'] ||
          row.raw['itemPermitDate'] ||
          row.raw['ITEM_PERMIT_DATE'] ||
          row.raw['출시일'] ||
          '',
        usageFrequency: Number((row.raw['사용빈도'] || row.raw['useCnt'] || '0').toString().replace(/[^0-9.-]/g, '')) || 0,
        sourceService: '건강보험심사평가원_약가마스터_의약품표준코드',
        raw: row.raw,
      };
    });

    const unionItems = [...merged, ...fromMaster];

    let finalItems = mergeAndFilterDrugItems(unionItems, {
      productName: body.productName,
      ingredientName: body.ingredientName,
      company: body.company,
    }).map((item) => {
      const coverage =
        (item.reimbursement || '').trim() ||
        ((item.raw?.['급여구분'] as string) || '').trim() ||
        ((item.raw?.['보험구분'] as string) || '').trim() ||
        ((item.raw?.['payYn'] as string) || '').trim();
      const composedPrice = composePriceCoverageLabel(item.priceLabel, coverage);
      return {
        ...item,
        ingredientName: normalizeIngredientText(item.ingredientName, ingredientKeyword),
        priceLabel: composedPrice,
        usageFrequency: item.usageFrequency || 0,
      };
    });

    if (finalItems.length > 0) {
      // HIRA API로 통합된 사용빈도를 한 번 조회하여 첫 번째 유사 약학성분에 반영합니다. (실시간 데이터 연동)
      const keywordToScan = body.ingredientName || body.productName || '';
      if (keywordToScan) {
        const usageVol = await fallbackUsageScan(keywordToScan);
        if (usageVol > 0) {
          finalItems = finalItems.map(item => ({
            ...item,
            usageFrequency: item.usageFrequency || usageVol
          }));
        }
      }
    }

    if (finalItems.length === 0 && ingredientKeyword) {
      const fallbackItems = await fallbackIngredientScan(ingredientKeyword);
      const mergedFallback = mergeAndFilterDrugItems(fallbackItems, {
        productName: body.productName,
        ingredientName: body.ingredientName || ingredientKeyword,
        company: body.company,
      }).map((item) => ({
        ...item,
        ingredientName: normalizeIngredientText(item.ingredientName, ingredientKeyword),
        priceLabel: composePriceCoverageLabel(item.priceLabel, item.reimbursement),
        usageFrequency: item.usageFrequency || 0,
      }));

      return NextResponse.json({
        success: true,
        total: mergedFallback.length,
        items: mergedFallback,
      });
    }

    return NextResponse.json({
      success: true,
      total: finalItems.length,
      items: finalItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || '약제 검색 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
