import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { lang, signature, content } = await req.json();

    if (!lang || !signature) {
      return NextResponse.json({ error: 'lang and signature are required.' }, { status: 400 });
    }

    await prisma.consentForm.create({
      data: {
        lang,
        signature,
        content: content || 'Standard Procedure Consent'
      }
    });

    return NextResponse.json({ success: true, message: '서명이 저장되었습니다.' });
  } catch (error: any) {
    console.error('Consent Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}