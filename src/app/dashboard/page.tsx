'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import DrugSearch from '@/components/dashboard/DrugSearch';
import PrescribeGuide from '@/components/dashboard/PrescribeGuide';
import RAGReview from '@/components/dashboard/RAGReview';
import Emergency from '@/components/dashboard/Emergency';
import LegalReview from '@/components/dashboard/LegalReview';
import TranslateMCA from '@/components/dashboard/TranslateMCA';
import SettingsMyPage from '@/components/dashboard/SettingsMyPage';

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

// ==========================================
// 2. 메인 대시보드 페이지
// ==========================================
export default function DashboardPage() {
  const [view, setView] = useState<string>('chat');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isOpinionModalOpen, setOpinionModalOpen] = useState(false);
  const [opinionText, setOpinionText] = useState('');

  // 유저 컨텍스트
  const [user, setUser] = useState({ name: '김의사', specialty: '내과' });

  // 채팅 상태
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  
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

  useEffect(() => {
     // 초기 로드 시 로컬 스토리지 데이터 불러오기
     const localSessions = JSON.parse(localStorage.getItem('medSessions') || '[]');
     const localLib = JSON.parse(localStorage.getItem('medLibrary') || '[]');
     if (localSessions.length > 0) setSessions(localSessions);
     if (localLib.length > 0) setSavedLibrary(localLib);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, view, transOutput]);

  // 전공 맞춤형 추천 검색어
  const suggestions = useMemo(() => {
    if (user.specialty === '내과') return ['2형 당뇨 1차 처방 최신 가이드라인', '고혈압 약제 동시 처방 주의사항', '복부 X-ray 판독해줘'];
    if (user.specialty === '피부과') return ['여드름 이소트레티노인 부작용 및 설명', '아토피 피부염 최신 초진 가이드'];
    return ['상기도 감염 항생제 처방 기준 알려줘', '첨부한 영상 판독해줘', '요즘 주2회 알바 초빙 벤치마크해줘'];
  }, [user.specialty]);

  const handleCreateNewChat = () => {
    setView('chat');
    setMessages([]);
    setAttachmentBase64(null);
    setCurrentSessionId(`session_${Date.now()}`);
    if(window.innerWidth < 768) setSidebarOpen(false);
  };

  const loadSession = (sessionData: any) => {
    setView('chat');
    setCurrentSessionId(sessionData.id);
    setMessages(sessionData.history || []);
    if(window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setAttachmentBase64(ev.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (textToSearch: string) => {
    const targetText = textToSearch.trim();
    if (!targetText && !attachmentBase64) return;
    
    const userMsg = { role: 'user', content: targetText, image: attachmentBase64 };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    
    const currentQueryPayload = {
      query: targetText || "이미지/임상 분석",
      summary: "", // Will be filled after AI response
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    setChatInput('');
    setAttachmentBase64(null);
    setIsThinking(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: targetText, history: newHistory, imageBase64: userMsg.image })
      });
      const data = await res.json();
      
      const assistantMsg = { role: 'assistant', parsedData: data };
      const finalizedHistory = [...newHistory, assistantMsg];
      setMessages(finalizedHistory);

      // 세션 저장
      currentQueryPayload.summary = data.chat_reply;
      const existingIdx = sessions.findIndex(s => s.id === currentSessionId);
      const newSessions = [...sessions];
      if (existingIdx >= 0) {
         newSessions[existingIdx].history = finalizedHistory;
         if (newSessions[existingIdx].title === "새로운 대화" && targetText) {
             newSessions[existingIdx].title = targetText;
         }
      } else {
         newSessions.unshift({ id: currentSessionId, title: targetText || "새로운 대화", history: finalizedHistory, date: new Date().toLocaleDateString() });
      }
      setSessions(newSessions);
      localStorage.setItem('medSessions', JSON.stringify(newSessions));
      
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
             <button onClick={() => setOpinionModalOpen(true)} className="w-full border border-dashed border-slate-400 bg-transparent py-2 rounded text-slate-500 text-sm hover:bg-slate-100">+</button>
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
           <button onClick={() => setView('settings')} className={`text-left px-3 py-2 rounded flex items-center gap-3 hover:bg-slate-800 text-blue-300 mt-4 border border-slate-700`}>
                마이페이지 및 설정
           </button>
        </div>        <div className="flex-1 overflow-y-auto">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">최근 기록</h3>
           <div className="flex flex-col gap-1">
             {sessions.slice(0,10).map((s, idx) => (
                <div key={idx} onClick={() => loadSession(s)} className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded hover:bg-slate-800 cursor-pointer truncate">
                   {s.title}
                </div>
             ))}
           </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-700 text-sm">
           <div className="font-bold">{user.name} 원장님</div>
           <div className="text-slate-400 text-xs">{user.specialty} 전문의</div>
        </div>
      </div>

      {/* 메인 캔버스 */}
      <div className="flex-1 flex flex-col w-full relative">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm z-30">
          <button className="md:hidden p-2 -ml-2 text-slate-600" onClick={() => setSidebarOpen(true)}> 메뉴</button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
               {view === 'chat' ? '전문 의학 어시스턴트' : view === 'translate' ? '진료실 다국어 번역' : view === 'rag_review' ? 'RAG 기반 논문/가이드라인 검색 및 리뷰' : '내 라이브러리'}    
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
               {view === 'chat' ? '진료, 연구, 약물 보조 및 종합 인텔리전스' : view === 'translate' ? '복약지도 및 소견서 임상 번역' : view === 'rag_review' ? '최신 논문 기반 응답 및 동료 의사 리뷰 워크플로우 연동' : '저장된 중요 레퍼런스 모음'}
            </p>
          </div>
          {view === 'chat' && messages.length > 0 && (
             <button onClick={handleSaveToLibrary} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm border border-slate-300 font-medium hidden sm:block">
               + 라이브러리 저장
             </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50" ref={scrollRef}>
          
          {/* ===================== CHAT VIEW ===================== */}
          {view === 'chat' && (
            <>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center w-full  pb-20">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl"></span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">무엇을 도와드릴까요, {user.name} 원장님?</h2>
                  <p className="text-slate-500 text-sm mb-8">환자 증상, X-Ray 사진 판독, 약물 상호작용(DDI), 최신 가이드라인 검색, 초빙 공고 비교 등 전공별 맞춤 정보를 지원합니다.</p>
                  
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
                                   <button className="px-3 py-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full hover:bg-green-100" onClick={(e) => { e.currentTarget.innerText=' 완료' }}> 좋아요</button>
                                   <button className="px-3 py-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full hover:bg-red-100" onClick={(e) => { e.currentTarget.innerText=' 반영됨' }}> 싫어요</button>
                                   <button className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-full hover:bg-blue-700 font-bold shadow-sm" onClick={() => setOpinionModalOpen(true)}>의견 남기기</button>
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
          {view === 'emergency' && <Emergency />}
          {view === 'legal' && <LegalReview />}
          {view === 'translate' && <TranslateMCA />}
          {view === 'settings' && <SettingsMyPage />}

        </main>

        {/* 하단 입력창 도크 (채팅 모드일 때만 표시) */}
        {view === 'chat' && (
          <div className="bg-white border-t border-slate-200 p-3 sm:p-4 z-30">
            {attachmentBase64 && (
              <div className="relative inline-block mb-3">
                <img src={attachmentBase64} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-slate-300 shadow-sm" />
                <button onClick={() => setAttachmentBase64(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none"></button>
              </div>
            )}
            
            <div className="relative flex items-end gap-2 bg-slate-100 rounded-2xl border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white shadow-inner">
              <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition flex-shrink-0" title="이미지/검사지 첨부">
                
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
                <div className="w-5 h-5 flex items-center justify-center font-bold text-lg"></div>
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
                 <button onClick={() => setOpinionModalOpen(false)} className="text-slate-400 hover:text-slate-600"></button>
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
                 <button onClick={() => setOpinionModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded">취소</button>
                 <button onClick={() => { alert('소중한 의견이 등록되었습니다.'); setOpinionModalOpen(false); setOpinionText(''); }} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded font-bold">의견 등록</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
