const fs = require('fs');
let c = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

c = c.replace('💊 약제 조회', '약제 조회');
c = c.replace('💊 통합 약제 조회 및 DUR', '의약품상세검색');

const s1 = c.indexOf('{/* ===================== DRUG SEARCH VIEW ===================== */}');
const s2 = c.indexOf('{/* ===================== CHAT VIEW ===================== */}', s1);

if(s1 !== -1 && s2 !== -1) {
  const replacement = `{/* ===================== DRUG SEARCH VIEW ===================== */}
            {view === 'drug_search' && (
              <div className="max-w-5xl mx-auto p-6 bg-white shadow-sm border border-slate-200 mt-6 rounded-md text-slate-800">
                <div className="flex items-center mb-4 border-b-2 border-[#1a659e] pb-2">
                  <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">의약품상세검색</h2>
                  <span className="ml-2 w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-500 cursor-pointer">i</span>
                </div>
                
                <div className="border-t border-l border-slate-200 text-[13px]">
                  {/* Row 1 */}
                  <div className="flex flex-col sm:flex-row border-b border-slate-200">
                    <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">제품명</div>
                    <div className="flex-1 p-2 sm:border-r sm:border-b-0 border-b border-slate-200">
                      <input type="text" className="w-full border border-slate-300 p-1.5 focus:outline-none focus:border-[#1a659e]" />
                    </div>
                    <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">성분명</div>
                    <div className="flex-1 p-2">
                      <input type="text" className="w-full border border-slate-300 p-1.5 focus:outline-none focus:border-[#1a659e]" />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="flex flex-col sm:flex-row border-b border-slate-200">
                    <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">제품코드</div>
                    <div className="flex-1 p-2 sm:border-r sm:border-b-0 border-b border-slate-200">
                      <input type="text" className="w-full border border-slate-300 p-1.5 focus:outline-none focus:border-[#1a659e]" />
                    </div>
                    <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">제약사</div>
                    <div className="flex-1 p-2">
                      <input type="text" className="w-full border border-slate-300 p-1.5 focus:outline-none focus:border-[#1a659e]" />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="flex flex-col sm:flex-row border-b border-slate-200">
                    <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">전문/일반</div>
                    <div className="flex-1 p-3 flex flex-wrap gap-x-6 gap-y-2">
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="rx_otc" defaultChecked className="accent-[#1a659e]" /> 전체</label>
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="rx_otc" className="accent-[#1a659e]" /> 전문</label>
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="rx_otc" className="accent-[#1a659e]" /> 일반</label>
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="rx_otc" className="accent-[#1a659e]" /> 의약외품</label>
                    </div>
                  </div>

                  {/* Row 4 */}
                  <div className="flex flex-col sm:flex-row border-b border-slate-200">
                    <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">급여/비급여</div>
                    <div className="flex-1 p-3 flex flex-wrap gap-x-5 gap-y-2">
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="ins_status" defaultChecked className="accent-[#1a659e]" /> 전체</label>
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="ins_status" className="accent-[#1a659e]" /> 급여</label>
                      <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="ins_status" className="accent-[#1a659e]" /> 비급여</label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-500"><input type="radio" name="ins_status" className="accent-[#1a659e]" /> 산정불가</label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-500"><input type="radio" name="ins_status" className="accent-[#1a659e]" /> 급여중지</label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-500"><input type="radio" name="ins_status" className="accent-[#1a659e]" /> 급여삭제</label>
                    </div>
                  </div>

                  {/* Row 5 */}
                  <div className="flex flex-col sm:flex-row border-b border-slate-200">
                    <div className="sm:w-auto flex-1 min-w-0 flex flex-col sm:flex-row sm:border-r sm:border-b-0 border-b border-slate-200">
                      <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">단일/복합제</div>
                      <div className="flex-1 p-3 flex flex-wrap gap-x-6 gap-y-2">
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="single_combo" defaultChecked className="accent-[#1a659e]" /> 전체</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="single_combo" className="accent-[#1a659e]" /> 단일제</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="single_combo" className="accent-[#1a659e]" /> 복합제</label>
                      </div>
                    </div>
                    <div className="sm:w-auto flex-1 min-w-0 flex flex-col sm:flex-row">
                      <div className="sm:w-32 bg-[#f8f9fa] p-3 flex sm:items-center font-bold border-b sm:border-b-0 sm:border-r border-slate-200 text-slate-700">주성분코드</div>
                      <div className="flex-1 p-2 border-r border-slate-200">
                        <input type="text" className="w-full border border-slate-300 p-1.5 focus:outline-none focus:border-[#1a659e]" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-[1px]">
                  <button className="border border-slate-300 bg-[#f8f9fa] hover:bg-slate-100 text-xs px-3 py-1 flex items-center justify-center gap-1 text-slate-600 rounded-sm">
                    <div className="w-3 h-3 rounded-full border border-slate-500 font-bold flex items-center justify-center text-[10px] pb-px">+</div> 펼침
                  </button>
                </div>

                <div className="flex justify-center gap-2 mt-8 mb-6">
                  <button className="bg-[#1a70b2] hover:bg-[#155a8f] text-white text-[15px] px-12 py-2.5 font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                    <span className="font-medium text-[16px] leading-none mb-px">Q</span> 검색
                  </button>
                  <button className="bg-[#758493] hover:bg-[#606d79] text-white text-[15px] px-10 py-2.5 font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                    <span className="font-medium text-[16px] leading-none mb-px">C</span> 선택초기화
                  </button>
                </div>
              </div>
            )}

`;
  
  c = c.slice(0, s1) + replacement + c.slice(s2);
}

fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', c, 'utf8');
