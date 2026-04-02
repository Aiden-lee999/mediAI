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
    const sourceLanguage = String(body?.sourceLanguage || '').trim();
    const targetLanguage = String(body?.targetLanguage || '').trim();

    if (!inputText || !sourceLanguage || !targetLanguage) {
      return NextResponse.json({ error: 'inputText, sourceLanguage, and targetLanguage are required.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            '당신은 진료실에서 의사와 외국인 환자 사이의 양방향 소통을 돕는 최고 수준의 의료 전문 통역 AI입니다.',
            '다음 원칙을 반드시 준수하세요:',
            '1. 의학 용어, 증상, 진단명, 약물명 등 의료에 특화된 단어를 극도로 정확하게 인식하고 번역해야 합니다.',
            '2. 의료진(의사/간호사)의 말은 환자가 이해하기 쉬운 자연스러운 높임말로 번역하세요.',
            '3. 환자의 말은 의료진이 임상적으로 파악하기 용이하도록 명확하고 정제된 표현으로 번역하세요.',
            '4. 원문의 의도나 뉘앙스가 훼손되지 않도록 주의하세요.',
            '반드시 JSON 객체만 반환하세요.',
            'JSON 스키마:',
            '{',
            '  "translation": "번역문",',
            '  "note": "임상적으로 주의 깊게 봐야 할 뉘앙스나 문화적 차이가 있다면 짧은 메모. 없으면 빈 문자열"',
            '}'
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `출발 언어: ${sourceLanguage}`,
            `도착 언어: ${targetLanguage}`,
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