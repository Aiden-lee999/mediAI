export type RecruitPriority = 'DISTANCE' | 'TIME' | 'WORK_METHOD' | 'PAY' | 'SPECIALTY' | 'BALANCED';

export type RouteSummary = {
  originAddress?: string | null;
  destinationAddress?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  distanceKm: number | null;
  drivingMinutes: number | null;
  transitMinutes: number | null;
  walkingMinutes: number | null;
  source: 'naver-directions' | 'google-distance-matrix' | 'estimated' | 'address-linkout';
  naverUrl: string;
  kakaoUrl: string;
  googleUrl: string;
};

export function parseList(value?: string | null) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toListString(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(',');
  return String(value || '').trim();
}

export function toNumberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isHospitalDirector(user: { name?: string | null; jobTitle?: string | null; role?: string | null; hospitalName?: string | null }) {
  const text = `${user.name || ''} ${user.jobTitle || ''} ${user.role || ''}`.toLowerCase();
  return /원장|병원장|대표|개원의|director|owner|admin|hospital_director|hospital-admin/.test(text);
}

export function haversineKm(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null) {
  if (![aLat, aLng, bLat, bLng].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const r = 6371;
  const dLat = toRad((bLat as number) - (aLat as number));
  const dLng = toRad((bLng as number) - (aLng as number));
  const lat1 = toRad(aLat as number);
  const lat2 = toRad(bLat as number);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function buildMapLinks(origin: string, destination: string) {
  const o = encodeURIComponent(origin || '');
  const d = encodeURIComponent(destination || '');
  return {
    naverUrl: `https://map.naver.com/p/search/${d}`,
    kakaoUrl: `https://map.kakao.com/link/search/${d}`,
    googleUrl: `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`,
  };
}

export function estimateRoute(input: {
  originAddress?: string | null;
  destinationAddress?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
}): RouteSummary {
  const links = buildMapLinks(input.originAddress || '', input.destinationAddress || '');
  const addresses = {
    originAddress: input.originAddress || null,
    destinationAddress: input.destinationAddress || null,
    originLat: input.originLat || null,
    originLng: input.originLng || null,
    destinationLat: input.destinationLat || null,
    destinationLng: input.destinationLng || null,
  };
  const straightKm = haversineKm(input.originLat, input.originLng, input.destinationLat, input.destinationLng);
  if (straightKm === null) {
    return {
      ...addresses,
      distanceKm: null,
      drivingMinutes: null,
      transitMinutes: null,
      walkingMinutes: null,
      source: 'address-linkout',
      ...links,
    };
  }

  const roadKm = Math.round(straightKm * 1.25 * 10) / 10;
  return {
    ...addresses,
    distanceKm: roadKm,
    drivingMinutes: Math.max(5, Math.round((roadKm / 32) * 60)),
    transitMinutes: Math.max(8, Math.round((roadKm / 20) * 60 + 8)),
    walkingMinutes: Math.max(5, Math.round((roadKm / 4.2) * 60)),
    source: 'estimated',
    ...links,
  };
}

function rangeOverlap(minA?: number | null, maxA?: number | null, minB?: number | null, maxB?: number | null) {
  if (minA == null && maxA == null) return true;
  if (minB == null && maxB == null) return true;
  const aMin = minA ?? 0;
  const aMax = maxA ?? Number.MAX_SAFE_INTEGER;
  const bMin = minB ?? 0;
  const bMax = maxB ?? Number.MAX_SAFE_INTEGER;
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
}

function hasIntersection(a?: string | null, b?: string | null) {
  const aa = parseList(a);
  const bb = parseList(b);
  if (!aa.length || !bb.length) return true;
  return aa.some((item) => bb.includes(item));
}

export function scoreRecruitMatch(input: {
  candidate: any;
  posting: any;
  priority?: RecruitPriority | string | null;
}) {
  const { candidate, posting } = input;
  const priority = (input.priority || candidate.priority || posting.priority || 'BALANCED') as RecruitPriority;
  let score = 42;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const specialtyMatch = !candidate.specialty || !posting.specialty || candidate.specialty === posting.specialty;
  if (specialtyMatch) {
    score += priority === 'SPECIALTY' ? 24 : 18;
    reasons.push('진료과/전문 분야가 맞습니다.');
  } else {
    score -= 12;
    warnings.push(`희망과(${candidate.specialty})와 공고과(${posting.specialty})가 다릅니다.`);
  }

  if (rangeOverlap(candidate.minPay, candidate.maxPay, posting.payMin, posting.payMax)) {
    score += priority === 'PAY' ? 22 : 14;
    reasons.push('희망 페이 범위와 공고 페이가 겹칩니다.');
  } else {
    score -= priority === 'PAY' ? 18 : 10;
    warnings.push('희망 페이와 공고 페이 범위 차이가 있습니다.');
  }

  if (hasIntersection(candidate.workTypes, posting.workTypes)) {
    score += priority === 'TIME' ? 18 : 10;
    reasons.push('근무 형태/시간 조건이 맞습니다.');
  } else {
    score -= 6;
    warnings.push('근무 형태 조건 확인이 필요합니다.');
  }

  if (hasIntersection(candidate.workMethods, posting.workMethods)) {
    score += priority === 'WORK_METHOD' ? 20 : 10;
    reasons.push('근무 방법 선호가 맞습니다.');
  } else {
    score -= priority === 'WORK_METHOD' ? 14 : 7;
    warnings.push('근무 방법 선호가 다를 수 있습니다.');
  }

  const distanceKm = haversineKm(candidate.latitude, candidate.longitude, posting.latitude, posting.longitude);
  if (distanceKm !== null) {
    if (distanceKm <= 5) {
      score += priority === 'DISTANCE' ? 22 : 12;
      reasons.push('매우 가까운 거리입니다.');
    } else if (distanceKm <= 15) {
      score += priority === 'DISTANCE' ? 16 : 8;
      reasons.push('출퇴근 가능한 거리입니다.');
    } else if (distanceKm <= 35) {
      score += 3;
      reasons.push('차량 이동 기준 검토 가능한 거리입니다.');
    } else {
      score -= priority === 'DISTANCE' ? 16 : 8;
      warnings.push('거리가 멀어 출퇴근 부담이 있을 수 있습니다.');
    }
  } else if (priority === 'DISTANCE') {
    warnings.push('좌표가 없어 거리 점수는 지도 링크 기준으로 확인해야 합니다.');
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: normalized,
    grade: normalized >= 85 ? '강력추천' : normalized >= 70 ? '추천' : normalized >= 55 ? '검토가능' : '조건확인',
    reasons: reasons.slice(0, 5),
    warnings: warnings.slice(0, 4),
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 1.25 * 10) / 10,
  };
}
