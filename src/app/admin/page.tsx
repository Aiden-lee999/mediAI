import Link from 'next/link';
import ReviewManager from './ReviewManager';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center text-gray-900">
      <header className="w-full bg-blue-800 text-white p-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black">⚕️ mediAI 고급 관리자 플랫폼 (Phase 2 & 3)</h1>
          <nav className="space-x-6 text-sm font-semibold">
            <Link href="/chat" className="hover:text-blue-200">챗봇 에이전트</Link>
            <span className="text-blue-300">|</span>
            <Link href="#analytics" className="hover:text-blue-200">고급 분석 대시보드</Link>
            <Link href="#workflow" className="hover:text-blue-200">리뷰어 검수</Link>
            <Link href="#permissions" className="hover:text-blue-200">권한 관리</Link>
            <Link href="#kb" className="hover:text-blue-200">병원별 연동</Link>
          </nav>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto mt-8 mb-20 space-y-8">
        
        {/* 1. 고급 분석 대시보드 (통계) */}
        <section id="analytics" className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            📊 고급 분석 대시보드
            <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Phase 3</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <div className="text-sm text-blue-600 font-bold mb-1">오늘의 활성 세션</div>
              <div className="text-4xl font-black text-gray-800">1,248<span className="text-lg font-medium text-gray-500 ml-1">건</span></div>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border border-green-100">
              <div className="text-sm text-green-600 font-bold mb-1">지식베이스 통합 매칭률</div>
              <div className="text-4xl font-black text-gray-800">94.2<span className="text-lg font-medium text-gray-500 ml-1">%</span></div>
            </div>
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-100">
              <div className="text-sm text-orange-600 font-bold mb-1">자료 업데이트 (RAG)</div>
              <div className="text-4xl font-black text-gray-800">82<span className="text-lg font-medium text-gray-500 ml-1">건</span></div>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
              <div className="text-sm text-purple-600 font-bold mb-1">피드백 요약 리포트</div>
              <div className="text-4xl font-black text-gray-800">15<span className="text-lg font-medium text-gray-500 ml-1">건</span></div>
            </div>
          </div>
        </section>

        {/* 2. 리뷰어 검수 워크플로우 & 피드백 요약 고도화 */}
        <section id="workflow" className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              📝 리뷰어 검수 워크플로우 & 답변 버전관리
              <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Phase 2/3</span>
            </h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              미검수 항목 일괄 처리
            </button>
          </div>
          <ReviewManager />
        </section>

        {/* 3. 권한 세분화 & 병원별 지식베이스/외부 데이터 연동 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div id="permissions" className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              🔐 권한 세분화 관리
              <span className="text-xs font-normal border border-gray-300 text-gray-600 px-2 py-1 rounded-full">Phase 2</span>
            </h2>
            <ul className="space-y-4">
              <li className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                  <h4 className="font-bold text-gray-800">최고 관리자 (Super Admin)</h4>
                  <p className="text-xs text-gray-500 mt-1">시스템 전역 설정, 모델 라우팅 권한</p>
                </div>
                <div className="text-2xl">👑</div>
              </li>
              <li className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                  <h4 className="font-bold text-gray-800">임상 지식 관리자 (Knowledge Reviewer)</h4>
                  <p className="text-xs text-gray-500 mt-1">RAG 데이터 추가, 답변 검수/승인 권한</p>
                </div>
                <div className="text-2xl">🩺</div>
              </li>
              <li className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                  <h4 className="font-bold text-gray-800">일반 의료진 (Standard User)</h4>
                  <p className="text-xs text-gray-500 mt-1">저장/태그/북마크 기능, 챗봇 조회</p>
                </div>
                <div className="text-2xl">🧑‍⚕️</div>
              </li>
            </ul>
          </div>

          <div id="kb" className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              🏥 병원별 지식베이스 & 외부 외부 연동
              <span className="text-xs font-normal border border-gray-300 text-gray-600 px-2 py-1 rounded-full">Phase 3</span>
            </h2>
            <div className="space-y-4">
              <div className="border border-green-200 bg-green-50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-green-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    내부 OCS/EMR 연동 (서울본원)
                  </div>
                  <div className="text-xs text-green-600 mt-1">마지막 동기화: 10분 전</div>
                </div>
                <button className="text-xs font-bold bg-white text-green-700 border border-green-200 px-3 py-1 rounded">설정</button>
              </div>
              <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-blue-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    의약품안전사용서비스(DUR) API
                  </div>
                  <div className="text-xs text-blue-600 mt-1">실시간 스트리밍 중 정상</div>
                </div>
                <button className="text-xs font-bold bg-white text-blue-700 border border-blue-200 px-3 py-1 rounded">설정</button>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                    외부 논문 DB (PubMed 연동)
                  </div>
                  <div className="text-xs text-gray-400 mt-1">상태: 연결 대기 중</div>
                </div>
                <button className="text-xs font-bold bg-white text-gray-600 border border-gray-200 px-3 py-1 rounded">연결하기</button>
              </div>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}