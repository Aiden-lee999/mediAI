"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import ChatThread from './ChatThread';
import Composer from './Composer';

export default function AppShell() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // 채팅 세션 목록 가져오기 (가상)
  const { data: sessions } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: async () => {
      // return axios.get('http://localhost:5000/api/v1/chat/sessions').then(res => res.data);
      return [{ session_id: '1', title: '고혈압 약 비교', updated_at: new Date() }];
    }
  });

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar (Conversations) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-blue-600">AI MD넷</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button className="w-full py-2 px-4 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100 flex items-center justify-center mb-4">
            + 새 대화
          </button>
          
          <div className="text-xs font-semibold text-gray-400 mb-2 mt-4 ml-1">최근 대화</div>
          {sessions?.map(s => (
            <div 
              key={s.session_id} 
              className="p-3 rounded-md hover:bg-gray-100 cursor-pointer text-sm font-medium truncate bg-gray-100"
            >
              {s.title}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-white">
        <header className="h-14 border-b border-gray-100 flex items-center px-6 bg-white justify-between">
          <div className="font-semibold text-gray-700">새로운 질환/약품/영상 검색</div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <ChatThread sessionId={activeSessionId} />
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
          <Composer sessionId={activeSessionId} />
        </div>
      </main>
    </div>
  );
}