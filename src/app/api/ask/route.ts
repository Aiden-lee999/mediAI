import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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

**[매우 중요한 어투 및 포맷 규칙]**
당신의 응답은 엄격한 JSON이나 정해진 카드 형태가 아닌, 선생님(의사)과 대화하듯이 매우 자연스럽고 매끄러운 구어체 마크다운(Markdown)으로 작성해야 합니다.
1. 기계적인 표나 개조식 나열부터 시작하지 마시고, 첫인사는 "네, 선생님. 문의하신 약물에 대해 확인해보았습니다."와 같이 부드럽고 자연스럽게 시작해주세요.
2. 약물의 기전이나 설명은 선생님(의사)에게 직접 구두로 브리핑하듯 서술하세요. (예: "선생님, 이 약물의 주요 작용 기전은...")
3. **[유일한 예외]** 10개 이상의 약물 대체 옵션 리스트나, 부작용 비교 등 여러 약물의 속성을 한눈에 비교해야 하는 정보는 **반드시 마크다운 테이블(표) 형태를 적극 활용**해서 보기 좋게 정리해주세요. (표의 컬럼 예: 약물명 | 성분명 | 가격 | 제조사 등)
4. JSON 포맷은 절대 출력하지 마세요.

**[필수 포함 8가지 핵심 정보]**
대화형 구어체로 설명하더라도, 아래 8가지 정보는 빠짐없이 순서대로(혹은 자연스러운 흐름으로) 모두 포함하여 설명해야 합니다:
1. **궁금한 약물 개요:** 약물의 작용 기전, 적응증, 용법/용량, 임상적 주의사항을 밀도있게 서술.
2. **대체 옵션 논리:** 어떤 대체제를 고려해야 하는지, 각 그룹별 특징과 장단점 서술.
3. **연관/대체 옵션 약물 리스트:** 무조건 10개 이상의 약물을 나열하되, **반드시 `|` 기호를 사용하는 규격화된 마크다운 표(Table)** 형태로 작성하세요. (예: `| 약물명 | 성분명 | 가격 | 분류 | 제조사 |` 형태이며, 바로 밑에 `|---|---|---|---|---|` 줄을 반드시 포함해야 합니다!) 실시간 API 정보 우선 반영.
4. **인기 처방 Top 5:** 많이 쓰이는 대체 약물 5위를 선정하여 **반드시 마크다운 표(Table)** 형태로 작성.
5. **프리미엄 처방 Top 5:** 비싸지만 효과가 좋은 프리미엄 약물 5위 랭킹을 선정하여 **반드시 마크다운 표(Table)** 형태로 작성.
6. **부작용 및 병용금기(DDI):** 발생 가능한 부작용 메커니즘과 병용금기 약물 안내.
7. **처방 실무 팁(MD Tip):** 의사들을 위한 실제 처방시 유용한 팁.
8. **AI 종합 소견 (및 출처):** AI 예상 임상 반응과 근거 자료 요약.

${drugContext}`
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
      stream: true,
      temperature: 0.2,
    });

          const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
  } catch (error: any) {
    console.error("OpenAI Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
