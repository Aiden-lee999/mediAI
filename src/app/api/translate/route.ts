import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inputText = String(body?.inputText || '').trim();
    const targetLanguage = String(body?.targetLanguage || '').trim();

    if (!inputText || !targetLanguage) {
      return NextResponse.json({ error: 'inputText and targetLanguage are required.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            '당신은 진료실 다국어 통역 보조 AI입니다.',
            '의학 용어의 정확성을 유지하되, 환자와 보호자가 이해하기 쉬운 자연스러운 표현으로 번역하세요.',
            '반드시 JSON 객체만 반환하세요.',
            'JSON 스키마:',
            '{',
            '  "translation": "번역문",',
            '  "note": "임상적으로 주의할 짧은 메모. 없으면 빈 문자열"',
            '}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `대상 언어: ${targetLanguage}`,
            '번역할 원문:',
            inputText,
          ].join('\n'),
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);

    return NextResponse.json({
      translation: String(parsed.translation || '').trim(),
      note: String(parsed.note || '').trim(),
    });
  } catch (error: any) {
    console.error('Translate Route Error:', error);
    return NextResponse.json({ error: error.message || 'Translation failed.' }, { status: 500 });
  }
}