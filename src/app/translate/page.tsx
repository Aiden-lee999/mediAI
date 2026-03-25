import Link from 'next/link';

export default function TranslatePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center text-gray-900">
      <header className="w-full bg-blue-700 text-white p-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black">🌐 다국어 번역 및 환자 안내</h1>
          <nav className="space-x-4">
            <Link href="/chat" className="hover:text-blue-200 font-medium">챗봇으로 돌아가기</Link>
          </nav>
        </div>
      </header>
      <main className="w-full max-w-5xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-sm border border-gray-100 flex gap-8">
        
        <div className="flex-1 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">대상 언어 설정</label>
            <select className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>🇺🇸 영어 (English)</option>
              <option>🇨🇳 중국어 (中文)</option>
              <option>🇯🇵 일본어 (日本語)</option>
              <option>🇻🇳 베트남어 (Tiếng Việt)</option>
              <option>🇷🇺 러시아어 (Tiếng Nga)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">한국어 진단/처방 소견 입력</label>
            <textarea 
              className="w-full border border-gray-300 rounded-lg p-4 h-48 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 급성 기관지염입니다. 처방해 드린 항생제와 기침약은 식후 30분에 꼭 챙겨 드시고, 증상이 심해지면 응급실로 오세요."
            ></textarea>
          </div>
          
          <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2">
            <span>번역 및 안내문 생성</span> 
            <span>✨</span>
          </button>
        </div>

        <div className="flex-1 bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col">
          <h3 className="font-bold text-gray-600 mb-4 flex items-center gap-2">
            <span>📄</span> 번역 결과 카드
          </h3>
          <div className="flex-1 bg-white border border-gray-100 rounded-lg p-6 shadow-sm mb-4">
            <div className="text-center text-gray-400 mt-20 text-sm">
              왼쪽에서 내용을 입력하고 버튼을 눌러주세요.
            </div>
          </div>
          <button className="w-full py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 disabled:opacity-50" disabled>
            프린트 하기
          </button>
        </div>
      </main>
    </div>
  );
}