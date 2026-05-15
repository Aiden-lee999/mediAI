'use client';

import { useEffect, useMemo, useState } from 'react';
import AddressAutocomplete, { AddressSuggestion } from '@/components/hospital/AddressAutocomplete';
import HospitalAutocomplete, { HospitalSuggestion } from '@/components/hospital/HospitalAutocomplete';
import HospitalDetailPanel from '@/components/hospital/HospitalDetailPanel';

const specialties = ['내과', '외과', '소아청소년과', '산부인과', '정형외과', '피부과', '정신건강의학과', '영상의학과', '응급의학과', '가정의학과', '일반의'];
const workTypeOptions = ['풀타임', '파트타임', '야간', '주말', '대진', '정기알바'];
const workMethodOptions = ['상근', '비상근', '외래', '입원전담', '검진', '온콜', '재택/원격'];
const priorities = [
  { value: 'BALANCED', label: '종합 균형' },
  { value: 'DISTANCE', label: '거리 우선' },
  { value: 'TIME', label: '근무 시간 우선' },
  { value: 'WORK_METHOD', label: '근무 방법 우선' },
  { value: 'PAY', label: '페이 우선' },
  { value: 'SPECIALTY', label: '진료과 우선' },
];

type AppUser = {
  id: string;
  name: string;
  specialty?: string;
  jobTitle?: string;
  role?: string;
  hospitalName?: string;
  hospitalDirectoryId?: string;
  address?: string;
  license?: string;
};

type FormState = {
  locationAddress: string;
  latitude: string;
  longitude: string;
  specialty: string;
  workTypes: string[];
  workMethods: string[];
  workHours: string;
  minPay: string;
  maxPay: string;
  priority: string;
  availableFrom: string;
  intro: string;
};

type PostingForm = {
  id?: string;
  hospitalDirectoryId: string;
  title: string;
  hospitalName: string;
  locationAddress: string;
  latitude: string;
  longitude: string;
  specialty: string;
  workTypes: string[];
  workMethods: string[];
  workHours: string;
  payMin: string;
  payMax: string;
  priority: string;
  description: string;
};

const emptyProfile = (user?: Partial<AppUser>): FormState => ({
  locationAddress: user?.address || '',
  latitude: '',
  longitude: '',
  specialty: user?.specialty || '내과',
  workTypes: ['풀타임'],
  workMethods: ['상근'],
  workHours: '주 5일, 09:00~18:00',
  minPay: '',
  maxPay: '',
  priority: 'BALANCED',
  availableFrom: '',
  intro: '',
});

const emptyPosting = (user?: Partial<AppUser>): PostingForm => ({
  id: undefined,
  hospitalDirectoryId: user?.hospitalDirectoryId || '',
  title: `${user?.specialty || '진료과'} 전문의 초빙`,
  hospitalName: user?.hospitalName || '',
  locationAddress: user?.address || '',
  latitude: '',
  longitude: '',
  specialty: user?.specialty || '내과',
  workTypes: ['풀타임'],
  workMethods: ['상근', '외래'],
  workHours: '주 5일, 09:00~18:00',
  payMin: '',
  payMax: '',
  priority: 'BALANCED',
  description: '',
});

function toArray(value?: string | null) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function toggle(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value];
}

function readUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('med_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isDirectorLocal(user: AppUser | null) {
  return /원장|병원장|대표|개원의|director|owner|admin|hospital_director|hospital-admin/i.test(`${user?.name || ''} ${user?.jobTitle || ''} ${user?.role || ''}`);
}

function postingToForm(posting: any): PostingForm {
  return {
    id: posting.id,
    hospitalDirectoryId: posting.hospitalDirectoryId || '',
    title: posting.title || '',
    hospitalName: posting.hospitalName || '',
    locationAddress: posting.locationAddress || '',
    latitude: posting.latitude ? String(posting.latitude) : '',
    longitude: posting.longitude ? String(posting.longitude) : '',
    specialty: posting.specialty || '내과',
    workTypes: toArray(posting.workTypes),
    workMethods: toArray(posting.workMethods),
    workHours: posting.workHours || '',
    payMin: posting.payMin ? String(posting.payMin) : '',
    payMax: posting.payMax ? String(posting.payMax) : '',
    priority: posting.priority || 'BALANCED',
    description: posting.description || '',
  };
}

