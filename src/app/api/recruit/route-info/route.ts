import { NextResponse } from 'next/server';
import { buildMapLinks, estimateRoute } from '@/lib/recruitMatching';
import { naverDrivingRoute } from '@/lib/naverMaps';

export const dynamic = 'force-dynamic';

type Body = {
  originAddress?: string;
  destinationAddress?: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
};

async function googleDistance(origin: string, destination: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !origin || !destination) return null;

  const modes = ['driving', 'transit', 'walking'] as const;
  const results: Record<string, any> = {};
  await Promise.all(modes.map(async (mode) => {
    const params = new URLSearchParams({
      origins: origin,
      destinations: destination,
      mode,
      language: 'ko',
      key,
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const item = data?.rows?.[0]?.elements?.[0];
    if (item?.status === 'OK') results[mode] = item;
  }));

  if (!results.driving && !results.transit && !results.walking) return null;
  const links = buildMapLinks(origin, destination);
  return {
    originAddress: origin,
    destinationAddress: destination,
    distanceKm: results.driving?.distance?.value ? Math.round((results.driving.distance.value / 1000) * 10) / 10 : null,
    drivingMinutes: results.driving?.duration?.value ? Math.round(results.driving.duration.value / 60) : null,
    transitMinutes: results.transit?.duration?.value ? Math.round(results.transit.duration.value / 60) : null,
    walkingMinutes: results.walking?.duration?.value ? Math.round(results.walking.duration.value / 60) : null,
    source: 'google-distance-matrix',
    ...links,
  };
}

async function naverDistance(body: Body) {
  const naver = await naverDrivingRoute({
    originAddress: body.originAddress || '',
    destinationAddress: body.destinationAddress || '',
    originLat: body.originLat,
    originLng: body.originLng,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
  });
  if (!naver) return null;

  const links = buildMapLinks(body.originAddress || naver.origin.address || '', body.destinationAddress || naver.destination.address || '');
  const distanceKm = naver.distanceKm;
  return {
    originAddress: body.originAddress || naver.origin.address || null,
    destinationAddress: body.destinationAddress || naver.destination.address || null,
    originLat: naver.origin.latitude,
    originLng: naver.origin.longitude,
    destinationLat: naver.destination.latitude,
    destinationLng: naver.destination.longitude,
    distanceKm,
    drivingMinutes: naver.drivingMinutes,
    transitMinutes: distanceKm ? Math.max(8, Math.round((distanceKm / 20) * 60 + 8)) : null,
    walkingMinutes: distanceKm ? Math.max(5, Math.round((distanceKm / 4.2) * 60)) : null,
    source: 'naver-directions',
    ...links,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const naver = await naverDistance(body);
    if (naver) return NextResponse.json({ success: true, route: naver });

    const google = await googleDistance(body.originAddress || '', body.destinationAddress || '');
    if (google) return NextResponse.json({ success: true, route: google });

    const route = estimateRoute(body);
    return NextResponse.json({ success: true, route });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '경로 계산 실패' }, { status: 500 });
  }
}
