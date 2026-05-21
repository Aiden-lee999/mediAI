'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import DrugSearch from '@/components/dashboard/DrugSearch';
import PrescribeGuide from '@/components/dashboard/PrescribeGuide';
import RAGReview from '@/components/dashboard/RAGReview';
import Emergency from '@/components/dashboard/Emergency';
import LegalReview from '@/components/dashboard/LegalReview';
import TranslateMCA from '@/components/dashboard/TranslateMCA';
import SettingsMyPage from '@/components/dashboard/SettingsMyPage';
import RecruitMatch from '@/components/dashboard/RecruitMatch';

// ==========================================
// 1. 하위 컴포넌트: 인터랙티브 약물 정렬 테이블
// ==========================================
function SortableDrugTable({ initialDrugs }: { initialDrugs: any[] }) {
  const uniqueDrugs = useMemo(() => {
    if (!initialDrugs) return [];
    
    const seen = new Set();
    return initialDrugs.filter((drug: any) => {
      const id = drug.name || drug.id || JSON.stringify(drug);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map((d:any) => ({
       ...d,
       price: d.price || d.insurance_price || d.금액 || d.약가 || '정보없음'
    }));
  }, [initialDrugs]);

  const [drugs, setDrugs] = useState([...uniqueDrugs]);    
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [isAsc, setIsAsc] = useState(true);

  const handleSort = (col: string) => {
    const newAsc = sortCol === col ? !isAsc : true;
    setSortCol(col);
    setIsAsc(newAsc);
    const sorted = [...drugs].sort((a, b) => {
      const valA = String(a[col] || '');
      const valB = String(b[col] || '');
      return newAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    setDrugs(sorted);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 mt-2 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-blue-600 text-white text-xs">
          <tr>
            <th className="p-2 cursor-pointer hover:bg-blue-700" onClick={() => handleSort('name')}>제품명 {sortCol === 'name' ? (isAsc ? '' : '') : ''}</th>
            <th className="p-2 cursor-pointer hover:bg-blue-700" onClick={() => handleSort('ingredient')}>성분명 {sortCol === 'ingredient' ? (isAsc ? '' : '') : ''}</th>
            <th className="p-2 cursor-pointer hover:bg-blue-700" onClick={() => handleSort('price')}>약가/구분 {sortCol === 'price' ? (isAsc ? '' : '') : ''}</th>
            <th className="p-2 cursor-pointer hover:bg-blue-700" onClick={() => handleSort('company')}>제약사 {sortCol === 'company' ? (isAsc ? '' : '') : ''}</th>
          </tr>
        </thead>
        <tbody>
          {drugs.map((d, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-blue-50 transition">
              <td className="p-2 font-bold text-blue-700">{d.name}</td>
              <td className="p-2 text-slate-600 text-xs">{d.ingredient}</td>
              <td className="p-2 text-xs">{d.price}<br /><span className="text-[10px] text-slate-400">{d.class || '전문의약품'}</span></td>
              <td className="p-2 text-slate-600 font-medium text-xs"> {d.company}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function convertImageFileToJpegDataUrl(file: File, maxSide = 1600, quality = 0.86) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 첨부할 수 있습니다.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
        const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('이미지 변환을 위한 Canvas를 초기화하지 못했습니다.');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이 이미지 형식은 브라우저에서 읽을 수 없습니다. JPG/PNG/WebP로 변환해 업로드해 주세요.'));
    };
    img.src = objectUrl;
  });
}

function messageToApiHistory(message: any) {
  if (message?.role === 'user') {
    const content = typeof message.content === 'string' ? message.content : '';
    const image = typeof message.image === 'string' && message.image.startsWith('data:image/') ? message.image : null;
    return content.trim() || image ? { role: 'user', content: content.trim() || '[첨부 이미지]', image, hasImage: Boolean(image) } : null;
  }

  const parsed = message?.parsedData;
  const blockText = Array.isArray(parsed?.blocks)
    ? parsed.blocks
        .map((block: any) => [block?.title, block?.body].filter(Boolean).join('\n'))
        .filter(Boolean)
        .join('\n\n')
    : '';
  const content = [parsed?.chat_reply, blockText, message?.content]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n\n');

  return content.trim() ? { role: 'assistant', content } : null;
}

function keepRecentHistoryImages(history: any[], maxImages = 1) {
  let remainingImages = maxImages;
  return history
    .slice()
    .reverse()
    .map((item) => {
      if (item?.role !== 'user' || !item.image) return item;
      if (remainingImages > 0) {
        remainingImages -= 1;
        return item;
      }
      const { image, ...rest } = item;
      return { ...rest, hasImage: true };
    })
    .reverse();
}

// ==========================================
// 2. 메인 대시보드 페이지
// ==========================================
export default function DashboardPage() {
  const [view, setView] = useState<string>('chat');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isOpinionModalOpen, setOpinionModalOpen] = useState(false);
  const [opinionText, setOpinionText] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState<{ msg: any; index: number } | null>(null);

  // 유저 컨텍스트
  const [user, setUser] = useState({ id: '', name: '김의사', specialty: '내과', points: 0 });

  // 채팅 상태
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [attachmentNotice, setAttachmentNotice] = useState('');
  
  // 히스토리/세션 관리
  const [currentSessionId, setCurrentSessionId] = useState<string>(`session_${Date.now()}`);
  const [sessions, setSessions] = useState<any[]>([]);
  const [savedLibrary, setSavedLibrary] = useState<any[]>([]);

  // 번역 대시보드 상태
  const [transInput, setTransInput] = useState('');
  const [transLang, setTransLang] = useState('en');
  const [transOutput, setTransOutput] = useState('');
  const [transNote, setTransNote] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSessionStorageKey = (userId?: string) => `medSessions:${userId || 'guest'}`;

  useEffect(() => {
     let storedUser: any = null;
     try {
       const rawUser = localStorage.getItem('med_user');
       storedUser = rawUser ? JSON.parse(rawUser) : null;
       if (storedUser?.id) {
         setUser(prev => ({ ...prev, id: storedUser.id, name: storedUser.name || prev.name, specialty: storedUser.specialty || prev.specialty }));
       }
     } catch {
       storedUser = null;
     }
     const userKey = getSessionStorageKey(storedUser?.id);
     // 초기 로드 시 로컬 스토리지 데이터 불러오기
     const localSessions = JSON.parse(localStorage.getItem(userKey) || '[]');
     const localLib = JSON.parse(localStorage.getItem('medLibrary') || '[]');
     if (localSessions.length > 0) setSessions(localSessions);
     if (localLib.length > 0) setSavedLibrary(localLib);

     // 서버에서 DB 세션 및 유저 정보(포인트 포함) 가져오기 (동기화)
     fetch(`/api/sessions?userId=${encodeURIComponent(storedUser?.id || '')}`)
       .then(r => r.json())
       .then(data => {
         if (data.sessions && data.sessions.length > 0) {
           setSessions(data.sessions);
         }
         // 유저 정보 처리
         if (data.user) {
           setUser(prev => ({ ...prev, id: data.user.id || prev.id, name: data.user.name || prev.name, specialty: data.user.specialty || prev.specialty, points: data.user.points }));
         }
       }).catch(e => console.error('DB 세션 로드 실패:', e));
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, view, transOutput]);

  // 전공 맞춤형 추천 검색어
  const suggestions = useMemo(() => {
    if (view === 'emergency') {
      return ['아나필락시스 쇼크 에피네프린 용량', '심정지 성인 ACLS 알고리즘 간단히', '소아 경련 환자 디아제팜 용량 계산', '급성 심근경색(AMI) 초기 대처법'];
    }
    if (view === 'legal') {
      return ['의료 기록 법적 책임 사례', '마취 사고 의사 과실 판례', '비급여 진료비 환불 소송', '설명의무 위반 배상 사례'];
    }
    if (user.specialty === '내과') return ['2형 당뇨 1차 처방 최신 가이드라인', '고혈압 약제 동시 처방 주의사항', '복부 X-ray 판독해줘'];
    if (user.specialty === '피부과') return ['여드름 이소트레티노인 부작용 및 설명', '아토피 피부염 최신 초진 가이드'];
    return ['상기도 감염 항생제 처방 기준 알려줘', '첨부한 영상 판독해줘', '의료법 위반 관련 판례 찾아줘'];
  }, [user.specialty, view]);

  const handleCreateNewChat = () => {
    // If not in a chat-capable view, default to 'chat'
    if (view !== 'chat' && view !== 'emergency' && view !== 'legal') {
      setView('chat');
    }
    setMessages([]);
    setAttachmentBase64(null);
    setAttachmentNotice('');
    setCurrentSessionId(`session_${Date.now()}`);
    if(window.innerWidth < 768) setSidebarOpen(false);
  };

  const loadSession = (sessionData: any) => {
    setView('chat');
    setCurrentSessionId(sessionData.id);
    setMessages(sessionData.history || []);
    if(window.innerWidth < 768) setSidebarOpen(false);
  };

  const findPromptForAssistant = (assistantIndex: number) => {
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') return messages[i]?.content || '';
    }
    return '';
  };

  const compactTrainingHistory = (untilIndex: number) => messages.slice(0, untilIndex + 1).map((item) => ({
    role: item.role,
    content: item.role === 'assistant' ? (item.parsedData?.chat_reply || item.content || '') : (item.content || ''),
    hasImage: Boolean(item.image),
  }));

  const submitTrainingFeedback = async (rating: 'LIKE' | 'DISLIKE' | 'COMMENT', msg: any, index: number, comment = '') => {
    const responseText = msg?.parsedData?.chat_reply || msg?.content || '';
    const prompt = findPromptForAssistant(index);
    const res = await fetch('/api/training-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        sessionId: currentSessionId,
        source: 'DASHBOARD_CHAT',
        rating,
        prompt,
        response: responseText,
        responseJson: msg?.parsedData || null,
        history: compactTrainingHistory(index),
        comment,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || '학습 피드백 저장 실패');
    if (typeof data.updatedPoints === 'number') setUser(prev => ({ ...prev, points: data.updatedPoints }));
    return data;
  };

  const deleteSession = async (sessionId: string) => {
    const filteredSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(filteredSessions);
    localStorage.setItem(getSessionStorageKey(user.id), JSON.stringify(filteredSessions));

    if (currentSessionId === sessionId) {
      setMessages([]);
      setAttachmentBase64(null);
      setAttachmentNotice('');
      setCurrentSessionId(`session_${Date.now()}`);
    }

    try {
      await fetch(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}&userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    } catch (error) {
      console.error('최근 기록 삭제 실패:', error);
    }
  };

  const clearAllSessions = async () => {
    if (sessions.length === 0) return;
    if (!window.confirm('최근 기록을 모두 삭제할까요?')) return;

    setSessions([]);
    setMessages([]);
    setAttachmentBase64(null);
    setAttachmentNotice('');
    setCurrentSessionId(`session_${Date.now()}`);
    localStorage.setItem(getSessionStorageKey(user.id), '[]');

    try {
      await fetch(`/api/sessions?all=true&userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    } catch (error) {
      console.error('전체 최근 기록 삭제 실패:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentNotice('이미지를 AI 분석용 JPEG로 변환 중입니다...');
    try {
      const converted = await convertImageFileToJpegDataUrl(file);
      setAttachmentBase64(converted);
      setAttachmentNotice('이미지가 첨부되었습니다. 서버 호환을 위해 JPEG로 자동 변환했습니다.');
    } catch (error: any) {
      setAttachmentBase64(null);
      setAttachmentNotice(error?.message || '이미지를 첨부하지 못했습니다. JPG/PNG/WebP 파일로 다시 시도해 주세요.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSendMessage = async (textToSearch: string) => {
    const targetText = textToSearch.trim();
    if (!targetText && !attachmentBase64) return;
    
    // Add implicit context based on the current view
    let contextualText = targetText;
    if (view === 'emergency') {
       contextualText = `[응급의료 모드] ${targetText}`;
    } else if (view === 'legal') {
       contextualText = `[의료법률 모드] ${targetText}`;
    }

    const latestContextImage = !attachmentBase64
      ? messages.slice().reverse().find((message) => message?.role === 'user' && message?.image)?.image
      : null;
    const userMsg = { role: 'user', content: contextualText, image: attachmentBase64 };
    const displayMsg = { role: 'user', content: targetText, image: attachmentBase64, reusedImageContext: Boolean(latestContextImage) }; // shown in UI without prefix
    
    const newHistory = [...messages, displayMsg];
    setMessages(newHistory);
    
    const currentQueryPayload = {
      query: targetText || "이미지/임상 분석",
      summary: "", // Will be filled after AI response
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    setChatInput('');
    setAttachmentBase64(null);
    setAttachmentNotice('');
    setIsThinking(true);

    try {
      const apiHistory = messages
        .map(messageToApiHistory)
        .filter(Boolean);
      const contextualHistory = keepRecentHistoryImages(apiHistory);

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, question: contextualText, history: contextualHistory, imageBase64: userMsg.image })
      });
      const data = await res.json();
      
      const assistantMsg = { role: 'assistant', content: data.chat_reply || '', parsedData: data };
      const finalizedHistory = [...newHistory, assistantMsg];
      setMessages(finalizedHistory);

      // 세션 저장
      currentQueryPayload.summary = data.chat_reply;
      const existingIdx = sessions.findIndex(s => s.id === currentSessionId);
      const newSessions = [...sessions];
      if (existingIdx >= 0) {
         newSessions[existingIdx].history = finalizedHistory;
         if (newSessions[existingIdx].title === "새로운 대화" && targetText) {
             newSessions[existingIdx].title = targetText.slice(0, 30); // clip too long titles
         }
      } else {
         newSessions.unshift({ id: currentSessionId, title: (targetText ? targetText.slice(0, 30) : "새로운 대화"), history: finalizedHistory, date: new Date().toLocaleDateString() });
      }
      setSessions(newSessions);
      localStorage.setItem(getSessionStorageKey(user.id), JSON.stringify(newSessions)); // 로그인 사용자별 로컬 캐시 유지

      // DB에 세션 저장 및 역사 동기화
      fetch('/api/sessions', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
          userId: user.id,
            id: currentSessionId,
            title: targetText ? targetText.slice(0, 30) : "새로운 대화",
            history: finalizedHistory
         })
      }).catch(e => console.error('DB 저장 실패:', e));

      // 최신 결과 페이로드 임시 저장 (라이브러리 추가용)
      (window as any).lastResultPayload = currentQueryPayload;

    } catch (error) {
      setMessages([...newHistory, { role: 'assistant', error: '서버 통신 오류가 발생했습니다.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleTranslate = async () => {
    if (!transInput.trim()) return;
    setTransOutput('번역 중입니다...');
    setTransNote('');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `다음 내용을 ${transLang}로 의학적 뉘앙스를 살려서 환자/보호자가 이해하기 쉽게 번역해줘:\n"${transInput}"` })
      });
      const data = await res.json();
      
      let transText = data.chat_reply;
      let noteText = '';
      if (data.blocks) {
         const tBlock = data.blocks.find((b:any) => b.block_type === 'translation');
         if (tBlock) {
             transText = tBlock.body;
             noteText = tBlock.meta_json?.clinical_note || '';
         }
      }
      setTransOutput(transText);
      setTransNote(noteText);
    } catch(e) {
      setTransOutput('번역 통신 오류가 발생했습니다.');
    }
  };

  const handleSaveToLibrary = () => {
      const payload = (window as any).lastResultPayload;
      if (!payload) { alert("저장할 최근 결과가 없습니다."); return; }
      
      const newLib = [payload, ...savedLibrary];
      setSavedLibrary(newLib);
      localStorage.setItem('medLibrary', JSON.stringify(newLib));
      alert("라이브러리에 성공적으로 저장되었습니다!");
  };

  // 블록 렌더링 엔진 (app.js 완벽 포팅)
  const renderBlock = (block: any, index: number) => {
    const { block_type, title, body, meta_json } = block;
    
    switch (block_type) {
      case 'textbook':
        return (
          <div key={index} className="bg-white border border-slate-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-2"> Textbook Knowledge (근거 기반 확정 지식)</h3>
            <div className="font-semibold text-sm mb-1">{title}</div>
            <div className="text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
      case 'journal':
        return (
          <div key={index} className="bg-green-50 border border-green-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-green-800 text-sm mb-2"> Latest Journals (최신 논문 및 가이드라인)</h3>
            <div className="font-semibold text-sm mb-1 text-green-900">{title}</div>
            <div className="text-sm text-green-800" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
      case 'md_tip':
        return (
          <div key={index} className="bg-purple-50 border border-purple-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-purple-800 text-sm mb-2"> MD 실무 Tip <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded ml-1"> 참고용</span></h3>
            <div className="font-semibold text-sm mb-1 text-purple-900">{title}</div>
            <div className="text-sm text-purple-800" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
      case 'doctor_consensus':
        return (
          <div key={index} className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-blue-800 text-sm mb-2"> 의사 집단 반응 요약 (AI 집계)</h3>
            <div className="flex gap-4 mb-2 text-xs font-medium">
              <span className="text-green-700"> 좋아요 {meta_json?.like_count || 0}</span>
              <span className="text-red-700"> 싫어요 {meta_json?.dislike_count || 0}</span>
              <span className="text-slate-600"> 의견 {meta_json?.feedback_count || 0}</span>
            </div>
            <div className="bg-white p-3 rounded text-sm text-slate-700 border border-blue-100">
               <strong>합의 요약:</strong> <span dangerouslySetInnerHTML={{ __html: body || meta_json?.summary || '' }} />
            </div>
          </div>
        );
      case 'doctor_opinion':
        return (
          <div key={index} className="bg-slate-50 border border-slate-300 p-4 rounded-lg mb-3 shadow-sm">
             <h3 className="font-bold text-slate-700 text-sm mb-3"> 의사 의견 <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">참고용</span></h3>
             {meta_json?.opinions?.map((op:any, i:number) => (
                <div key={i} className="bg-white border border-slate-200 rounded p-2 mb-2">
                   <div className="flex justify-between mb-1">
                      <span className="font-bold text-xs text-blue-700"> {op.specialty}</span>
                      <span className="text-xs text-slate-500"> {op.likes}</span>
                   </div>
                   <div className="text-sm text-slate-600">{op.content}</div>
                </div>
             ))}
             <button onClick={() => { setFeedbackTarget(null); setOpinionModalOpen(true); }} className="w-full border border-dashed border-slate-400 bg-transparent py-2 rounded text-slate-500 text-sm hover:bg-slate-100">+</button>
          </div>
        );
      case 'patient_context':
        return (
          <div key={index} className="bg-cyan-50 border border-cyan-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-cyan-900 text-sm mb-2">👤 환자 문맥 카드: {title}</h3>
            <div className="text-sm text-cyan-900 mb-3" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
            {meta_json?.context?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {meta_json.context.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg bg-white border border-cyan-100 p-2 text-xs">
                    <div className="font-black text-cyan-800">{item.label || item.key}</div>
                    <div className="mt-1 text-slate-700">{(item.values || []).join(', ')}</div>
                  </div>
                ))}
              </div>
            )}
            {meta_json?.open_questions?.length > 0 && (
              <div className="rounded-lg bg-white/80 p-2 text-xs text-cyan-900">
                <strong>추가 확인:</strong> {meta_json.open_questions.join(', ')}
              </div>
            )}
          </div>
        );
      case 'diagnosis_assist':
        return (
          <div key={index} className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-indigo-900 text-sm mb-2">🩺 진단 어시스트: {title}</h3>
            <div className="text-sm text-indigo-900 mb-3" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
            {meta_json?.differentials?.length > 0 && (
              <div className="space-y-2">
                {meta_json.differentials.map((dx: any, i: number) => (
                  <div key={i} className="rounded-lg bg-white border border-indigo-100 p-3 text-xs">
                    <div className="font-black text-indigo-800">{dx.diagnosis || `감별진단 ${i + 1}`}</div>
                    {dx.supporting && <div className="mt-1 text-slate-700">근거: {dx.supporting}</div>}
                    {dx.against && <div className="mt-1 text-slate-500">반대 근거: {dx.against}</div>}
                    {dx.next_step && <div className="mt-1 text-blue-700">다음 확인: {dx.next_step}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'radiology_checklist':
        return (
          <div key={index} className="bg-sky-50 border border-sky-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-sky-900 text-sm mb-2">🩻 영상 판독 체크리스트: {title}</h3>
            <div className="text-sm text-sky-900 mb-3" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-white border border-sky-100 p-3">
                <div className="font-black text-sky-800 mb-1">체계적 확인</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {(meta_json?.checklist || []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-lg bg-white border border-red-100 p-3">
                <div className="font-black text-red-700 mb-1">놓치면 안 되는 소견</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {(meta_json?.red_flags || []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        );
      case 'medication_safety':
        return (
          <div key={index} className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-emerald-900 text-sm mb-2">💊 약물 적응증·병용 안전성: {title}</h3>
            <div className="text-sm text-emerald-900 mb-3" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
            {meta_json?.medication_checks?.length > 0 && (
              <div className="space-y-2">
                {meta_json.medication_checks.map((check: any, i: number) => (
                  <div key={i} className="rounded-lg bg-white border border-emerald-100 p-3 text-xs">
                    <div className="font-black text-emerald-800">{check.drug || `약물 ${i + 1}`}</div>
                    {check.indication_fit && <div className="mt-1 text-slate-700">적응증: {check.indication_fit}</div>}
                    {check.avoid_with?.length > 0 && <div className="mt-1 text-red-700">피해야 할 조합: {check.avoid_with.join(', ')}</div>}
                    {check.pairs_well_with?.length > 0 && <div className="mt-1 text-blue-700">함께 고려 가능: {check.pairs_well_with.join(', ')}</div>}
                    {check.monitoring?.length > 0 && <div className="mt-1 text-amber-700">모니터링: {check.monitoring.join(', ')}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'legal_review':
        return (
          <div key={index} className="bg-yellow-50 border border-yellow-300 p-4 rounded-lg mb-3 shadow-sm">
            <h3 className="font-bold text-yellow-900 text-sm mb-2">⚖️ 진료 법률·분쟁 리스크 검토: {title}</h3>
            <div className="text-sm text-yellow-950 mb-3" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
            {meta_json?.legal_checks?.length > 0 && (
              <div className="space-y-2">
                {meta_json.legal_checks.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg bg-white border border-yellow-100 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-yellow-900">{item.issue || `체크포인트 ${i + 1}`}</span>
                      {item.risk && <span className="rounded-full bg-yellow-100 px-2 py-0.5 font-bold text-yellow-800">{item.risk}</span>}
                    </div>
                    {item.documentation && <div className="mt-1 text-slate-700">기록: {item.documentation}</div>}
                    {item.mitigation && <div className="mt-1 text-blue-700">예방 조치: {item.mitigation}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'insurance_warning':
        return (
          <div key={index} className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded-r-lg mb-3 shadow-sm">
            <strong className="text-amber-800 text-sm block mb-1"> [DDI / 보험 삭감 경고] {title}</strong>
            <div className="text-sm text-amber-900" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
      case 'expert_warning':
        return (
          <div key={index} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg mb-3 shadow-sm">
            <strong className="text-red-700 text-sm block mb-1"> [전문가 검토 필요] 확신도 낮음: {title}</strong>
            <div className="text-sm text-red-800" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
      case 'image_read':
      case 'ddx':
        return (
          <div key={index} className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-3 shadow-sm">
            <strong className="text-slate-800 text-sm block mb-2"> {title}</strong>
            <div className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
      case 'sponsor_card':
        return (
          <div key={index} className="bg-rose-50 border border-rose-200 p-3 rounded-lg mb-3 cursor-pointer hover:bg-rose-100 transition shadow-sm" onClick={() => window.open(meta_json?.link_url || '#', '_blank')}>
             <strong className="text-rose-700 text-sm block mb-1"> [Sponsor] {title}</strong>
             <span className="text-xs text-rose-900">{body}</span>
          </div>
        );
      case 'recruit_cards':
        return (
          <div key={index} className="mb-3">
             <h3 className="font-bold text-slate-700 text-sm mb-2"> {title || 'AI 맞춤 초빙 리스트'}</h3>
             {meta_json?.jobs?.map((j:any, i:number) => (
                <div key={i} className="bg-white border border-slate-200 rounded p-3 mb-2 shadow-sm">
                   <div className="flex justify-between items-start mb-1">
                      <strong className="text-blue-700 text-sm">{j.title}</strong>
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold">AI Match: {j.match_score}</span>
                   </div>
                   <div className="text-xs text-slate-500 mb-1">{j.hospital} | {j.type}</div>
                   <div className="text-xs text-slate-700">{j.detail}</div>
                </div>
             ))}
          </div>
        );
      case 'drug_cards':
        return (
          <div key={index} className="mb-3">
            <div className="text-xs text-slate-500 mb-2">{title || '의학 엔진 검색 반영 (테이블 헤더 클릭 시 정렬 가능)'}</div>
            <SortableDrugTable initialDrugs={meta_json?.drugs || []} />
          </div>
        );
      case 'prescription_options':
        return (
          <div key={index} className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-blue-900">{title || '추천 처방 옵션'}</h3>
            {body && <div className="mb-3 text-sm text-blue-900" dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br/>') }} />}
            <div className="space-y-3">
              {(meta_json?.prescriptions || []).map((rx: any, rxIndex: number) => (
                <div key={rxIndex} className="rounded-lg border border-blue-100 bg-white p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-blue-800">{rx.label || `추천 ${rxIndex + 1}`}</strong>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      총 약가 {rx.totalDrugCost || rx.total || '확인 필요'}
                    </span>
                  </div>
                  {rx.indication && <div className="mb-2 text-xs text-slate-600">상정 상황: {rx.indication}</div>}
                  <div className="overflow-hidden rounded border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="p-2">약제</th>
                          <th className="p-2">용법/일수</th>
                          <th className="p-2">약가</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rx.drugs || []).map((drug: any, drugIndex: number) => (
                          <tr key={drugIndex} className="border-t border-slate-100">
                            <td className="p-2">
                              <div className="font-bold text-slate-800">{drug.name || drug.productName || '약품명 확인 필요'}</div>
                              <div className="text-[11px] text-slate-500">{drug.ingredient || ''}</div>
                            </td>
                            <td className="p-2 text-slate-600">{drug.dose || drug.days || rx.assumptions || '용법 확인 필요'}</td>
                            <td className="p-2 text-slate-700">
                              {drug.estimatedCost || drug.price || drug.unitPrice || '확인 필요'}
                              {drug.reimbursement && <div className="text-[11px] text-slate-400">{drug.reimbursement}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rx.insuranceFeeEstimate && <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">보험/수가: {rx.insuranceFeeEstimate}</div>}
                  {rx.cautions && <div className="mt-2 text-xs text-red-700">주의: {rx.cautions}</div>}
                  {rx.assumptions && <div className="mt-1 text-[11px] text-slate-500">가정: {rx.assumptions}</div>}
                </div>
              ))}
            </div>
            {meta_json?.follow_up_questions?.length > 0 && (
              <div className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-700">
                <strong className="mb-1 block text-slate-900">추가로 확인할 질문</strong>
                <ul className="list-disc space-y-1 pl-4">
                  {meta_json.follow_up_questions.map((question: string, questionIndex: number) => <li key={questionIndex}>{question}</li>)}
                </ul>
              </div>
            )}
          </div>
        );
      case 'translation':
          return (
            <div key={index} className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-3 shadow-sm">
               <h3 className="font-bold text-indigo-800 text-sm mb-2"> {title}</h3>
               <div className="text-sm text-indigo-900 bg-white p-3 rounded border border-indigo-100">{body}</div>
               {meta_json?.clinical_note && <div className="text-xs text-indigo-600 mt-2"> <b>Note:</b> {meta_json.clinical_note}</div>}
            </div>
          );
      default:
        return (
          <div key={index} className="mb-2">
            <strong>{title}</strong><br/>
            <span className="text-sm" dangerouslySetInnerHTML={{ __html: body?.replace(/\n/g, '<br/>') || '' }} />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans w-full">
      
      {/* 모바일 오버레이 배경 */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* 사이드바 */}
      <div className={`fixed inset-y-0 left-0 bg-slate-900 text-white w-64 p-4 z-50 transform transition-transform duration-300 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="flex justify-between items-center mb-8">
           <h1 className="text-xl font-bold tracking-tight">AIMDNET<span className="text-blue-400">.</span></h1>
           <button className="md:hidden text-slate-300" onClick={() => setSidebarOpen(false)}></button>
        </div>
        
        <button onClick={handleCreateNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg mb-6 flex items-center justify-center gap-2">
           <span className="text-lg">+</span> 새 채팅
        </button>

        <div className="flex flex-col gap-2 mb-8 text-sm font-medium text-slate-300">
           <button onClick={() => {setView('drug'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='drug'?'bg-slate-800 text-white':''}`}>
              약제조회
           </button>
           <button onClick={() => {setView('guide'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='guide'?'bg-slate-800 text-white':''}`}>
              처방 가이드
           </button>
           <button onClick={() => {setView('case'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='case'?'bg-slate-800 text-white':''}`}>
              증례 검색
           </button>
           <button onClick={() => {setView('rag_review'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='rag_review'?'bg-slate-800 text-white':''}`}>
              RAG 및 리뷰 워크플로우 
           </button>
           <button onClick={() => {setView('emergency'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='emergency'?'bg-slate-800 text-white':''}`}>
              응급의료
           </button>
           <button onClick={() => {setView('legal'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='legal'?'bg-slate-800 text-white':''}`}>
              법률검토 (판례중심)
           </button>
           <button onClick={() => {setView('translate'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='translate'?'bg-slate-800 text-white':''}`}>
              다국어 진료 어시스턴트 MCA
           </button>
            <button onClick={() => {setView('recruit'); if(window.innerWidth<768) setSidebarOpen(false);}} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 ${view==='recruit'?'bg-slate-800 text-white':''}`}>
              구인·구직 AI 매칭
            </button>
           <button onClick={() => setView('settings')} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 text-blue-300 mt-4 border border-slate-700`}>
                마이페이지 및 설정
           </button>
        </div>        <div className="flex-1 overflow-y-auto">
           <div className="mb-3 flex items-center justify-between gap-2">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">최근 기록</h3>
             {sessions.length > 0 && (
               <button
                 onClick={clearAllSessions}
                 className="text-[11px] font-semibold text-slate-500 hover:text-red-300 transition"
                 title="최근 기록 전체 삭제"
               >
                 전체 삭제
               </button>
             )}
           </div>
           <div className="flex flex-col gap-1">
             {sessions.slice(0,10).map((s, idx) => (
                <div key={s.id || idx} onClick={() => loadSession(s)} className="group flex items-center gap-1 rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer">
                   <span className="min-w-0 flex-1 truncate">{s.title}</span>
                   <button
                     onClick={(event) => {
                       event.stopPropagation();
                       deleteSession(s.id);
                     }}
                     className="hidden h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-500 hover:bg-red-500/20 hover:text-red-200 group-hover:flex"
                     title="이 최근 기록 삭제"
                   >
                     ×
                   </button>
                </div>
             ))}
             {sessions.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-slate-600">저장된 최근 기록이 없습니다.</div>
             )}
           </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-700 text-sm">
           <div className="font-bold">{user.name} 원장님</div>
           <div className="text-slate-400 text-xs">{user.specialty} 전문의</div>
           <div className="text-blue-300 text-xs font-bold mt-1">포인트: {user.points}P</div>
        </div>
      </div>

      {/* 메인 캔버스 */}
      <div className="flex-1 flex flex-col w-full relative">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm z-30">
          <button className="md:hidden p-2 -ml-2 text-slate-600" onClick={() => setSidebarOpen(true)}> 메뉴</button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {view === 'chat' ? '전문 의학 어시스턴트' : view === 'emergency' ? '🚨 실시간 응급(ER) 어시스턴트' : view === 'legal' ? '⚖️ 의료 법률 및 판례 어시스턴트' : view === 'translate' ? '진료실 다국어 번역' : view === 'rag_review' ? 'RAG 기반 논문/가이드라인 검색 및 리뷰' : view === 'recruit' ? '구인·구직 AI 매칭' : '내 라이브러리'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {view === 'chat' ? '진료, 연구, 약물 보조 및 종합 인텔리전스' : view === 'emergency' ? '긴급 상황 프로토콜, 용량 계산, 처치 우선순위 즉각 답변' : view === 'legal' ? '의료분쟁 판례 검색, 의료법 해석, 방어 진료 지침' : view === 'translate' ? '복약지도 및 소견서 임상 번역' : view === 'rag_review' ? '최신 논문 기반 응답 및 동료 의사 리뷰 워크플로우 연동' : view === 'recruit' ? '근무조건, 페이, 거리, 시간, 근무방법 기반 자동 추천' : '저장된 중요 레퍼런스 모음'}
            </p>
          </div>
          {(view === 'chat' || view === 'emergency' || view === 'legal') && messages.length > 0 && (
             <button onClick={handleSaveToLibrary} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm border border-slate-300 font-medium hidden sm:block">
               + 라이브러리 저장
             </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50" ref={scrollRef}>
          
          {/* ===================== CHAT VIEW ===================== */}
          {(view === 'chat' || view === 'emergency' || view === 'legal') && (
            <>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center w-full pb-20">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${view === 'emergency' ? 'bg-red-100 text-red-600' : view === 'legal' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                    {view === 'emergency' ? (
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : view === 'legal' ? (
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0l-1.414 1.414M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">무엇을 도와드릴까요, {user.name} 원장님?</h2>
                  <p className="text-slate-500 text-sm mb-6">
                     {view === 'emergency' ? '실시간 응급 대응 프로토콜 및 용량 계산' : view === 'legal' ? '의료분쟁 예방 및 판례 분석' : '환자 증상, X-Ray 사진 판독, 약물 상호작용(DDI), 최신 가이드라인 검색 등 지식 베이스 검색을 지원합니다.'}
                  </p>
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="mb-8 flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-5 py-2.5 rounded-full hover:bg-blue-100 transition shadow-sm font-medium text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    X-Ray / 검사지 / 이미지 첨부하기
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {suggestions.map((text, i) => (
                      <button key={i} onClick={() => handleSendMessage(text)} className="bg-white border border-slate-200 p-3 rounded-lg text-sm text-left hover:bg-slate-50 hover:border-blue-300 text-slate-700 shadow-sm transition">
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 pb-24">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`w-full max-w-none rounded-2xl p-4 sm:p-5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                        {msg.role === 'user' ? (
                          <>
                            {msg.image && <img src={msg.image} alt="uploaded" className="w-full w-full rounded-lg mb-3 border border-blue-500" />}
                            {msg.reusedImageContext && (
                              <div className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-blue-50 ring-1 ring-white/25">
                                이전 첨부 이미지를 함께 참고 중
                              </div>
                            )}
                            <div className="leading-relaxed text-sm sm:text-base whitespace-pre-wrap">{msg.content}</div>
                          </>
                        ) : (
                          <>
                            {msg.error ? (
                              <div className="text-red-500">{msg.error}</div>
                            ) : (
                              <div className="w-full">
                                {msg.parsedData?.inferred_domain || msg.parsedData?.orchestration_summary && (
                                   <div className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">
                                      {msg.parsedData.orchestration_summary || msg.parsedData.inferred_domain}
                                   </div>
                                )}
                                
                                {msg.parsedData?.blocks?.map((block: any, bi: number) => renderBlock(block, bi))}
                                
                                {(!msg.parsedData?.blocks || msg.parsedData.blocks.length === 0) && (
                                   <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.parsedData?.chat_reply || ''}</div>
                                )}

                                {/* AI 응답 Action Bar (app.js 그대로 포팅) */}
                                <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
                                   <button className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-full hover:bg-slate-50 bg-white" onClick={() => alert('클립보드에 복사되었습니다.')}>복사</button>
                                   <button className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-full hover:bg-slate-50 bg-white" onClick={handleSaveToLibrary}>저장</button>
                                   <div className="flex-1"></div>
                                   <button className="px-3 py-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100" onClick={async (e) => { try { await submitTrainingFeedback('LIKE', msg, idx); e.currentTarget.innerText=' 학습 반영'; } catch { alert('피드백 저장에 실패했습니다.'); } }}> 좋아요</button>
                                   <button className="px-3 py-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full hover:bg-red-100" onClick={async (e) => { try { await submitTrainingFeedback('DISLIKE', msg, idx); e.currentTarget.innerText=' 개선 데이터 반영'; } catch { alert('피드백 저장에 실패했습니다.'); } }}> 싫어요</button>
                                   <button className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-full hover:bg-blue-700 font-bold shadow-sm" onClick={() => { setFeedbackTarget({ msg, index: idx }); setOpinionModalOpen(true); }}>의견 남기기</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></div>
                        <span className="text-sm text-slate-500 ml-2">의학 지식베이스 검색 및 분석 중...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===================== NEW VIEWS ===================== */}
          {view === 'rag_review' && <RAGReview />}
          {view === 'drug' && <DrugSearch />}
          {view === 'guide' && <PrescribeGuide />}
          {view === 'case' && <PrescribeGuide />}
          {view === 'translate' && <TranslateMCA />}
          {view === 'recruit' && <RecruitMatch />}
          {view === 'settings' && <SettingsMyPage />}

        </main>

        {/* 하단 입력창 도크 (채팅 모드일 때만 표시) */}
        {(view === 'chat' || view === 'emergency' || view === 'legal') && (
          <div className="bg-white border-t border-slate-200 p-3 sm:p-4 z-30">
            {attachmentBase64 && (
              <div className="relative inline-block mb-3">
                <img src={attachmentBase64} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-slate-300 shadow-sm" />
                <button onClick={() => { setAttachmentBase64(null); setAttachmentNotice(''); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none">
                  &times;
                </button>
              </div>
            )}
            {attachmentNotice && (
              <div className="mb-2 text-xs text-slate-500">
                {attachmentNotice}
              </div>
            )}
            
            <div className="relative flex items-end gap-2 bg-slate-100 rounded-2xl border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white shadow-inner">
              <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition flex-shrink-0" title="이미지/검사지 첨부">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              
              <textarea
                className="w-full max-h-32 bg-transparent text-sm text-slate-800 p-2.5 resize-none focus:outline-none"
                placeholder={isThinking ? "분석 중입니다..." : "환자 증상, 질환, 약물 DDI, X-Ray 사진 등을 입력하세요."}
                rows={1}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(chatInput);
                  }
                }}
                disabled={isThinking}
              />
              
              <button 
                onClick={() => handleSendMessage(chatInput)} 
                disabled={(!chatInput.trim() && !attachmentBase64) || isThinking}
                className="p-2.5 flex-shrink-0 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition shadow-sm"
              >
                <div className="w-5 h-5 flex items-center justify-center font-bold text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </div>
              </button>
            </div>
            <div className="text-center mt-2.5 text-[10px] text-slate-400">
               AIMDNET 플랫폼은 보조 목적으로만 제공되며, 최종 진단과 처방은 의사의 임상적 판단에 따라야 합니다.
            </div>
          </div>
        )}

      </div>

      {/* 내부 의사 의견 모달 (app.js openOpinionModal) */}
      {isOpinionModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full w-full rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-slate-800 text-md"> 동료 의견 남기기</h3>
                 <button onClick={() => { setOpinionModalOpen(false); setFeedbackTarget(null); }} className="text-slate-400 hover:text-slate-600"></button>
              </div>
              <div className="p-5">
                 <p className="text-xs text-slate-500 mb-3">작성하신 의견은 가명(전공의/전문의) 처리되어 다른 원장님들의 인텔리전스 분석 시 참고 데이터로 활용됩니다.</p>
                 <textarea 
                   className="w-full border border-slate-300 rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                   placeholder="해당 결과에 대한 원장님의 실제 임상 경험을 육안 지식으로 남겨주세요."
                   value={opinionText}
                   onChange={(e) => setOpinionText(e.target.value)}
                 />
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
                 <button onClick={() => { setOpinionModalOpen(false); setFeedbackTarget(null); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded">취소</button>
                 <button onClick={async () => { 
                    if (!opinionText.trim()) return alert('의견을 입력해주세요.');
                    try {
                      if (feedbackTarget) {
                        await submitTrainingFeedback('COMMENT', feedbackTarget.msg, feedbackTarget.index, opinionText);
                      }
                      const res = await fetch('/api/opinions', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: user.id, sessionId: currentSessionId, content: opinionText })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setUser(prev => ({...prev, points: data.updatedPoints}));
                        alert(`소중한 의견이 등록되었습니다. (+1 포인트 적립, 현재 ${data.updatedPoints}P)`);
                      } else {
                        alert('의견 등록은 완료되었으나 포인트 적립에 오류가 발생했습니다.');
                      }
                    } catch(e) {
                      alert('의견 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                    }
                    setOpinionModalOpen(false); 
                    setFeedbackTarget(null);
                    setOpinionText(''); 
                 }} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded font-bold">의견 등록</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
