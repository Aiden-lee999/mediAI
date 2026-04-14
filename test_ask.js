const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function run() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: \당신은 매일 수많은 환자를 진료하는 의사를 돕는 전문 의학 어시스턴트입니다.
프론트엔드 대시보드의 블록 UI를 가장 완벽하게 렌더링하기 위해 반드시 아래의 엄격한 JSON 포맷으로만 응답해주세요. 응답은 무조건 파싱 가능한 유효한 JSON 객체 하나여야 합니다. (마크다운 백틱을 포함하지 마세요)

주의: 약물(예: 고덱스, godex 등) 대체 투여를 묻는 질문에는 다음 8개의 블록을 정확하게 순서대로 배열로 생성해야 합니다:

1. "textbook" 블록: "1. [약물명]은 무슨 약이다~~" (기능, 효능 등 기본 약물 정보)
2. "textbook" 블록: "2. [약물명]을 대체하려면 이런 약들이 있다~~" (대체 약물 개념 설명)
3. "drug_cards" 블록: 대체 약물 리스트 테이블 (반드시 meta_json.drugs 배열에 name, ingredient, price, class, company 속성을 모두 채워 3개 이상의 대체제를 제공)
4. "textbook" 블록: "3. 가장 많이 팔리는 약 top5"
5. "textbook" 블록: "4. 가장 수가 비싼 약 top5"
6. "md_tip" 블록: "처방 팁" (복용법 주의사항 등)
7. "doctor_consensus" 블록: "의사 집단 반응 요약" (반드시 meta_json에 like_count, dislike_count, feedback_count, summary를 포함)
8. "journal" 블록: "출처 및 근거 자료"

JSON 예시 뼈대:
{
  "intent_type": "drug",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 요약",
  "chat_reply": "사용자에게 건넬 친절한 일반 텍스트 답변",
  "blocks": [
    { "block_type": "textbook", "title": "약물 설명", "body": "내용...", "meta_json": {}, "sort_order": 1 },
    { "block_type": "textbook", "title": "대체 약물 안내", "body": "대체 옵션...", "meta_json": {}, "sort_order": 2 },
    { "block_type": "drug_cards", "title": "대체 약물 리스트", "body": "", "meta_json": { "drugs": [ { "name": "우루사정(100mg)", "ingredient": "Ursodeoxycholic acid", "price": "100원(급여)", "class": "전문의약품", "company": "대웅제약" }, {"name": "실리마린", "ingredient": "Silymarin", "price": "비급여", "class": "일반의약품", "company": "알리코제약"} ] }, "sort_order": 3 }
  ]
}
\
    }, {
      role: 'user', content: 'godex를 먹는 환자가 위가 안좋대. 어떤 약으로 바꾸는게 좋을까?'
    }],
    response_format: { type: "json_object" }
  });
  console.log(completion.choices[0].message.content);
}
run();
