import { NextResponse } from 'next/server';
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productName, ingredientName, company } = body;

    const searchProducts = productName ? productName.split(',').map((p: string) => p.trim()).filter(Boolean) : [];

    const conditions: any[] = [];
    if (searchProducts.length > 0) {
      if (searchProducts.length === 1) {
         conditions.push({ productName: { contains: searchProducts[0], mode: 'insensitive' } });
      } else {
         conditions.push({
           OR: searchProducts.map((p: string) => ({ productName: { contains: p, mode: 'insensitive' } }))
         });
      }
    }
    
    if (company) conditions.push({ company: { contains: company, mode: 'insensitive' } });
    if (ingredientName) conditions.push({ ingredientName: { contains: ingredientName, mode: 'insensitive' } });
    
    // 조건이 비어있으면 전체 중 처방빈도 높은 순으로 150개 반환되도록 유지 (에러/빈배열 반환 제거)
    const drugs = await prisma.drug.findMany({
      where: conditions.length > 0 ? { AND: conditions } : undefined,
      take: 150,
      orderBy: { usageFrequency: 'desc' }
    });

    const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
    const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크', '아토르바스타틴'];
    
    const finalItems: SearchItem[] = drugs.map((item: (typeof drugs)[number]) => {
      let p = (item.priceLabel || '').trim();
      const c = (item.reimbursement || '').trim() || '비급여';
      let finalIngr = item.ingredientName || '-';

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
        sourceService: '자체DB 초고속 조회'
      };
    });

    // 제품명+제조사 기준 중복을 제거하고, 더 높은 빈도 값을 대표값으로 사용
    const dedupMap = new Map<string, SearchItem>();
    for (const item of finalItems) {
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

