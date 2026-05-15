import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isHospitalDirector, toListString, toNumberOrNull } from '@/lib/recruitMatching';
import { ensureCoordinate } from '@/lib/naverMaps';

export const dynamic = 'force-dynamic';

type ProfileBody = {
  userId?: string;
  license?: string;
  mode?: string;
  locationAddress?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  specialty?: string;
  workTypes?: string[] | string;
  workMethods?: string[] | string;
  workHours?: string;
  minPay?: number | string | null;
  maxPay?: number | string | null;
  priority?: string;
  availableFrom?: string;
  intro?: string;
};

async function findUser(userId?: string, license?: string) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (license) return prisma.user.findUnique({ where: { doctorLicense: license } });
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const user = await findUser(url.searchParams.get('userId') || undefined, url.searchParams.get('license') || undefined);
    if (!user) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    const profile = await prisma.recruitProfile.findUnique({ where: { userId: user.id } });
    const isHiringMode = profile?.mode ? profile.mode === 'HIRING' : isHospitalDirector(user);
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        specialty: user.specialty,
        jobTitle: user.jobTitle,
        hospitalName: user.hospitalName,
        address: user.address,
        isDirector: isHiringMode,
      },
      profile,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '프로필 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProfileBody;
    const user = await findUser(body.userId, body.license);
    if (!user) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    const director = isHospitalDirector(user);
    const mode = body.mode === 'HIRING' || body.mode === 'SEEKING' ? body.mode : (director ? 'HIRING' : 'SEEKING');
    const locationAddress = body.locationAddress?.trim() || user.address || null;
    const coordinate = await ensureCoordinate({
      address: locationAddress,
      latitude: body.latitude,
      longitude: body.longitude,
    });
    const profile = await prisma.recruitProfile.upsert({
      where: { userId: user.id },
      update: {
        mode,
        locationAddress,
        latitude: coordinate?.latitude ?? toNumberOrNull(body.latitude),
        longitude: coordinate?.longitude ?? toNumberOrNull(body.longitude),
        specialty: body.specialty?.trim() || user.specialty || null,
        workTypes: toListString(body.workTypes),
        workMethods: toListString(body.workMethods),
        workHours: body.workHours?.trim() || null,
        minPay: toNumberOrNull(body.minPay),
        maxPay: toNumberOrNull(body.maxPay),
        priority: body.priority || 'BALANCED',
        availableFrom: body.availableFrom?.trim() || null,
        intro: body.intro?.trim() || null,
      },
      create: {
        userId: user.id,
        mode,
        locationAddress,
        latitude: coordinate?.latitude ?? toNumberOrNull(body.latitude),
        longitude: coordinate?.longitude ?? toNumberOrNull(body.longitude),
        specialty: body.specialty?.trim() || user.specialty || null,
        workTypes: toListString(body.workTypes),
        workMethods: toListString(body.workMethods),
        workHours: body.workHours?.trim() || null,
        minPay: toNumberOrNull(body.minPay),
        maxPay: toNumberOrNull(body.maxPay),
        priority: body.priority || 'BALANCED',
        availableFrom: body.availableFrom?.trim() || null,
        intro: body.intro?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, profile, isDirector: mode === 'HIRING' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '프로필 저장 실패' }, { status: 500 });
  }
}
