'use client';
import { useState } from 'react';

export default function LegalReview() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('의료소송 판례');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });
      const data = await res.json();
      setResponse(data);
      setActiveTab('AI 판례분석 결과');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full  space-y-6">
      {/* 5. 법률검토 (판례중심) */}
      <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-700">
        <h2 className="text-xl font-extrabold text-white mb-2 flex items-center gap-2">️ 의료법규 및 판례 AI 어시스턴트</h2>
        <p className="text-sm text-slate-300 mb-6">"내시경 중 천공 발생 시 설명의무 위반 소송 결과 찾아줘" 처럼 위험도가 높은 시술 전 체크리스트와 판례를 제공합니다.</p>
        
        <div className="relative">
          <input
            type="text"
            className="w-full bg-slate-800 border border-slate-600 outline-none text-white rounded-xl px-5 py-4 pl-12 focus:ring-2 focus:ring-blue-500 transition shadow-inner"
            placeholder="궁금한 시술명, 부작용, 의료분쟁 키워드, 비급여 청구 기준 등을 입력하세요."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <span className="absolute left-4 top-4 text-xl opacity-50"></span>
          <button 
            id="legal-search-btn"
            disabled={loading}
            onClick={handleSearch}
            className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition shadow-sm h-[40px] disabled:opacity-50">
            {loading ? '검색 중...' : '판례 검색'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* 좌측 콘텐츠 영력 */}
         <div className="col-span-2 space-y-4">
            <div className="flex border-b border-slate-200">
               {['AI 판례분석 결과', '의료소송 판례', '시술 설명 동의서 생성기', '심평원/복지부 유권해석'].map(tab => (
                  <button 
                     key={tab}
                     className={`py-3 px-6 font-bold text-sm border-b-2 transition -mb-[1px] ${activeTab === tab ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                     onClick={() => setActiveTab(tab)}
                  >
                     {tab}
                  </button>
               ))}
            </div>

            {activeTab === 'AI 판례분석 결과' && response && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm pt-6 mt-2">
                <div className="flex items-center gap-2 mb-4 border-b pb-2">
                  <span className="text-indigo-600 text-xl">️</span>
                  <h3 className="font-bold text-lg text-slate-800">분석 결과 요약</h3>
                </div>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-lg mb-6 leading-relaxed">
                  {response.chat_reply || response.orchestration_summary}
                </p>

                <div className="space-y-4">
                  {response.blocks?.map((block: any, idx: number) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                        {block.block_type === 'insurance_warning' || block.block_type === 'expert_warning' ? '️' : ''} {block.title}
                      </h4>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{block.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'AI 판례분석 결과' && !response && !loading && (
              <div className="text-center py-10 text-slate-500 bg-white rounded-xl border border-slate-200">
                상단의 검색창을 이용해 판례 및 의료법 분쟁 사례를 AI에게 질문해보세요.
              </div>
            )}

            {activeTab === '의료소송 판례' && (
               <div className="space-y-4 pt-2">
                  <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm">
                     <div className="flex justify-between items-start mb-3">
                        <div className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">설명의무 위반 (패소 판례)</div>
                        <span className="text-xs text-slate-400">대법원 2018다28****</span>
                     </div>
                     <h3 className="font-bold text-slate-800 mb-2 leading-snug cursor-pointer hover:underline">수면 대장내시경 검사 중 발생한 대장 천공에 대한 의사의 과실 여부</h3>
                     <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        피고 병원 의사가 대장내시경 검사 과정에서 무리하게 내시경을 압박 진입하여 천공이 발생한 과실이 추정되며, 사전에 천공 발생 위험성에 대한 구체적인 설명이 동의서에 누락되었다.
                     </p>
                     <div className="bg-slate-50 p-3 rounded border border-slate-100 text-xs">
                        <strong className="text-slate-700"> AI 방어 요약:</strong> 내시경 전 동의서에 "유착, 굴곡 등으로 인한 천공 가능성"을 명시하고 환자 서명을 별도로 징구할 것.
                     </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm opacity-80">
                     <div className="flex justify-between items-start mb-3">
                        <div className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">과실 부정 (승소 판례)</div>
                        <span className="text-xs text-slate-400">대법원 2019도11****</span>
                     </div>
                     <h3 className="font-bold text-slate-800 mb-2 leading-snug cursor-pointer hover:underline">디스크 수술 후 불가항력적 마름 발현 사건</h3>
                     <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        마취 및 수술 과정은 정상적으로 진행되었고 생체 징후 변화 시 즉각 응급조치를 다했다면, 단순히 결과가 나쁘다는 이유만으로 의료 과실을 추정할 수 없다.
                     </p>
                  </div>
               </div>
            )}

            {activeTab === '시술 설명 동의서 생성기' && (
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm pt-6 mt-2">
                  <h3 className="font-bold text-slate-800 mb-4 block">️ AI 시술 동의서 점검 및 자동 생성</h3>
                  <div className="space-y-4">
                     <input id="legal-proc" type="text" placeholder="시술명 (예: 요추 추간판 성형술)" className="w-full border border-slate-300 p-3 rounded" />
                     <textarea id="legal-memo" placeholder="현재 제공 중인 동의서 텍스트를 붙여넣기 하거나 비워두세요." className="w-full border border-slate-300 p-3 rounded min-h-[100px]"></textarea>
                     <button 
                        onClick={() => {
                           const proc = (document.getElementById('legal-proc') as HTMLInputElement)?.value || '';
                           const memo = (document.getElementById('legal-memo') as HTMLTextAreaElement)?.value || '';
                           setQuery(`[의료법 동의서 점검] 시술명: ${proc}. 기존내용: ${memo}. 법적 누락 조항 및 필수 고지 내용을 추가해서 작성해줘.`);
                           setActiveTab('AI 판례분석 결과');
                           document.getElementById('legal-search-btn')?.click();
                        }}
                        className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl shadow">법적 누락 조항 분석 및 보완</button>
                  </div>
               </div>
            )}

            {activeTab === '심평원/복지부 유권해석' && (
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-2 text-center py-10">
                  <p className="text-slate-500 mb-4">상단 검색창에 삭감 사례나 유권해석을 문의해주세요.</p>
                  <button 
                     onClick={() => {
                        setQuery('도수치료 실손보험 청구 관련 최근 금감원 및 심평원 유권해석의 핵심 쟁점을 요약해줘.');
                        setActiveTab('AI 판례분석 결과');
                        document.getElementById('legal-search-btn')?.click();
                     }}
                     className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold">
                     예시: 도수치료 유권해석 분석
                  </button>
               </div>
            )}
         </div>

         {/* 우측 사이드바: 면책 고지 및 퀵 링크 */}
         <div className="col-span-1 space-y-6">
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl shadow-sm">
               <h3 className="font-bold text-rose-800 text-sm mb-2 flex items-center gap-1">️ 주의사항</h3>
               <p className="text-xs text-rose-700 leading-relaxed">
                  본 AI가 제공하는 판례 및 법률 정보는 참고용일 뿐이며, <strong className="underline">변호사의 법률 자문을 대체하지 않습니다.</strong> 실제 의료 분쟁 시 반드시 전문 법조인의 조력을 받으십시오.
               </p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="font-bold text-slate-800 text-sm mb-4">빈발 의료분쟁 토픽 Top 5</h3>
               <ul className="text-sm space-y-3">
                  <li className="flex justify-between items-center text-slate-600 hover:text-blue-600 cursor-pointer">
                     <span>1. 피부 미용시술 후 화상/색소침착</span> <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500">18%</span>
                  </li>
                  <li className="flex justify-between items-center text-slate-600 hover:text-blue-600 cursor-pointer">
                     <span>2. 내시경 천공 및 수면마취 사고</span> <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500">15%</span>
                  </li>
                  <li className="flex justify-between items-center text-slate-600 hover:text-blue-600 cursor-pointer">
                     <span>3. 도수치료 후 신경 손상 </span> <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500">12%</span>
                  </li>
                  <li className="flex justify-between items-center text-slate-600 hover:text-blue-600 cursor-pointer">
                     <span>4. 비급여 과다청구에 대한 민원</span> <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500">8%</span>
                  </li>
                  <li className="flex justify-between items-center text-slate-600 hover:text-blue-600 cursor-pointer">
                     <span>5. 필러/보톡스 부작용 (괴사)</span> <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500">6%</span>
                  </li>
               </ul>
            </div>
         </div>
      </div>
    </div>
  );
}