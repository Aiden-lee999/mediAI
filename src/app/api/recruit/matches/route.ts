import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { estimateRoute, isHospitalDirector, scoreRecruitMatch } from '@/lib/recruitMatching';

export const dynamic = 'force-dynamic';

async function findUser(userId?: string, license?: string) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (license) return prisma.user.findUnique({ where: { doctorLicense: license } });
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await findUser(body.userId, body.license);
    if (!user) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    const profile = await prisma.recruitProfile.findUnique({ where: { userId: user.id } });
    const director = isHospitalDirector(user);

    if (director) {
      const postings = await prisma.recruitPosting.findMany({
        where: { ownerId: user.id, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        include: { hospitalDirectory: true },
      });
      const candidates = await prisma.recruitProfile.findMany({
        where: {
          mode: 'SEEKING',
          userId: { not: user.id },
          user: { role: { not: 'HOSPITAL_DIRECTOR' } },
        },
        include: { user: { select: { id: true, name: true, specialty: true, jobTitle: true, hospitalName: true, role: true } } },
        take: 200,
      });

      const seekerCandidates = candidates.filter((candidate) => !isHospitalDirector(candidate.user));
      const matches = postings.flatMap((posting) => seekerCandidates.map((candidate) => {
        const result = scoreRecruitMatch({ candidate, posting, priority: posting.priority });
        const route = estimateRoute({
          originAddress: candidate.locationAddress || '',
          destinationAddress: posting.locationAddress,
          originLat: candidate.latitude,
          originLng: candidate.longitude,
          destinationLat: posting.latitude,
          destinationLng: posting.longitude,
        });
        return { type: 'candidate', posting, candidate, score: result, route };
      })).filter((match) => match.score.score >= 40).sort((a, b) => b.score.score - a.score.score).slice(0, 30);

      return NextResponse.json({ success: true, mode: 'HIRING', isDirector: true, profile, matches });
    }

    if (!profile) {
      return NextResponse.json({ success: true, mode: 'SEEKING', isDirector: false, profile: null, matches: [], message: '먼저 구직 선호조건을 저장해 주세요.' });
    }

    const postings = await prisma.recruitPosting.findMany({
      where: { status: 'ACTIVE' },
      include: {
        owner: { select: { id: true, name: true, jobTitle: true, hospitalName: true, specialty: true } },
        hospitalDirectory: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const matches = postings.map((posting) => {
      const result = scoreRecruitMatch({ candidate: profile, posting, priority: profile.priority });
      const route = estimateRoute({
        originAddress: profile.locationAddress || '',
        destinationAddress: posting.locationAddress,
        originLat: profile.latitude,
        originLng: profile.longitude,
        destinationLat: posting.latitude,
        destinationLng: posting.longitude,
      });
      return { type: 'posting', posting, score: result, route };
    }).filter((match) => match.score.score >= 40).sort((a, b) => b.score.score - a.score.score).slice(0, 30);

    return NextResponse.json({ success: true, mode: 'SEEKING', isDirector: false, profile, matches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '매칭 조회 실패' }, { status: 500 });
  }
}
