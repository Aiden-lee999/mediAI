import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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
    let modelToUse = determineModel(question || '', !!imageBase64);
    
    // 비존재 모델 방어
    modelToUse = modelToUse.replace('gpt-5.4-pro', 'gpt-4o').replace('gpt-5.4-mini', 'gpt-4o-mini').replace('gpt-5.4', 'gpt-4o');

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: \당신은 매일 수많은 환자를 진료하는 의사를 돕는 특급 전문 의학 어시스턴트입니다.
프론트엔드 대시보드의 블록 UI를 가장 완벽하게 렌더링하기 위해 반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요. 응답은 무조건 파싱 가능한 유효한 JSON 객체 하나여야 합니다.

주의: 특정 약물(예: 고덱스, godex 등)의 대체 투여를 묻는 질문에는 다음 **8개의 블록**을 정확하게 이 순서대로 생성해야 합니다:

1. "textbook" 블록: "1. [약물명]은 무슨 약이다~~" (기능, 효능 등 기본 약물 정보)
2. "textbook" 블록: "2. [약물명]을 대체하려면 이런 약들이 있다~~" (대체 약물 개념 설명)
3. "drug_cards" 블록: 대체 약물 리스트 (반드시 meta_json.drugs 배열에 객체를 넣고 name, ingredient, price, class, company 속성을 모두 채워 3개 이상의 대체제를 제공하세요.)
4. "textbook" 블록: "3. 가장 많이 팔리는 약 top5"
5. "textbook" 블록: "4. 가장 수가 비싼 약 top5"
6. "md_tip" 블록: "처방 팁" (복용법 주의사항 등)
7. "doctor_consensus" 블록: "의사 집단 반응 요약" (반드시 meta_json에 like_count, dislike_count, feedback_count, summary를 포함하세요.)
8. "journal" 블록: "출처 및 근거 자료"

JSON 예시 뼈대:
{
  "intent_type": "drug",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 요약",
  "chat_reply": "사용자에게 건넬 친절한 일반 텍스트 답변",
  "blocks": [
    { "block_type": "textbook", "title": "...", "body": "...", "meta_json": {}, "sort_order": 1 },
    { "block_type": "drug_cards", "title": "대체 약물 후보", "body": "...", "meta_json": { "drugs": [ { "name": "우루사", "ingredient": "UDCA", "price": "100원", "class": "전문", "company": "대웅제약" } ] }, "sort_order": 2 }
  ]
}
\
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
       if (question) {
           messages.push({ role: 'user', content: question });
       }
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
