'use client';
import { useState, useEffect } from 'react';

export default function Emergency() {
  const [weight, setWeight] = useState<number>(60);
  const [algorithm, setAlgorithm] = useState<string>('ACLS');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
     let interval: any;
     if (isRunning) {
        interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
     }
     return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (secs: number) => {
     const m = Math.floor(secs / 60).toString().padStart(2, '0');
     const s = (secs % 60).toString().padStart(2, '0');
     return `${m}:${s}`;
  };

  const [antidoteQuery, setAntidoteQuery] = useState('');
  const [antidoteLoading, setAntidoteLoading] = useState(false);
  const [antidotes, setAntidotes] = useState<any>(null);

  const handleAntidoteSearch = async () => {
    if (!antidoteQuery.trim()) return;
    setAntidoteLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `${antidoteQuery} 중독에 대한 해독제와 체중 ${weight}kg 기준의 투여 용량을 알려주세요.` })
      });
      const data = await res.json();
      setAntidotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAntidoteLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg border border-red-700 flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-extrabold mb-1">🚨 원클릭 응급처치 (ACLS / Anaphylaxis)</h2>
            <p className="text-red-100 text-sm">입력된 체중에 맞춰 약물 용량이 즉각 환산되며 타이머가 연동됩니다.</p>
         </div>
         <div className="text-right">
            <div className="text-red-200 text-xs font-bold mb-1">환자 예상 체중 (kg)</div>
            <div className="flex gap-2">
               <button onClick={()=>setWeight(w=>Math.max(10, w-5))} className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded font-bold">-</button>
               <input 
                  type="number" 
                  className="w-20 text-center bg-white text-red-900 font-bold rounded"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
               />
               <button onClick={()=>setWeight(w=>w+5)} className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded font-bold">+</button>
            </div>
         </div>
      </div>

      <div className="flex gap-4">
         <button onClick={()=>setAlgorithm('ACLS')} className={`flex-1 py-4 font-extrabold rounded-lg border-2 transition ${algorithm === 'ACLS' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-500 hover:border-red-300'}`}>성인 심정지 알고리즘 (ACLS)</button>
         <button onClick={()=>setAlgorithm('Anaphylaxis')} className={`flex-1 py-4 font-extrabold rounded-lg border-2 transition ${algorithm === 'Anaphylaxis' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300'}`}>아나필락시스 쇼크</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* 좌측 메인 플로우 */}
         <div className="col-span-2 space-y-4">
            {algorithm === 'ACLS' && (
               <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-red-200">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-red-100">
                     <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                        <span className="text-red-600">⏱️</span> CPR 타이머 & 투약 스케줄
                     </h3>
                     <div className="flex items-center gap-4">
                        <div className="text-3xl font-mono text-red-600 tracking-wider font-extrabold w-24 text-right">
                           {formatTime(elapsedTime)}
                        </div>
                        <button 
                           className={`px-4 py-2 font-bold rounded text-white ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                           onClick={() => setIsRunning(!isRunning)}
                        >
                           {isRunning ? '일시정지' : 'CPR 시작'}
                        </button>
                        <button className="text-xs text-slate-500 underline" onClick={()=>setElapsedTime(0)}>초기화</button>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center">
                        <div>
                           <div className="text-red-900 font-bold mb-1">Epinephrine 1mg IV/IO</div>
                           <div className="text-sm text-red-700">매 3~5분마다 투여 (현 체중 무관 성인 1앰플)</div>
                        </div>
                        <button className="bg-white border-2 border-red-500 text-red-600 font-bold px-6 py-3 rounded-xl hover:bg-red-50 active:bg-red-600 active:text-white transition shadow-sm">
                           투여 완료 기록
                        </button>
                     </div>

                     <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                        <div>
                           <div className="text-slate-800 font-bold mb-1">Amiodarone (VF/pVT)</div>
                           <div className="text-sm text-slate-600">첫 투여: <span className="font-bold text-blue-600">300mg IV/IO</span> (2번의 제세동 후)</div>
                        </div>
                        <button className="bg-white border-2 border-slate-300 text-slate-600 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 active:bg-slate-600 active:text-white transition">
                           300mg 투여
                        </button>
                     </div>

                     <div className="w-full bg-blue-50 border-l-4 border-blue-500 p-4 mt-6">
                        <strong className="text-blue-900 block mb-1">리듬 확인 (맥박 촉지) 최소화</strong>
                        <p className="text-sm text-blue-800">2분마다 제세동기를 통해 리듬 분석. 가슴압박 중단 시간은 10초 이내로 최소화하세요.</p>
                     </div>
                  </div>
               </div>
            )}

            {algorithm === 'Anaphylaxis' && (
               <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-amber-200">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg mb-6 pb-4 border-b border-amber-100">
                     <span className="text-amber-500">⚡</span> 아나필락시스 초동 대처
                  </h3>

                  <div className="space-y-4">
                     <div className="p-5 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex bg-amber-100/50 p-2 rounded justify-between mb-4">
                           <span className="text-amber-900 font-bold">에피네프린 근육주사 (IM)</span>
                           <span className="text-amber-700 font-bold text-xs bg-white px-2 py-1 border border-amber-200 rounded-full">1순위</span>
                        </div>
                        <div className="flex items-center gap-4 text-center">
                           <div className="flex-1 bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                              <div className="text-xs text-slate-500 mb-1">농도비 (1:1000)</div>
                              <div className="text-2xl font-extrabold text-amber-600 mb-1">0.3 ~ 0.5 <span className="text-sm font-medium">mg</span></div>
                              <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">성인 / 대퇴부 전외측</div>
                           </div>
                           <div className="flex-1">
                              <p className="text-sm text-amber-900 text-left leading-relaxed">
                                필요시 5~15분 간격으로 최대 3회까지 반복 투여합니다.<br/><br/>
                                <span className="font-bold underline text-red-600">절대 정맥주사(IV)로 투여하지 마십시오 (심실빈맥 위험)</span>
                              </p>
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <div className="flex-1 p-4 bg-slate-50 rounded border border-slate-200">
                           <h4 className="font-bold text-slate-700 text-sm mb-2">보조 요법 1. 항히스타민제</h4>
                           <div className="text-xs text-slate-600">
                              <span className="font-bold text-blue-600">Chlorpheniramine</span> 1앰플 (4mg) IV/IM<br/>or <span className="font-bold text-blue-600">Peniramine</span>
                           </div>
                        </div>
                        <div className="flex-1 p-4 bg-slate-50 rounded border border-slate-200">
                           <h4 className="font-bold text-slate-700 text-sm mb-2">보조 요법 2. 스테로이드</h4>
                           <div className="text-xs text-slate-600">
                              <span className="font-bold text-blue-600">Hydrocortisone</span> 250mg IV <br/> or <span className="font-bold text-blue-600">Methylprednisolone</span> 125mg IV
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* 중독 해독제 사전 */}
         <div className="col-span-1 bg-slate-800 rounded-xl p-6 shadow-lg text-slate-50 relative overflow-hidden h-full flex flex-col border border-slate-700">
            <h3 className="font-extrabold text-white flex items-center gap-2 mb-4 border-b border-slate-600 pb-3">
               <span className="text-indigo-400">🧪</span> 독성학/해독제 (Antidote)
            </h3>
            
            <div className="relative mb-4">
               <input 
                  type="text" 
                  value={antidoteQuery}
                  onChange={(e) => setAntidoteQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAntidoteSearch()}
                  className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-sm text-white focus:outline-none focus:border-indigo-400 pr-12"
                  placeholder="원인 약물 또는 독극물 검색"
               />
               <button 
                 onClick={handleAntidoteSearch}
                 disabled={antidoteLoading}
                 className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded text-xs transition disabled:opacity-50">
                 {antidoteLoading ? '...' : '검색'}
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
               {antidotes ? (
                  <div className="bg-slate-700/50 p-4 rounded border border-indigo-500 shadow-inner">
                     <h4 className="font-bold text-indigo-300 mb-2 border-b border-slate-600 pb-1">AI 해독 분석 결과</h4>
                     <p className="text-sm text-slate-200 leading-relaxed mb-3">
                        {antidotes.chat_reply}
                     </p>
                     {antidotes.blocks?.map((block: any, idx: number) => (
                        <div key={idx} className="bg-slate-800 p-2 rounded text-xs border border-slate-600 mt-2">
                           <strong className="text-emerald-400 block mb-1">{block.title}</strong>
                           <span className="text-slate-300">{block.body}</span>
                        </div>
                     ))}
                     <button onClick={() => setAntidotes(null)} className="mt-4 text-xs text-slate-400 underline">돌아가기</button>
                  </div>
               ) : (
                  <>
                     <div className="bg-slate-700/50 p-3 rounded border border-slate-600 hover:bg-slate-700 transition cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-indigo-300">Acetaminophen (타이레놀)</span>
                        </div>
                        <div className="text-sm text-slate-300 mb-1">해독: <span className="font-bold text-white">N-acetylcysteine (NAC)</span></div>
                        <div className="text-xs text-slate-400">초기 부하용량: <span className="font-bold text-emerald-400">{weight * 150} mg</span> (체중 {weight}kg 적용)</div>
                     </div>
                     <div className="bg-slate-700/50 p-3 rounded border border-slate-600 hover:bg-slate-700 transition cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-indigo-300">Benzodiazepines (수면제)</span>
                        </div>
                        <div className="text-sm text-slate-300 mb-1">해독: <span className="font-bold text-white">Flumazenil</span></div>
                        <div className="text-xs text-slate-400">0.2mg 정맥주사 발현 확인 후 증량</div>
                     </div>
                     <div className="bg-slate-700/50 p-3 rounded border border-slate-600 hover:bg-slate-700 transition cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-indigo-300">Opioids (마약성 진통제)</span>
                        </div>
                        <div className="text-sm text-slate-300 mb-1">해독: <span className="font-bold text-white">Naloxone</span></div>
                        <div className="text-xs text-slate-400">0.4 ~ 2.0mg IV 반복</div>
                     </div>
                  </>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}