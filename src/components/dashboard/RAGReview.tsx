'use client';
import { useState } from 'react';

export default function RAGReview() {
  const [fileList, setFileList] = useState<string[]>(['대한류마티스학회_관절염가이드.pdf', '병원_자체항생제_처방매뉴얼.docx']);
  const [chatLog, setChatLog] = useState<{role:string, text:string, source?:string}[]>([
     { 
       role: 'ai', 
       text: '원장님께서 업로드하신 병원 자체 지침 및 최신 논문을 바탕으로 질의응답이 가능합니다. 예: "우리 병원 항생제 1차 처방 기준이 뭐야?"'
     }
  ]);
  const [query, setQuery] = useState('');

  return (
    <div className="w-full  flex flex-col md:flex-row gap-6 h-[calc(100vh-150px)]">
      
      {/* 좌측: 문서 업로드 및 관리 (RAG 소스) */}
      <div className="w-full md:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-slate-200. flex flex-col">
         <h2 className="text-lg font-extrabold text-indigo-800 mb-2 flex items-center gap-2">
           <span className="text-xl">️</span> 내 병원 RAG 지식베이스
         </h2>
         <p className="text-xs text-slate-500 mb-4">
           원장님만의 임상 매뉴얼이나 논문 PDF를 올리면, AI가 이 내용 안에서만 '환각 없이' 답변합니다.
         </p>
         
         <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl p-6 text-center cursor-pointer hover:bg-indigo-50 transition mb-6">
            <div className="text-2xl mb-2"></div>
            <div className="text-sm font-bold text-indigo-700">PDF, Word, TXT 업로드</div>
            <div className="text-xs text-indigo-400 mt-1">파일을 드래그하거나 클릭하여 업로드</div>
         </div>
         
         <h3 className="text-sm font-bold text-slate-700 mb-3">현재 로드된 문서</h3>
         <div className="flex-1 overflow-y-auto space-y-2">
            {fileList.map((file, i) => (
               <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-lg hover:border-indigo-200 transition">
                  <div className="flex items-center gap-2 overflow-hidden">
                     <span className="text-red-500 font-bold text-xs">{file.endsWith('pdf') ? 'PDF' : 'DOC'}</span>
                     <span className="text-sm text-slate-700 font-medium truncate">{file}</span>
                  </div>
                  <button className="text-slate-400 hover:text-red-500 text-xs ml-2">삭제</button>
               </div>
            ))}
         </div>
      </div>

      {/* 우측: 타 병원 검사 결과지 판독 + 커스텀 챗봇 */}
      <div className="w-full md:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <span className="text-xl"></span> RAG 커스텀 챗봇 & 결과지 판독
            </h2>
            <button 
               onClick={async () => {
                  setChatLog(prev => [...prev, {role:'user', text: '[결과지 사진 업로드 완료] 본 결과지의 주요 이상 수치를 파악하고 환자 상담용 멘트를 작성해줘'}]);
                  try {
                     const res = await fetch('/api/ask', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: '건강검진 피검사 결과지에서 AST 112, ALT 185의 의미를 환자용으로 매우 쉽게 풀어서 설명해주는 문장을 작성해줘. "textbook" 블록 타입 하나만 리턴해.' })
                     });
                     if (res.ok) {
                        const data = await res.json();
                        setChatLog(prev => [...prev, {role: 'ai', text: data.chat_reply || data.blocks?.[0]?.body || '간 수치가 높게 나왔습니다. 의사와 상담하세요.'}]);
                     }
                  } catch (e) {
                     setChatLog(prev => [...prev, {role:'ai', text:'분석 실패'}]);
                  }
               }}
               className="text-xs font-bold px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700">
               타 병원 결과지 사진 올리기 
            </button>
         </div>

         {/* 챗 로그 */}
         <div className="flex-1 overflow-y-auto p-2 space-y-4 mb-4">
            {chatLog.map((log, idx) => (
               <div key={idx} className={`flex ${log.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${log.role === 'ai' ? 'bg-slate-50 border border-slate-200 rounded-tl-none' : 'bg-indigo-600 text-white rounded-tr-none'}`}>
                     <div className="text-sm leading-relaxed whitespace-pre-wrap">{log.text}</div>
                     {log.source && (
                        <div className="mt-3 p-2 bg-white rounded border border-indigo-100 text-xs text-indigo-700">
                           <span className="font-bold">출처:</span> {log.source}
                        </div>
                     )}
                  </div>
               </div>
            ))}
         </div>

         {/* 입력창 */}
         <div className="flex gap-2">
            <input 
               type="text"
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                     document.getElementById('rag-send-btn')?.click();
                  }
               }}
               className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               placeholder="문서에 대한 질문이나 결과지 해석을 요청하세요."
            />
            <button 
               id="rag-send-btn"
               className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-sm"
               onClick={async () => {
                  if(!query.trim()) return;
                  
                  const currentQuery = query;
                  setQuery('');
                  setChatLog(prev => [...prev, {role:'user', text: currentQuery}]);
                  
                  try {
                     const res = await fetch('/api/rag', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: currentQuery })
                     });
                     
                     if (res.ok) {
                        const data = await res.json();
                        setChatLog(prev => [...prev, {
                           role: 'ai', 
                           text: data.answer, 
                           source: data.sources && data.sources.length > 0 ? data.sources.map((s:any) => s.title).join(', ') : ''
                        }]);
                     } else {
                        setChatLog(prev => [...prev, {role: 'ai', text: '죄송합니다. RAG 서버 처리 중 오류가 발생했습니다.'}]);
                     }
                  } catch (err) {
                     setChatLog(prev => [...prev, {role: 'ai', text: '네트워크 연결 오류입니다.'}]);
                  }
               }}
            >
               전송
            </button>
         </div>
      </div>

    </div>
  );
}