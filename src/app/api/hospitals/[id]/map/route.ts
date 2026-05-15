import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function naverHeaders() {
  const clientId = process.env.NAVER_MAPS_CLIENT_ID || process.env.NAVER_CLIENT_ID || process.env.NCP_APIGW_API_KEY_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET || process.env.NCP_APIGW_API_KEY;
  if (!clientId || !clientSecret) return null;
  return {
    'X-NCP-APIGW-API-KEY-ID': clientId,
    'X-NCP-APIGW-API-KEY': clientSecret,
  };
}

export async function GET(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const width = Math.min(Number(url.searchParams.get('w') || 720) || 720, 1280);
    const height = Math.min(Number(url.searchParams.get('h') || 320) || 320, 720);
    const hospital = await prisma.hospitalDirectory.findUnique({ where: { id } });
    if (!hospital?.latitude || !hospital?.longitude) return NextResponse.json({ success: false, error: '지도 좌표가 없습니다.' }, { status: 404 });

    const headers = naverHeaders();
    if (!headers) return NextResponse.json({ success: false, error: '네이버 지도 API 키가 설정되지 않았습니다.' }, { status: 503 });

    const marker = `type:d|size:mid|pos:${hospital.longitude} ${hospital.latitude}|label:${encodeURIComponent(hospital.name.slice(0, 12))}`;
    const params = new URLSearchParams({
      w: String(width),
      h: String(height),
      center: `${hospital.longitude},${hospital.latitude}`,
      level: '16',
      markers: marker,
      format: 'png',
      scale: '2',
    });
    const mapRes = await fetch(`https://maps.apigw.ntruss.com/map-static/v2/raster?${params.toString()}`, {
      headers,
      cache: 'no-store',
    });
    if (!mapRes.ok) return NextResponse.json({ success: false, error: '네이버 지도 이미지를 불러오지 못했습니다.' }, { status: mapRes.status });
    const buffer = await mapRes.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': mapRes.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '지도 생성 실패' }, { status: 500 });
  }
}
