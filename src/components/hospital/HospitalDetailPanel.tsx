'use client';

import { useEffect, useState } from 'react';

type Props = {
  hospitalId?: string;
  hospital?: any;
  editable?: boolean;
  onUpdated?: (hospital: any) => void;
};

const editableFields = [
  ['phone', '전화번호'],
  ['homepage', '홈페이지'],
  ['address', '주소'],
  ['parkingCapacity', '주차 가능대수'],
  ['parkingPaid', '주차 비용 부담'],
  ['parkingNote', '주차 안내'],
  ['closedSunday', '일요일 휴진'],
  ['closedHoliday', '공휴일 휴진'],
  ['lunchWeekday', '평일 점심시간'],
  ['lunchSaturday', '토요일 점심시간'],
  ['receptionWeekday', '평일 접수시간'],
  ['receptionSaturday', '토요일 접수시간'],
] as const;

function formatTime(value?: number | null) {
  if (!value) return '-';
  const raw = String(value).padStart(4, '0');
  return `${raw.slice(0, -2)}:${raw.slice(-2)}`;
}

export default function HospitalDetailPanel({ hospitalId, hospital: initialHospital, editable = false, onUpdated }: Props) {
  const [hospital, setHospital] = useState<any>(initialHospital || null);
  const [draft, setDraft] = useState<any>(initialHospital || {});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialHospital) {
      setHospital(initialHospital);
      setDraft(initialHospital);
      return;
    }
    if (!hospitalId) return;
    setLoading(true);
    fetch(`/api/hospitals/${hospitalId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.hospital) {
          setHospital(data.hospital);
          setDraft(data.hospital);
        }
      })
      .finally(() => setLoading(false));
  }, [hospitalId, initialHospital]);

  const save = async () => {
    if (!hospital?.id) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/hospitals/${hospital.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '저장 실패');
      setHospital(data.hospital);
      setDraft(data.hospital);
      onUpdated?.(data.hospital);
      setMessage('병원 정보가 수정되었습니다.');
    } catch (error: any) {
      setMessage(error?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">병원 정보를 불러오는 중입니다...</div>;
  if (!hospital) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">선택된 병원 정보가 없습니다.</div>;

  const naverUrl = hospital.naverMapUrl || `https://map.naver.com/p/search/${encodeURIComponent(`${hospital.name} ${hospital.address || ''}`)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">{hospital.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{hospital.typeName || '의료기관'} · {hospital.sidoName || ''} {hospital.sigunguName || ''}</p>
          <p className="mt-1 text-sm text-slate-500">{hospital.address || '주소 정보 없음'}</p>
        </div>
        <a href={naverUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#03c75a] px-4 py-2 text-xs font-black text-white">네이버지도 보기</a>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <Info label="전화" value={hospital.phone} />
        <Info label="총 의사수" value={hospital.totalDoctors ? `${hospital.totalDoctors}명` : '-'} />
        <Info label="전문의" value={hospital.specialists ? `${hospital.specialists}명` : '-'} />
        <Info label="평일 접수" value={hospital.receptionWeekday} />
        <Info label="토요일 접수" value={hospital.receptionSaturday} />
        <Info label="점심시간" value={hospital.lunchWeekday} />
        <Info label="응급실 주간" value={hospital.erDayAvailable === 'Y' ? `운영 ${hospital.erDayPhone1 || ''}` : '미운영/확인필요'} />
        <Info label="응급실 야간" value={hospital.erNightAvailable === 'Y' ? `운영 ${hospital.erNightPhone1 || ''}` : '미운영/확인필요'} />
        <Info label="주차" value={hospital.parkingCapacity ? `${hospital.parkingCapacity}대 · ${hospital.parkingPaid || ''}` : hospital.parkingNote || '-'} />
      </div>

      {hospital.id && hospital.latitude && hospital.longitude && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <img src={`/api/hospitals/${hospital.id}/map?w=900&h=360`} alt={`${hospital.name} 네이버 지도`} className="h-72 w-full object-cover" />
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
        <strong className="mb-2 block text-slate-900">진료시간</strong>
        월 {formatTime(hospital.mondayStart)}~{formatTime(hospital.mondayEnd)} · 화 {formatTime(hospital.tuesdayStart)}~{formatTime(hospital.tuesdayEnd)} · 수 {formatTime(hospital.wednesdayStart)}~{formatTime(hospital.wednesdayEnd)} · 목 {formatTime(hospital.thursdayStart)}~{formatTime(hospital.thursdayEnd)} · 금 {formatTime(hospital.fridayStart)}~{formatTime(hospital.fridayEnd)} · 토 {formatTime(hospital.saturdayStart)}~{formatTime(hospital.saturdayEnd)} · 일 {formatTime(hospital.sundayStart)}~{formatTime(hospital.sundayEnd)}
      </div>

      {editable && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="mb-3 text-sm font-black text-slate-800">병원 정보 수정</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {editableFields.map(([field, label]) => (
              <label key={field} className="text-xs font-bold text-slate-500">
                {label}
                <input
                  value={draft?.[field] ?? ''}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
          <button onClick={save} disabled={saving} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:bg-slate-300">
            {saving ? '저장 중...' : '수정 저장'}
          </button>
          {message && <span className="ml-3 text-xs text-slate-500">{message}</span>}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-black text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{value || '-'}</div>
    </div>
  );
}
