import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function compact(value: string | null | undefined) {
  return String(value || '').trim();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = compact(url.searchParams.get('q'));
    const limit = Math.min(Number(url.searchParams.get('limit') || 12) || 12, 30);

    if (q.length < 1) {
      return NextResponse.json({ success: true, hospitals: [] });
    }

    const tokens = q.split(/\s+/).filter(Boolean).slice(0, 4);
    const hospitals = await prisma.hospitalDirectory.findMany({
      where: {
        AND: tokens.map((token) => ({
          OR: [
            { name: { contains: token } },
            { address: { contains: token } },
            { sidoName: { contains: token } },
            { sigunguName: { contains: token } },
          ],
        })),
      },
      orderBy: [{ sidoName: 'asc' }, { sigunguName: 'asc' }, { name: 'asc' }],
      take: limit,
      select: {
        id: true,
        encryptedCode: true,
        name: true,
        typeName: true,
        sidoName: true,
        sigunguName: true,
        address: true,
        phone: true,
        totalDoctors: true,
        latitude: true,
        longitude: true,
      },
    });

    return NextResponse.json({ success: true, hospitals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '병의원 검색 실패' }, { status: 500 });
  }
}
