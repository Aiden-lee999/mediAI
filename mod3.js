const fs = require('fs');
let code = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

const s1 = \          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50" ref={scrollRef}>
            
            {/* ===================== CHAT VIEW ===================== */}\;

const t1 = \          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50" ref={scrollRef}>
            
            {/* ===================== DRUG SEARCH VIEW ===================== */}
            {view === 'drug_search' && (
              <div className="max-w-4xl mx-auto p-4 flex flex-col items-center justify-center min-h-[50vh] text-center">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100 max-w-2xl w-full">
                  <h2 className="text-2xl font-bold mb-4 text-slate-800">💊 통합 약제 조회 및 DUR</h2>
                  <p className="text-slate-500 mb-8">
                    의약품의 최신 정보(효능/효과, 용법/용량, 주의사항)와 대체 약품을 검색하고 비교합니다.<br/>
                    <span className="text-xs text-slate-400">(해당 기능은 다음 업데이트 시 외부 공공 데이터 API와 연동될 예정입니다.)</span>
                  </p>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="제품명 또는 성분명을 입력하세요 (예: 타이레놀, 아세트아미노펜)..."
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

code = code.replace(s1, t1);
fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', code, 'utf8');
