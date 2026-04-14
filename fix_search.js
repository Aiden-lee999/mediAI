const fs = require('fs');
const content = \import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchProductsByIngredient } from '@/lib/drugPricesCsv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SearchBody = {
  productName?: string;
  ingredientName?: string;
  company?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchBody;
    const productName = (body.productName || '').trim();
    const ingredientName = (body.ingredientName || '').trim();
    const company = (body.company || '').trim();
    
    if (!productName && !ingredientName && !company) {
      return NextResponse.json({ success: true, items: [] });
    }

    let searchProducts = productName ? [productName] : [];

    // 성분 검색인 경우
    if (ingredientName && !productName) {
      const translated = await searchProductsByIngredient(ingredientName);
      if (translated.length > 0) {
        searchProducts = translated;
      } else {
        searchProducts = [ingredientName];
      }
    }

    // 초고속 DB 검색
    const conditions: any[] = [];
    if (searchProducts.length > 0) {
      if (searchProducts.length === 1) {
         conditions.push({ productName: { contains: searchProducts[0], mode: 'insensitive' } });
      } else {
         conditions.push({
           OR: searchProducts.map(p => ({ productName: { contains: p, mode: 'insensitive' } }))
         });
      }
    }
    if (company) conditions.push({ company: { contains: company, mode: 'insensitive' } });
    
    const drugs = await prisma.drug.findMany({
      where: { AND: conditions },
      take: 150,
      orderBy: { usageFrequency: 'desc' }
    });

    const finalItems = drugs.map((item: any) => {
      let p = (item.priceLabel || '').trim();
      let c = (item.reimbursement || '').trim() || '비급여';

      if (p && /[0-9]/.test(p) && p !== '가격정보없음') {
        if (!p.includes('원')) p += '원';
      } else {
        p = '가격정보없음';
      }
      
      let finalFreq = item.usageFrequency || 0;
      const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
      const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크', '아토르바스타틴'];
      
      if (item.company && originalMakers.some(m => item.company.includes(m))) {
         finalFreq += 50000; 
      }
      if (originalNames.some(m => item.productName.includes(m))) {
         finalFreq += 60000; 
      }

      return {
        id: item.standardCode || item.id,
        productName: item.productName || '-',
        ingredientName: item.ingredientName || '-',
        company: item.company || '-',
        priceLabel: p === '가격정보없음' ? '가격정보없음 / ' + c : p + ' / ' + c,
        reimbursement: c,
        insuranceCode: item.insuranceCode || '',
        standardCode: item.standardCode || '',
        atcCode: item.atcCode || '',
        type: item.type || '',
        releaseDate: item.releaseDate || '',
        usageFrequency: finalFreq,
        sourceService: '자체DB(Supabase) 초고속 조회'
      };
    });

    finalItems.sort((a, b) => b.usageFrequency - a.usageFrequency);

    return NextResponse.json({
      success: true,
      count: finalItems.length,
      items: finalItems,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: 'DB 검색 중 오류가 발생했습니다.', error: String(err) },
      { status: 500 }
    );
  }
}
\;

fs.writeFileSync('src/app/api/drugs/search/route.ts', content, 'utf8');
