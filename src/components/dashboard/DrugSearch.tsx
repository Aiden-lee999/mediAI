'use client';
import { useState } from 'react';

export default function DrugSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('검색결과');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<any>(null);

  // Sorting state
  const [sortCol, setSortCol] = useState<string>('brandClass');
  const [isAsc, setIsAsc] = useState<boolean>(true);

  const handleSort = (col: string) => {
    const asc = sortCol === col ? !isAsc : true;
    setSortCol(col);
    setIsAsc(asc);

    const sorted = [...searchResults].sort((a: any, b: any) => {
      let valA = a[col] || '';
      let valB = b[col] || '';

      if (col === 'brandClass') {
          valA = a.brandClass === '오리지널(대장약)' ? 0 : 1;
          valB = b.brandClass === '오리지널(대장약)' ? 0 : 1;
          return asc ? valA - valB : valB - valA;
      }
      
      return asc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    setSearchResults(sorted);
  };

  const [durInfo, setDurInfo] = useState<any>(null);
  const [durLoading, setDurLoading] = useState(false);
  
  const [llmInfo, setLlmInfo] = useState<any>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const fetchDUR = async (drug: any) => {
     setDurLoading(true);
     setDurInfo(null);
     try {
       const res = await fetch('/api/drugs/dur', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ productName: drug.productName, ingredientName: drug.ingredientName })
       });
       const data = await res.json();
       setDurInfo(data);
     } catch (err) {
       console.error(err);
     } finally {
       setDurLoading(false);
     }
  };

  const fetchLLMInfo = async (drug: any) => {
     setLlmLoading(true);
     setLlmInfo(null);
     try {
       const res = await fetch('/api/ask', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ question: `약품명: ${drug.productName}, 성분명: ${drug.ingredientName}. 해당 약제의 최신 건강보험 심평원 급여 인정 기준(삭감 주의사항 포함)과 동일 성분의 대표적인 대체 약제 2~3가지를 추천해줘. "textbook" 블록과 "drug_cards" 블록을 같이 반환해줘.` })
       });
       const data = await res.json();
       setLlmInfo(data);
     } catch (err) {
       console.error(err);
     } finally {
       setLlmLoading(false);
     }
  };

  const handleSelectDrug = (drug: any) => {
    setSelectedDrug(drug);
    fetchDUR(drug);
    fetchLLMInfo(drug);
    setActiveTab('급여조회');
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/drugs/search?productName=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();

      if (res.ok) {
        // By default, original first
        const sorted = (data.items || []).sort((a: any, b: any) => {
          const aClass = a.brandClass === '오리지널(대장약)' ? 0 : 1;
          const bClass = b.brandClass === '오리지널(대장약)' ? 0 : 1;
          if (aClass !== bClass) return aClass - bClass;
          return b.usageFrequency - a.usageFrequency;
        });
        setSearchResults(sorted);
        setActiveTab('검색결과'); // Add a tab for search results
      } else {
        setError(`검색 오류: ${data.message || res.statusText}`);
      }
    } catch (err: any) {
      setError(`네트워크 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full  space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-extrabold text-blue-800 mb-2"> 스마트 약제조회 및 DUR 보조</h2>
        <p className="text-sm text-slate-500 mb-6">30만 건의 의약품 데이터베이스를 실시간으로 검색하여 급여 기준, 대체 약제, DUR(병용금기) 정보를 제공합니다.</p>
        
        <div className="relative mb-6">
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pl-12 shadow-inner"
            placeholder="품목명, 성분명, 제약사 또는 '당뇨 고혈압 처방 삭감 기준' 등을 자연어로 검색해보세요."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <span className="absolute left-4 top-4 w-5 h-5 flex items-center justify-center text-slate-400"></span>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg text-sm transition shadow-sm disabled:opacity-50">
            {loading ? '검색 중...' : 'AI 검색'}
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          {['검색결과', '급여조회', '대체약제', 'DUR 점검', '복약지도'].map(tab => (
             <button
               key={tab}
               className={`py-3 px-6 font-bold text-sm border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
               onClick={() => setActiveTab(tab)}
             >
               {tab}
             </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="col-span-2">
            {error && (
              <div className="p-4 mb-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            
            {activeTab === '검색결과' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <span className="text-blue-500"></span> 검색 결과 {searchResults.length > 0 && `(${searchResults.length}건)`}
                 </h3>

                 {loading ? (
                   <div className="text-center py-8 text-slate-500">검색 중입니다...</div>
                 ) : searchResults.length > 0 ? (
                   <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('productName')}>제품명 {sortCol === 'productName' && (isAsc ? '▲' : '▼')}</th>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('brandClass')}>구분 {sortCol === 'brandClass' && (isAsc ? '▲' : '▼')}</th>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('ingredientName')}>주성분 {sortCol === 'ingredientName' && (isAsc ? '▲' : '▼')}</th>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('reimbursement')}>급여 {sortCol === 'reimbursement' && (isAsc ? '▲' : '▼')}</th>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('priceLabel')}>약가 {sortCol === 'priceLabel' && (isAsc ? '▲' : '▼')}</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {searchResults.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleSelectDrug(item)}>
                             <td className="p-3 font-bold text-blue-700">{item.productName}</td>
                             <td className="p-3 text-xs">
                               <span className={`px-2 py-0.5 rounded-full ${item.brandClass === '오리지널(대장약)' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                 {item.brandClass || '복제약(제네릭)'}
                               </span>
                             </td>
                             <td className="p-3 text-slate-600">{item.ingredientName || '-'}</td>
                             <td className="p-3">{item.reimbursement || '-'}</td>
                             <td className="p-3">{item.priceLabel || '-'}</td>
                          </tr>
                          ))}
                       </tbody>
                    </table>
                   </div>
                 ) : (
                   <div className="text-center py-8 text-slate-500">
                     검색 결과가 없습니다. 다른 검색어로 검색해보세요.
                   </div>
                 )}
              </div>
            )}
            
            {activeTab === '급여조회' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <span className="text-blue-500"></span> 심평원 인정 기준 (AI 분석 최신고시요약)
                 </h3>
                 {!selectedDrug ? (
                    <div className="text-center py-8 text-slate-500">약제를 먼저 검색하고 선택해주세요.</div>
                 ) : llmLoading ? (
                    <div className="text-center py-8 text-slate-500 animate-pulse">실시간 급여 기준 정보를 가져오는 중입니다...</div>
                 ) : (
                    <div className="space-y-4">
                       <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">인정 고시 및 주요 정보</span>
                            <span className="text-sm font-bold text-slate-700">{selectedDrug.productName} ({selectedDrug.ingredientName})</span>
                          </div>
                          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {llmInfo?.chat_reply || '급여 관련 상세 정보가 생성되지 않았습니다.'}
                          </div>
                       </div>
                       {llmInfo?.blocks?.map((block: any, idx: number) => (
                          block.block_type === 'insurance_warning' || block.block_type === 'expert_warning' || block.block_type === 'textbook' ? (
                             <div key={idx} className="p-4 bg-red-50 rounded-lg border border-red-100 mt-2">
                                <h4 className="font-bold text-red-800 text-sm mb-1">{block.title || '️ 삭감 및 주의사항'}</h4>
                                <p className="text-xs text-red-700 whitespace-pre-wrap">{block.body}</p>
                             </div>
                          ) : null
                       ))}
                    </div>
                 )}
              </div>
            )}
            
            {activeTab === '대체약제' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-blue-500"></span> 동일 성분 대체 약제 비교</h3>
                   <span className="text-xs text-slate-500">품절 및 부작용 고려</span>
                 </div>
                 
                 {!selectedDrug ? (
                    <div className="text-center py-8 text-slate-500">약제를 먼저 검색하고 선택해주세요.</div>
                 ) : llmLoading ? (
                    <div className="text-center py-8 text-slate-500 animate-pulse">대체 약제 정보를 검색 중입니다...</div>
                 ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                             <th className="p-3">추천 제품명</th>
                             <th className="p-3">성분명/함량</th>
                             <th className="p-3">제약사</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {llmInfo?.blocks?.find((b:any)=>b.block_type==='drug_cards')?.meta_json?.drugs?.map((drug:any, idx:number)=>(
                             <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-blue-700">{drug.name}</td>
                                <td className="p-3 text-slate-600">{drug.ingredient}</td>
                                <td className="p-3">{drug.company || '-'}</td>
                             </tr>
                          )) || (
                             <tr><td colSpan={3} className="text-center p-5 text-slate-500">조회된 대체 약제 정보가 없습니다.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
                 )}
              </div>
            )}            {activeTab === 'DUR 점검' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="text-blue-500"></span> 사전 처방 안전 점검 (DUR)</h3>
                 
                 {!selectedDrug ? (
                   <div className="text-center py-8 text-slate-500">먼저 검색 후 약제를 선택해주세요.</div>
                 ) : durLoading ? (
                   <div className="text-center py-8 text-slate-500">DUR 정보를 실시간으로 확인하는 중입니다...</div>
                 ) : durInfo?.sections?.filter((s:any) => s.total > 0).length > 0 ? (
                   <div className="space-y-4">
                     {durInfo.sections.filter((s:any) => s.total > 0).map((sec: any, sIdx: number) => (
                       <div key={sIdx} className="border border-red-200 bg-red-50 p-4 rounded-xl flex gap-4">
                          <div className="bg-white p-2 rounded-full h-10 w-10 flex items-center justify-center shadow-sm">️</div>
                          <div className="flex-1">
                             <div className="font-bold text-red-800 text-sm mb-1">{sec.title} 발견! ({sec.total}건)</div>
                             {sec.items.map((item: any, iIdx: number) => (
                               <div key={iIdx} className="mt-2 text-xs text-red-900 leading-relaxed bg-white border border-red-300 p-3 rounded">
                                  <strong>금기약/사유:</strong> {item.contraDrug || item.ageInfo || item.pregnantInfo || '제공안됨'}<br/>
                                  <strong>주의사항:</strong> {item.caution || '상세 내용 없음'}
                               </div>
                             ))}
                          </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-xl flex gap-4">
                     <div className="bg-white p-2 rounded-full h-10 w-10 flex items-center justify-center shadow-sm text-emerald-500 font-bold"></div>
                     <div className="flex items-center">
                        <div className="font-bold text-emerald-800 text-sm">{selectedDrug.productName} 약제에 대해 특별한 DUR 금기/주의사항이 발견되지 않았습니다.</div>
                     </div>
                   </div>
                 )}
              </div>
            )}
         </div>

         {/* Right Sidebar (Mini AI Assistant) */}
         <div className="col-span-1 space-y-6">
            <div className="bg-blue-600 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
               <div className="absolute right-0 bottom-0 opacity-10 text-6xl transform translate-x-4 translate-y-4"></div>
               <h3 className="font-bold text-lg mb-2 relative z-10">AI 퀵 검색</h3>
               <p className="text-blue-100 text-xs mb-4 relative z-10">방금 입력한 약제와 연관된 다국어 복약 지도문을 생성할까요?</p>
               <button className="w-full bg-white text-blue-700 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-blue-50 relative z-10 transition">
                 다국어 지도문 자동 생성
               </button>
            </div>
            
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
               <h3 className="font-bold text-slate-800 text-sm mb-3">최근 검색한 성분</h3>
               <div className="flex flex-wrap gap-2">
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium cursor-pointer hover:bg-slate-200">Metformin</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium cursor-pointer hover:bg-slate-200">Empagliflozin</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium cursor-pointer hover:bg-slate-200">Amoxicillin</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}