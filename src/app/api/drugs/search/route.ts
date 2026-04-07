import { NextResponse } from 'next/server';
import { getIngredientNameByCode, getIngredientNameByStandardCode, loadRichDrugPrices } from '@/lib/drugPricesCsv';
import { prisma } from '@/lib/prisma';

type SearchItem = {
  id: string;
  productName: string;
  ingredientName: string;
  company: string;
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

function looksLikeCode(value: string) {
  return /^[A-Z0-9]{6,}$/i.test(value);
}

function ingredientFromProductName(productName: string) {
  const match = productName.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || '';
}

function normalizeBaseProductName(name: string) {
  return name
    .replace(/&nbsp;/gi, ' ')
    .split('(')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productName, ingredientName, company } = body;

    const searchProducts = productName ? productName.split(',').map((p: string) => p.trim()).filter(Boolean) : [];

    const conditions: any[] = [];
    if (searchProducts.length > 0) {
      if (searchProducts.length === 1) {
         const q = searchProducts[0];
         conditions.push({
           OR: [
             { productName: { contains: q, mode: 'insensitive' } },
             { ingredientName: { contains: q, mode: 'insensitive' } },
             { company: { contains: q, mode: 'insensitive' } },
             { standardCode: { contains: q, mode: 'insensitive' } },
             { insuranceCode: { contains: q, mode: 'insensitive' } },
             { atcCode: { contains: q, mode: 'insensitive' } },
           ],
         });
      } else {
         conditions.push({
           OR: searchProducts.flatMap((p: string) => ([
             { productName: { contains: p, mode: 'insensitive' } },
             { ingredientName: { contains: p, mode: 'insensitive' } },
             { company: { contains: p, mode: 'insensitive' } },
             { standardCode: { contains: p, mode: 'insensitive' } },
             { insuranceCode: { contains: p, mode: 'insensitive' } },
             { atcCode: { contains: p, mode: 'insensitive' } },
           ]))
         });
      }
    }
    
    if (company) conditions.push({ company: { contains: company, mode: 'insensitive' } });
    if (ingredientName) conditions.push({ ingredientName: { contains: ingredientName, mode: 'insensitive' } });
    
    // 조건이 비어있으면 전체 중 처방빈도 높은 순으로 150개 반환되도록 유지 (에러/빈배열 반환 제거)
    let drugs = await prisma.drug.findMany({
      where: conditions.length > 0 ? { AND: conditions } : undefined,
      take: 150,
      orderBy: { usageFrequency: 'desc' }
    });

    // If filtered search yields nothing, return default top list instead of empty results.
    const usedDefaultFallback = conditions.length > 0 && drugs.length === 0;
    if (usedDefaultFallback) {
      drugs = await prisma.drug.findMany({
        take: 150,
        orderBy: { usageFrequency: 'desc' }
      });
    }

    const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
    const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크', '아토르바스타틴'];
    const csvPriceMap = await loadRichDrugPrices();
    const ingredientCodeSet = new Set<string>();
    const standardCodeSet = new Set<string>();

    for (const drug of drugs) {
      const code = (drug.ingredientName || '').trim();
      if (code && looksLikeCode(code)) ingredientCodeSet.add(code);
      const std = (drug.standardCode || '').trim();
      if (std) standardCodeSet.add(std);
    }

    const ingredientNameMap = new Map<string, string>();
    const standardIngredientNameMap = new Map<string, string>();
    if (ingredientCodeSet.size > 0) {
      await Promise.all(
        Array.from(ingredientCodeSet).map(async (code) => {
          const ingredientName = await getIngredientNameByCode(code);
          if (ingredientName) ingredientNameMap.set(code, ingredientName);
        })
      );
    }

    if (standardCodeSet.size > 0) {
      await Promise.all(
        Array.from(standardCodeSet).map(async (code) => {
          const ingredientName = await getIngredientNameByStandardCode(code);
          if (ingredientName) standardIngredientNameMap.set(code, ingredientName);
        })
      );
    }
    
    const finalItems: SearchItem[] = drugs.map((item: (typeof drugs)[number]) => {
      const standardCode = (item.standardCode || '').trim();
      const csvData = standardCode ? csvPriceMap.get(standardCode) : undefined;

      let p = (item.priceLabel || '').trim().replace(/,/g, '');
      const c = (item.reimbursement || '').trim() || '비급여';
      if ((!p || p === '가격정보없음' || !/[0-9]/.test(p)) && csvData?.price) {
        p = String(csvData.price).trim().replace(/,/g, '');
      }

      let finalIngr = (item.ingredientName || '').trim();
      if (!finalIngr || finalIngr === '-' || looksLikeCode(finalIngr)) {
        finalIngr = (
          ingredientNameMap.get(finalIngr) ||
          standardIngredientNameMap.get(standardCode) ||
          csvData?.ingredient ||
          ingredientFromProductName(item.productName || '') ||
          '-'
        ).trim();
      }

      if (p && /[0-9]/.test(p) && p !== '가격정보없음') {
        if (!p.includes('원')) p += '원';
      } else {
        p = '가격정보없음';
      }

      let finalFreq = item.usageFrequency || 0;
      const isOriginalCompany = !!(item.company && originalMakers.some(m => item.company?.includes(m)));
      const isOriginalName = originalNames.some(m => item.productName.includes(m));
      const brandClass: SearchItem['brandClass'] = (isOriginalCompany || isOriginalName) ? '오리지널(대장약)' : '복제약(제네릭)';
      
      if (isOriginalCompany) {
         finalFreq += 50000; 
      }
      if (isOriginalName) {
         finalFreq += 60000;
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
        brandClass,
        sourceService: csvData?.price || csvData?.ingredient ? '자체DB+CSV 보강 조회' : '자체DB 초고속 조회'
      };
    });

    // Propagate known prices to variants sharing the same base product name.
    const knownPriceByBaseName = new Map<string, string>();
    for (const item of finalItems) {
      if (/[0-9]/.test(item.priceLabel) && !item.priceLabel.startsWith('가격정보없음')) {
        const baseName = normalizeBaseProductName(item.productName);
        if (baseName && !knownPriceByBaseName.has(baseName)) {
          const numericPrice = item.priceLabel.split('/')[0].trim();
          knownPriceByBaseName.set(baseName, numericPrice);
        }
      }
    }

    const normalizedItems = finalItems.map((item) => {
      if (!item.priceLabel.startsWith('가격정보없음')) return item;

      const baseName = normalizeBaseProductName(item.productName);
      const inferredPrice = knownPriceByBaseName.get(baseName);
      if (!inferredPrice) return item;

      return {
        ...item,
        priceLabel: `${inferredPrice} / ${item.reimbursement}`,
      };
    });

    // 제품명+제조사 기준 중복을 제거하고, 더 높은 빈도 값을 대표값으로 사용
    const dedupMap = new Map<string, SearchItem>();
    for (const item of normalizedItems) {
      const key = `${item.productName}__${item.company}`;
      const prev = dedupMap.get(key);
      if (!prev || item.usageFrequency > prev.usageFrequency) {
        dedupMap.set(key, item);
      }
    }

    const dedupedItems = Array.from(dedupMap.values());

    // 정렬 우선순위: 오리지널/복제약 구분 -> 처방빈도 desc -> 제품명 asc
    dedupedItems.sort((a: SearchItem, b: SearchItem) => {
      const classRank = (v: SearchItem['brandClass']) => (v === '오리지널(대장약)' ? 0 : 1);
      const classDiff = classRank(a.brandClass) - classRank(b.brandClass);
      if (classDiff !== 0) return classDiff;

      const freqDiff = b.usageFrequency - a.usageFrequency;
      if (freqDiff !== 0) return freqDiff;

      return a.productName.localeCompare(b.productName, 'ko');
    });

    return NextResponse.json({
      success: true,
      count: dedupedItems.length,
      items: dedupedItems,
      fallbackUsed: usedDefaultFallback,
    });
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

    const proxyReq = new Request('http://localhost/api/drugs/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, ingredientName, company }),
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

