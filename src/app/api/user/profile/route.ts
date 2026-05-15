import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function findUser(userId?: string | null, license?: string | null) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } });
  if (license) return prisma.user.findUnique({ where: { doctorLicense: license } });
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const user = await findUser(url.searchParams.get('userId'), url.searchParams.get('license'));
    if (!user) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    const hospital = user.hospitalDirectoryId
      ? await prisma.hospitalDirectory.findUnique({ where: { id: user.hospitalDirectoryId } })
      : user.institutionNumber
        ? await prisma.hospitalDirectory.findUnique({ where: { encryptedCode: user.institutionNumber } }).catch(() => null)
        : user.hospitalName
          ? await prisma.hospitalDirectory.findFirst({ where: { name: { contains: user.hospitalName } } })
          : null;
    return NextResponse.json({ success: true, user: publicUser(user), hospital });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '프로필 조회 실패' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const user = await findUser(body.userId, body.license);
    if (!user) return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

    const hospitalDirectoryId = String(body.hospitalDirectoryId || '').trim() || null;
    const selectedHospital = hospitalDirectoryId
      ? await prisma.hospitalDirectory.findUnique({ where: { id: hospitalDirectoryId } })
      : null;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: String(body.name || user.name).trim(),
        specialty: String(body.specialty || user.specialty || '').trim() || null,
        hospitalName: selectedHospital?.name || String(body.hospitalName || user.hospitalName || '').trim() || null,
        address: selectedHospital?.address || String(body.address || user.address || '').trim() || null,
        institutionNumber: selectedHospital?.encryptedCode || String(body.institutionNumber || user.institutionNumber || '').trim() || null,
        hospitalDirectoryId,
      },
    });

    return NextResponse.json({ success: true, user: publicUser(updated), hospital: selectedHospital });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '프로필 저장 실패' }, { status: 500 });
  }
}
