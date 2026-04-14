import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { chatHistory } = await req.json();

    if (!chatHistory || !Array.isArray(chatHistory)) {
      return NextResponse.json({ error: 'chatHistory is required.' }, { status: 400 });
    }

    const conversationText = chatHistory.map((c: any) => `${c.role === 'doctor' ? '의사' : `환자`}: ${c.text}`).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: '주어진 의사와 환자의 진료 대화 내역 전체를 분석하여 명확하고 간결한 SOAP 포맷(영문/국문 혼용 의료 차트 표준)의 차트 기록을 생성해주세요.'
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
    });

    const content = completion.choices[0]?.message?.content || '';

    // MongoDB/SQLite Saving logic
    await prisma.chartRecord.create({
      data: { content }
    });

    return NextResponse.json({ result: content });
  } catch (error: any) {
    console.error('Chart Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}