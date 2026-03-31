const fs = require('fs');

function fixPrompt(filePath) {
  let file = fs.readFileSync(filePath, 'utf8');

  // Change prompt instruction for Block 8
  file = file.replace(
    '8. "doctor_consensus" (의사 집단 반응): AI가 추정한 동료 의사들의 가상의 종합 의견.',
    '8. "doctor_consensus" (AI 예상 임상 반응): 학습된 의학 지식을 바탕으로, 실제 임상 현장에서 의사들이 주로 체감하는 해당 약물의 장단점을 요약.'
  );

  // Change JSON skeleton for Block 8
  file = file.replace(
    `{ "block_type": "doctor_consensus", "title": "8. 의사 집단 반응 요약", "body": "", "meta_json": { "like_count": 15, "dislike_count": 2, "feedback_count": 5, "summary": "[의사들의 실제 종합 추천 의견을 가상으로 작성]" }, "sort_order": 8 }`,
    `{ "block_type": "doctor_consensus", "title": "8. AI 예상 임상 반응", "body": "", "meta_json": { "summary": "[해당 약물에 대한 임상 현장의 주요 여론/의견 평가를 AI가 요약]" }, "sort_order": 8 }`
  );

  fs.writeFileSync(filePath, file, 'utf8');
}

fixPrompt('src/app/api/ask/route.ts');
fixPrompt('backend/src/routes/chatRoutes.ts');
console.log('Fixed prompts for block 8');