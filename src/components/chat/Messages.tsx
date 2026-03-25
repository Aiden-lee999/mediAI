"use client";

import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Messages({ sessionId }: { sessionId: string | null }) {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['chatMessages', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const res = await fetch(`/api/conversations/${sessionId}/messages`);
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 2000 // Poll for updates every 2s
  });

  if (!sessionId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-20">
        <div className="text-4xl">🤖</div>
        <p className="font-medium">좌측에서 새 대화를 시작하거나 기존 대화를 선택해주세요.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-10 text-center text-gray-400">대화 내용을 불러오는 중...</div>;
  }

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">
      {messages?.length === 0 && (
        <div className="text-center py-20 text-gray-400">
           아직 대화가 없습니다. 질문을 입력해보세요!
        </div>
      )}
      {messages?.map((msg: any) => (
        <div key={msg.id} className={`flex gap-4 p-4 rounded-xl ${msg.role === 'USER' ? 'flex-row-reverse' : 'bg-white shadow-sm border border-gray-100'}`}>
          <div className={`w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center font-bold text-sm ${msg.role === 'USER' ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'}`}>
            {msg.role === 'USER' ? '나' : 'AI'}
          </div>
          <div className={`flex-1 prose prose-sm max-w-none ${msg.role === 'USER' ? 'text-right' : ''}`}>
            {msg.role === 'USER' ? (
               <div className="inline-block bg-blue-50 text-gray-800 px-4 py-2 rounded-2xl rounded-tr-sm shadow-sm whitespace-pre-wrap">{msg.content}</div>
            ) : (
               <div className="text-gray-800">
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
                   {msg.content}
                 </ReactMarkdown>
               </div>
            )}
            
            {msg.role === 'AI' && msg.sources && msg.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                 <span className="text-xs font-bold text-gray-400 my-auto mr-1">📚 근거/출처:</span>
                 {msg.sources.map((s: any, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700 cursor-pointer hover:bg-green-100 font-semibold" title={s.snippet}>
                      🔗 {s.title}
                    </span>
                 ))}
                 <div className="w-full mt-2 flex justify-end gap-2">
                    <button className="text-xs flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100">
                      🔖 북마크
                    </button>
                    <button className="text-xs flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100">
                      🏷️ 태그 추가
                    </button>
                    <button className="text-xs flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100">
                      ✍️ 피드백 남기기
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
