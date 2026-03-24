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

        const masterPrompt = `당신은 차세대 의사 전용 폐쇄형 의료 AI 플랫폼 'AI MD넷(Beta)'의 오케스트레이션 엔진입니다.
일반인이 아닌, 동료 의사(원장님)들에게 조언을 제공합니다.
사용자의 질문을 분석하여 의도를 파악하고, 지정된 JSON 형식(blocks 배열)을 구성하여 응답하세요.
반드시 아래 5가지 타입 중 하나로 해석하고, 해당 타입에 맞는 block을 순서대로 생성해야 합니다. 항상 마지막엔 맥락에 맞는 sponsored_card를 붙일 수 있습니다.

[의도 분류 및 필수 Block 구성]
1. 질환 지식 검색 (disease)
- 의도가 질환 진단, 가이드라인, 최신 치료법 등일 때.
- 텍스트 -> 저널 -> 의사 합의 -> 의사 의견 순서로 위계를 엄격하게 분리하여 아래 block들을 순서대로 반환:
  - block_type: "textbook" (교과서적 확정 지식, DX/DDX 구조 등. meta_json.sections 에 배열로 overview, dx, ddx, tx 분리)
  - block_type: "journal" (최신 논문 동향/임상 적용 포인트 요약. meta_json.journals 에 배열로 논문 목록 반환)
  - block_type: "doctor_consensus" (의사 집단 반응 요약. 가상의 좋아요/싫어요 수, 요약 합의문 등 meta_json 제공)
  - block_type: "doctor_opinion" (실제 의사들의 개인 팁/의견 배열. meta_json.opinions 제공. "참고용" 라벨 강제 적용)

2. 약품/처방 인텔리전스 (drug)
- 특정 약품의 성분, 가격, 소팅(정렬/비교), 대체약, 병용금기(DDI) 등을 묻는 경우.
- 자연어로 정렬(예: 가격순, 오리지널 먼저)을 요구하면 meta_json에 반영.
  - block_type: "drug_cards" (meta_json.items에 약품명, 성분명, 가격, 제약사 등 약물 리스트 배열)
  - block_type: "interaction_warning" (병용 금기 DDI 경고, severity, summary 제공)
  - block_type: "insurance_warning" (보험 삭감 경고, patient_cost_estimate 환자 부담금 경고 등)

3. 일반 임상 사진 / 판독 보조 (image)
- X-ray, CT, MRI, EKG, 내시경 등 사진을 판독해달라고 하거나 환자 케이스를 묻는 경우.
  - block_type: "imaging_result" (이미지 판독 결과. meta_json.candidate_diagnoses 배열, confidence 확률 제공, doctor_review_notice 경고문 포함)

4. 초빙/구직 매칭 (recruit)
- 특정 지역이나 과의 구인구직 정보를 묻는 경우.
  - block_type: "recruiting_card" (meta_json.items에 채용공고 배열 생성 - match_score 포함)

5. 일반 텍스트 번역 (translation)
- 특정 말을 다른 언어로 번역해달라는 경우. (translation_info block)

[JSON 응답 포맷 (이 형태를 반드시 준수하세요)]
{
  "message_id": "생성형난수",
  "intent_type": "disease|drug|image|recruit|translation",
  "summary_text": "현재 응답의 한국어 1줄 요약",
  "safety_notice": "안전성/면책 조항 (예: 최종 판단은 의사가...)",
  "blocks": [
    {
      "block_id": "blk_01",
      "block_type": "textbook | journal | doctor_consensus | doctor_opinion | drug_cards | interaction_warning | insurance_warning | imaging_result | recruiting_card | sponsored_card",
      "sort_order": 1,
      "title": "블록 제목",
      "body": "짧은 텍스트 요약",
      "meta_json": { "추가 자료 (예: drug_cards면 items 배열, textbook이면 sections 배열)" }
    }
  ]
}

- 스폰서(sponsored_card): 배열 맨 마지막에 꼭 넣기. 제약사 배너. (예: 당뇨약 검색시 SGLT-2 세미나)
`;

        let depthInstruction = depth === 'quick' 
            ? "대화형 투를 유지하되, 핵심적인 내용 위주로 간결하게 요약하세요." 
            : "매우 상세하고 심도 있게 진단, 처방, DDI 및 논문 요약을 논의하세요.";
        
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
                    { type: "text", text: question || "첨부된 이미지를 바탕으로 판독해주세요. 병변이 어디에 어떻게 보이는지, 그래서 어떤 질병이 의심되는지, 감별해야 할 다른 질환은 무엇인지, 그리고 추천하는 치료법이나 처치를 구체적으로 설명해주세요." },
                    { type: "image_url", image_url: { url: imageBase64 } }
                ]
            });
        } else {
            // [RAG 파이프라인 1, 2, 3 단계 통합: PubMed API 실시간 검색 및 컨텍스트 주입]
            let pubmedContext = "";
            try {
                // 1. PubMed 검색 API (esearch) - 질문에서 키워드 추출하여 검색
                const searchQ = encodeURIComponent(question);
                const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchQ}&retmode=json&retmax=3`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const idList = searchData.esearchresult?.idlist || [];
                    
                    if (idList.length > 0) {
                        // 2. PubMed 요약 API (esummary) - 실제 논문 메타데이터 가져오기
                        const ids = idList.join(',');
                        const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`);
                        if (summaryRes.ok) {
                            const summaryData = await summaryRes.json();
                            const results = summaryData.result || {};
                            
                            pubmedContext = idList.map(id => {
                                const paper = results[id];
                                if (!paper) return "";
                                return `[논문 PID: ${id}] 제목: ${paper.title}, 저널: ${paper.fulljournalname}, 발행일: ${paper.pubdate}`;
                            }).join('\n');
                        }
                    }
                }
            } catch (err) {
                console.error("PubMed Fetch Error:", err);
            }

            // 3. RAG 컨텍스트를 시스템 프롬프트 또는 유저 메시지에 주입
            let finalQuestion = question;
            if (pubmedContext) {
                finalQuestion = `유저 질문: ${question}\n\n[실시간 검색된 PubMed 논문 (RAG Data)]\n${pubmedContext}\n\n위 검색된 실제 논문 데이터를 반드시 'journal' 블록(meta_json.journals)에 활용하여 답변을 작성하세요.`;
            }

            messagesArray.push({ role: "user", content: finalQuestion });
        }

        // --- 동적 모델 라우팅 로직 (비용 최적화) ---
        // 1. 이미지가 있거나 (단순 OCR보다 복잡할 가능성)
        // 2. 컨텍스트가 긴 경우
        // 3. 질문이 길 경우
        let isComplexTask = false;
        if (imageBase64) isComplexTask = true;
        if (customContext && customContext.length > 500) isComplexTask = true;
        if (question && question.length > 200) isComplexTask = true;
        
        let isVeryHardTask = false;
        if (depth === 'deep' && isComplexTask && customContext && customContext.length > 2000) {
            isVeryHardTask = true;
        }

        // 최신 OpenAI 모델 정책 적용
        let targetModel = "gpt-4o-mini"; // fallback to gpt-4o-mini as realistic baseline if 5.4 not available in your region yet
        if (isComplexTask) targetModel = "gpt-4o";
        // To use real gpt-5.4 logic, uncomment the below lines if your account has 5.4 API access:
        // targetModel = "gpt-5.4-mini";
        // if(isComplexTask) targetModel = "gpt-5.4";
        // if(isVeryHardTask) targetModel = "gpt-5.4-pro"; // Note: pro requires /v1/responses endpoint 

        // OpenAI 공식 모듈 대신 Native Fetch를 사용하여 런타임 충돌 원천 차단
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: targetModel,
                response_format: { type: "json_object" },
                messages: messagesArray,
                temperature: 0.7 
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`OpenAI API Error: ${errorData}`);
        }

        const data = await response.json();
        
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

        // return all parsed blocks safely to frontend
        return res.status(200).json({
            intent_type: parsedData.intent_type || "general",
            blocks: parsedData.blocks || [],
            orchestration_summary: parsedData.orchestration_summary || "",
            // fallback old formats to avoid error
            chat_reply: parsedData.chat_reply || ""
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