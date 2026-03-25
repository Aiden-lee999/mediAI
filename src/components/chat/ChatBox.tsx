"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function ChatBox({ sessionId }: { sessionId: string | null }) {
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: content, sessionId })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', sessionId] });
      setContent('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !sessionId || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const insertTemplate = (type: string) => {
    if (type === 'compare') {
      setContent('약제 변경/비교 템플릿:\n- 기존 약제: [약제A]\n- 변경 고려 약제: [약제B]\n- 환자 상태: [신장/간 기능 등]\n- 질문: 부작용 및 변경 시 주의사항을 문헌 기반으로 비교해주세요.');
    } else if (type === 'summarize') {
      setContent('논문/가이드라인 요약 템플릿:\n- 문서/주제명: [주제]\n- 포커스: [주요 결과, 처방 지침 등]\n- 질문: 위 주제에 대한 최신 업데이트 사항을 3줄로 요약해주세요.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto mb-4">
      <div className="flex gap-2 mb-2 px-2">
        <span className="text-xs font-bold text-gray-500 my-auto p-1">간편 템플릿:</span>
        <button onClick={() => insertTemplate('compare')} className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-full font-medium transition cursor-pointer">
          💊 약제 비교 전용 템플릿
        </button>
        <button onClick={() => insertTemplate('summarize')} className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full font-medium transition cursor-pointer">
          📄 최신 지침 요약 템플릿
        </button>
      </div>

    <form onSubmit={handleSubmit} className="relative rounded-2xl shadow-sm border border-gray-200 bg-white group focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={sessionId ? "의학 논문 검색, 환자 케이스 분석, 다국어 번역 안내문 작성 등 질문을 입력하세요..." : "대화를 시작하려면 먼저 새 대화 세션을 생성해주세요."}
        disabled={!sessionId || sendMessageMutation.isPending}
        className="w-full resize-none bg-transparent pt-4 pb-14 px-5 focus:outline-none min-h-[100px] text-gray-800 placeholder-gray-400 placeholder:font-light"
      />
      
      <div className="absolute bottom-3 right-3 flex items-center space-x-2">
        <div className="text-[10px] text-gray-300 font-medium hidden sm:block mr-2">
           Shift + Enter로 줄바꿈
        </div>
        <button
          type="submit"
          disabled={!content.trim() || !sessionId || sendMessageMutation.isPending}
          className="bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-bold shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          {sendMessageMutation.isPending ? '분석 중...' : '보내기'}
        </button>
      </div>
    </form>
    </div>
  );
}
