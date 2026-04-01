import { NextResponse } from 'next/server';
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
    
    let drugContext = "";
    if (question && (question.includes("약") || question.includes("알려줘") || question.includes("타이레놀") || question.includes("부작용") || question.includes("가격"))) {
       const rawObj = await fetchDrugInfo(question);
       if (rawObj) {
         drugContext = `
[실시간 API 연동된 정보] 
반드시 다음 정보를 기반으로 응답의 "3. 대체약물 리스트"와 "4. 5. 블록"의 약가/이미지를 참고하여 작성하세요. 가격을 절대로 임의로 지어내지(hallucinate) 마십시오!
- 약품명: ${rawObj.name}
- 대표이미지: ${rawObj.imageUrl} 
- ${rawObj.mfdsData}
- ${rawObj.hiraData}
(참고: 응답 JSON 생성 시, ${rawObj.name}에 해당하는 데이터가 필요하면 가격으로 '${rawObj.priceInfo}'를, 이미지 URL로 '${rawObj.imageUrl}'를 있는 그대로 사용하십시오!)
`;
       }
    }

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

**[매우 중요한 어투 규칙]**
당신의 응답은 단순한 표나 딱딱한 개조식 나열이 아닌, 선생님(의사)과 대화하듯이 매우 자연스럽고 매끄러운 구어체로 작성되어야 합니다.
'chat_reply' 필드에는 응답을 시작하는 친절한 인사말 서론(예: "네, 선생님. 문의하신 약물에 대해 확인해보았습니다.")을 작성하고,
각 블록의 'body' 내용 또한 기계적인 나열이 아니라 "선생님, 이 약물의 주요 작용 기전은..."과 같이 풀어서 설명하는 대화체 문장식으로 작성해주세요.

1. "textbook" (약물 기본 설명): 약물의 작용 기전, 적응증, 용법/용량, 임상적 주의사항을 매우 밀도있게 서술하십시오.
2. "textbook" (대체 옵션 논리): 어떤 대체제를 고려해야 하는지, 각 그룹별 특징과 장단점을 서술하십시오.
3. "drug_cards" (대체 약물 리스트): **[주의!] 무조건 10개 이상의 약물**을 나열해야 합니다. 실시간 API 연동 정보가 있다면 해당 약물을 리스트에 우선 포함하고 price와 image_url을 그대로 사용하세요. 형식을 지키세요: name, ingredient, price, class, company, image_url.
4. "textbook" (많이 쓰이는 약 Top 5): 인기 5위 약물을 새로 선정해 기입.
5. "textbook" (주요 비싼 약 Top 5): 비싼 프리미엄 약물 5위 랭킹.
6. "textbook" (부작용 및 병용금기 DDI): 발생 가능한 부작용 메커니즘과 병용금기 약물을 표시.
7. "md_tip" (처방 팁)
8. "doctor_consensus" (AI 예상 임상 반응)
9. "journal" (출처 및 근거 자료)

--- [JSON 포맷] ---
{
  "intent_type": "drug",
  "orchestration_summary": "[요약]",
  "chat_reply": "[짧은 인사말]",
  "blocks": [
    { "block_type": "textbook", "title": "1. 궁금한 약물 개요", "body": "[기전]", "meta_json": { "image_url": "대표이미지URL 여기 입력" }, "sort_order": 1 },
    { "block_type": "textbook", "title": "2. 대체 옵션 논리", "body": "[설명]", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "3. 연관/대체 옵션 약물", "body": "", "meta_json": { "drugs": [ { "name": "약물명", "ingredient": "성분명", "price": "150원", "class": "급여", "company": "제약사", "image_url": "url" } ] }, "sort_order": 3 },
    { "block_type": "textbook", "title": "4. 인기 처방 Top 5", "body": "...", "meta_json": {}, "sort_order": 4 },
    { "block_type": "textbook", "title": "5. 프리미엄 처방 Top 5", "body": "...", "meta_json": {}, "sort_order": 5 },
    { "block_type": "textbook", "title": "6. 부작용 및 DDI", "body": "...", "meta_json": {}, "sort_order": 6 },
    { "block_type": "md_tip", "title": "7. 처방 실무 팁", "body": "...", "meta_json": {}, "sort_order": 7 },
    { "block_type": "doctor_consensus", "title": "8. AI 종합 소견", "body": "", "meta_json": { "summary": "..." }, "sort_order": 8 },
    { "block_type": "journal", "title": "9. 의학 출처", "body": "...", "meta_json": {}, "sort_order": 9 }
  ]
}`
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
