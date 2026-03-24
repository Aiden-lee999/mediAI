"use client";

import { useState } from 'react';
import { Send, Image as ImageIcon, Paperclip } from 'lucide-react';
import axios from 'axios';
import { useChatStore } from '../../stores/chatStore';

export default function Composer({ sessionId }: { sessionId: string | null }) {
  const [text, setText] = useState("");
  const { addMessage } = useChatStore();

  const handleSend = async () => {
    if (!text.trim() || !sessionId) return;
    
    // 유저 메시지 먼저 화면에 그림
    addMessage(sessionId, { id: 'user_'+Date.now(), role: 'user', content: text });
    
    const currentText = text;
    setText("");

    try {
      // 1. 의도 분석
      const intentRes = await axios.post('http://localhost:5000/api/v1/ai/route-intent', { content: currentText });
      
      // 2. 답변 생성 요청
      const res = await axios.post('http://localhost:5000/api/v1/ai/generate-response', { 
        session_id: sessionId, 
        message_id: 'msg_'+Date.now(),
        intents: intentRes.data.data.intents
      });

      // AI 메시지 화면에 그림
      addMessage(sessionId, { 
        id: res.data.data.response_id, 
        role: 'assistant', 
        content: res.data.data.summary_text,
        blocks: res.data.data.blocks
      });

    } catch (e) {
      console.error(e);
      addMessage(sessionId, { id: 'err_'+Date.now(), role: 'assistant', content: "서버 응답 오류입니다."});
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full relative">
      <div className="bg-white border rounded-2xl shadow-sm p-3 focus-within:ring-2 ring-blue-500/20 transition-all flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="질환명, 증상, 약품, 판독할 영상을 입력하세요... (예: 심부전 처방 가이드라인)"
          className="w-full resize-none outline-none max-h-48 min-h-[60px] text-gray-800 placeholder-gray-400 bg-transparent text-[15px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-2 text-gray-400">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ImageIcon size={18} /></button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Paperclip size={18} /></button>
          </div>
          <button 
            onClick={handleSend}
            disabled={!text.trim()}
            className={`p-2 rounded-full transition-all ${text.trim() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 mt-2">
         최종 판단은 담당 의사가 내려야 하며 AI는 책임을 지지 않습니다.
      </div>
    </div>
  );
}