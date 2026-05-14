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
    const speaker = String(body?.speaker || '').trim();
    const context = Array.isArray(body?.context) ? body.context.slice(-6) : [];

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
            '목표는 구글 번역기처럼 자연스럽고 짧게 말이 이어지되, 의료 문맥에서는 더 정확하게 의학 용어를 보존·설명하는 것입니다.',
            '다음 원칙을 반드시 준수하세요:',
            '1. [중요 STT 자동 교정] 입력된 원문 텍스트는 모바일 음성 인식(STT)을 거친 문장이므로, 의학 용어가 발음대로 잘못 적히거나(예: "소아까" -> "소아과", "인대놀" -> "인데놀", "당수치" -> "혈당 수치"), 반복해서 적히는 에러(예: "머리가 아 머리가 아파요" -> "머리가 아파요")가 흔합니다. 번역 전 문맥을 파악하여 올바른 의학 용어와 매끄러운 단일 문장으로 자동 교정하세요.',
            '2. 의학 용어, 증상, 진단명, 약물명 등 의료에 특화된 단어를 극도로 정확하게 인식하고 번역해야 합니다.',
            '3. 의료진(의사/간호사)의 말은 환자가 이해하기 쉬운 자연스러운 높임말로 번역하세요.',
            '4. 환자의 말은 의료진이 임상적으로 파악하기 용이하도록 명확하고 정제된 전문 의학 용어(한 문장에 증상 요약 등)를 섞어 번역하세요.',
            '5. 약물 용량, 횟수, 기간, 부작용, 금기, 응급 경고 증상은 절대 생략하거나 완화하지 마세요.',
            '6. 실제 대화에서 바로 읽어줄 수 있도록 너무 딱딱한 문어체를 피하고 자연스러운 구어체를 사용하세요.',
            '7. 원문의 의도나 뉘앙스가 훼손되지 않도록 주의하세요.',
            '반드시 JSON 객체만 반환하세요.',
            'JSON 스키마:',
            '{',
            '  "correctedInput": "STT 오류와 어색한 표현을 보정한 원문",',
            '  "translation": "번역문",',
            '  "backTranslation": "번역문을 다시 한국어로 간단히 옮긴 안전 확인용 문장",',
            '  "medicalTerms": ["핵심 의학 용어 0~5개"],',
            '  "note": "임상적으로 주의 깊게 봐야 할 뉘앙스, 문화적 차이, 또는 STT(음성인식) 오류를 교정했다면 어떤 부분인지 설명하는 짧은 메모. 없으면 빈 문자열"',
            '}'
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `출발 언어: ${sourceLanguage}`,
            `도착 언어: ${targetLanguage}`,
            `화자: ${speaker || '미지정'}`,
            `최근 대화 문맥(JSON): ${JSON.stringify(context)}`,
            '번역할 원문:',
            inputText,
          ].join('\n'),
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);

    return NextResponse.json({
      correctedInput: String(parsed.correctedInput || inputText).trim(),
      translation: String(parsed.translation || '').trim(),
      backTranslation: String(parsed.backTranslation || '').trim(),
      medicalTerms: Array.isArray(parsed.medicalTerms) ? parsed.medicalTerms.map((term: unknown) => String(term).trim()).filter(Boolean).slice(0, 5) : [],
      note: String(parsed.note || '').trim(),
      medicalNote: String(parsed.note || '').trim(),
    });
  } catch (error: any) {
    console.error('Translate Route Error:', error);
    return NextResponse.json({ error: error.message || 'Translation failed.' }, { status: 500 });
  }
}