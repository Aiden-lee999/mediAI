type Coordinate = {
  latitude: number;
  longitude: number;
  address?: string;
};

function naverCredentials() {
  const clientId = process.env.NAVER_MAPS_CLIENT_ID || process.env.NAVER_CLIENT_ID || process.env.NCP_APIGW_API_KEY_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET || process.env.NCP_APIGW_API_KEY;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function naverHeaders() {
  const credentials = naverCredentials();
  if (!credentials) return null;
  return {
    'X-NCP-APIGW-API-KEY-ID': credentials.clientId,
    'X-NCP-APIGW-API-KEY': credentials.clientSecret,
  };
}

export function hasNaverMapsKey() {
  return !!naverCredentials();
}

export async function naverGeocode(address?: string | null): Promise<Coordinate | null> {
  const query = String(address || '').trim();
  const headers = naverHeaders();
  if (!query || !headers) return null;

  const params = new URLSearchParams({ query });
  const res = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${params.toString()}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const data = await res.json();
  const item = data?.addresses?.[0];
  const longitude = Number(item?.x);
  const latitude = Number(item?.y);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    address: item?.roadAddress || item?.jibunAddress || query,
  };
}

export async function ensureCoordinate(input: {
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): Promise<Coordinate | null> {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude, address: String(input.address || '').trim() || undefined };
  }
  return naverGeocode(input.address);
}

export async function naverDrivingRoute(input: {
  originAddress?: string | null;
  destinationAddress?: string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  destinationLat?: number | string | null;
  destinationLng?: number | string | null;
}) {
  const headers = naverHeaders();
  if (!headers) return null;

  const [origin, destination] = await Promise.all([
    ensureCoordinate({ address: input.originAddress, latitude: input.originLat, longitude: input.originLng }),
    ensureCoordinate({ address: input.destinationAddress, latitude: input.destinationLat, longitude: input.destinationLng }),
  ]);
  if (!origin || !destination) return null;

  const params = new URLSearchParams({
    start: `${origin.longitude},${origin.latitude}`,
    goal: `${destination.longitude},${destination.latitude}`,
    option: 'trafast',
  });
  const res = await fetch(`https://maps.apigw.ntruss.com/map-direction/v1/driving?${params.toString()}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const data = await res.json();
  const route = data?.route?.trafast?.[0] || data?.route?.traoptimal?.[0];
  const summary = route?.summary;
  const distanceMeters = Number(summary?.distance);
  const durationMs = Number(summary?.duration);
  if (!Number.isFinite(distanceMeters) && !Number.isFinite(durationMs)) return null;

  const distanceKm = Number.isFinite(distanceMeters) ? Math.round((distanceMeters / 1000) * 10) / 10 : null;
  return {
    distanceKm,
    drivingMinutes: Number.isFinite(durationMs) ? Math.max(1, Math.round(durationMs / 60000)) : null,
    origin,
    destination,
  };
}
