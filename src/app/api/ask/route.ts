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
      content: `당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

주의: 약물과 관련된 질문에는 무조건 아래 9개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다. 프롬프트 하단의 'JSON 뼈대'는 단순 예시(Dummy)일 뿐이므로, 절대로 뼈대의 텍스트를 그대로 복사해서 출력하지 마시고, **반드시 실제 환자/질문 상황에 맞는 매우 구체적이고 전문적인 내용으로만 가득 채워야 합니다.**

--- [블록 작성 상세 규칙 - 반드시 지킬 것!] ---
1. "textbook" (약물 기본 설명): 질문한 약물의 작용 기전, 적응증, 한계점, 임상적 의의 등을 **매우 심도있게 (최소 500자 이상, 3~4문단)** 서술하십시오.
2. "textbook" (대체 옵션 원리): 왜 대체제를 고려해야 하는지, 각 대체제 계열별 기전 차이와 장단점을 **매우 심도있게 (최소 500자 이상, 3~4문단)** 서술하십시오.
3. "drug_cards" (대체 약물 리스트): **[주의!] 무조건 10개 이상의 약물**을 나열해야 합니다. (10개 미만 불가). 다양한 성분과 제네릭을 포함한 폭넓은 대체 약물 리스트를 구체적(name, ingredient, price, class, company)으로 채워 넣으십시오.
4. "textbook" (많이 팔리는 약 Top 5): **[매우 중요!] 3번 블록(대체 약물 리스트)에서 뽑은 것을 재활용하지 마십시오.** 대한민국 및 전체 처방 시장 통계를 독자적으로 분석하여, 해당 질환/적응증에서 가장 처방량/판매량이 높은 진짜 Top 5 약물을 **새로 선정**해 적으십시오. (1위~5위 각각 약가와 급여/비급여 여부 명시)
5. "textbook" (가장 수가 비싼 약 Top 5): **[매우 중요!] 3번 블록 리스트와 무관하게** 전체 시장에서 처방 가능한 관련 약물 중 가장 약가가 비싼 프리미엄 약물 Top 5를 새로 선정하십시오. (1위~5위 각각 약가와 급여/비급여 여부 명시)
6. "textbook" (부작용 및 병용금기 DDI): 발생 가능한 부작용 메커니즘과, **반드시 같이 처방하면 안 되는 약물(병용금기)의 실제 성분명과 제품명을 명확한 예시로 명시**하십시오. (예: 로수바스타틴-크레스토정 같이 구체적으로 명시할 것)
7. "md_tip" (처방 팁): 복약 지도, 식전/식후 등 실무 주의사항.
8. "doctor_consensus" (의사 집단 반응): AI가 추정한 동료 의사들의 가상의 종합 의견.
9. "journal" (출처 및 근거 자료): "가이드라인 참조"같은 모호한 말 금지. "대한내과학회 진료가이드라인(2023)", "Journal of Hepatology(2022)" 등 연도와 저널명이 포함된 구체적인 출처를 2개 이상 명시.

--- [JSON 뼈대] ---
{
  "intent_type": "drug",
  "orchestration_summary": "[실제 상황에 맞는 요약 작성]",
  "chat_reply": "[어시스턴트의 짧은 인사말 작성]",
  "blocks": [
    { "block_type": "textbook", "title": "1. [질문한 약물명] 개요", "body": "[최소 500자 이상의 깊이 있는 기전 및 효능 설명 작성]", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 옵션 원리", "body": "[최소 500자 이상의 대체제 계열별 장단점 분석 작성]", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 대체 약물 리스트", "body": "", "meta_json": { "drugs": [ { "name": "[실제약물명1]", "ingredient": "[성분명1]", "price": "[가격]", "class": "[급여/비급여]", "company": "[제약사]" }, { "name": "[실제약물명2]", "ingredient": "[성분명2]", "price": "[가격]", "class": "[급여/비급여]", "company": "[제약사]" } ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 많이 팔리는 약 Top 5 (전체 시장 기준)", "body": "1위: [실제 약물] (약가: [가격], 구분: [급여/비급여])\n2위: ...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 가장 수가 비싼 약 Top 5 (약가 기준)", "body": "1위: [실제 비싼 약물] (약가: [가격], 구분: [급여/비급여])\n...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "textbook", "title": "6. 부작용 및 병용금기(DDI)", "body": "[구체적인 병용금기 제품명과 성분명을 포함한 상세 설명]", "meta_json": {}, "sort_order": 6 },
    { "block_type": "md_tip", "title": "7. 처방 팁 (실무 기준)", "body": "[환자 복약/지도 주의사항]", "meta_json": {}, "sort_order": 7 },
    { "block_type": "doctor_consensus", "title": "8. 의사 집단 반응 요약", "body": "", "meta_json": { "like_count": 15, "dislike_count": 2, "feedback_count": 5, "summary": "[의사들의 실제 종합 추천 의견을 가상으로 작성]" }, "sort_order": 8 },
    { "block_type": "journal", "title": "9. 출처 및 근거 자료", "body": "[구체적 출처 1]\n[구체적 출처 2]", "meta_json": {}, "sort_order": 9 }
  ]
}`
    });

    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        let msgContent = msg.content;
        if (msg.role === "assistant" && msg.parsedData) {
          msgContent = typeof msg.parsedData === "string" ? msg.parsedData : (msg.parsedData.chat_reply || "AI 응답 요약");
        }
        if (msgContent) {
          messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: typeof msgContent === "string" ? msgContent : JSON.stringify(msgContent)
          });
        }
      });
    }

    const userMessage: any = { role: "user", content: [] };
    if (question) {
      userMessage.content.push({ type: "text", text: question });
    }
    if (imageBase64) {
      userMessage.content.push({
        type: "image_url",
        image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : "data:image/jpeg;base64," + imageBase64 }
      });
    }
    if (userMessage.content.length > 0) {
      messages.push(userMessage);
    }

    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const reply = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(reply);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("OpenAI Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