export default function RecruitMatch() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isDirector, setIsDirector] = useState(false);
  const [profile, setProfile] = useState<FormState>(emptyProfile());
  const [posting, setPosting] = useState<PostingForm>(emptyPosting());
  const [matches, setMatches] = useState<any[]>([]);
  const [postings, setPostings] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [postingModalOpen, setPostingModalOpen] = useState(false);

  const userId = user?.id || '';

  useEffect(() => {
    const u = readUser();
    setUser(u);
    setProfile(emptyProfile(u || undefined));
    setPosting(emptyPosting(u || undefined));
    setIsDirector(isDirectorLocal(u));
  }, []);

  const load = async (currentUser = user) => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError('');
    try {
      const [profileRes, postingsRes, matchesRes] = await Promise.all([
        fetch(`/api/recruit/profile?userId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' }),
        fetch(`/api/recruit/postings?ownerId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' }),
        fetch('/api/recruit/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }),
        }),
      ]);
      const profileData = await profileRes.json();
      const postingsData = await postingsRes.json();
      const matchesData = await matchesRes.json();

      if (profileData?.user) {
        setIsDirector(profileData.user.isDirector);
        const mergedUser = { ...currentUser, ...profileData.user };
        setUser(mergedUser);
        if (typeof window !== 'undefined') localStorage.setItem('med_user', JSON.stringify(mergedUser));
      }
      if (profileData?.profile) {
        setProfile({
          locationAddress: profileData.profile.locationAddress || '',
          latitude: profileData.profile.latitude ? String(profileData.profile.latitude) : '',
          longitude: profileData.profile.longitude ? String(profileData.profile.longitude) : '',
          specialty: profileData.profile.specialty || currentUser.specialty || '내과',
          workTypes: toArray(profileData.profile.workTypes),
          workMethods: toArray(profileData.profile.workMethods),
          workHours: profileData.profile.workHours || '',
          minPay: profileData.profile.minPay ? String(profileData.profile.minPay) : '',
          maxPay: profileData.profile.maxPay ? String(profileData.profile.maxPay) : '',
          priority: profileData.profile.priority || 'BALANCED',
          availableFrom: profileData.profile.availableFrom || '',
          intro: profileData.profile.intro || '',
        });
      }
      setPostings(postingsData?.postings || []);
      setMatches(matchesData?.matches || []);
      if (matchesData?.message) setMessage(matchesData.message);
    } catch (e: any) {
      setError(e?.message || '구인·구직 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = readUser();
    if (u?.id) void load(u);
  }, []);

  const saveProfile = async () => {
    if (!userId) return setError('로그인 정보가 없습니다. 다시 로그인해 주세요.');
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/recruit/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode: isDirector ? 'HIRING' : 'SEEKING', ...profile }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '프로필 저장 실패');
      setMessage(isDirector ? '병원/채용 기준이 저장되었습니다.' : '구직 선호조건이 저장되었습니다.');
      setProfileModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || '프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const savePosting = async () => {
    if (!userId) return setError('로그인 정보가 없습니다. 다시 로그인해 주세요.');
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/recruit/postings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...posting }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '공고 저장 실패');
      setMessage(posting.id ? '구인 공고가 수정되었습니다. 후보자 매칭을 갱신했습니다.' : '구인 공고가 등록되었습니다. 후보자 매칭을 갱신했습니다.');
      setPosting(emptyPosting(user || undefined));
      setPostingModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || '공고 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openNewPosting = () => {
    setPosting(emptyPosting(user || undefined));
    setPostingModalOpen(true);
  };

  const openEditPosting = (target: any) => {
    setPosting(postingToForm(target));
    setPostingModalOpen(true);
  };

  const deletePosting = async (postingId: string) => {
    if (!userId) return setError('로그인 정보가 없습니다. 다시 로그인해 주세요.');
    const ok = window.confirm('이 구인 공고를 삭제할까요?');
    if (!ok) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/recruit/postings?id=${encodeURIComponent(postingId)}&userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '공고 삭제 실패');
      setMessage('구인 공고가 삭제되었습니다.');
      if (selected?.posting?.id === postingId) setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.message || '공고 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const applyPostingHospital = (hospital: HospitalSuggestion) => {
    setPosting((prev) => ({
      ...prev,
      hospitalDirectoryId: hospital.id,
      hospitalName: hospital.name,
      locationAddress: hospital.address || prev.locationAddress,
      latitude: hospital.latitude ? String(hospital.latitude) : prev.latitude,
      longitude: hospital.longitude ? String(hospital.longitude) : prev.longitude,
    }));
  };

  const applyProfileAddress = (address: AddressSuggestion) => {
    setProfile((prev) => ({
      ...prev,
      locationAddress: address.address,
      latitude: String(address.latitude),
      longitude: String(address.longitude),
    }));
  };

  const applyPostingAddress = (address: AddressSuggestion) => {
    setPosting((prev) => ({
      ...prev,
      locationAddress: address.address,
      latitude: String(address.latitude),
      longitude: String(address.longitude),
    }));
  };

  const primaryLabel = isDirector ? '구인하기 · AI 후보 매칭' : '구직하기 · AI 병원 매칭';
  const topMatches = useMemo(() => matches.slice(0, 12), [matches]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        로그인 사용자 정보를 찾지 못했습니다. 로그인 후 이용해 주세요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        <div className="bg-[radial-gradient(circle_at_12%_10%,rgba(56,189,248,0.35),transparent_28%),linear-gradient(135deg,#0f172a_0%,#1e3a8a_52%,#0f766e_100%)] p-8">
          <p className="text-xs font-black tracking-[0.32em] text-cyan-100">AIMDNET RECRUIT INTELLIGENCE</p>
          <h2 className="mt-3 text-3xl font-black">{primaryLabel}</h2>
          <div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black text-cyan-50">
            {isDirector ? '원장/관리자 모드: 구인하기만 표시됩니다.' : '의료진 모드: 구직하기만 표시됩니다.'}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
            {isDirector
              ? '병원 원장/관리자 계정은 구인 공고를 등록하고, 전공·경력·근무조건·페이 기준으로 어울리는 의료진을 자동 추천받습니다.'
              : '의료진 계정은 희망 근무조건을 저장하면 진료과·근무시간·근무방법·페이·거리·중요도 기준으로 나에게 맞는 병원을 자동 추천받습니다.'}
          </p>
        </div>
      </section>

      {(error || message) && (
        <div className={`rounded-2xl border px-5 py-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Panel title={isDirector ? '매칭용 병원정보' : '내 구직 선호조건'} subtitle="버튼을 눌러 팝업에서 입력·저장·수정합니다.">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-black text-slate-900">{profile.specialty || '진료과 미입력'} · {profile.workHours || '시간 미입력'}</p>
              <p className="mt-1 text-xs text-slate-500">{profile.locationAddress || '기준 위치를 등록해 주세요.'}</p>
              <p className="mt-2 text-xs text-slate-500">{profile.workTypes.join(', ') || '근무형태 미입력'} · {profile.workMethods.join(', ') || '근무방식 미입력'}</p>
            </div>
            <button onClick={() => setProfileModalOpen(true)} className="h-11 w-full rounded-xl bg-blue-700 text-sm font-black text-white hover:bg-blue-800">
              {isDirector ? '병원정보 입력/수정' : '구직조건 입력/수정'}
            </button>
          </Panel>

          {isDirector && (
            <Panel title="구인 공고 관리" subtitle="공고를 여러 개 등록하고, 각 공고를 수정하거나 삭제할 수 있습니다.">
              <button onClick={openNewPosting} className="h-11 w-full rounded-xl bg-emerald-700 text-sm font-black text-white hover:bg-emerald-800">+ 새 구인 공고 등록</button>
              <div className="space-y-3">
                {postings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">등록된 구인 공고가 없습니다.</div>
                ) : postings.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{p.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{p.hospitalName} · {p.specialty || '전체과'} · {p.workHours || '시간 협의'}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{p.status}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openEditPosting(p)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">수정</button>
                      <button onClick={() => deletePosting(p.id)} className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title={isDirector ? 'AI 추천 후보 의료진' : 'AI 추천 병원'} subtitle={isDirector ? '후보 추천은 전공, 경력/소개, 희망 근무조건, 페이를 중심으로 표시합니다.' : '매칭 점수는 진료과, 페이, 근무시간, 근무방법, 거리, 우선순위를 합산합니다.'}>
            {topMatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                {isDirector ? '구인 공고를 등록하면 후보 의료진 추천이 표시됩니다.' : '구직 선호조건을 저장하면 추천 병원이 표시됩니다.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                {topMatches.map((match, idx) => <MatchCard key={`${match.posting?.id || idx}_${idx}`} match={match} isDirector={isDirector} onSelect={setSelected} />)}
              </div>
            )}
          </Panel>

          {selected && <RoutePanel match={selected} isDirector={isDirector} />}
        </div>
      </div>

      {profileModalOpen && (
        <Modal title={isDirector ? '매칭용 병원정보 입력/수정' : '내 구직 선호조건 입력/수정'} onClose={() => setProfileModalOpen(false)}>
          <ProfileForm profile={profile} setProfile={setProfile} isDirector={isDirector} loading={loading} onSave={saveProfile} onAddressSelect={applyProfileAddress} />
        </Modal>
      )}

      {postingModalOpen && isDirector && (
        <Modal title={posting.id ? '구인 공고 수정' : '구인 공고 등록'} onClose={() => setPostingModalOpen(false)}>
          <PostingFormView posting={posting} setPosting={setPosting} loading={loading} onSave={savePosting} onHospitalSelect={applyPostingHospital} onAddressSelect={applyPostingAddress} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-600 hover:bg-slate-200">닫기</button>
        </div>
        <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ProfileForm({ profile, setProfile, isDirector, loading, onSave, onAddressSelect }: { profile: FormState; setProfile: (profile: FormState) => void; isDirector: boolean; loading: boolean; onSave: () => void; onAddressSelect: (address: AddressSuggestion) => void }) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-black text-slate-600">{isDirector ? '병원 위치' : '내 기준 위치'}</span>
        <AddressAutocomplete
          value={profile.locationAddress}
          onChange={(value) => setProfile({ ...profile, locationAddress: value, latitude: '', longitude: '' })}
          onSelect={onAddressSelect}
          placeholder="도로명 또는 지번으로 검색하세요"
        />
      </label>
      <FormSelect label="해당과" value={profile.specialty} onChange={(v) => setProfile({ ...profile, specialty: v })} options={specialties} />
      <CheckGroup label={isDirector ? '채용 시간/형태' : '희망 시간/형태'} values={profile.workTypes} options={workTypeOptions} onChange={(v) => setProfile({ ...profile, workTypes: v })} />
      <CheckGroup label={isDirector ? '채용 업무 방식' : '희망 업무 방식'} values={profile.workMethods} options={workMethodOptions} onChange={(v) => setProfile({ ...profile, workMethods: v })} />
      <FormInput label={isDirector ? '채용 시간 상세' : '희망 근무시간'} value={profile.workHours} onChange={(v) => setProfile({ ...profile, workHours: v })} placeholder="예: 주 4일, 오전 진료만" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormInput label={isDirector ? '제시 최소 페이' : '희망 최소 페이'} value={profile.minPay} onChange={(v) => setProfile({ ...profile, minPay: v.replace(/\D/g, '') })} placeholder="만원" />
        <FormInput label={isDirector ? '제시 최대 페이' : '희망 최대 페이'} value={profile.maxPay} onChange={(v) => setProfile({ ...profile, maxPay: v.replace(/\D/g, '') })} placeholder="만원" />
      </div>
      <FormSelect label="가장 중요한 기준" value={profile.priority} onChange={(v) => setProfile({ ...profile, priority: v })} options={priorities.map((p) => p.value)} labels={Object.fromEntries(priorities.map((p) => [p.value, p.label]))} />
      {!isDirector && <FormInput label="시작 가능일" value={profile.availableFrom} onChange={(v) => setProfile({ ...profile, availableFrom: v })} placeholder="예: 즉시 / 2026-06-01" />}
      <FormTextarea label={isDirector ? '병원/채용 소개' : '소개/경력/요구사항'} value={profile.intro} onChange={(v) => setProfile({ ...profile, intro: v })} placeholder={isDirector ? '진료량, 장비, 복지, 협진 구조 등을 입력하세요.' : '경력, 가능한 업무, 중요한 조건을 입력하세요.'} />
      <button onClick={onSave} disabled={loading} className="h-11 w-full rounded-xl bg-blue-700 text-sm font-black text-white hover:bg-blue-800 disabled:bg-slate-300">
        {loading ? '저장 중...' : isDirector ? '병원정보 저장 후 후보 매칭' : '구직조건 저장 후 병원 매칭'}
      </button>
    </div>
  );
}

function PostingFormView({ posting, setPosting, loading, onSave, onHospitalSelect, onAddressSelect }: { posting: PostingForm; setPosting: (posting: PostingForm) => void; loading: boolean; onSave: () => void; onHospitalSelect: (hospital: HospitalSuggestion) => void; onAddressSelect: (address: AddressSuggestion) => void }) {
  return (
    <div className="space-y-4">
      <FormInput label="공고 제목" value={posting.title} onChange={(v) => setPosting({ ...posting, title: v })} />
      <label className="block">
        <span className="mb-1 block text-xs font-black text-slate-600">병원명</span>
        <HospitalAutocomplete
          value={posting.hospitalName}
          onChange={(value) => setPosting({ ...posting, hospitalName: value, hospitalDirectoryId: '' })}
          onSelect={onHospitalSelect}
          placeholder="병의원명을 입력하면 전국 병의원 DB에서 자동검색됩니다"
          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
        {posting.hospitalDirectoryId && <p className="mt-1 text-xs font-bold text-emerald-600">공식 병의원 DB와 연결되었습니다.</p>}
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black text-slate-600">근무지 주소</span>
        <AddressAutocomplete
          value={posting.locationAddress}
          onChange={(value) => setPosting({ ...posting, locationAddress: value, latitude: '', longitude: '' })}
          onSelect={onAddressSelect}
          placeholder="도로명 또는 지번으로 검색하세요"
        />
      </label>
      <FormSelect label="해당과" value={posting.specialty} onChange={(v) => setPosting({ ...posting, specialty: v })} options={specialties} />
      <CheckGroup label="근무 시간/형태" values={posting.workTypes} options={workTypeOptions} onChange={(v) => setPosting({ ...posting, workTypes: v })} />
      <CheckGroup label="근무 방법" values={posting.workMethods} options={workMethodOptions} onChange={(v) => setPosting({ ...posting, workMethods: v })} />
      <FormInput label="근무 시간 상세" value={posting.workHours} onChange={(v) => setPosting({ ...posting, workHours: v })} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormInput label="최소 페이" value={posting.payMin} onChange={(v) => setPosting({ ...posting, payMin: v.replace(/\D/g, '') })} placeholder="만원" />
        <FormInput label="최대 페이" value={posting.payMax} onChange={(v) => setPosting({ ...posting, payMax: v.replace(/\D/g, '') })} placeholder="만원" />
      </div>
      <FormSelect label="중요 기준" value={posting.priority} onChange={(v) => setPosting({ ...posting, priority: v })} options={priorities.map((p) => p.value)} labels={Object.fromEntries(priorities.map((p) => [p.value, p.label]))} />
      <FormTextarea label="공고 설명" value={posting.description} onChange={(v) => setPosting({ ...posting, description: v })} placeholder="진료량, 장비, 복지, 협진 구조 등을 입력하세요." />
      <button onClick={onSave} disabled={loading} className="h-11 w-full rounded-xl bg-emerald-700 text-sm font-black text-white hover:bg-emerald-800 disabled:bg-slate-300">
        {loading ? '저장 중...' : posting.id ? '구인 공고 수정 저장' : '구인 공고 등록'}
      </button>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function FormInput({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}

function FormTextarea({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-600">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}

function FormSelect({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
        {options.map((opt) => <option key={opt} value={opt}>{labels[opt] || opt}</option>)}
      </select>
    </label>
  );
}

function CheckGroup({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  return (
    <div>
      <span className="mb-2 block text-xs font-black text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(toggle(values, opt))} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${values.includes(opt) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match, isDirector, onSelect }: { match: any; isDirector: boolean; onSelect: (match: any) => void }) {
  const targetTitle = isDirector ? `${match.candidate?.user?.name || '후보 의료진'} ${match.candidate?.specialty || ''}` : match.posting?.title;
  const sub = isDirector ? `${match.candidate?.user?.jobTitle || '의료진'} · ${match.candidate?.workHours || '근무시간 협의'}` : `${match.posting?.hospitalName} · ${match.posting?.specialty || '전체과'}`;
  const candidateCareer = match.candidate?.intro || match.candidate?.user?.jobTitle || '경력 미입력';
  const candidatePay = match.candidate?.minPay || match.candidate?.maxPay ? `${match.candidate?.minPay || '협의'}~${match.candidate?.maxPay || '협의'}만원` : '페이 협의';
  const displayReasons = (match.score?.reasons || []).filter((reason: string) => !isDirector || !/거리|출퇴근|차량/.test(reason));
  return (
    <button onClick={() => onSelect(match)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-black text-slate-900">{targetTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{sub}</p>
        </div>
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">{match.score?.score}점</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        {isDirector ? (
          <>
            <Metric label="전공" value={match.candidate?.specialty || match.candidate?.user?.specialty || '미입력'} />
            <Metric label="경력/직함" value={String(candidateCareer).slice(0, 16)} />
            <Metric label="희망 페이" value={candidatePay} />
          </>
        ) : (
          <>
            <Metric label="등급" value={match.score?.grade || '-'} />
            <Metric label="거리" value={match.route?.distanceKm ? `${match.route.distanceKm}km` : '지도확인'} />
            <Metric label="차량" value={match.route?.drivingMinutes ? `${match.route.drivingMinutes}분` : '확인'} />
          </>
        )}
      </div>
      <ul className="mt-4 space-y-1 text-xs leading-5 text-slate-600">
        {displayReasons.slice(0, 3).map((r: string) => <li key={r}>• {r}</li>)}
      </ul>
      {(match.score?.warnings || []).length > 0 && <p className="mt-3 text-xs font-bold text-amber-700">조건 확인: {match.score.warnings[0]}</p>}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-2 py-3">
      <p className="text-[10px] font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-800">{value}</p>
    </div>
  );
}

function RoutePanel({ match, isDirector }: { match: any; isDirector: boolean }) {
  const initialRoute = match.route || {};
  const [liveRoute, setLiveRoute] = useState<any>(initialRoute);
  const [routeLoading, setRouteLoading] = useState(false);
  const posting = match.posting || {};
  const candidate = match.candidate || {};

  useEffect(() => {
    const route = match.route || {};
    const originAddress = route.originAddress || (isDirector ? candidate.locationAddress : '');
    const destinationAddress = route.destinationAddress || posting.locationAddress || '';
    setLiveRoute(route);
    if (isDirector) return;
    if (!originAddress || !destinationAddress) return;

    let cancelled = false;
    setRouteLoading(true);
    fetch('/api/recruit/route-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originAddress,
        destinationAddress,
        originLat: isDirector ? candidate.latitude : route.originLat,
        originLng: isDirector ? candidate.longitude : route.originLng,
        destinationLat: posting.latitude,
        destinationLng: posting.longitude,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && data.route) setLiveRoute(data.route);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [match, isDirector, candidate.locationAddress, candidate.latitude, candidate.longitude, posting.locationAddress, posting.latitude, posting.longitude]);

  const route = liveRoute || {};
  const origin = route.originAddress || (isDirector ? (candidate.locationAddress || '후보 위치') : '내 위치');
  const destination = route.destinationAddress || posting.locationAddress || '병원 위치';
  const detailReasons = (match.score?.reasons || []).filter((reason: string) => !isDirector || !/거리|출퇴근|차량/.test(reason));
  const detailWarnings = (match.score?.warnings || ['면접 전 실제 근무조건과 계약조건을 확인하세요.']).filter((warning: string) => !isDirector || !/거리|출퇴근|좌표/.test(warning));
  return (
    <Panel title={isDirector ? '추천 후보의사 상세' : '추천 상세 및 이동 경로'} subtitle={isDirector ? '후보의 전공, 경력, 희망 조건을 중심으로 확인합니다.' : '추천 병원 위치와 이동 정보를 확인합니다.'}>
      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-black text-slate-900">{isDirector ? `${candidate.user?.name || '후보'} 매칭` : posting.title}</p>
            <p className="mt-1 text-sm text-slate-600">{isDirector ? `${candidate.specialty || candidate.user?.specialty || '전공 미입력'} · ${candidate.user?.jobTitle || '직함 미입력'}` : `${posting.hospitalName} · ${posting.locationAddress}`}</p>
          </div>
          <span className="rounded-full bg-blue-700 px-4 py-2 text-sm font-black text-white">AI Match {match.score?.score}점</span>
        </div>
        {isDirector ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Metric label="전공" value={candidate.specialty || candidate.user?.specialty || '미입력'} />
            <Metric label="경력/직함" value={candidate.intro ? String(candidate.intro).slice(0, 18) : candidate.user?.jobTitle || '미입력'} />
            <Metric label="희망 조건" value={candidate.workMethods || candidate.workTypes || '협의'} />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="차량" value={routeLoading ? '계산 중' : route.drivingMinutes ? `${route.drivingMinutes}분` : '지도 확인'} />
              <Metric label="거리" value={route.distanceKm ? `${route.distanceKm}km` : '주소 기반'} />
              <Metric label="대중교통" value={route.transitMinutes ? `${route.transitMinutes}분` : '지도 확인'} />
              <Metric label="도보" value={route.walkingMinutes ? `${route.walkingMinutes}분` : '지도 확인'} />
            </div>
            <div className="mt-5 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700">
              <strong>경로:</strong> {origin} → {destination}
            </div>
          </>
        )}
        {route.naverUrl && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={route.naverUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#03c75a] px-4 py-2 text-xs font-black text-white">네이버지도 보기</a>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="font-black text-slate-900">추천 이유</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {(detailReasons.length ? detailReasons : ['전공, 희망 조건, 페이 기준으로 검토할 수 있습니다.']).map((r: string) => <li key={r}>• {r}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-black text-amber-900">확인할 조건</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-800">
            {(detailWarnings.length ? detailWarnings : ['면접 전 실제 근무조건과 계약조건을 확인하세요.']).map((r: string) => <li key={r}>• {r}</li>)}
          </ul>
        </div>
      </div>
      {(posting.hospitalDirectory || posting.hospitalDirectoryId) && (
        <HospitalDetailPanel hospitalId={posting.hospitalDirectoryId} hospital={posting.hospitalDirectory} />
      )}
    </Panel>
  );
}
