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
    const { chatHistory, lang } = await req.json();

    if (!chatHistory || !lang) {
      return NextResponse.json({ error: 'chatHistory and lang are required.' }, { status: 400 });
    }

    const conversationText = chatHistory.map((c: any) => `[${c.role}]: ${c.text}`).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `당신은 능숙한 의료 어시스턴트입니다. 아래에 제공된 진료 대화를 바탕으로, 환자가 스스로 이해하기 쉽게 '진료 요약 및 복약 안내'를 10문장 이내로 작성해주세요. 출력 언어는 반드시 제공된 언어인 [${lang}] 여야 합니다.`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
    });

    const content = completion.choices[0]?.message?.content || '';

    await prisma.patientSummary.create({
      data: { lang, content }
    });

    return NextResponse.json({ result: content });
  } catch (error: any) {
    console.error('Summary Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}