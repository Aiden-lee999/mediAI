import Link from 'next/link';

export default function MyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center text-gray-900">
      <header className="w-full bg-blue-700 text-white p-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black">🧑‍⚕️ 마이페이지</h1>
          <nav className="space-x-4">
            <Link href="/chat" className="hover:text-blue-200 font-medium">챗봇으로 돌아가기</Link>
          </nav>
        </div>
      </header>
      <main className="w-full max-w-3xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
          <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold">
            김
          </div>
          <div>
            <h2 className="text-3xl font-bold">김닥터 원장님</h2>
            <p className="text-gray-500 mt-1">호흡기내과 전문의 | 서울의료원</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-3">내 관심 분야 (RAG 맞춤형)</h3>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">고혈압</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">당뇨</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">항생제 내성</span>
              <button className="px-3 py-1 border border-dashed border-gray-300 text-gray-500 rounded-full text-sm font-medium hover:bg-gray-50">+ 추가</button>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-3">설정</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <div>
                  <div className="font-bold text-sm">프롬프트 상세 모드</div>
                  <div className="text-xs text-gray-400">답변 시 임상 논문 출처를 더 상세하게 표기합니다.</div>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-0.5"></div>
                </div>
              </label>
              <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <div>
                  <div className="font-bold text-sm">알림 설정</div>
                  <div className="text-xs text-gray-400">새로운 내부 지침이 등록되었을 때 알림을 받습니다.</div>
                </div>
                <div className="w-10 h-5 bg-gray-300 rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-0.5"></div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}