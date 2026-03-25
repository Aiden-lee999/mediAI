"use client";

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import ChatThread from './ChatThread';
import Composer from './Composer';

export default function AppShell() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const { data: sessions } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: async () => {
      // Mock data for initial rendering
      return [{ session_id: '1', title: '고혈압 약제 부작용 비교', updated_at: new Date() }];
    }
  });

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10 w-[280px]">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-2xl font-black text-blue-700 tracking-tight flex items-center gap-2">
            <span className="text-xl">⚕️</span> mediAI
          </h1>
          <p className="text-xs text-gray-400 mt-1 ml-1 font-medium">의사 전용 집단지성 AI 업무 플랫폼</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button 
            onClick={() => setActiveSessionId('new_' + Date.now())}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center mb-6 shadow-sm transition-transform active:scale-95"
          >
            + 새 대화 시작
          </button>

          <div className="text-xs font-bold text-gray-400 mb-2 mt-4 ml-1 uppercase tracking-wider">최근 세션</div>
          {sessions?.map((s: any) => (
            <button
              key={s.session_id}
              onClick={() => setActiveSessionId(s.session_id)}
              className={`w-full text-left p-3 rounded-lg cursor-pointer text-sm font-medium truncate transition-colors ${activeSessionId === s.session_id ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-gray-600 hover:bg-gray-100 border border-transparent'}`}
            >
              💬 {s.title}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-full bg-blue-200 font-bold text-blue-700 flex items-center justify-center">의사</div>
             <div>
                <div className="text-sm font-bold">김닥터 원장님</div>
                <div className="text-xs text-gray-500">내과 전문의 (마이페이지)</div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col bg-white relative">
        <header className="h-[60px] border-b border-gray-100 flex items-center px-6 bg-white justify-between shrink-0">
          <div className="flex space-x-6">
            <span className="text-sm font-bold text-blue-600 border-b-2 border-blue-600 pb-[19px] pt-1 pt-4">🤖 통합 질의 (Chat)</span>
            <span className="text-sm font-medium text-gray-500 hover:text-gray-800 cursor-pointer pt-4">📄 환자 설명문 생성</span>
            <span className="text-sm font-medium text-gray-500 hover:text-gray-800 cursor-pointer pt-4">🌐 다국어 번역 안내</span>
            <span className="text-sm font-medium text-gray-500 hover:text-gray-800 cursor-pointer pt-4">⚙️ 내부 지식 관리(RAG)</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 bg-gray-50/50 scroll-smooth">
          <ChatThread sessionId={activeSessionId} />
        </div>

        <div className="bg-white border-t border-gray-100 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-10 px-4 sm:px-6 md:px-10 pt-4 pb-6">
          <Composer sessionId={activeSessionId} />
          <div className="text-center mt-3 text-[11px] text-gray-400 font-medium">
             mediAI는 진단을 보조하는 도구이며, 최종 결정은 전문의의 소견을 따릅니다.
          </div>
        </div>
      </main>
    </div>
  );
}
