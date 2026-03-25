// api/ask.js
module.exports = async function handler(req, res) {
    // 1. CORS 및 통신 허용 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { question, imageBase64, depth = 'deep', customContext, history = [] } = req.body;
        
        if (!question && !imageBase64) {
            return res.status(400).json({ error: "질문이나 이미지가 필요합니다." });
        }

        const masterPrompt = `당신은 대한민국 최고 권위의 대학병원 교수급 전문의(MedAssist Pro)입니다. 사용자는 당신에게 조언을 구하는 동료 의사(원장님)입니다.
기계적인 템플릿 답변을 버리고, 동료 의사와 자연스럽게 심층적인 임상 케이스나 최신 지견을 논의하는 '대화형(Conversational) 자문' 형식을 취하세요. 

[핵심 지침]
1. 의도 파악 및 대화형 전개: 질문의 이면에 있는 임상적/학술적 의도를 정확히 파악하고, "원장님, 말씀하신 내용에 대해..." 와 같이 자연스럽고 유기적인 대화 흐름으로 답변을 시작하세요. 기계적인 나열을 피하고 논리적이고 설득력 있는 흐름을 유지하세요.
2. 정확한 답변과 추가 제안 (Deep Clinical Insights): 질문에 대한 1차원적 답변을 넘어, 감별 진단(DDx), 권장되는 1/2차 처방 가이드라인(국내 처방 가능한 상표명 포함), 필요한 추가 검사나 후속 처치 등 실제 임상 현장의 경험이 담긴 '추가적인 제안 사항'을 반드시 제공하세요.
3. 논문/학술 정보 요구 시 (매우 중요): 논문이나 연구 동향에 대해 물어볼 경우, 반드시 다음 요소를 포함하여 풍성하게 답변하세요:
   - 해당 주제와 관련된 Top 5 랜드마크 또는 최신 논문 리스트
   - 각 논문의 구체적인 Abstract(초록/핵심 요약) 및 주요 결과(Takeaways)
   - 대립되거나 비교 대상이 되는 주요 논문/연구(Pro & Con) 간의 차이점 대조 및 교수로서의 해석
4. 시각 자료(X-ray 등) 직접 판독 의무: "AI라서 알 수 없다"는 식의 책임 회피성 멘트는 절대 금지합니다. 병변의 구체적 위치와 영상학적 특징을 전문가 수준으로 직접 분석, 묘사하고 감별 질환을 명확히 제시하세요.
5. 철저한 리스크/주의사항 분석: 특정 처방이나 시술 시 발생할 수 있는 병용 금기, 특정 환자군(간/신부전 등) 부작용, 놓치기 쉬운 위험 신호(Red flags)를 날카롭게 지적하세요.

다음 JSON 형식으로만 반환하세요:
{
  "inferred_domain": "전체 대화 맥락이 고려된 세부 전공 영역 (예: 순환기내과 - 최신 고혈압 가이드라인 및 논문 대조)",
  "chat_reply": "<p>동료와 대화하듯 질문 의도를 명확히 짚어주는 인사말, 깊이 있는 분석, 추가 제안, (논문 요청 시) Top 5 논문 비교 및 요약 등을 포함한 매우 상세하고 자연스러운 본문. 가독성을 위해 <p>, <ul>, <li>, <strong> 태그를 풍부하게 활용.</p>",
  "warning_notes": "<p>처방/치료 시 주의할 사항, 금기, Red flag signs 등 날카로운 임상적 경고</p>",
  "references": "<p>본문에서 언급한 논문(PMID), NEJM 등 학술지 명, 학회 가이드라인 등의 정확한 출처 목록</p>"
}`;

        let depthInstruction = depth === 'quick' 
            ? "아주 짧고 간결한 결론과 핵심 주의사항만 요약하세요." 
            : "복잡한 쟁점을 깊이 있게 다루고 차이점을 설명하세요.";
        
        let systemContent = masterPrompt + "\n\n[답변 깊이 지침]\n" + depthInstruction;
        if (customContext) systemContent = "[RAG 적용]\n" + customContext + "\n\n---\n" + systemContent;

        let messagesArray = [{ role: "system", content: systemContent }];

        if (history && history.length > 0) {
            history.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    const content = typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content;
                    messagesArray.push({ role: msg.role, content });
                }
            });
        }

        if (imageBase64) {
            messagesArray.push({
                role: "user",
                content: [
                    { type: "text", text: question || "첨부된 이미지를 바탕으로 판독해주세요." },
                    { type: "image_url", image_url: { url: imageBase64 } }
                ]
            });
        } else {
            messagesArray.push({ role: "user", content: question });
        }

        // OpenAI 공식 모듈 대신 Native Fetch를 사용하여 런타임 충돌 원천 차단
        const fetchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: messagesArray,
                temperature: 0.45
            })
        });

        if (!fetchResponse.ok) {
            const errorData = await fetchResponse.text();
            throw new Error(`OpenAI API Error: ${errorData}`);
        }

        const data = await fetchResponse.json();
        
        let parsedData = {};
        try {
            let rawContent = data.choices?.[0]?.message?.content;
            if (rawContent) {
                // 가끔 포맷을 무시하고 마크다운(```json)을 붙이는 경우를 위한 방어 코드
                rawContent = rawContent.replace(/```json/gi, '').replace(/```/gi, '').trim();
                parsedData = JSON.parse(rawContent);
            } else {
                parsedData = { chat_reply: "AI 응답 내용이 비어있습니다. 질문을 조금 더 구체적으로 변경해보세요." };
            }
        } catch (e) {
            console.error("JSON 파싱 에러:", e);
            parsedData = { chat_reply: "AI가 생성한 응답의 형식이 올바르지 않아 출력할 수 없습니다." };
        }

        // parsedData가 null이나 undefined일 경우를 완전히 차단
        parsedData = parsedData || {};

        return res.status(200).json({
            domain: parsedData.inferred_domain || "통합 분석",
            chat_reply: parsedData.chat_reply || "응답 분석 불가",
            warning_notes: parsedData.warning_notes || "",
            references: parsedData.references || ""
        });

    } catch (error) {
        console.error("Critical Runtime Error:", error);
        return res.status(500).json({ 
            error: "서버 런타임 오류", 
            message: error.message 
        });
    }
}

module.exports.config = {
    api: {
        bodyParser: { sizeLimit: '4mb' }
    }
};