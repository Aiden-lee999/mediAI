import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function digits(value: string) {
  return (value || '').replace(/\D/g, '');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = (url.searchParams.get('key') || '').trim();
    const productName = (url.searchParams.get('productName') || '').trim();

    if (!key && !productName) {
      return NextResponse.json({ success: false, message: 'key 또는 productName 이 필요합니다.' }, { status: 400 });
    }

    const keyDigits = digits(key);

    const item = await prisma.drug.findFirst({
      where: {
        OR: [
          ...(key ? [{ id: key }, { standardCode: key }, { insuranceCode: key }] : []),
          ...(keyDigits ? [{ standardCode: keyDigits }, { insuranceCode: { contains: keyDigits } }] : []),
          ...(productName ? [{ productName: { contains: productName } }] : []),
        ],
      },
      select: {
        id: true,
        productName: true,
        ingredientName: true,
        company: true,
        reimbursement: true,
        priceLabel: true,
        insuranceCode: true,
        standardCode: true,
        atcCode: true,
        type: true,
        releaseDate: true,
        usageFrequency: true,
      },
    });

    if (!item) {
      return NextResponse.json({ success: false, message: '약품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, message: '약품 조회 중 오류가 발생했습니다.', error: err.message },
      { status: 500 },
    );
  }
}
