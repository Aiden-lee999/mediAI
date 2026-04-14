"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const openai_1 = __importDefault(require("openai"));
const drugApiClient_1 = require("../../../src/lib/drugApiClient");
const router = express_1.default.Router();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || 'YOUR_KEY',
});
function determineModel(question, hasImage) {
    if (hasImage)
        return 'gpt-4o';
    if (!question || question.length < 10)
        return 'gpt-4o-mini';
    return 'gpt-4o';
}
router.post('/ask', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { question, history, imageBase64 } = req.body;
        let modelToUse = determineModel(question || '', !!imageBase64);
        modelToUse = modelToUse.replace('gpt-5.4-pro', 'gpt-4o').replace('gpt-5.4-mini', 'gpt-4o-mini').replace('gpt-5.4', 'gpt-4o');
        let drugContext = "";
        if (question && (question.includes("약") || question.includes("알려줘") || question.includes("타이레놀") || question.includes("부작용") || question.includes("가격"))) {
            const rawObj = yield (0, drugApiClient_1.fetchDrugInfo)(question);
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
        const messages = [];
        messages.push({
            role: 'system',
            content: `당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.
반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요.

주의: 약물과 관련된 질문에는 무조건 아래 9개의 블록을 예시와 동일한 순서와 블록 타입으로 모두 생성해야 합니다. 프롬프트 하단의 'JSON 포맷'은 단순 예시(Dummy)일 뿐이므로, 예시대로 포맷 텍스트를 그대로 복사해서 출력하지 마시고, **반드시 실제 환자/질문 상황에 맞는 매우 구체적이고 전문적인 내용으로 값을 채워야 합니다.** ${drugContext}

--- [블록 작성 상세 규칙 - 반드시 지킬 것!] ---
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
    { "block_type": "textbook", "title": "1. 궁금한 약물 개요", "body": "[기전]", "meta_json": {}, "sort_order": 1 },
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
            pastHistory.forEach((msg) => {
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
        const userMessage = { role: "user", content: [] };
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
        const response = yield openai.chat.completions.create({
            model: modelToUse,
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.2,
        });
        const reply = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(reply);
        res.json(parsed);
    }
    catch (error) {
        console.error("OpenAI Route Error:", error);
        res.status(500).json({ error: error.message });
    }
}));
exports.default = router;
