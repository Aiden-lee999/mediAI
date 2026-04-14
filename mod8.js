const fs = require('fs');
let c = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

const s1 = c.indexOf('{/* ===================== DRUG SEARCH VIEW ===================== */}');
const s2 = c.indexOf('{/* ===================== CHAT VIEW ===================== */}', s1);

if(s1 !== -1 && s2 !== -1) {
  const replacement = `{/* ===================== DRUG SEARCH VIEW ===================== */}
            {view === 'drug_search' && (
              <div className="max-w-4xl mx-auto p-4 sm:p-6 mb-10 w-full animate-in fade-in zoom-in duration-300">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  
                  {/* 헤더 */}
                  <div className="border-b border-slate-100 bg-slate-50 px-6 py-5 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                       의약품 상세 검색
                    </h2>
                    <span className="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-md shadow-sm">
                      DUR 연동 예정
                    </span>
                  </div>
                  
                  <div className="p-6 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      
                      {/* 입력 필드 영역 */}
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-0.5">제품명</label>
                          <input type="text" className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="예: 타이레놀" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-0.5">제품코드</label>
                          <input type="text" className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="예: 648900080" />
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-0.5">성분명</label>
                          <input type="text" className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="예: 아세트아미노펜" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-0.5">제약사</label>
                          <input type="text" className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400" placeholder="예: 한국얀센" />
                        </div>
                      </div>

                      {/* 라디오 버튼 영역 */}
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-6 mt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-3 ml-0.5">전문/일반</label>
                          <div className="flex flex-wrap gap-4 px-1">
                            {['전체', '전문', '일반', '의약외품'].map((item, idx) => (
                              <label key={idx} className="flex items-center gap-2 cursor-pointer group">
                                <input type="radio" name="rx_otc" defaultChecked={idx===0} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-3 ml-0.5">단일/복합제</label>
                          <div className="flex flex-wrap gap-4 px-1">
                            {['전체', '단일제', '복합제'].map((item, idx) => (
                              <label key={idx} className="flex items-center gap-2 cursor-pointer group">
                                <input type="radio" name="single_combo" defaultChecked={idx===0} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="md:col-span-2 pt-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-3 ml-0.5">급여/비급여 현황</label>
                          <div className="flex flex-wrap gap-5 px-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            {['전체', '급여', '비급여', '산정불가', '급여중지', '급여삭제'].map((item, idx) => (
                              <label key={idx} className="flex items-center gap-2 cursor-pointer group">
                                <input type="radio" name="ins_status" defaultChecked={idx===0} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 하단 버튼 영역 */}
                  <div className="bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3 p-5 sm:p-6">
                    <button className="px-6 py-2.5 sm:px-8 sm:py-3 bg-white border border-slate-300 text-slate-600 font-semibold rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-sm text-sm sm:text-[15px]">
                      초기화
                    </button>
                    <button className="px-8 py-2.5 sm:px-12 sm:py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200/50 text-sm sm:text-[15px]">
                      의약품 검색
                    </button>
                  </div>
                </div>
              </div>
            )}

`;
  
  c = c.slice(0, s1) + replacement + c.slice(s2);
}

fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', c, 'utf8');
