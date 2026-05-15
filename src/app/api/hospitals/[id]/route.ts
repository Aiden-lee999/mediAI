import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const editableFields = [
  'name', 'typeName', 'sidoName', 'sigunguName', 'eupmyeondong', 'zipCode', 'address', 'phone', 'homepage',
  'landmark', 'direction', 'distance', 'parkingPaid', 'parkingNote', 'closedSunday', 'closedHoliday',
  'erDayAvailable', 'erDayPhone1', 'erDayPhone2', 'erNightAvailable', 'erNightPhone1', 'erNightPhone2',
  'lunchWeekday', 'lunchSaturday', 'receptionWeekday', 'receptionSaturday'
] as const;

const intFields = ['parkingCapacity', 'totalDoctors', 'generalDoctors', 'specialists', 'dentistDoctors', 'koreanDoctors', 'midwives'] as const;
const floatFields = ['latitude', 'longitude'] as const;

function naverMapUrl(hospital: { name: string; address?: string | null; latitude?: number | null; longitude?: number | null }) {
  const query = encodeURIComponent(`${hospital.name} ${hospital.address || ''}`.trim());
  if (hospital.latitude && hospital.longitude) {
    return `https://map.naver.com/p/search/${query}?c=${hospital.longitude},${hospital.latitude},15,0,0,0,dh`;
  }
  return `https://map.naver.com/p/search/${query}`;
}

export async function GET(_req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const hospital = await prisma.hospitalDirectory.findUnique({ where: { id } });
    if (!hospital) return NextResponse.json({ success: false, error: '병의원 정보를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ success: true, hospital: { ...hospital, naverMapUrl: naverMapUrl(hospital) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '병의원 상세 조회 실패' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const data: Record<string, any> = {};

    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = String(body[field] || '').trim() || null;
    });
    intFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = Number(body[field]);
        data[field] = Number.isFinite(value) ? value : null;
      }
    });
    floatFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = Number(body[field]);
        data[field] = Number.isFinite(value) ? value : null;
      }
    });

    const hospital = await prisma.hospitalDirectory.update({ where: { id }, data });
    return NextResponse.json({ success: true, hospital: { ...hospital, naverMapUrl: naverMapUrl(hospital) } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '병의원 정보 수정 실패' }, { status: 500 });
  }
}
