const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

const oldRegex = /case 'doctor_consensus':[\s\S]*?(?=case 'doctor_opinion':)/;
const newStr = `case 'doctor_consensus':
          return (
            <div key={index} className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-3 shadow-sm">
              <h3 className="font-bold text-blue-800 text-sm mb-2"> AI 예측 : 임상 현장 의견 요약</h3>
              <div className="bg-white p-3 rounded text-sm text-slate-700 border border-blue-100 mt-2">
                 <strong>AI 분석:</strong> <span dangerouslySetInnerHTML={{ __html: body || meta_json?.summary || '' }} />
              </div>
            </div>
          );
        `;

content = content.replace(oldRegex, newStr);
fs.writeFileSync('src/app/dashboard/page.tsx', content, 'utf8');
