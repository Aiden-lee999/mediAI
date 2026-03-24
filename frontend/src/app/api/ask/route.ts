import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// 환경변수에 OPENAI_API_KEY가 등록되어 있다고 가정합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

function determineModel(question: string, hasImage: boolean) {
  if (hasImage) return 'gpt-4o';
  if (!question || question.length < 50) return 'gpt-4o-mini';
  return 'gpt-4o';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, history, imageBase64 } = body;
    const modelToUse = determineModel(question || '', !!imageBase64);

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `당신은 뛰어난 전문 의학 어시스턴트입니다.
반드시 아래의 JSON 포맷으로만 응답해주세요. 프론트엔드의 블록 UI를 렌더링하기 위한 필수 규격입니다:
{
  "intent_type": "general|disease|drug|image|recruit|translation",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 (예: X-ray 판독 및 전문의 소견 종합)",
  "chat_reply": "사용자에게 건넬 친절한 일반 텍스트 답변",
  "blocks": [
    {
      "block_type": "textbook|journal|md_tip|doctor_consensus|doctor_opinion|insurance_warning|expert_warning|image_read|sponsor_card|recruit_cards|drug_cards|translation",
      "title": "화면에 표시될 블록의 제목",
      "body": "블록의 내용 (HTML 태그 허용 안됨, 일반 텍스트)",
      "meta_json": {}, 
      "sort_order": 1
    }
  ]
}
- 보험 삭감 경고가 필요하면 'insurance_warning', 약물 추천시 'drug_cards', 처방 팁은 'md_tip' 블록을 적극 활용하세요.
- 번역 요청인 경우 'translation' 블록을 사용하고 meta_json.clinical_note에 복약 주의사항을 넣으세요.
`
    });

    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
         if(h.content && typeof h.content === 'string') {
            messages.push({ role: h.role, content: h.content });
         }
      });
    }

    if (imageBase64) {
       messages.push({
          role: 'user',
          content: [
             { type: 'text', text: question || '이 이미지를 의학적으로 분석해주세요.' },
             { type: 'image_url', image_url: { url: imageBase64 } }
          ]
       });
    } else {
       messages.push({ role: 'user', content: question });
    }

    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: messages,
      response_format: { type: "json_object" }
    });

    const replyContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(replyContent || '{}');

    return NextResponse.json(parsedResponse);
  } catch (error: any) {
    console.error("OpenAI API 연동 오류:", error.message || error);
    return NextResponse.json({
      intent_type: 'general',
      orchestration_summary: '시스템 안내',
      chat_reply: '현재 인공지능 서버가 원활하지 않습니다.',
      blocks: []
    });
  }
}


