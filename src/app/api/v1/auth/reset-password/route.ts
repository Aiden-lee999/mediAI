import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, hashToken, normalizeLicenseNumber } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const licenseNumber = normalizeLicenseNumber(body.licenseNumber || body.license || '');
    const token = String(body.token || '').trim();
    const password = String(body.password || '');

    if (!licenseNumber || !token || password.length < 8) {
      return NextResponse.json({ success: false, error: '면허번호, 재설정 토큰, 8자 이상 비밀번호가 필요합니다.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { doctorLicense: licenseNumber } });
    if (!user?.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return NextResponse.json({ success: false, error: '유효한 재설정 요청이 없습니다.' }, { status: 400 });
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: '재설정 토큰이 만료되었습니다.' }, { status: 400 });
    }

    if (user.passwordResetTokenHash !== hashToken(token)) {
      return NextResponse.json({ success: false, error: '재설정 토큰이 올바르지 않습니다.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '비밀번호 재설정 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
