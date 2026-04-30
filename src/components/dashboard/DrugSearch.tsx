'use client';
import { useEffect, useMemo, useState } from 'react';

const SORT_PREF_KEY = 'drugSearch.sortPreference.v1';

const SORT_OPTIONS = [
  { value: 'brandClass', label: '구분' },
  { value: 'productName', label: '제품명' },
  { value: 'ingredientName', label: '주성분' },
  { value: 'company', label: '제약사' },
  { value: 'reimbursement', label: '급여' },
  { value: 'priceLabel', label: '약가' },
  { value: 'usageFrequency', label: '처방빈도' },
] as const;

function loadSortPreference() {
  if (typeof window === 'undefined') {
    return { col: 'brandClass', asc: true };
  }

  try {
    const raw = window.localStorage.getItem(SORT_PREF_KEY);
    if (!raw) return { col: 'brandClass', asc: true };
    const parsed = JSON.parse(raw) as { col?: string; asc?: boolean };
    return {
      col: parsed.col || 'brandClass',
      asc: parsed.asc ?? true,
    };
  } catch {
    return { col: 'brandClass', asc: true };
  }
}

function saveSortPreference(col: string, asc: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SORT_PREF_KEY, JSON.stringify({ col, asc }));
}

export default function DrugSearch() {
  const initialSort = loadSortPreference();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('검색결과');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [resultFilter, setResultFilter] = useState('');

  // Sorting state
  const [sortCol, setSortCol] = useState<string>(initialSort.col);
  const [isAsc, setIsAsc] = useState<boolean>(initialSort.asc);

  const [defaultSortCol, setDefaultSortCol] = useState<string>(initialSort.col);
  const [defaultSortAsc, setDefaultSortAsc] = useState<boolean>(initialSort.asc);

  const toPriceNumber = (value: string) => {
    const first = (value || '').split('/')[0] || '';
    const numeric = first.replace(/[^0-9]/g, '');
    return numeric ? Number(numeric) : Number.MAX_SAFE_INTEGER;
  };

  const handleSort = (col: string) => {
    const asc = sortCol === col ? !isAsc : true;
    setSortCol(col);
    setIsAsc(asc);
  };

  const handleApplyDefaultSort = () => {
    setSortCol(defaultSortCol);
    setIsAsc(defaultSortAsc);
    saveSortPreference(defaultSortCol, defaultSortAsc);

    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SORT_PREF_KEY,
        value: JSON.stringify({ col: defaultSortCol, asc: defaultSortAsc }),
      }),
    }).catch(() => {
      // local preference is already stored; ignore remote save failure
    });
  };

  useEffect(() => {
    let active = true;

    const loadServerPreference = async () => {
      try {
        const res = await fetch(`/api/user/preferences?key=${encodeURIComponent(SORT_PREF_KEY)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data?.value) return;

        const parsed = JSON.parse(data.value) as { col?: string; asc?: boolean };
        const col = parsed?.col || 'brandClass';
        const asc = parsed?.asc ?? true;

        setSortCol(col);
        setIsAsc(asc);
        setDefaultSortCol(col);
        setDefaultSortAsc(asc);
        saveSortPreference(col, asc);
      } catch {
        // keep local fallback preference
      }
    };

    loadServerPreference();

    return () => {
      active = false;
    };
  }, []);

  const visibleResults = useMemo(() => {
    const filter = resultFilter.trim().toLowerCase();
    const filtered = !filter
      ? searchResults
      : searchResults.filter((row: any) => {
          const product = (row.productName || '').toLowerCase();
          const ingredient = (row.ingredientName || '').toLowerCase();
          const company = (row.company || '').toLowerCase();
          return product.includes(filter) || ingredient.includes(filter) || company.includes(filter);
        });

    return [...filtered].sort((a: any, b: any) => {
      let valA = a[sortCol] || '';
      let valB = b[sortCol] || '';

      if (sortCol === 'brandClass') {
          valA = a.brandClass === '오리지널(대장약)' ? 0 : 1;
          valB = b.brandClass === '오리지널(대장약)' ? 0 : 1;
            return isAsc ? valA - valB : valB - valA;
      }

      if (sortCol === 'priceLabel') {
        const priceA = toPriceNumber(a.priceLabel || '');
        const priceB = toPriceNumber(b.priceLabel || '');
        return isAsc ? priceA - priceB : priceB - priceA;
      }

      if (sortCol === 'usageFrequency') {
        const freqA = Number(a.usageFrequency || 0);
        const freqB = Number(b.usageFrequency || 0);
        return isAsc ? freqA - freqB : freqB - freqA;
      }
      
      return isAsc
        ? String(valA).localeCompare(String(valB), 'ko')
        : String(valB).localeCompare(String(valA), 'ko');
    });
  }, [searchResults, resultFilter, sortCol, isAsc]);

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
    // DO NOT change activeTab automatically to allow the user to keep viewing search results!
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
        setSearchResults(data.items || []);
        setResultFilter('');
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
                   <span className="text-blue-500"></span> 검색 결과 {searchResults.length > 0 && `(${visibleResults.length}/${searchResults.length}건)`}
                 </h3>

                 <div className="mb-4">
                   <input
                     type="text"
                     className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                     placeholder="검색된 결과 안에서 재검색 (제품명 / 주성분 / 제약사)"
                     value={resultFilter}
                     onChange={(e) => setResultFilter(e.target.value)}
                   />
                 </div>

                 <div className="mb-4 p-3 border border-slate-200 rounded-lg bg-slate-50 flex flex-wrap items-center gap-2">
                   <span className="text-xs font-bold text-slate-700">기본 정렬 설정</span>
                   <select
                     className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                     value={defaultSortCol}
                     onChange={(e) => setDefaultSortCol(e.target.value)}
                   >
                     {SORT_OPTIONS.map((opt) => (
                       <option key={opt.value} value={opt.value}>{opt.label}</option>
                     ))}
                   </select>
                   <select
                     className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                     value={defaultSortAsc ? 'asc' : 'desc'}
                     onChange={(e) => setDefaultSortAsc(e.target.value === 'asc')}
                   >
                     <option value="asc">오름차순</option>
                     <option value="desc">내림차순</option>
                   </select>
                   <button
                     className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                     onClick={handleApplyDefaultSort}
                   >
                     저장 및 적용
                   </button>
                   <span className="text-[11px] text-slate-500">현재: {SORT_OPTIONS.find((v) => v.value === sortCol)?.label || sortCol} / {isAsc ? '오름차순' : '내림차순'}</span>
                 </div>

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
                              <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('company')}>제약사 {sortCol === 'company' && (isAsc ? '▲' : '▼')}</th>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('reimbursement')}>급여 {sortCol === 'reimbursement' && (isAsc ? '▲' : '▼')}</th>
                             <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('priceLabel')}>약가 {sortCol === 'priceLabel' && (isAsc ? '▲' : '▼')}</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                            {visibleResults.map((item, idx) => (
                            <tr key={`${item.standardCode || item.id || idx}_${item.company || ''}`} className={`hover:bg-slate-50 cursor-pointer ${selectedDrug?.productName === item.productName && selectedDrug?.company === item.company ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`} onClick={() => handleSelectDrug(item)}>
                             <td className="p-3 font-[800] text-blue-700 max-w-[120px] sm:max-w-[160px] lg:max-w-[200px] break-words whitespace-normal leading-tight">{item.productName}</td>
                             <td className="p-3 text-xs">
                               <span className={`px-2 py-0.5 rounded-full ${item.brandClass === '오리지널(대장약)' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                 {item.brandClass || '복제약(제네릭)'}
                               </span>
                             </td>
                             <td className="p-3 text-slate-600">{item.ingredientName || '-'}</td>
                              <td className="p-3 text-slate-700">{item.company || '-'}</td>
                             <td className="p-3">{item.reimbursement || '-'}</td>
                             <td className="p-3">{ (item.priceLabel || "-").split("/")[0].trim() }</td>
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
                 ) : (
                    <div className="space-y-4">
                       <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">인정 고시 및 주요 정보</span>
                            <span className="text-sm font-bold text-slate-700">{selectedDrug.productName} ({selectedDrug.ingredientName})</span>
                          </div>
                          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {llmLoading ? '실시간 AI 병합 및 약가/급여 기준 분석 중입니다 (약 3~8초 소요)...' : (llmInfo?.chat_reply || '급여 상세 정보가 생성되지 않았습니다.')}
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
                 ) : (
                 <div className="overflow-x-auto">
                    {llmLoading && <div className="p-4 text-center text-blue-500 font-bold animate-pulse">실시간 AI 대체 약제 검색 중...</div>}
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