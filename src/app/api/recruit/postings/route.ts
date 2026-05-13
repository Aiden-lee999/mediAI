import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isHospitalDirector, toListString, toNumberOrNull } from '@/lib/recruitMatching';
import { ensureCoordinate } from '@/lib/naverMaps';

export const dynamic = 'force-dynamic';

async function findUser(userId?: string, license?: string) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (license) return prisma.user.findUnique({ where: { doctorLicense: license } });
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerId = url.searchParams.get('ownerId') || undefined;
    const postings = await prisma.recruitPosting.findMany({
      where: ownerId ? { ownerId } : { status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { owner: { select: { name: true, jobTitle: true, hospitalName: true, specialty: true } } },
    });
    return NextResponse.json({ success: true, postings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '공고 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await findUser(body.userId, body.license);
    if (!user) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    if (!isHospitalDirector(user)) {
      return NextResponse.json({ success: false, error: '구인 공고 등록은 병원 원장/관리자 계정에서만 가능합니다.' }, { status: 403 });
    }

    const locationAddress = String(body.locationAddress || user.address || '').trim();
    const coordinate = await ensureCoordinate({
      address: locationAddress,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    const data = {
      ownerId: user.id,
      hospitalName: String(body.hospitalName || user.hospitalName || '').trim(),
      title: String(body.title || '').trim(),
      specialty: String(body.specialty || user.specialty || '').trim() || null,
      locationAddress,
      latitude: coordinate?.latitude ?? toNumberOrNull(body.latitude),
      longitude: coordinate?.longitude ?? toNumberOrNull(body.longitude),
      workTypes: toListString(body.workTypes),
      workMethods: toListString(body.workMethods),
      workHours: String(body.workHours || '').trim() || null,
      payMin: toNumberOrNull(body.payMin),
      payMax: toNumberOrNull(body.payMax),
      priority: String(body.priority || 'BALANCED'),
      description: String(body.description || '').trim() || null,
      status: String(body.status || 'ACTIVE'),
    };

    if (!data.hospitalName || !data.title || !data.locationAddress) {
      return NextResponse.json({ success: false, error: '병원명, 공고 제목, 근무지 주소는 필수입니다.' }, { status: 400 });
    }

    const posting = body.id
      ? await prisma.recruitPosting.update({ where: { id: String(body.id) }, data })
      : await prisma.recruitPosting.create({ data });

    return NextResponse.json({ success: true, posting });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '공고 저장 실패' }, { status: 500 });
  }
}
