import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

// 환경변수에 OPENAI_API_KEY가 등록되어 있다고 가정합니다. (또는 이전 키를 여기에 직접 입력)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY', // <-- 필요 시 발급받으신 키로 하드코딩 교체 가능
});

// 원장님이 요청하신 "실무 추천 모델 라우팅" 로직
function determineModel(question: string, hasImage: boolean) {
  // 3. 복잡한 멀티모달 추론, 아주 어려운 일부 요청  gpt-5.4-pro
  if (hasImage) {
    return 'gpt-5.4-pro'; 
  }
  
  // 1. 짧은 질문 / 간단 분류 / 일반 OCR  gpt-5.4-mini
  // (질문이 50자 이하인 경우 간단한 질문으로 간주)
  if (!question || question.length < 50) {
    return 'gpt-5.4-mini';
  }
  
  // 2. 긴 문맥 / 분석 / 정확도 중요한 답변  gpt-5.4
  return 'gpt-5.4';
}

router.post('/ask', async (req, res) => {
  const { question, history, imageBase64 } = req.body;
  
  // 요청하신 "가장 먼저 고쳐야 할 모델 연동 및 라우팅 로직" 적용
  const modelToUse = determineModel(question || '', !!imageBase64);

  try {
    const messages: any[] = [];
    
    // 프론트엔드 UI를 100% 동작시키기 위한 시스템 프롬프트 (JSON 강제)
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
      "meta_json": {}, // 특수 블록용 (예: drug_cards의 drugs 배열, doctor_opinion의 opinions 배열 등)
      "sort_order": 1
    }
  ]
}

- 보험 삭감 경고가 필요하면 'insurance_warning', 약물 추천시 'drug_cards', 처방 팁은 'md_tip' 블록을 적극 활용하세요.
- 번역 요청인 경우 'translation' 블록을 사용하고 meta_json.clinical_note에 복약주의사항을 넣으세요.
`
    });

    // 과거 대화 컨텍스트 주입
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
         // 이전 대화 텍스트만 유지 (토큰 절약 및 에러 방지)
         if(h.content && typeof h.content === 'string') {
            messages.push({ role: h.role, content: h.content });
         }
      });
    }

    // 현재 사용자 입력 처리 (멀티모달 포함)
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

    // 원장님 요청 사항: OpenAI API 실제 연동
    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: messages,
      response_format: { type: "json_object" } // JSON 포맷 강제
    });

    const replyContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(replyContent || '{}');

    // 프론트엔드로 실데이터 발송
    res.json(parsedResponse);

  } catch (error: any) {
    console.error("OpenAI API 연동 오류:", error.message || error);
    res.json({
      intent_type: 'general',
      orchestration_summary: '시스템 안내',
      chat_reply: '현재 인공지능 서버가 원활하지 않습니다.',
      blocks: []
    });
  }
});

export default router;