import { NextResponse } from 'next/server';
import { verifyDoctorLicense } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await verifyDoctorLicense({
      licenseNumber: body.licenseNumber || body.license || '',
      name: body.name,
      birthDate: body.birthDate,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, verified: false, reason: error?.message || '면허번호 확인 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
