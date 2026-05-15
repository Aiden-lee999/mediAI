'use client';
import { useEffect, useState } from 'react';
import HospitalAutocomplete, { HospitalSuggestion } from '@/components/hospital/HospitalAutocomplete';
import HospitalDetailPanel from '@/components/hospital/HospitalDetailPanel';

export default function SettingsMyPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
   const [userId, setUserId] = useState('');
   const [hospital, setHospital] = useState<any>(null);
   const [showHospitalDetail, setShowHospitalDetail] = useState(false);
   const [notice, setNotice] = useState('');

  const [profile, setProfile] = useState({
    name: '김의사',
    licenseNumber: '123456',
    specialty: '내과',
    hospitalName: '서울제일의원',
      email: 'doctor@seouljeil.com',
      address: '',
      institutionNumber: '',
      hospitalDirectoryId: ''
  });

  const [preferences, setPreferences] = useState({
    defaultGuideline: 'KDA (대한당뇨병학회)',
    alertDDR: true,
    alertPregnancy: true,
    alertAgeLimit: true,
    theme: 'light',
    language: 'ko'
  });

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePreferenceChange = (name: string, value: any) => {
    setPreferences(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setLoading(true);
      setNotice('');
      fetch('/api/user/profile', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ userId, ...profile }),
      })
         .then((res) => res.json())
         .then((data) => {
            if (!data.success) throw new Error(data.error || '저장 실패');
            localStorage.setItem('med_user', JSON.stringify(data.user));
            setHospital(data.hospital || hospital);
            setNotice('설정이 성공적으로 저장되었습니다.');
         })
         .catch((error) => setNotice(error?.message || '저장 중 오류가 발생했습니다.'))
         .finally(() => setLoading(false));
  };

   const applyHospitalSelection = (selected: HospitalSuggestion) => {
      setProfile((prev) => ({
         ...prev,
         hospitalName: selected.name,
         hospitalDirectoryId: selected.id,
         institutionNumber: selected.encryptedCode,
         address: selected.address || prev.address,
      }));
      setHospital(selected);
      setShowHospitalDetail(true);
   };

   useEffect(() => {
      try {
         const raw = localStorage.getItem('med_user');
         const user = raw ? JSON.parse(raw) : null;
         if (!user?.id) return;
         setUserId(user.id);
         setProfile((prev) => ({
            ...prev,
            name: user.name || prev.name,
            licenseNumber: user.license || prev.licenseNumber,
            specialty: user.specialty || prev.specialty,
            hospitalName: user.hospitalName || '',
            email: user.email || '',
            address: user.address || '',
            institutionNumber: user.institutionNumber || '',
            hospitalDirectoryId: user.hospitalDirectoryId || '',
         }));
         fetch(`/api/user/profile?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
               if (data?.user) {
                  setProfile((prev) => ({
                     ...prev,
                     name: data.user.name || prev.name,
                     licenseNumber: data.user.license || prev.licenseNumber,
                     specialty: data.user.specialty || prev.specialty,
                     hospitalName: data.user.hospitalName || '',
                     email: data.user.email || '',
                     address: data.user.address || '',
                     institutionNumber: data.user.institutionNumber || '',
                     hospitalDirectoryId: data.user.hospitalDirectoryId || '',
                  }));
               }
               if (data?.hospital) setHospital(data.hospital);
            });
      } catch {
         // ignore local profile bootstrap errors
      }
   }, []);

  return (
    <div className="w-full  space-y-6 animate-fadeIn py-2">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-1 flex items-center gap-3">
               마이페이지 & 환경설정
            </h2>
            <p className="text-slate-500 text-sm">AIMDNET 시스템을 원장님의 진료 환경에 맞게 최적화하세요.</p>
            {notice && <p className="mt-2 text-xs font-bold text-blue-600">{notice}</p>}
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
              { id: 'profile', label: '개인정보 & 면허' },
              { id: 'preferences', label: '진료 & UI 설정' }
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
                 {tab.label}
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
                        <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">인증 완료됨</span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">진료 과목 (전문 분야)</label>
                        <select 
                          className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                          name="specialty" value={profile.specialty} onChange={handleProfileChange}
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
                        <HospitalAutocomplete
                          value={profile.hospitalName}
                          onChange={(value) => setProfile((prev) => ({ ...prev, hospitalName: value, hospitalDirectoryId: '' }))}
                          onSelect={applyHospitalSelection}
                          placeholder="병의원명을 입력하면 자동검색됩니다"
                        />
                        {profile.hospitalDirectoryId && <p className="mt-1 text-xs font-bold text-emerald-600">공식 병의원 DB와 연결됨</p>}
                     </div>
                  </div>
                  
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1">로그인 이메일</label>
                     <input className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" name="email" value={profile.email} readOnly />
                  </div>
                           <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                 <div>
                                    <p className="text-sm font-black text-blue-900">내 병원 정보</p>
                                    <p className="mt-1 text-xs text-blue-700">전국 병의원 DB 기준 상세정보와 네이버지도 위치를 확인하고, 변경된 내용은 직접 수정할 수 있습니다.</p>
                                 </div>
                                 <button type="button" onClick={() => setShowHospitalDetail((prev) => !prev)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white">
                                    {showHospitalDetail ? '닫기' : '내병원 정보 보기'}
                                 </button>
                              </div>
                              {showHospitalDetail && <div className="mt-4"><HospitalDetailPanel hospitalId={profile.hospitalDirectoryId || hospital?.id} hospital={hospital} editable onUpdated={setHospital} /></div>}
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

         </div>
      </div>
    </div>
  );
}