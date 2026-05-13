import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPasswordResetToken, hashToken, normalizeLicenseNumber, passwordResetExpiry } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const licenseNumber = normalizeLicenseNumber(body.licenseNumber || body.license || '');
    const user = licenseNumber
      ? await prisma.user.findUnique({ where: { doctorLicense: licenseNumber } })
      : null;

    let devResetToken = '';
    if (user) {
      const token = createPasswordResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiresAt: passwordResetExpiry(),
        },
      });

      if (process.env.NODE_ENV !== 'production' || process.env.RETURN_PASSWORD_RESET_TOKEN === 'true') {
        devResetToken = token;
      }

      // 운영에서는 여기서 SMS/이메일 발송 Provider를 연결한다.
    }

    return NextResponse.json({
      success: true,
      message: '계정이 존재하면 비밀번호 재설정 절차가 발송됩니다.',
      ...(devResetToken ? { resetToken: devResetToken } : {}),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '비밀번호 찾기 요청 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
