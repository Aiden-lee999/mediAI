const fs = require('fs');

let drugContent = fs.readFileSync('src/components/dashboard/DrugSearch.tsx', 'utf8');

// For "급여조회" component, replace the entire inline ternary operator that blocks UI
drugContent = drugContent.replace(
  /\) : llmLoading \? \([\s\S]*?\) : \([\s\S]*?<div className="p-4 bg-slate-50/g,
  ') : (\n                    <div className="space-y-4">\n                       <div className="p-4 bg-slate-50'
);

drugContent = drugContent.replace(
  /\{llmInfo\?\.chat_reply \|\| '[^']+'\}/g,
  "{llmLoading ? '실시간 AI 병합 및 약가/급여 기준 분석 중입니다 (약 3~8초 소요)...' : (llmInfo?.chat_reply || '급여 상세 정보가 생성되지 않았습니다.')}"
);

// Make 대체약제 also not block UI entirely
drugContent = drugContent.replace(
  /\) : llmLoading \? \([\s\S]*?\) : \([\s\S]*?<div className="overflow-x-auto">/g,
  ') : (\n                 <div className="overflow-x-auto">\n                    {llmLoading && <div className="p-4 text-center text-blue-500 font-bold animate-pulse">실시간 AI 대체 약제 검색 중...</div>}'
);

fs.writeFileSync('src/components/dashboard/DrugSearch.tsx', drugContent);
