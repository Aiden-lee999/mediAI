'use client';
import { useState, useEffect } from 'react';

export default function PrescribeGuide() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  
  const [initialData, setInitialData] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchInitialGuide = async () => {
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: '현재 의학계(KDA, KSH 등)의 가장 최신 당뇨, 고혈압 처방 가이드라인 핵심 요약과 일반적인 비만치료제(Saxenda 등) 증량 스케줄을 "textbook" 블록 타입으로 알려주세요.' })
        });
        const data = await res.json();
        setInitialData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchInitialGuide();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 검색 바 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-extrabold text-blue-800 mb-2"> 처방 가이드 및 증례 매칭</h2>
        <p className="text-sm text-slate-500 mb-6">"50대 여성, 고혈압 당뇨 복합 환자"처럼 환자의 상태를 입력하면 최신 학회 가이드라인과 실제 처방 증례를 분석해드립니다.</p>
        
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="환자의 증명, 나이, 기저질환, 검사 수치 등을 입력하세요 (예: 50대 남성, Cr 1.8, HbA1c 8.5 환자)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            disabled={loading}
            onClick={handleSearch}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-8 py-3 rounded-lg text-sm transition shadow-sm whitespace-nowrap disabled:opacity-50">
            {loading ? '분석 중...' : '증례 매칭'}
          </button>
        </div>
      </div>

      {response && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <span className="text-indigo-600 text-xl"></span>
            <h3 className="font-bold text-lg text-indigo-900">AI 분석 결과 요약</h3>
          </div>
          <p className="text-slate-700 bg-indigo-50 p-4 rounded-lg mb-6 leading-relaxed">
            {response.chat_reply}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {response.blocks?.map((block: any, idx: number) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  {block.block_type === 'insurance_warning' ? '️' : ''} {block.title}
                </h4>
                <p className="text-sm text-slate-600 mb-3">{block.body}</p>
                {block.meta_json?.drugs && (
                  <div className="mt-2 space-y-2">
                    {block.meta_json.drugs.map((drug: any, dIdx: number) => (
                      <div key={dIdx} className="bg-white p-2 rounded border border-slate-100 text-xs">
                        <div className="font-bold text-blue-700">{drug.name}</div>
                        <div className="text-slate-500">{drug.ingredient}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!response && !loading && (
        <>
          {initialLoading ? (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center animate-pulse">
              <span className="text-2xl mb-3 block"></span>
              <p className="text-slate-500 font-medium">최신 학회 가이드라인 및 증량 스케줄을 AI가 실시간으로 분석중입니다...</p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-emerald-500">�</span> 최신 학회 가이드라인 요약 & 증량 스케줄 (실시간 AI 통신)
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">Auto-generated by GPT-4</span>
               </div>
               
               <p className="text-sm text-slate-700 mb-6 bg-slate-50 p-4 rounded-lg leading-relaxed">
                 {initialData?.chat_reply || '현재 데이터를 불러올 수 없습니다.'}
               </p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {initialData?.blocks?.map((block: any, idx: number) => (
                   <div key={idx} className="border-l-4 border-emerald-400 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-emerald-700 font-bold text-sm block">{block.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                         {block.body}
                      </p>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </>
      )}
      
      {/* 유사 증례 분석 (전체 폭) - 결과 없을때만 보여지도록 유지 */}
      {!response && !loading && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
             <span className="text-amber-500">‍️</span> 원장님 환자와 유사한 상위 1% 성공 증례
           </h3>
           <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                       <th className="p-3">환자 프로필</th>
                       <th className="p-3">초기 수치</th>
                       <th className="p-3">효과적 처방 조합</th>
                       <th className="p-3">12주 경과</th>
                       <th className="p-3 text-center">상세</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                       <td className="p-3"><div className="font-bold text-slate-700">M/54</div><div className="text-[10px] text-slate-500">CKD stage 3, HTN</div></td>
                       <td className="p-3"><span className="text-red-500 font-bold">HbA1c 8.8%</span><br/><span className="text-slate-500 text-xs">Cr 1.6</span></td>
                       <td className="p-3 text-blue-700 font-medium">Linagliptin 5mg + Empagliflozin 10mg</td>
                       <td className="p-3"><span className="text-emerald-600 font-bold">HbA1c 7.1%</span><br/><span className="text-slate-500 text-xs">Cr 유지 (1.5)</span></td>
                       <td className="p-3 text-center"><button className="text-blue-500 border border-blue-200 px-2 py-1 rounded text-xs hover:bg-blue-50">차트 보기</button></td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
}