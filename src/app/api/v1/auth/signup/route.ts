import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, hashPassword, isValidLicenseFormat, normalizeLicenseNumber, publicUser, verifyDoctorLicense } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function validPassword(password: string) {
  return typeof password === 'string' && password.length >= 8;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const licenseNumber = normalizeLicenseNumber(body.licenseNumber || body.license || '');
    const name = String(body.name || '').trim();
    const specialty = String(body.specialty || '').trim();
    const phone = String(body.phone || '').trim();
    const telephone = String(body.telephone || '').trim();
    const email = String(body.email || '').trim() || null;
    const birthDate = String(body.birthDate || '').trim();
    const address = String(body.address || '').trim();
    const jobTitle = String(body.jobTitle || '').trim();
    const hospitalName = String(body.hospitalName || '').trim();
    const institutionNumber = String(body.institutionNumber || '').trim();
    const termsAgreed = body.termsAgreed === true;
    const privacyAgreed = body.privacyAgreed === true;
    const patientInfoAgreed = body.patientInfoAgreed === true;
    const qualityImprovementAgreed = body.qualityImprovementAgreed === true;
    const marketingAgreed = body.marketingAgreed === true;
    const password = String(body.password || '');

    if (!isValidLicenseFormat(licenseNumber)) {
      return NextResponse.json({ success: false, error: '면허번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ success: false, error: '성명을 입력해 주세요.' }, { status: 400 });
    }
    if (!validPassword(password)) {
      return NextResponse.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }
    if (!termsAgreed || !privacyAgreed || !patientInfoAgreed) {
      return NextResponse.json({ success: false, error: '필수 약관, 개인정보 처리 안내, 환자정보·민감정보 입력 유의사항을 모두 확인해 주세요.' }, { status: 400 });
    }

    const verification = await verifyDoctorLicense({ licenseNumber, name, birthDate });
    if (!verification.verified) {
      return NextResponse.json(
        { success: false, error: verification.reason || '의사면허번호 확인에 실패했습니다.', verification },
        { status: verification.source === 'NOT_CONFIGURED' ? 503 : 403 },
      );
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { doctorLicense: licenseNumber },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: '이미 가입된 면허번호 또는 이메일입니다.' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        doctorLicense: licenseNumber,
        email,
        passwordHash: hashPassword(password),
        name,
        specialty: specialty || (verification as any).specialty || null,
        phone: phone || null,
        telephone: telephone || null,
        birthDate: birthDate || null,
        address: address || null,
        jobTitle: jobTitle || null,
        hospitalName: hospitalName || null,
        institutionNumber: institutionNumber || null,
        title: jobTitle || null,
        role: 'DOCTOR',
        status: 'ACTIVE',
        licenseVerifiedAt: new Date(),
        termsAgreedAt: new Date(),
        privacyAgreedAt: new Date(),
        patientInfoAgreedAt: new Date(),
        qualityImprovementAgreedAt: qualityImprovementAgreed ? new Date() : null,
        marketingAgreedAt: marketingAgreed ? new Date() : null,
      },
    });

    const token = createSessionToken({ sub: user.id, role: user.role, license: user.doctorLicense });
    return NextResponse.json({ success: true, token, user: publicUser(user) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '회원가입 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
