import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 환경변수에 OPENAI_API_KEY가 등록되어 있다고 가정합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

function determineModel(question: string, hasImage: boolean) {
  if (hasImage) return 'gpt-5.4-pro';
  if (!question || question.length < 50) return 'gpt-5.4-mini';
  return 'gpt-5.4';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, history, imageBase64 } = body;
    const modelToUse = determineModel(question || '', !!imageBase64);

    let ragContext = "";
    if (question && question.length >= 2) {
      const searchTerms = question.split(' ').map((w: string) => w.trim()).filter((w: string) => w.length >= 2);
      if (searchTerms.length > 0) {
        // 간단한 휴리스틱 (약품/성분명 검색 키워드가 들어왔을 때 관련 정보 컨텍스트를 주입합니다)
        const drugs = await prisma.drug.findMany({
          where: {
            OR: searchTerms.map((term: string) => ({
                productName: { contains: term }
            })).concat(searchTerms.map((term: string) => ({
                ingredientName: { contains: term }
            })))
          },
          take: 3,
          select: {
             productName: true, ingredientName: true, company: true, priceLabel: true, type: true, 
             efficacy: true, durInfo: true, publicApiDump: true
          }
        });
        
        if (drugs.length > 0) {
           ragContext = `[사전 조회된 데이터베이스(RAG) 지식베이스 정보]\n` +
             drugs.map(d => {
                let info = `- 약품명: ${d.productName}\n- 성분명: ${d.ingredientName}\n- 회사: ${d.company}`;
                if (d.priceLabel) info += `\n- 보험약가/분류: ${d.priceLabel} / ${d.type}`;
                if (d.durInfo) info += `\n- DUR금기/주의사항 요약: ${d.durInfo}`;
                if (d.efficacy) info += `\n- 효능/효과요약: ${d.efficacy}`;
                // 공공 API 원문 덤프에서 핵심적인 부분을 뽑아주면 더 정확하지만 너무 길면 잘리므로 헤벨만 (선택사항)
                // if (d.publicApiDump && d.publicApiDump.includes('status":"success"')) {
                //      info += `\n- 공공데이터 원문 덤프 존재함`;
                // }
                return info;
             }).join('\n\n');
        }
      }
    }

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `당신은 뛰어난 전문 의학 어시스턴트입니다. 아래에 [사전 제공된 지식베이스 RAG 정보]가 있다면 반드시 이를 최우선으로 참고하여 답변의 <채팅내용>과 <blocks>에 활용해야 합니다.\n${ragContext}\n
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
      "meta_json": {
        "drugs": [
          {
            "name": "약품명",
            "ingredient": "성분명",
            "price": "약가 및 등재구분",
            "class": "분류",
            "company": "제약사명"
          }
        ]
      },
      "sort_order": 1
    }
  ]
}
- 보험 삭감 경고가 필요하면 'insurance_warning', 약물 추천시 'drug_cards', 처방 팁은 'md_tip' 블록을 적극 활용하세요.
- 번역 요청인 경우 'translation' 블록을 사용하고 meta_json.clinical_note에 복약 주의사항을 넣으세요.
- drug_cards 블록 생성 시 반드시 배열 내 각 객체는 name, ingredient, price, class, company 속성을 포함해야 하며, 중복되는 약물 정보가 없도록 제외하여 응답하세요.
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
