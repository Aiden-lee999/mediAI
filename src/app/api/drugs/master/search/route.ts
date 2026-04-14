import { NextResponse } from 'next/server';
import { searchDrugMasterRows } from '@/lib/drugMasterCsv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type MasterBody = {
  productName?: string;
  ingredientName?: string;
  company?: string;
  limit?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MasterBody;
    const items = await searchDrugMasterRows({
      productName: body.productName,
      ingredientName: body.ingredientName,
      company: body.company,
      limit: body.limit ?? 100,
    });

    return NextResponse.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || '약가마스터 CSV 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
