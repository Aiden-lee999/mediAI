const fs = require('fs');

const routeCode = `import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchDrugInfo } from '@/lib/drugApiClient';

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
    
    // 식약처/심평원 API 연동 실시간 호출
    let drugContext = "";
    if (question && (question.includes("약") || question.includes("알려줘") || question.includes("타이레놀") || question.includes("부작용") || question.includes("가격"))) {
       // 질문 추출
       const rawObj = await fetchDrugInfo(question);
       if (rawObj) {
         drugContext = \`
[실시간 API 연동된 정보] 
반드시 다음 정보를 기반으로 응답의 "3. 대체약물 리스트"와 "4. 5. 블록"의 약가/이미지를 참고하여 작성하세요. 가격을 절대로 임의로 지어내지(hallucinate) 마십시오!
- 약품명: \${rawObj.name}
- 대표이미지: \${rawObj.imageUrl} 
- \${rawObj.mfdsData}
- \${rawObj.hiraData}
(참고: 응답 JSON 생성 시, \${rawObj.name}에 해당하는 데이터가 필요하면 가격으로 '\${rawObj.priceInfo}'를, 이미지 URL로 '\${rawObj.imageUrl}'를 있는 그대로 사용하십시오!)
\`;
       }
    }

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: \`당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

주의: 약물과 관련된 질문에는 무조건 아래 9개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다. 프롬프트 하단의 'JSON 포맷'은 단순 예시(Dummy)일 뿐이므로, 예시대로 포맷 텍스트를 그대로 복사해서 출력하지 마시고, **반드시 실제 환자/질문 상황에 맞는 매우 구체적이고 전문적인 내용으로 값을 채워야 합니다.** \${drugContext}

--- [블록 작성 상세 규칙 - 반드시 지킬 것!] ---
1. "textbook" (약물 기본 설명): 약물의 작용 기전, 적응증, 용법/용량, 임상적 주의 성을 매우 밀도있게 (최소 500자 이상, 3~4문단) 서술하십시오.
2. "textbook" (대체 옵션 논리): 어떤 대체제를 고려해야 하는지, 각 그룹별 특징과 장단점을 매우 밀도있게 (최소 500자 이상, 3~4문단) 서술하십시오.
3. "drug_cards" (대체 약물 리스트): **[주의!] 무조건 10개 이상의 약물**을 나열해야 합니다. (10개 미만 불가). 다양한 성분과 시밀러를 포함하여 가급적 대체 약물 리스트를 구체적인(name, ingredient, price, class, company, image_url)로 채워 넣으십시오 (위의 실시간 API 연동 정보가 있다면 해당 약물을 리스트에 포함하고 price와 image_url을 그대로 사용하세요).
4. "textbook" (많이 쓰이는 약 Top 5): **[매우 중요!] 3번 블록(대체 약물 리스트)에서 뽑은 것을 재활용하지 마십시오.** 전세계 및 국내 전체 처방 시장 통계를 독자적으로 분석하여, 해당 질환/적응증에서 가장 처방 판매량이 높은 진짜 Top 5 약물을 **새로 선정**해 기입하십시오 (1~5위 각각 약가, 급여/비급여 여부 명시)
5. "textbook" (가장 약가가 비싼 약 Top 5): **[매우 중요!] 3번 블록 리스트와 무관하게** 전체 시장에서 처방 가능한 관련 약물 중 가장 약가가 비싼 프리미엄 약물 Top 5를 새로 선정하십시오. (1~5위 각각 약가, 급여/비급여 여부 명시)
6. "textbook" (부작용 및 병용금기 DDI): 발생 가능한 부작용 메커니즘과 **반드시 같이 처방하면 안 되는 약물(병용금기)의 실제 성분명과 제품명을 명확한 예시로 명시**하십시오.
7. "md_tip" (처방 팁: 복약 지도, 식전/식후 등 실무 주의사항)
8. "doctor_consensus" (AI 예상 임상 반응): 임상 현장에서 의사들이 주로 체감하는 해당 약물의 장단점을 요약.
9. "journal" (출처 및 근거 자료): "가이드라인 참조"같은 모호한 말 금지. 구체적인 출처 2개 이상 명시.

--- [JSON 포맷] ---
{
  "intent_type": "drug",
  "orchestration_summary": "[실제 상황에 맞는 요약 작성]",
  "chat_reply": "[어시스턴트의 짧은 인사말 작성]",
  "blocks": [
    { "block_type": "textbook", "title": "1. 궁금한 약물 개요", "body": "[최소 500자 이상 작용기전 설명]", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 옵션 논리", "body": "[최소 500자 이상의 대체제 분석]", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 연관/대체 옵션 약물 (최소 10가 필수)", "body": "", "meta_json": { "drugs": [ { "name": "[실제약물명]", "ingredient": "[성분명]", "price": "[가격]", "class": "[급여구분]", "company": "[제약사]", "image_url": "[이미지URL결과]" } ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 인기 처방 Top 5", "body": "1위 ... 2위 ...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 프리미엄 처방 Top 5", "body": "1위 ...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "textbook", "title": "6. 부작용 및 DDI", "body": "[병용금기 사례]", "meta_json": {}, "sort_order": 6 },
    { "block_type": "md_tip", "title": "7. 처방/복약 실무 팁", "body": "[복약 및 주의사항]", "meta_json": {}, "sort_order": 7 },
    { "block_type": "doctor_consensus", "title": "8. AI 종합 소견", "body": "", "meta_json": { "summary": "[AI 요약 임상 반응]" }, "sort_order": 8 },
    { "block_type": "journal", "title": "9. 의학 출처", "body": "[출처 1]\\n[출처 2]", "meta_json": {}, "sort_order": 9 }
  ]
}\`
    });

    if (history && Array.isArray(history)) {
      const pastHistory = history.length > 0 ? history.slice(0, -1) : [];
      pastHistory.forEach((msg: any) => {
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
`;

fs.writeFileSync('src/app/api/ask/route.ts', routeCode);
const backendCode = routeCode.replace('import { NextResponse } from \\'next/server\\';', 'import express from \\'express\\';\nimport { fetchDrugInfo } from \\'../lib/drugApiClient\\';').replace('export async function POST(req: Request) {', \`const router = express.Router();
router.post('/ask', async (req, res) => {\`).replace(/return NextResponse\\.json\\((.*?)\\);/g, 'res.json($1);').replace(/return NextResponse\\.json\\((.*?), \\{ status: 500 \\}\\);/g, 'res.status(500).json($1);').replace('const body = await req.json();', 'const body = req.body;');

fs.writeFileSync('backend/src/routes/chatRoutes.ts', backendCode);

console.log('Fixed route.ts with drugApiClient!');
