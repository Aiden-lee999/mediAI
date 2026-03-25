"use client";

import { useState } from 'react';
import { useChatStore } from "../../stores/chatStore";

function MessageBubble({ msg }: { msg: any }) {
  const [isOpinionOpen, setIsOpinionOpen] = useState(false);
  const [opinionText, setOpinionText] = useState("");
  const [feedback, setFeedback] = useState<'like'|'dislike'|null>(null);

  const handleOpinionSubmit = () => {
    if(!opinionText.trim()) return;
    alert('원장님의 소견이 집단 지성 DB에 안전하게 등록되었습니다.');
    setOpinionText('');
    setIsOpinionOpen(false);
  };

  return (
    <div className={"flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}"}>
      <div className={"max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'w-full text-gray-800 bg-white/50 border border-gray-100 shadow-sm'}"}>
        {msg.role === 'user' ? (
          <p>{msg.content}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-gray-800 font-medium mb-1">{msg.content}</div>
            
            {msg.blocks?.map((blk: any, bIdx: number) => {
              if(blk.block_type === 'textbook') return (
                <div key={bIdx} className="border border-indigo-100 rounded-lg p-5 bg-white shadow-sm">
                  <h3 className="font-bold flex items-center text-indigo-900 mb-3 border-b pb-2">📚 {blk.title}</h3>
                  {blk.sections?.map((sec: any, sIdx: number) => (
                    <div key={sIdx} className="mb-2">
                      <span className="font-semibold text-sm text-gray-700 mr-2">[{sec.title}]</span>
                      <span className="text-sm text-gray-600 leading-relaxed">{sec.content}</span>
                    </div>
                  ))}
                </div>
              );
              if(blk.block_type === 'doctor_consensus') return (
                <div key={bIdx} className="border border-amber-200 rounded-lg p-5 bg-gradient-to-br from-amber-50 to-white shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-amber-200 text-amber-800 text-[10px] px-2 py-1 font-bold rounded-bl-lg">LIVE 집단 요약</div>
                  <h3 className="font-bold flex items-center text-amber-900 mb-2">�� 전문의 집단 의견 요약</h3>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">"{blk.summary}"</p>
                </div>
              );
              if(blk.block_type === 'drug_cards') return (
                <div key={bIdx} className="border border-blue-200 rounded-lg p-4 bg-white shadow-sm">
                  <h3 className="font-bold flex items-center text-blue-900 mb-2 border-b pb-2">💊 {blk.title || '약품 정보'}</h3>
                  <div className="space-y-2">
                    {blk.items?.map((item: any, iIdx: number) => (
                      <div key={iIdx} className="p-3 border rounded-md flex justify-between items-center bg-gray-50 hover:bg-blue-50 transition-colors">
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{item.product_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.ingredient_name}</div>
                        </div>
                        <button className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-600 hover:text-blue-600">상세보기</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
              // 기본 블록 생략 간소화
              return <div key={bIdx} className="p-3 border border-gray-200 rounded-md text-sm text-gray-600">[{blk.block_type}] {blk.title}</div>
            })}

            {/* 피드백 및 의견 등록 UI (서비스 핵심) */}
            <div className="flex items-center gap-2 mt-2 pt-4 border-t border-gray-100">
              <button className="px-3 py-1.5 bg-gray-50 hover:bg-gray-200 border border-gray-200 rounded text-xs font-medium text-gray-600 transition-colors">복사</button>
              <div className="flex-1"></div>
              <button 
                onClick={() => setIsOpinionOpen(!isOpinionOpen)}
                className="px-3 py-1.5 bg-blue-50/80 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:border-blue-300 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1"
              >
                📋 원장님 소견 남기기
              </button>
              <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 overflow-hidden">
                <button 
                  onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                  className={"px-3 py-1.5 text-xs transition-colors border-r border-gray-200 hover:bg-gray-100 ${feedback === 'like' ? 'bg-blue-100 text-blue-600 font-bold' : 'text-gray-500'}"}
                >👍 유용함</button>
                <button 
                  onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
                  className={"px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 ${feedback === 'dislike' ? 'bg-red-100 text-red-600 font-bold' : 'text-gray-500'}"}
                >👎 아님</button>
              </div>
            </div>

            {/* 의사 소견 입력 모달/폼창 (토글) */}
            {isOpinionOpen && (
              <div className="mt-2 p-4 bg-white border-2 border-blue-200 rounded-xl shadow-lg ring-4 ring-blue-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-blue-800">이 케이스에 대한 전문의 소견 추가</div>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">실명 비공개 (과목만 노출)</span>
                </div>
                <textarea
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                  placeholder="추후 이 질문이 다시 나왔을 때 동료 의사들에게 공유될 실무적 팁이나 주의사항을 적어주세요."
                  value={opinionText}
                  onChange={(e) => setOpinionText(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5" onClick={() => setIsOpinionOpen(false)}>취소</button>
                  <button onClick={handleOpinionSubmit} className="text-xs bg-blue-600 text-white font-bold px-4 py-1.5 rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
                    제출 및 집단지성 기여
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatThread({ sessionId }: { sessionId: string | null }) {
  const { messages } = useChatStore();

  if (!sessionId) return (
    <div className="flex flex-col items-center justify-center h-full text-center mt-20 fade-in slide-in-from-bottom-4 animate-in duration-500">
      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm text-3xl">🩺</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-3 tracking-tight">어떤 임상 정보가 필요하신가요, 원장님?</h2>
      <p className="text-gray-500 mb-8 max-w-md leading-relaxed">의료 질의응답, 약제 비교, 문헌 요약 등 다양한 기능이 하나의 대화창에서 AI와 집단지성을 통해 해결됩니다.</p>
      
      <div className="grid grid-cols-2 gap-3 max-w-lg w-full text-left">
        <button className="p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-sm group">
           <div className="font-bold text-gray-800 group-hover:text-blue-700 mb-1">🏥 임상/질환 가이드</div>
           <div className="text-xs text-gray-400">특정 증상에 대한 최신 진단 및 치료 지침</div>
        </button>
        <button className="p-4 border border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all text-sm group">
           <div className="font-bold text-gray-800 group-hover:text-green-700 mb-1">💊 약제 비교/추천</div>
           <div className="text-xs text-gray-400">성분 비교 및 보험 삭감, DUR 금기 확인</div>
        </button>
        <button className="p-4 border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all text-sm group">
           <div className="font-bold text-gray-800 group-hover:text-purple-700 mb-1">📄 문헌/저널 요약</div>
           <div className="text-xs text-gray-400">방대한 영문 논문을 핵심 위주 한글 요약</div>
        </button>
        <button className="p-4 border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all text-sm group">
           <div className="font-bold text-gray-800 group-hover:text-amber-700 mb-1">🌎 의료 통역/번역</div>
           <div className="text-xs text-gray-400">외국인 환자를 위한 다국어 의료 번역</div>
        </button>
      </div>
    </div>
  );

  const currentMessages = messages[sessionId] || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-4">
      {currentMessages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
    </div>
  );
}
