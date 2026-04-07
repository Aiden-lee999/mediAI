const fs = require('fs');
let code = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

code = code.replace(
  /\{view === 'chat' \? '전문 의학 어시스턴트' : view === 'translate' \? '다국어 진료 어시스턴트' : view === 'rag_review' \? 'RAG 기반 논문\/가이드라인 검색 및 리뷰' : '내 라이브러리'\}/g,
  \{view === 'chat' ? '전문 의학 어시스턴트' : view === 'drug_search' ? '약제 조회 및 비교' : view === 'translate' ? '다국어 진료 어시스턴트' : view === 'rag_review' ? 'RAG 기반 논문/가이드라인 검색 및 리뷰' : '내 라이브러리'}\
);

code = code.replace(
  /\{view === 'chat' \? '진료, 연구, 약물 보조 및 종합 인텔리전스' : view === 'translate' \? '복약지도, 설명, 통역을 위한 실시간 음성 번역' : view === 'rag_review' \? '최신 논문 기반 응답 및 동료 의사 리뷰 워크플로우 연동' : '저장된 중요 레퍼런스 모음'\}/g,
  \{view === 'chat' ? '진료, 연구, 약물 보조 및 종합 인텔리전스' : view === 'drug_search' ? '조제약 및 의약품 조회, 비교 (DUR 연동 예정)' : view === 'translate' ? '복약지도, 설명, 통역을 위한 실시간 음성 번역' : view === 'rag_review' ? '최신 논문 기반 응답 및 동료 의사 리뷰 워크플로우 연동' : '저장된 중요 레퍼런스 모음'}\
);

fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', code, 'utf8');
