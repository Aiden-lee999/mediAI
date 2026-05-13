import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, normalizeLicenseNumber, publicUser, verifyPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { license, licenseNumber, password } = await req.json();
    const normalizedLicense = normalizeLicenseNumber(licenseNumber || license || '');

    if (!normalizedLicense || !password) {
      return NextResponse.json({ error: '면허번호와 비밀번호를 입력해 주세요.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { doctorLicense: normalizedLicense },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: '면허번호 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: '승인되지 않았거나 비활성화된 계정입니다.' }, { status: 403 });
    }

    const token = createSessionToken({ sub: user.id, role: user.role, license: user.doctorLicense });
    return NextResponse.json({ token, user: publicUser(user) });

  } catch (error) {
    return NextResponse.json({ error: '서버 오류입니다' }, { status: 500 });
  }
}
