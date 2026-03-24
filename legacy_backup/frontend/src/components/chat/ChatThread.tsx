"use client";

import { useChatStore } from "../../stores/chatStore";

export default function ChatThread({ sessionId }: { sessionId: string | null }) {
  const { messages } = useChatStore();
  
  if (!sessionId) return <div className="text-gray-400 text-sm text-center mt-10">대화를 선택해주세요.</div>;

  const currentMessages = messages[sessionId] || [];

  if (currentMessages.length === 0) return (
    <div className="text-center mt-20">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">무엇을 도와드릴까요, 원장님?</h2>
      <p className="text-gray-500">질환, 약품검색, 사진 판독을 자유롭게 입력해주세요.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {currentMessages.map((msg, idx) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'w-full text-gray-800'}`}>
            {msg.role === 'user' ? (
              <p>{msg.content}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {/* AI 응답 요약 */}
                <div className="text-blue-600 font-medium mb-3">{msg.content}</div>
                {/* 블록 렌더링 */}
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
                  if(blk.block_type === 'journal') return (
                    <div key={bIdx} className="border border-green-100 rounded-lg p-5 bg-white shadow-sm">
                      <h3 className="font-bold flex items-center text-green-900 mb-3 border-b pb-2">🔬 {blk.title}</h3>
                      {blk.journals?.map((j: any, jIdx: number) => (
                        <div key={jIdx} className="text-sm border-l-4 border-green-400 pl-3 py-1 mb-2 bg-green-50/50">
                          <div className="font-semibold text-gray-800">{j.title}</div>
                          <div className="text-gray-500 text-xs mt-1">{j.journal_name} ({j.publication_date})</div>
                        </div>
                      ))}
                    </div>
                  );
                  if(blk.block_type === 'doctor_consensus') return (
                    <div key={bIdx} className="border border-amber-100 rounded-lg p-5 bg-amber-50">
                      <h3 className="font-bold flex items-center text-amber-900 mb-3 border-b border-amber-200 pb-2">👨‍⚕️ {blk.title} <span className="text-xs bg-amber-200 px-2 py-0.5 ml-2 rounded-full">실시간 요약</span></h3>
                      <p className="text-sm text-gray-700 mb-3">{blk.summary}</p>
                      <div className="flex gap-4">
                        <div className="text-sm font-semibold flex items-center gap-1 text-blue-600">👍 추천 {blk.like_count}</div>
                        <div className="text-sm font-semibold flex items-center gap-1 text-red-500">👎 반대 {blk.dislike_count}</div>
                      </div>
                    </div>
                  );
                  if(blk.block_type === 'doctor_opinion') return (
                    <div key={bIdx} className="border border-gray-200 rounded-lg p-5 bg-gray-50">
                      <h3 className="font-bold flex items-center text-gray-700 mb-3 border-b pb-2">💬 {blk.title || '의사 코멘트'}</h3>
                      {blk.opinions?.map((op: any, oIdx: number) => (
                        <div key={oIdx} className="bg-white border rounded p-3 mb-2 flex flex-col gap-1 shadow-sm">
                          <div className="text-xs text-blue-600 font-bold">{op.specialty}</div>
                          <div className="text-sm text-gray-700">{op.opinion_text}</div>
                          <div className="text-xs text-gray-400 text-right">공감 {op.likes}</div>
                        </div>
                      ))}
                    </div>
                  );
                  if(blk.block_type === 'drug_cards') return (
                    <div key={bIdx} className="border border-blue-200 rounded-lg p-5 bg-white shadow-sm">
                      <h3 className="font-bold flex items-center text-blue-900 mb-3 border-b pb-2">💊 {blk.title || '약품 비교/검색'}</h3>
                      <div className="space-y-3">
                        {blk.items?.map((item: any, iIdx: number) => (
                          <div key={iIdx} className="p-3 border rounded-md flex justify-between items-center bg-gray-50/50">
                            <div>
                              <div className="font-bold text-gray-800 text-sm">{item.product_name}</div>
                              <div className="text-xs text-gray-500">{item.ingredient_name} · {item.manufacturer}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-blue-700">{item.insurance_price ? `₩${item.insurance_price}` : '비급여'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                  if(blk.block_type === 'interaction_warning') return (
                    <div key={bIdx} className="border border-red-200 rounded-lg p-4 bg-red-50 mt-2">
                       <h3 className="font-bold flex items-center text-red-700 mb-2">⚠️ 병용/안전 주의 (DUR)</h3>
                       <div className="text-sm text-red-800 font-medium">병용 금기/주의 성분이 포함되어 있습니다.</div>
                       {blk.interactions?.map((warn:any, wIdx:number) => (
                          <div key={wIdx} className="text-xs text-red-700 mt-1">- {warn.summary || warn.recommendation}</div>
                       ))}
                    </div>
                  );
                  if(blk.block_type === 'insurance_warning') return (
                    <div key={bIdx} className="border border-orange-200 rounded-lg p-4 bg-orange-50 mt-2">
                       <h3 className="font-bold flex items-center text-orange-700 mb-2">💸 심평원 삭감/보험 주의</h3>
                       <div className="text-sm text-orange-900">{blk.summary || '해당 약품들의 조합 또는 연령금기 상 삭감 위험이 존재합니다.'}</div>
                    </div>
                  );
                  if(blk.block_type === 'imaging_result') return (
                    <div key={bIdx} className="border border-purple-200 rounded-lg p-5 bg-white shadow-sm">
                      <h3 className="font-bold flex items-center text-purple-900 mb-3 border-b pb-2">🖼️ 영상 판독 소견 (AI)</h3>
                      <div className="text-sm text-purple-800 font-medium mb-2">{blk.summary || '병변 의심 소견이 발견되었습니다.'}</div>
                      <ul className="text-sm text-gray-700 list-disc pl-5">
                         {blk.sections?.map((sec:any, sIdx:number) => <li key={sIdx}>{sec.content}</li>)}
                      </ul>
                      <div className="text-xs text-gray-500 mt-3">* 본 판독은 의사의 최종 확인이 필수입니다 (참고용).</div>
                    </div>
                  );
                  if(blk.block_type === 'recruiting_card') return (
                    <div key={bIdx} className="border border-emerald-200 rounded-lg p-5 bg-white shadow-sm">
                      <h3 className="font-bold flex items-center text-emerald-900 mb-3 border-b pb-2">🤝 유망 초기/구직 공고</h3>
                      <div className="space-y-3">
                        {blk.items?.map((item: any, iIdx: number) => (
                          <div key={iIdx} className="p-3 border rounded-md hover:border-emerald-300 transition-colors bg-emerald-50/20 cursor-pointer">
                            <div className="font-bold text-gray-800 text-sm mb-1">{item.title || item.product_name}</div>
                            <div className="text-xs text-gray-600 flex justify-between">
                               <span>{item.manufacturer || '지역 병원'}</span>
                               <span className="font-medium text-emerald-600">지원하기 ➔</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                  return null;
                })}
                {/* 액션 바 */}
                <div className="flex items-center gap-2 mt-2 pt-4 border-t border-gray-100">
                  <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-600 transition-colors">저장</button>
                  <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-600 transition-colors">복사</button>
                  <div className="flex-1"></div>
                  <button className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium transition-colors">내 의견 남기기</button>
                  <button className="px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded text-xs transition-colors">👍</button>
                  <button className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded text-xs transition-colors">👎</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}