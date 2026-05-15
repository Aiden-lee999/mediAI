import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function naverHeaders() {
  const clientId = process.env.NAVER_MAPS_CLIENT_ID || process.env.NAVER_CLIENT_ID || process.env.NCP_APIGW_API_KEY_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET || process.env.NCP_APIGW_API_KEY;
  if (!clientId || !clientSecret) return null;
  return {
    'X-NCP-APIGW-API-KEY-ID': clientId,
    'X-NCP-APIGW-API-KEY': clientSecret,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = String(url.searchParams.get('q') || '').trim();
    if (query.length < 2) return NextResponse.json({ success: true, addresses: [] });

    const headers = naverHeaders();
    if (!headers) return NextResponse.json({ success: false, error: '네이버 지도 API 키가 설정되지 않았습니다.' }, { status: 503 });

    const params = new URLSearchParams({ query, count: '8' });
    const res = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${params.toString()}`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ success: false, error: '주소 검색 실패' }, { status: res.status });

    const data = await res.json();
    const addresses = (data?.addresses || []).map((item: any) => ({
      roadAddress: item.roadAddress || '',
      jibunAddress: item.jibunAddress || '',
      address: item.roadAddress || item.jibunAddress || query,
      latitude: Number(item.y),
      longitude: Number(item.x),
    })).filter((item: any) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    return NextResponse.json({ success: true, addresses });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '주소 검색 오류' }, { status: 500 });
  }
}
