import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SearchBody = {
  productName?: string;
  ingredientName?: string;
  company?: string;
};

// 약 5만개의 정형화된 DB를 즉시 검색합니다
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

    const conditions: any[] = [];
    if (productName) conditions.push({ productName: { contains: productName } });
    if (ingredientName) conditions.push({ ingredientName: { contains: ingredientName } });
    if (company) conditions.push({ company: { contains: company } });

    const drugs = await prisma.drug.findMany({
      where: {
        AND: conditions,
      },
      take: 150,
    });

    const finalItems = drugs.map((item) => {
      let p = (item.priceLabel || '').trim();
      const c = (item.reimbursement || '').trim() || '비급여';
      
      if (p && /[0-9]/.test(p)) {
        if (!p.includes('원')) p = `${p}원`;
      } else {
        p = '가격정보없음';
      }

      return {
        id: item.standardCode || item.id,
        productName: item.productName || '-',
        ingredientName: item.ingredientName || '-',
        company: item.company || '-',
        priceLabel: `${p} / ${c}`,
        reimbursement: c,
        insuranceCode: item.insuranceCode || '',
        standardCode: item.standardCode || '',
        atcCode: item.atcCode || '',
        type: item.type || '',
        releaseDate: item.releaseDate || '',
        usageFrequency: item.usageFrequency || 0,
        sourceService: '자체DB(Supabase)',
      };
    });

    return NextResponse.json({
      success: true,
      count: finalItems.length,
      items: finalItems,
    });
  } catch (error) {
    console.error('Database Search Error:', error);
    return NextResponse.json(
      { success: false, message: 'DB 검색 중 오류가 발생했습니다.', error: error?.toString(), stack: error?.stack },
      { status: 500 }
    );
  }
}
