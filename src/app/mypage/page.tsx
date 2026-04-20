import Link from 'next/link';

export default function MyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      {/* 1. 상단 파란색 헤더 */}
      <header className="w-full bg-[#1e5bff] text-white py-4 px-6 md:px-8 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-6xl mx-auto w-full">
          <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center text-xs">👨‍⚕️</div>
          <h1 className="text-lg font-bold tracking-tight">마이페이지</h1>
          <div className="flex-1"></div>
          <Link href="/dashboard" className="text-sm hover:text-blue-100 font-medium transition cursor-pointer z-10">
            대시보드로 돌아가기
          </Link>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="w-full max-w-3xl mx-auto mt-10 p-8 pb-12 bg-white rounded-2xl shadow-sm border border-slate-200 relative">
        
        {/* 프로필 + 포인트 영역 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-8 mb-8 gap-6">
          {/* 프로필 좌측 */}
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#e3ecff] flex items-center justify-center flex-shrink-0">
              <span className="text-[#1a56ff] text-3xl font-extrabold">김</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">김닥터 원장님</h2>
              <p className="text-slate-500 text-sm mt-1.5 font-medium">호흡기내과 전문의 | 서울의료원</p>
            </div>
          </div>
          
          {/* 포인트 우측 */}
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="text-[#ff3b3b] font-bold text-lg">Point 점수</div>
            <div className="flex items-center gap-2">
              <button className="bg-[#4b78c6] hover:bg-[#3962a9] text-white px-5 py-2 rounded text-sm font-bold shadow-sm transition">
                사용하기
              </button>
              <span className="text-[#ff3b3b] font-light">→</span>
            </div>
            <div className="text-[#ff3b3b] text-xs font-medium text-right mt-1 leading-snug">
              Mdcastle의<br />
              경품<br />
              할인구매<br />
              초빙시 사용<br />
              Donation 과 연계
            </div>
          </div>
        </div>

        {/* 내 관심 분야 (RAG 맞춤형) */}
        <div className="mb-10">
          <h3 className="text-base font-bold text-slate-800 mb-3">내 관심 분야 (RAG 맞춤형)</h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-[#f0f4ff] text-[#1e5bff] rounded-full text-sm font-bold shadow-sm border border-[#d8e4ff]">고혈압</span>
            <span className="px-3 py-1.5 bg-[#f0f4ff] text-[#1e5bff] rounded-full text-sm font-bold shadow-sm border border-[#d8e4ff]">당뇨</span>
            <span className="px-3 py-1.5 bg-[#f0f4ff] text-[#1e5bff] rounded-full text-sm font-bold shadow-sm border border-[#d8e4ff]">항생제 내성</span>
            <button className="px-4 py-1.5 border border-dashed border-slate-300 text-slate-500 rounded-full text-sm font-medium hover:bg-slate-50 transition">
              + 추가
            </button>
          </div>
        </div>

        {/* 설정 영역 */}
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-3">설정</h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* 프롬프트 상세 모드 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
              <div>
                <div className="font-bold text-[15px] text-slate-800">프롬프트 상세 모드</div>
                <div className="text-xs text-slate-400 mt-0.5">답변 시 임상 논문 출처를 더 상세하게 표기합니다.</div>
              </div>
              <div className="w-[42px] h-[24px] bg-[#1e5bff] rounded-full relative cursor-pointer shadow-inner">
                <div className="w-[18px] h-[18px] bg-white rounded-full absolute right-1 top-[3px] shadow-sm"></div>
              </div>
            </div>
            
            {/* 알림 설정 */}
            <div className="flex items-center justify-between px-5 py-4 bg-white">
              <div>
                <div className="font-bold text-[15px] text-slate-800">알림 설정</div>
                <div className="text-xs text-slate-400 mt-0.5">새로운 내부 지침이 등록되었을 때 알림을 받습니다.</div>
              </div>
              <div className="w-[42px] h-[24px] bg-[#e2e8f0] rounded-full relative cursor-pointer shadow-inner">
                <div className="w-[18px] h-[18px] bg-white rounded-full absolute left-1 top-[3px] shadow-sm"></div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}