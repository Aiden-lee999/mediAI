import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

function determineModel(question: string, hasImage: boolean) {
  if (hasImage) return 'gpt-4o';
  if (!question || question.length < 10) return 'gpt-4o-mini';
  return 'gpt-4o';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, history, imageBase64 } = body;
    let modelToUse = determineModel(question || '', !!imageBase64);
    modelToUse = modelToUse.replace('gpt-5.4-pro', 'gpt-4o').replace('gpt-5.4-mini', 'gpt-4o-mini').replace('gpt-5.4', 'gpt-4o');

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `당신은 매일 수많은 환자를 진료하는 의사를 돕는 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요. 

주의: 약물(예: 고덱스, godex 등)과 관련된 대체 투여 / 추천 질문에는 무조건 아래 8개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다.

1. "textbook" (약물 기본 설명)
2. "textbook" (대체 옵션 원리)
3. "drug_cards" (대체 약물 정보 - meta_json.drugs에 반드시 3개 이상 채울 것)
4. "textbook" (가장 많이 팔리는 약 top5)
5. "textbook" (가장 수가 비싼 약 top5)
6. "md_tip" (처방 팁)
7. "doctor_consensus" (의사 집단 반응)
8. "journal" (출처 및 근거)

JSON 뼈대:
{
  "intent_type": "drug",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 요약",
  "chat_reply": "사용자에게 건넬 짧은 안내",
  "blocks": [
    { "block_type": "textbook", "title": "1. [약물명] 개요", "body": "기능, 효능 등...", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 약물 개념", "body": "대체 약들의 기전...", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 대체 약물 리스트", "body": "", "meta_json": { "drugs": [ { "name": "우루사정(100mg)", "ingredient": "Ursodeoxycholic acid", "price": "100원(급여)", "class": "전문의약품", "company": "대웅제약" }, {"name": "실리마린", "ingredient": "Silymarin", "price": "비급여", "class": "일반의약품", "company": "알리코제약"}, {"name": "펜넬캡슐", "ingredient": "Biphenyl dimethyl dicarboxylate", "price": "200원", "class": "전문의약품", "company": "파마킹"} ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 많이 팔리는 약 Top 5", "body": "1위~5위 목록 형식으로 작성...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 가장 수당이 비싼 약 Top 5", "body": "1위~5위 고가 약 목록...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "md_tip", "title": "6. 처방 팁 (실무 기준)", "body": "주의사항, 복약 지도 등...", "meta_json": {}, "sort_order": 6 },
    { "block_type": "doctor_consensus", "title": "7. 의사 집단 반응 요약", "body": "", "meta_json": { "like_count": 8, "dislike_count": 1, "feedback_count": 3, "summary": "위장 장애 시 UDCA 등으로 변경 권장합니다." }, "sort_order": 7 },
    { "block_type": "journal", "title": "8. 출처 및 근거 자료", "body": "관련 가이드라인 또는 논문명...", "meta_json": {}, "sort_order": 8 }
  ]
}
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
             { type: 'text', text: question || '분석해주세요.' },
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
    console.error("API 연동 오류:", error);
    return NextResponse.json({ intent_type: 'general', blocks: [] });
  }
}

