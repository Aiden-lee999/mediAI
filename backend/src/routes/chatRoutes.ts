import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

function determineModel(question: string, hasImage: boolean) {
  if (hasImage) return 'gpt-4o';
  // 약제나 복잡한 질문은 무조건 gpt-4o를 타도록 기준을 대폭 낮춤
  if (!question || question.length < 10) return 'gpt-4o-mini';
  return 'gpt-4o';
}

router.post('/ask', async (req, res) => {
  const { question, history, imageBase64 } = req.body;

  let modelToUse = determineModel(question || '', !!imageBase64);
  modelToUse = modelToUse.replace('gpt-5.4-pro', 'gpt-4o').replace('gpt-5.4-mini', 'gpt-4o-mini').replace('gpt-5.4', 'gpt-4o');

  try {
    const messages: any[] = [];

    messages.push({
      role: 'system',
      content: `﻿당신은 매일 수많은 환자를 진료하는 의사를 돕는 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

주의: 약물(예: 고덱스, godex 등)과 관련된 대체 투여 / 추천 질문에는 무조건 아래 9개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다.
1. "textbook" (약물 기본 설명 - 질문한 약물의 작용 기전, 적응증, 임상적 의의 등을 매우 심도있게 전문적인 수준으로 3~4문단 이상 상세히 서술할 것)
2. "textbook" (대체 옵션 원리 - 왜 대체제를 고려해야 하는지, 각 대체제 계열별 기전 차이와 장단점을 매우 심도있고 상세하게 3~4문단 이상 서술할 것)
3. "drug_cards" (대체 약물 리스트 - 최소 5개 ~ 10개 이상의 다양한 성분과 제네릭을 포함한 폭넓은 대체 약물 리스트를 무조건 포함시킬 것. name/ingredient/price/class/company 구체적 기재)
4. "textbook" (많이 팔리는 약 Top 5 - 앞서 3번 블록에서 언급된 리스트에 국한되지 않고, 전체 시장에서 해당 질환/적응증으로 처방되는 전체 약물 중 판매량 Top 5를 적을 것. 순위별로 약가(원)와 보험구분(급여/비급여) 필수 작성)
5. "textbook" (가장 수가 비싼 약 Top 5 - 앞서 3번 블록 리스트에 국한되지 않고, 전체 시장에서 약가가 가장 비싼 관련 약물 Top 5. 순위별로 약가(원)와 보험구분(급여/비급여) 필수 작성)
6. "textbook" (부작용 및 병용금기(DDI) - 발생 가능한 부작용 메커니즘과, 반드시 **같이 처방하면 안 되는 병용금기 약물들의 구체적인 성분명과 제품명 예시들**을 명확히 명시할 것. 단순히 기전이나 군(class)만 말하지 말고 직접적인 약물명을 적어줄 것)
7. "md_tip" (처방 팁)
8. "doctor_consensus" (의사 집단 반응)
9. "journal" (출처 및 근거 자료 - "가이드라인 참조"같은 모호한 말 대신 "대한간학회 진료가이드라인(2022)", "Journal of Hepatology(2023)" 등 구체적인 출처 명시)

JSON 뼈대:
{
  "intent_type": "drug",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 요약",
  "chat_reply": "사용자에게 건넬 짧은 안내",
  "blocks": [
    { "block_type": "textbook", "title": "1. [약물명] 개요", "body": "기능, 효능 등 매우 상세한 전문 내용...", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 옵션 원리", "body": "대체 약들의 기전 및 종류에 대한 심도 깊은 설명...", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 대체 약물 리스트 (주요 샘플 5~10종)", "body": "", "meta_json": { "drugs": [ { "name": "우루사정(100mg)", "ingredient": "Ursodeoxycholic acid", "price": "100원", "class": "급여/전문의약품", "company": "대웅제약" }, {"name": "실리마린", "ingredient": "Silymarin", "price": "150원", "class": "비급여/일반의약품", "company": "알리코제약"}, {"name": "펜넬캡슐", "ingredient": "Biphenyl dimethyl dicarboxylate", "price": "200원", "class": "급여/전문의약품", "company": "파마킹"} ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 많이 팔리는 약 Top 5 (전체 시장 기준)", "body": "1위: 약물명A (약가: OO원, 구분: 급여)\n2위: 약물명B (약가: OO원, 구분: 비급여)...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 가장 수가 비싼 약 Top 5 (전체 시장 기준)", "body": "1위: 약물명C (약가: OO원, 구분: 급여)\n2위: 약물명D (약가: OO원, 구분: 비급여)...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "textbook", "title": "6. 부작용 및 병용금기(DDI)", "body": "이 약물 처방 시 흔한 부작용은 ~이며, 대표적으로 [특정 약물명A], [특정 성분명B] 등과 병용 투여 금기입니다...", "meta_json": {}, "sort_order": 6 },
    { "block_type": "md_tip", "title": "7. 처방 팁 (실무 기준)", "body": "주의사항, 복약 지도 등...", "meta_json": {}, "sort_order": 7 },
    { "block_type": "doctor_consensus", "title": "8. 의사 집단 반응 요약", "body": "", "meta_json": { "like_count": 8, "dislike_count": 1, "feedback_count": 3, "summary": "위장 장애 시 UDCA 등으로 변경 권장합니다." }, "sort_order": 8 },
    { "block_type": "journal", "title": "9. 출처 및 근거 자료", "body": "[1] 대한내과학회 XX가이드라인(2023)\n[2] Journal of Medicine, 특정 논문명(2022)...", "meta_json": {}, "sort_order": 9 }
  ]
}

`

    });

    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
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

    res.json(parsed);
  } catch (error: any) {
    console.error("OpenAI Route Error:", error);
    res.status(500).json({ error: error.message });
  }
};
content: `﻿당신은 매일 수많은 환자를 진료하는 의사를 돕는 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

주의: 약물(예: 고덱스, godex 등)과 관련된 대체 투여 / 추천 질문에는 무조건 아래 9개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다.
1. "textbook" (약물 기본 설명 - 질문한 약물의 작용 기전, 적응증, 임상적 의의 등을 매우 심도있게 전문적인 수준으로 3~4문단 이상 상세히 서술할 것)
2. "textbook" (대체 옵션 원리 - 왜 대체제를 고려해야 하는지, 각 대체제 계열별 기전 차이와 장단점을 매우 심도있고 상세하게 3~4문단 이상 서술할 것)
3. "drug_cards" (대체 약물 리스트 - 무조건 **정확히 10개**의 다양한 제품명과 제네릭 리스트를 배열에 꽉 채워서 생성할 것. name/ingredient/price/class/company 필수 기재)
4. "textbook" (많이 팔리는 약 Top 5 - **절대 3번 블록의 표에 있는 약들 안에서만 고르지 말 것**. 3번 블록과 완전히 무관하게, 대한민국 해당 질환 처방 시장 전체를 통틀어 판매량 Top 5 의약품을 적을 것. 순위별로 약가와 보험구분 필수)
5. "textbook" (가장 수가 비싼 약 Top 5 - **절대 3번 블록의 표에 있는 약들 안에서만 고르지 말 것**. 3번 블록과 무관하게, 대한민국 해당 질환 시장 전체를 통틀어 약가가 제일 비싼 약 Top 5를 적을 것. 순위별 약가/구분 필수)
6. "textbook" (부작용 및 병용금기(DDI) - 발생 가능한 부작용 메커니즘과, 반드시 **같이 처방하면 안 되는 병용금기 약물들의 구체적인 성분명과 제품명 예시들**을 명확히 명시할 것. 단순히 기전이나 군(class)만 말하지 말고 직접적인 약물명을 적어줄 것)
7. "md_tip" (처방 팁)
8. "doctor_consensus" (의사 집단 반응)
9. "journal" (출처 및 근거 자료 - "가이드라인 참조"같은 모호한 말 대신 "대한간학회 진료가이드라인(2022)", "Journal of Hepatology(2023)" 등 구체적인 출처 명시)

JSON 뼈대:
{
  "intent_type": "drug",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 요약",
  "chat_reply": "사용자에게 건넬 짧은 안내",
  "blocks": [
    { "block_type": "textbook", "title": "1. [약물명] 개요", "body": "기능, 효능 등 매우 상세한 전문 내용...", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 옵션 원리", "body": "대체 약들의 기전 및 종류에 대한 심도 깊은 설명...", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 대체 약물 리스트 (10개 고정)", "body": "", "meta_json": { "drugs": [ { "name": "우루사정(100mg)", "ingredient": "Ursodeoxycholic acid", "price": "100원", "class": "급여/전문의약품", "company": "대웅제약" }, {"name": "실리마린", "ingredient": "Silymarin", "price": "150원", "class": "비급여/일반의약품", "company": "알리코제약"}, {"name": "펜넬캡슐", "ingredient": "Biphenyl dimethyl dicarboxylate", "price": "200원", "class": "급여/전문의약품", "company": "파마킹"} ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 많이 팔리는 약 Top 5 (전체 시장 기준)", "body": "1위: 약물명A (약가: OO원, 구분: 급여)\n2위: 약물명B (약가: OO원, 구분: 비급여)...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 가장 수가 비싼 약 Top 5 (전체 시장 기준)", "body": "1위: 약물명C (약가: OO원, 구분: 급여)\n2위: 약물명D (약가: OO원, 구분: 비급여)...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "textbook", "title": "6. 부작용 및 병용금기(DDI)", "body": "이 약물 처방 시 흔한 부작용은 ~이며, 대표적으로 [특정 약물명A], [특정 성분명B] 등과 병용 투여 금기입니다...", "meta_json": {}, "sort_order": 6 },
    { "block_type": "md_tip", "title": "7. 처방 팁 (실무 기준)", "body": "주의사항, 복약 지도 등...", "meta_json": {}, "sort_order": 7 },
    { "block_type": "doctor_consensus", "title": "8. 의사 집단 반응 요약", "body": "", "meta_json": { "like_count": 8, "dislike_count": 1, "feedback_count": 3, "summary": "위장 장애 시 UDCA 등으로 변경 권장합니다." }, "sort_order": 8 },
    { "block_type": "journal", "title": "9. 출처 및 근거 자료", "body": "[1] 대한내과학회 XX가이드라인(2023)\n[2] Journal of Medicine, 특정 논문명(2022)...", "meta_json": {}, "sort_order": 9 }
  ]
}

`undefinedcontent: `﻿당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

주의: 약물(예: 고덱스, godex 등)과 관련된 대체 투여 / 추천 질문에는 무조건 아래 9개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다.

**[블록 작성 상세 규칙 - 반드시 지킬 것!]**
1. "textbook" (약물 기본 설명): 질문한 약물의 작용 기전, 적응증, 한계점, 임상적 의의 등을 **매우 길고 심도있게(최소 500자 이상, 3~4문단)** 서술하십시오.
2. "textbook" (대체 옵션 원리): 왜 대체제를 고려해야 하는지, 각 대체제 계열별 기전 차이와 장단점을 **매우 길고 심도있게(최소 500자 이상, 3~4문단)** 서술하십시오.
3. "drug_cards" (대체 약물 리스트): **반드시 무조건 최소 10개 이상의 약물**을 나열해야 합니다. (10개 미만은 절대 불가). 다양한 성분과 제네릭을 포함한 폭넓은 대체 약물 리스트를 (name/ingredient/price/class/company) 구체적으로 채워 넣으십시오.
4. "textbook" (많이 팔리는 약 Top 5): **[매우 중요!!!] 절대로 3번 블록(대체 약물 리스트) 안에서만 고르지 마십시오.** 대한민국이나 글로벌 전체 처방 시장 통계를 떠올려, 해당 질환/적응증 전체에서 가장 판매량이 높은 Top 5 약물을 **독립적으로 새로 선정**하여 적으십시오. 순위마다 약가와 보험구분 필수.
5. "textbook" (가장 수가 비싼 약 Top 5): **[매우 중요!!!] 3번 블록 리스트와 무관하게 전체 시장**에서 처방 가능한 약물 중 가장 약가가 비싼 프리미엄 약물 Top 5를 적으십시오. 순위마다 약가와 보험구분 필수.
6. "textbook" (부작용 및 병용금기(DDI)): 발생 가능한 부작용뿐만 아니라, **[매우 중요!!!] 같이 처방하면 안 되는 약물(병용금기)의 실제 성분명과 제품명 예시(예: 로수바스타틴(크레스토), 자몽주스 등)를 명확히 적어주십시오.** 애매한 군(class) 설명으로 끝내지 마십시오.
7. "md_tip" (처방 팁): 주의사항, 복약 지도 등
8. "doctor_consensus" (의사 집단 반응)
9. "journal" (출처 및 근거 자료 - "가이드라인 참조"같은 모호한 말 대신 "대한간학회 진료가이드라인(2022)", "Journal of Hepatology(2023)" 등 구체적인 출처 명시)

JSON 뼈대 (배열 안의 항목 순서는 무조건 1부터 9까지 유지):
{
  "intent_type": "drug",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 요약",
  "chat_reply": "사용자에게 건넬 짧은 안내",
  "blocks": [
    { "block_type": "textbook", "title": "1. [약물명] 개요", "body": "기능, 효능 등 전문적이고 긴 내용 (최소 500자 이상)...", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 옵션 원리", "body": "대체 약들의 기전에 대한 심도 깊은 설명 (최소 500자 이상)...", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 대체 약물 리스트 (반드시 최소 10개 이상!!!)", "body": "", "meta_json": { "drugs": [ { "name": "우루사정(100mg)", "ingredient": "Ursodeoxycholic acid", "price": "100원", "class": "급여/전문의약품", "company": "대웅제약" }, {"name": "실리마린... (나머지 9개 이상 필수 채움)" } ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 많이 팔리는 약 Top 5 (전체 시장 기준, 3번과 무관하게 독립 서치)", "body": "1위: 약물명A (약가: OO원, 구분: 급여)\n2위: 약물명B (약가: OO원, 구분: 비급여)...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 가장 수가 비싼 약 Top 5 (전체 시장 기준, 3번과 무관하게 독립 서치)", "body": "1위: 약물명C (약가: OO원, 구분: 급여)\n2위: 약물명D (약가: OO원, 구분: 비급여)...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "textbook", "title": "6. 부작용 및 병용금기(DDI)", "body": "추천 약물 및 주의 성분. 대표적인 병용 금기 제품명: [제품명A], [제품명B]...", "meta_json": {}, "sort_order": 6 },
    { "block_type": "md_tip", "title": "7. 처방 팁 (실무 기준)", "body": "주의사항, 복약 지도 등...", "meta_json": {}, "sort_order": 7 },
    { "block_type": "doctor_consensus", "title": "8. 의사 집단 반응 요약", "body": "", "meta_json": { "like_count": 8, "dislike_count": 1, "feedback_count": 3, "summary": "위장 장애 시 UDCA 등으로 변경 권장합니다." }, "sort_order": 8 },
    { "block_type": "journal", "title": "9. 출처 및 근거 자료", "body": "[1] 대한내과학회 XX가이드라인(2023)\n[2] Journal of Medicine, 특정 논문명(2022)...", "meta_json": {}, "sort_order": 9 }
  ]
}

`undefined