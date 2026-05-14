import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Suggestion = {
  speaker: 'doctor' | 'patient';
  text: string;
  meaningKo: string;
  intent: string;
};

function safeString(value: unknown) {
  return String(value || '').trim();
}

function normalizeSpeaker(value: unknown): 'doctor' | 'patient' {
  return value === 'patient' ? 'patient' : 'doctor';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const latestSpeaker = normalizeSpeaker(body?.latestSpeaker);
    const patientLanguage = safeString(body?.patientLanguage) || '영어';
    const patientLanguageCode = safeString(body?.patientLanguageCode) || 'en';
    const latestOriginal = safeString(body?.latestOriginal);
    const latestTranslation = safeString(body?.latestTranslation);
    const context = Array.isArray(body?.context) ? body.context.slice(-8) : [];
    const nextSpeaker: 'doctor' | 'patient' = latestSpeaker === 'doctor' ? 'patient' : 'doctor';
    const responseLanguage = nextSpeaker === 'patient' ? patientLanguage : '한국어';

    if (!latestOriginal && !latestTranslation) {
      return NextResponse.json({ suggestions: [] });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            '당신은 외래 진료실에서 의료진과 외국인 환자의 자연스러운 양방향 대화를 돕는 의료 통역 코파일럿입니다.',
            '최근 대화 맥락과 방금 발화된 문장을 보고, 다음 화자가 실제로 말할 가능성이 높은 예상 응답/후속 질문 5개를 생성하세요.',
            '의사가 질문한 직후라면 환자가 답할 만한 짧고 자연스러운 답변을 환자 언어로 생성하세요.',
            '환자가 답한 직후라면 의사가 이어서 물어볼 만한 임상적으로 유용한 후속 질문 또는 안내를 한국어로 생성하세요.',
            '모바일 버튼에 들어갈 문장이므로 각 text는 80자 이내, 가능하면 한 문장으로 작성하세요.',
            '의학적으로 중요한 red flag, 약물 알레르기, 임신/수유, 복용약, 증상 기간/강도/위치/악화요인을 우선 고려하세요.',
            '진단을 확정하거나 과도하게 안심시키는 문장은 만들지 마세요.',
            '반드시 JSON 객체만 반환하세요.',
            'JSON 스키마: { "suggestions": [{ "speaker": "doctor|patient", "text": "버튼에 표시하고 입력될 문장", "meaningKo": "한국어 의미", "intent": "짧은 의도 라벨" }] }',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `환자 언어: ${patientLanguage} (${patientLanguageCode})`,
            `방금 말한 화자: ${latestSpeaker}`,
            `다음 예상 화자: ${nextSpeaker}`,
            `응답 언어: ${responseLanguage}`,
            `최근 대화(JSON): ${JSON.stringify(context)}`,
            `방금 원문: ${latestOriginal}`,
            `방금 번역: ${latestTranslation}`,
            '위 조건에 맞는 예상 응답 5개를 생성하세요.',
          ].join('\n'),
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent) as { suggestions?: Partial<Suggestion>[] };
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .map((item) => ({
            speaker: normalizeSpeaker(item.speaker || nextSpeaker),
            text: safeString(item.text),
            meaningKo: safeString(item.meaningKo),
            intent: safeString(item.intent),
          }))
          .filter((item) => item.text)
          .slice(0, 5)
      : [];

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Translate Suggestions Route Error:', error);
    return NextResponse.json({ error: error.message || 'Suggestion generation failed.' }, { status: 500 });
  }
}
