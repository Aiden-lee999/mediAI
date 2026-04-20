'use client';
import { useState, useEffect } from 'react';

export default function SettingsMyPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  // My Page Mock State
  const [profile, setProfile] = useState({
    name: '김의사',
    licenseNumber: '123456',
    specialty: '내과',
    hospitalName: '서울제일내과의원',
    email: 'doctor@seouljeil.com'
  });

  const [preferences, setPreferences] = useState({
    defaultGuideline: 'KDA (대한당뇨병학회)',
    alertDDR: true,
    alertPregnancy: true,
    alertAgeLimit: true,
    theme: 'light',
    language: 'ko'
  });

  const [apiKeys, setApiKeys] = useState<{ provider: string, key: string, status: string }[]>([
    { provider: 'OpenAI (GPT-4)', key: 'sk-proj-...1234', status: 'active' },
    { provider: 'Anthropic (Claude-3)', key: '', status: 'empty' }, // 추가적인 커스텀 모델 연동
    { provider: 'HIRA OpenAPI', key: 'hira-auth-...abcd', status: 'active' }
  ]);

  const [apiLogs] = useState([
    { id: 1, date: '2026-04-16 14:32', type: 'DUR 점검', status: 'Success', cost: '₩0' },
    { id: 2, date: '2026-04-16 13:15', type: '처방 가이드(LLM)', status: 'Success', cost: '₩125' },
    { id: 3, date: '2026-04-15 09:00', type: '상병코드 AI 추천', status: 'Success', cost: '₩88' },
  ]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePreferenceChange = (name: string, value: any) => {
    setPreferences(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setLoading(true);
    // 가상의 API 통신 (실제로 NextAuth 나 user DB 에 업데이트해야 함)
    setTimeout(() => {
       setLoading(false);
       alert('설정이 성공적으로 저장되었습니다.');
    }, 600);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn py-2">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-1 flex items-center gap-3">
               👤 마이페이지 & 환경설정
            </h2>
            <p className="text-slate-500 text-sm">AIMDNET 시스템을 원장님의 진료 환경에 맞게 최적화하세요.</p>
         </div>
         <button 
           onClick={handleSave}
           disabled={loading}
           className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm disabled:opacity-50 transition"
         >
           {loading ? '저장 중...' : '변경사항 저장'}
         </button>
      </div>

      {/* Tabs & Content */}
      <div className="flex flex-col md:flex-row gap-6">
         {/* Sidebar Tabs */}
         <div className="w-full md:w-64 flex flex-col gap-2">
            {[
              { id: 'profile', label: '개인정보 & 면허', icon: '🩺' },
              { id: 'preferences', label: '진료 & UI 설정', icon: '⚙️' },
              { id: 'apikeys', label: 'API 키 & 연동', icon: '🔑' },
              { id: 'logs', label: 'API 사용 이력 & 과금', icon: '📊' }
            ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-3 ${
                    activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                 }`}
               >
                 <span className="text-lg">{tab.icon}</span> {tab.label}
               </button>
            ))}
         </div>

         {/* Content Area */}
         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            
            {/* 1. 프로필 설정 */}
            {activeTab === 'profile' && (
               <div className="space-y-5">
                  <h3 className="font-bold text-lg border-b border-slate-100 pb-3 mb-4">개인정보 및 의료인 인증</h3>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">이름 (원장님)</label>
                        <input className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" name="name" value={profile.name} onChange={handleProfileChange} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">의사 면허 번호</label>
                        <input className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" name="licenseNumber" value={profile.licenseNumber} readOnly />
                        <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">✓ 인증 완료됨</span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">진료 과목 (전문 분야)</label>
                        <select 
                          className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                          name="specialty" value={profile.specialty} onChange={(e) => handleProfileChange(e as any)}
                        >
                           <option value="내과">내과</option>
                           <option value="가정의학과">가정의학과</option>
                           <option value="피부과">피부과</option>
                           <option value="외과">외과</option>
                           <option value="응급의학과">응급의학과</option>
                           <option value="일반의">일반의</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">소속 병/의원명</label>
                        <input className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" name="hospitalName" value={profile.hospitalName} onChange={handleProfileChange} />
                     </div>
                  </div>
                  
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1">로그인 الإ메일</label>
                     <input className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" name="email" value={profile.email} readOnly />
                  </div>
               </div>
            )}

            {/* 2. 진료 & UI 설정 */}
            {activeTab === 'preferences' && (
               <div className="space-y-6">
                  <h3 className="font-bold text-lg border-b border-slate-100 pb-3 mb-4">AI 진료 보조 민감도 & 환경 설정</h3>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">프롬프트 기본 가이드라인 기준</label>
                    <p className="text-xs text-slate-500 mb-3">AI가 처방 증례 및 가이드라인을 검색할 때 최우선으로 참고할 학회를 설정합니다.</p>
                    <select 
                      className="w-full md:w-1/2 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={preferences.defaultGuideline} 
                      onChange={(e) => handlePreferenceChange('defaultGuideline', e.target.value)}
                    >
                       <option value="KDA (대한당뇨병학회)">KDA (대한당뇨병학회)</option>
                       <option value="KSH (대한고혈압학회)">KSH (대한고혈압학회)</option>
                       <option value="ADA (미국당뇨병학회)">ADA (미국당뇨병학회)</option>
                       <option value="AHA (미국심장협회)">AHA (미국심장협회)</option>
                       <option value="혼합 (종합 AI 판단)">혼합 (종합 AI 판단)</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                     <label className="block text-sm font-bold text-slate-700 mb-4">자동 DUR(사전 처방 안전 점검) 경고 수준</label>
                     <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                           <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                                  checked={preferences.alertDDR} onChange={(e) => handlePreferenceChange('alertDDR', e.target.checked)} />
                           <div>
                              <div className="text-sm font-bold text-slate-800">병용 금기 약제 경고 (DDI)</div>
                              <div className="text-xs text-slate-500">채팅 및 약제 조회 시 병용 금기를 즉시 경고합니다.</div>
                           </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                           <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                                  checked={preferences.alertPregnancy} onChange={(e) => handlePreferenceChange('alertPregnancy', e.target.checked)} />
                           <div>
                              <div className="text-sm font-bold text-slate-800">임부 금기 약제 경고</div>
                              <div className="text-xs text-slate-500">FDA / HIRA 기준 임부 금기 등급(1, 2등급)을 경고합니다.</div>
                           </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                           <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" 
                                  checked={preferences.alertAgeLimit} onChange={(e) => handlePreferenceChange('alertAgeLimit', e.target.checked)} />
                           <div>
                              <div className="text-sm font-bold text-slate-800">연령 금기 및 노인 주의 경고</div>
                              <div className="text-xs text-slate-500">소아/노인 주의 성분을 강력히 필터링합니다.</div>
                           </div>
                        </label>
                     </div>
                  </div>
               </div>
            )}

            {/* 3. API 키 설정 */}
            {activeTab === 'apikeys' && (
               <div className="space-y-6">
                  <h3 className="font-bold text-lg border-b border-slate-100 pb-3 mb-2">프라이빗 API 연동 (BYOK)</h3>
                  <p className="text-xs text-slate-500 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 leading-relaxed">
                     보안이 중요하거나, 요금 폭탄을 피하기 위해 원장님 개인의 OpenAI, Anthropic 키 및 공공데이터포털(HIRA) 인증키를 직접 입력할 수 있습니다. 
                     키는 브라우저 내부 및 암호화된 세션에만 저장되며 외부로 유출되지 않습니다.
                  </p>

                  <div className="space-y-4">
                     {apiKeys.map((api, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-3 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <div className="w-full md:w-1/3">
                              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                 {api.provider}
                                 {api.status === 'active' && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                              </div>
                           </div>
                           <div className="w-full md:w-2/3 flex gap-2">
                              <input 
                                type="password" 
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" 
                                value={api.key} 
                                placeholder="키를 입력하세요 (예: sk-...)" 
                                onChange={(e) => {
                                   const newKeys = [...apiKeys];
                                   newKeys[idx].key = e.target.value;
                                   newKeys[idx].status = e.target.value ? 'active' : 'empty';
                                   setApiKeys(newKeys);
                                }}
                              />
                              <button className="bg-white border border-slate-300 text-slate-600 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 font-bold transition">
                                 검증
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* 4. 로그 & 과금 */}
            {activeTab === 'logs' && (
               <div className="space-y-6">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-3 mb-4">
                     <h3 className="font-bold text-lg">AI 사용 이력 및 API 과금표</h3>
                     <span className="text-sm font-bold text-slate-600">이번 달 총 청구액: <span className="text-blue-600 text-xl tracking-tight">₩4,250</span></span>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-xs uppercase">
                           <tr>
                              <th className="p-3">일시</th>
                              <th className="p-3">요청 기능</th>
                              <th className="p-3">상태</th>
                              <th className="p-3 text-right">예상 비용</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {apiLogs.map(log => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                 <td className="p-3 text-slate-500 text-xs">{log.date}</td>
                                 <td className="p-3 font-medium text-slate-800">{log.type}</td>
                                 <td className="p-3">
                                    <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase">
                                       {log.status}
                                    </span>
                                 </td>
                                 <td className="p-3 text-right font-mono text-slate-600">{log.cost}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  <div className="text-center mt-4">
                     <button className="text-sm text-blue-600 hover:text-blue-800 font-bold border-b border-blue-600 pb-0.5">전체 내역 다운로드 (CSV)</button>
                  </div>
               </div>
            )}

         </div>
      </div>
    </div>
  );
}