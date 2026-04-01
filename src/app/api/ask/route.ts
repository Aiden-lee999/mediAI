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
         drugContext = [
           "[실시간 API 연동된 정보]",
           "반드시 다음 정보를 기반으로 응답의 '3. 대체약물 리스트'와 '4. 5. 블록'의 약가/이미지를 참고하여 작성하세요. 가격을 절대로 임의로 지어내지(hallucinate) 마십시오!",
           "- 약품명: " + rawObj.name,
           "- 대표이미지: " + rawObj.imageUrl,
           "- " + rawObj.mfdsData,
           "- " + rawObj.hiraData,
           "(참고: 응답 JSON 생성 시, " + rawObj.name + "에 해당하는 데이터가 필요하면 가격으로 '" + rawObj.priceInfo + "'를, 이미지 URL로 '" + rawObj.imageUrl + "'를 있는 그대로 사용하십시오!)"
         ].join("\n");
       }
    }

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: [
        "당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.",
        "",
        "**[매우 중요한 어투 및 포맷 규칙]**",
        "당신의 응답은 반드시 2부분으로 나누어져야 합니다.",
        "**[Part 1: 스트리밍 대화 (Markdown)]**",
        "여기에는 표를 그리지 마세요. 선생님(의사)과 대화하듯이 매우 자연스럽고 매끄러운 구어체 마크다운으로 약물의 개요, 실무 팁, 부작용, AI 요약 등의 핵심 정보를 자연스럽게 서술하세요.",
        "",
        "**[Part 2: 구조화된 데이터 UI 블록]**",
        "Part 1 작성이 끝나면, 반드시 정확히 '___JSON_BLOCKS___' 라는 구분자를 출력하고, 그 아래에 8가지 필수 정보가 담긴 JSON 배열을 출력하세요.",
        "JSON 배열은 반드시 다음 규격을 100% 준수해야 합니다 (body가 비어있으면 화면이 깨집니다):",
        "[",
        "  { \"block_type\": \"textbook\", \"title\": \"1. 궁금한 약물 개요\", \"body\": \"약물의 작용 기전, 적응증 등 상세 설명\", \"meta_json\": { \"image_url\": \"제공된 사진 URL\" } },",
        "  { \"block_type\": \"textbook\", \"title\": \"2. 대체 옵션 논리\", \"body\": \"대체제 고려 사항 및 특징 설명\" },",
        "  { \"block_type\": \"drug_cards\", \"title\": \"3. 연관/대체 약물 (확장형)\", \"meta_json\": { \"drugs\": [ {\"name\":\"약\",\"ingredient\":\"성분\",\"price\":\"단가\",\"class\":\"분류\",\"company\":\"제약사\"} ] } },",
        "  { \"block_type\": \"textbook\", \"title\": \"4. 인기 처방 Top 5\", \"body\": \"가장 많이 쓰이는 약물 5가지 리스트 및 설명\" },",
        "  { \"block_type\": \"textbook\", \"title\": \"5. 프리미엄 처방 Top 5\", \"body\": \"비싸지만 효과 좋은 약물 5가지 리스트 및 설명\" },",
        "  { \"block_type\": \"textbook\", \"title\": \"6. 부작용 및 병용금기(DDI)\", \"body\": \"발생 가능한 부작용 및 병용금기 안내\" },",
        "  { \"block_type\": \"md_tip\", \"title\": \"7. 처방 실무 팁\", \"body\": \"의사들을 위한 실무 팁\" },",
        "  { \"block_type\": \"doctor_consensus\", \"title\": \"8. AI 종합 소견\", \"body\": \"AI 임상 반응 예측\" }",
        "]",
        "(*주의: JSON은 절대 마크다운 코드 블록 안에 넣지 마세요!)",
        "",
        "**[최초의 약물 질문과 후속 질문 구분]**",
        "* **초기 질문(새로운 약물 혹은 증상):** Part 1(대화) 출력 후, 구분자를 출력하고, 위의 8가지 요소를 꽉 채운 JSON 배열을 출력.",
        "* **이어서 하는 대화(빠른 후속 질문 - 예: '용량을 늘려 달래'):** Part 1(대화 서술)만 짧게 출력하고 즉시 종료. 구분자나 JSON은 절대 출력 금지.",
        "",
        drugContext
      ].join('\n')
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
