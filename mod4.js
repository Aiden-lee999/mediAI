const fs = require('fs');
let c = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

const target = '{/* ===================== CHAT VIEW ===================== */}';
const replacement = \{/* ===================== DRUG SEARCH VIEW ===================== */}
            {view === 'drug_search' && (
              <div className="max-w-4xl mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-blue-100 max-w-2xl w-full">
                  <span className="text-4xl mb-4 block">💊</span>
                  <h2 className="text-2xl font-bold mb-4 text-slate-800">통합 약제 조회 및 비교</h2>
                  <p className="text-slate-500 mb-8 max-w-lg mx-auto">
                    의약품의 핵심 정보(효능, 용법)와 대체 약품을 통합 검색합니다.<br/>
                    <span className="text-sm text-slate-400 mt-2 block">(다음 단계에서 외부 약제 공공 데이터 및 DUR API 연동 예정)</span>
                  </p>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="약품명이나 성분명을 입력하세요..."
                      className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50 text-lg transition-all"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all">
                      검색
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== CHAT VIEW ===================== */}\;

c = c.replace(target, replacement);
fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', c, 'utf8');