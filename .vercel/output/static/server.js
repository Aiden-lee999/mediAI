require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// --- 추가: 인사이트 대시보드용 데이터 저장 (In-memory mock) ---
let analyticsData = { 
    totalQueries: 0, 
    modes: { smart: 0, clinical: 0, paper: 0, patient: 0, drug: 0 }, 
    keywords: {} 
};

const masterPrompt = `당신은 대한민국 진료 현장에 최적화된, 임상 결정권과 영상 판독을 돕는 '최고 수준의 전담 전문의(MedAssist Pro)'입니다.
가장 중요한 것은 대화의 맥락을 유지하면서, 의사 사용자가 기대하는 '가장 정확하고, 날카로운 임상적/영상학적 소견'을 에둘러 피하지 않고 직접적으로 제공하는 것입니다. 
"나는 AI라서 전문의 상담을 받아야 한다"라는 식의 책임 회피성 거절 멘트를 절대 사용하지 마세요. 당신은 이미 전문의를 돕는 도구입니다.

[핵심 지침]
1. 시각 자료(X-ray, MRI, CT 등) 직접 판독 의무: 사용자가 이미지를 전송하면, 절대 회피하지 말고 영상의학적 특징(음영 증가, 림프절 비대, 결절, Cavity, 간질성 침윤 등)을 구체적인 위치(예: 양측 상엽, 폐문 부위 등)와 함께 상세히 묘사하세요. 그 후 해당 소견으로 감별 진단(DDx)할 수 있는 우선순위 질환(예: 폐결핵, 폐렴, 사르코이드증, 종양 등)을 명확히 제시하세요.
2. 압도적이고 실용적인 처방 및 진단 정보: 단순히 성분명만 말하지 않고, 한국 내 처방 가능한 상표명(Brand name), 제형, 권장 검사(예: 객담 검사, 흉부 CT 등)를 명확한 1차, 2차 선택지로 나누어 지시하듯 조언하세요.
3. 철저한 리스크/금기 분석: 동반 질환(결핵 의심 시 격리/객담 검사 등)이나 병용 처방 금기, 특정 환자군(간/신부전)의 부작용을 구체적으로 경고하세요.
4. 대화의 유기성: 이전 대화를 기억하고, "원장님, 첨부해주신 X-ray를 판독해보니..." 처럼 자연스럽게, 하지만 확신에 찬 전문의의 톤으로 답변하세요.
5. 엄격한 근거 기반: 모든 주장과 권고(예: 결핵 영상 소견 기준)에는 국내외 학회 가이드라인, NEJM, 식약처 등의 출처를 표기하세요.

다음 JSON 형식으로만 반환하세요:
{
  "inferred_domain": "전체 대화 맥락이 고려된 세부 전공 영역 (예: 호흡기내과/영상의학과 - 흉부 X-ray 판독 및 감별진단)",
  "chat_reply": "<p>구체적인 영상 소견(시각적 묘사), 가장 유력한 감별 질환 목록, 필요한 추가 검사(CT 등), 구체적 약물/처방을 포함한 상세하고 단호한 대화형 본문. (html의 <p>, <ul>, <li>, <strong> 적극 활용)</p>",
  "warning_notes": "<p>위험 신호(Red flag signs - 객혈, 체중 감소 등), 병용 금기 약물군, 추가 전파 위험(결핵 등) 등 놓치지 말아야 할 세부 경고사항</p>",
  "references": "<p>영상의학회/호흡기학회 가이드라인, 논문(PMID), 관련 정부/학회 지침 출처</p>"
}`;

app.post('/api/ask', async (req, res) => {
    try {
        const { question, imageBase64, depth = 'deep', customContext, history = [] } = req.body;
        
        if (!question && !imageBase64) {
            return res.status(400).json({ error: "질문이나 이미지가 필요합니다." });
        }

        // --- 통계 업데이트 ---
        analyticsData.totalQueries++;
        if(question) {
            const words = question.split(" ").filter(w => w.length > 1 && !w.includes('?'));
            words.forEach(w => { analyticsData.keywords[w] = (analyticsData.keywords[w] || 0) + 1; });
        }

        let depthInstruction = "";
        if (depth === 'quick') {
            depthInstruction = "현재는 'Quick Answer' 모드입니다. 아주 짧고 간결한 결론과 핵심 주의사항만 요약하세요.";
        } else {
            depthInstruction = "현재는 'Deep Answer' 모드입니다. 복잡한 쟁점을 깊이 있게 다루고 차이점을 설명하세요.";
        }
        
        let systemContent = masterPrompt + "\n\n[답변 깊이 지침]\n" + depthInstruction;
        
        if (customContext) {
            systemContent = "[원내 프로토콜/특정 가이드라인 강제 적용]\n다음 업로드된 RAG 문서를 본 질문의 최우선 분석 기준(Ground Truth)으로 삼아 답변하세요:\n\n" + customContext + "\n\n---\n" + systemContent;
        }

        let messagesArray = [
            { role: "system", content: systemContent }
        ];

        // Append conversation history
        if (history && history.length > 0) {
            history.forEach(msg => {
                if (msg.role && (msg.role === 'user' || msg.role === 'assistant')) {
                    // Stringify the content if it's an object so OpenAI handles it properly when mixed with latest question format
                    if (msg.role === 'assistant' && typeof msg.content === 'object') {
                        messagesArray.push({ role: msg.role, content: JSON.stringify(msg.content) });
                    } else {
                        messagesArray.push({ role: msg.role, content: msg.content });
                    }
                }
            });
        }

        if (imageBase64) {
            messagesArray.push({
                role: "user",
                content: [
                    { type: "text", text: question || "첨부된 이미지를 바탕으로 판독 및 최적의 의학적 소견을 내어주세요." },
                    { type: "image_url", image_url: { url: imageBase64 } }
                ]
            });
        } else {
            messagesArray.push({ role: "user", content: question });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o", // gpt-4o-mini 대신 훨씬 똑똑하고 문맥/전문성이 깊은 메인 모델로 변경
            response_format: { type: "json_object" }, 
            messages: messagesArray,
            temperature: 0.45 // 창의성, 자연스러운 대화, 다양한 근거 조합을 위해 온도값 상향
        });

        const rawText = response.choices[0].message.content;
        const parsedData = JSON.parse(rawText);

        res.json({
            domain: parsedData.inferred_domain || "통합 분석",
            chat_reply: parsedData.chat_reply || "응답 분석 불가",
            warning_notes: parsedData.warning_notes || "",
            references: parsedData.references || ""
        });

    } catch (error) {
        console.error("OpenAI API Error:", error);
        res.status(500).json({ error: "AI 서버 연동 중 오류가 발생했습니다." });
    }
});

// --- 추가: 제약사/B2B 인사이트 대시보드 데이터 API ---
app.get('/api/analytics', (req, res) => {
    res.json(analyticsData);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 다중 모드 및 비전(이미지) 지원 서버 기동 완료: http://localhost:${port}`);
});