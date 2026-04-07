import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    
    if (conditions.length === 0) {
      return NextResponse.json({ success: true, count: 0, items: [] });
    }

    const drugs = await prisma.drug.findMany({
      where: { AND: conditions },
      take: 150,
      orderBy: { usageFrequency: 'desc' }
    });

    const originalMakers = ['존슨앤드존슨판매', '한국얀센', '화이자', '얀센', '글락소', '노바티스', '아스트라제네카', '릴리', '사노피', '다케다', '머크', '베링거', 'MSD'];
    const originalNames = ['타이레놀', '리피토', '글리벡', '노바스크', '아토르바스타틴'];
    
    const finalItems = drugs.map((item) => {
      let p = (item.priceLabel || '').trim();
      const c = (item.reimbursement || '').trim() || '비급여';
      let finalIngr = item.ingredientName || '-';

      if (p && /[0-9]/.test(p) && p !== '가격정보없음') {
        if (!p.includes('원')) p += '원';
      } else {
        p = '가격정보없음';
      }

      let finalFreq = item.usageFrequency || 0;
      
      if (item.company && originalMakers.some(m => item.company?.includes(m))) {
         finalFreq += 50000; 
      }
      if (originalNames.some(m => item.productName.includes(m))) {
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
        sourceService: '자체DB 초고속 조회'
      };
    });

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
      { success: false, message: 'DB 검색 중 오류가 발생했습니다.', error: error.message },
      { status: 500 }
    );
  }
}

