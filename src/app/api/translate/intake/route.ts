import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { lang, symptom, duration, history, occupation, chatHistory } = await req.json();

    if (!lang) {
      return NextResponse.json({ error: 'lang is required.' }, { status: 400 });
    }

    const conversationText = chatHistory && chatHistory.length > 0 ? chatHistory.map((c: any) => `[${c.role}]: ${c.text}`).join('\n') : '';

    await prisma.patientIntake.create({
      data: {
        patientLang: lang,
        symptom: symptom || '정보 없음',
        duration: duration || '정보 없음',
        history: history || '정보 없음',
        occupation: occupation || '정보 없음',
        summaryChat: conversationText
      }
    });

    return NextResponse.json({ success: true, message: '문진표가 저장되었습니다.' });
  } catch (error: any) {
    console.error('Intake Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
