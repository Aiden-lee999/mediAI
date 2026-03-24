import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { license, password, name, specialty } = await req.json();
    
    // 단순 데모용 모의 로그인 (DB 없이)
    if (!license || !password) {
      return NextResponse.json({ error: '인증 정보가 올바르지 않습니다.' }, { status: 401 });
    }

    return NextResponse.json({
      token: 'fake-jwt-token-for-demo',
      user: {
        id: 1,
        name: name || '김의사',
        specialty: specialty || '내과',
        license: license
      }
    });

  } catch (error) {
    return NextResponse.json({ error: '서버 오류입니다' }, { status: 500 });
  }
}
