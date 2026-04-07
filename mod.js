const fs = require('fs');
let code = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

const regex = /<button onClick=\{\(\) => updateView\('drug_search'\)\} className=(.*?)>\s*💊 약제 조회\s*<\/button>/g;

const replacement = \<button onClick={() => updateView('drug_search')} className={\\\	ext-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 \\\\\\}>
               💊 약제 조회
           </button>\;

code = code.replace(regex, replacement);
fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', code, 'utf8');
