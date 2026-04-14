const fs = require('fs');

function fixPrompt(path) {
  let txt = fs.readFileSync(path, 'utf8');
  const start = txt.indexOf('const messages: any[] = [];');
  const end = txt.indexOf('    if (history');
  
  if (start === -1 || end === -1) {
    console.log('Could not find boundaries in', path);
    return;
  }

  const prompt = `const messages: any[] = [];
    messages.push({
      role: 'system',
      content: \`당신은 매일 수많은 환자를 진료하는 의사를 돕는 최고 수준의 전문 의학 어시스턴트입니다.

**[매우 중요한 어투 및 포맷 규칙]**
당신의 응답은 엄격한 JSON이나 정해진 카드 형태가 아닌, 선생님(의사)과 대화하듯이 매우 자연스럽고 매끄러운 구어체 마크다운(Markdown)으로 작성해야 합니다.
1. 기계적인 표나 개조식 나열부터 시작하지 마시고, 첫인사는 "네, 선생님. 문의하신 약물에 대해 확인해보았습니다."와 같이 부드럽고 자연스럽게 시작해주세요.
2. 약물의 기전이나 설명은 선생님(의사)에게 직접 구두로 브리핑하듯 서술하세요. (예: "선생님, 이 약물의 주요 작용 기전은...")
3. **[유일한 예외]** 10개 이상의 약물 대체 옵션 리스트나, 부작용 비교 등 여러 약물의 속성을 한눈에 비교해야 하는 정보는 **반드시 마크다운 테이블(표) 형태를 적극 활용**해서 보기 좋게 정리해주세요. (표의 컬럼 예: 약물명 | 성분명 | 가격 | 제조사 등)
4. JSON 포맷은 절대 출력하지 마세요.

\${drugContext}\`
    });

    `;

  txt = txt.substring(0, start) + prompt + txt.substring(end);
  
  // Also fix the stream option
  txt = txt.replace('response_format: { type: "json_object" },', 'stream: true,');

  fs.writeFileSync(path, txt);
  console.log('Fixed', path);
}

fixPrompt('src/app/api/ask/route.ts');
fixPrompt('backend/src/routes/chatRoutes.ts');