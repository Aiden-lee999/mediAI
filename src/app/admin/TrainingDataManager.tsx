'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

type TrainingExample = {
  id: string;
  userId: string;
  user?: { name?: string | null; specialty?: string | null; doctorLicense?: string | null } | null;
  sessionId?: string | null;
  rating: string;
  source: string;
  prompt: string;
  response: string;
  responseJson?: any;
  history?: any;
  comment?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

const statusLabels: Record<string, string> = {
  RAW: '검수 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  EXPORTED: '학습 반영',
};

const ratingLabels: Record<string, string> = {
  LIKE: '좋아요',
  DISLIKE: '싫어요',
  COMMENT: '의견',
  CORRECTION: '수정 제안',
};

function statusClass(status: string) {
  if (status === 'APPROVED') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'EXPORTED') return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-yellow-100 text-yellow-800 border-yellow-200';
}

function ratingClass(rating: string) {
  if (rating === 'LIKE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (rating === 'DISLIKE') return 'bg-red-50 text-red-700 border-red-200';
  if (rating === 'COMMENT') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function TrainingDataManager() {
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [selected, setSelected] = useState<TrainingExample | null>(null);
  const [status, setStatus] = useState('RAW');
  const [rating, setRating] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editResponse, setEditResponse] = useState('');
  const [editComment, setEditComment] = useState('');

  const stats = useMemo(() => {
    return examples.reduce((acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, { total: 0 } as Record<string, number>);
  }, [examples]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (status !== 'ALL') params.set('status', status);
      if (rating !== 'ALL') params.set('rating', rating);
      const res = await fetch(`/api/training-feedback?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '학습 데이터 조회 실패');
      setExamples(data.examples || []);
      if (selected && !data.examples?.some((item: TrainingExample) => item.id === selected.id)) setSelected(null);
    } catch (error: any) {
      setMessage(error?.message || '학습 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status, rating]);

  const open = (item: TrainingExample) => {
    setSelected(item);
    setEditPrompt(item.prompt || '');
    setEditResponse(item.response || '');
    setEditComment(item.comment || '');
  };

  const updateExample = async (nextStatus: string) => {
    if (!selected) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/training-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          status: nextStatus,
          prompt: editPrompt,
          response: editResponse,
          comment: editComment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '검수 상태 저장 실패');
      setMessage(`${statusLabels[nextStatus] || nextStatus} 처리되었습니다.`);
      setSelected(null);
      await load();
    } catch (error: any) {
      setMessage(error?.message || '검수 상태 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const exportUrl = '/api/training-feedback?format=jsonl&limit=200';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">AIMDNET 학습 데이터 검수</h3>
          <p className="mt-1 text-sm text-slate-500">좋아요/의견/수정 피드백을 확인하고 fine-tuning에 쓸 데이터만 승인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportUrl} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">JSONL 다운로드</a>
          <button onClick={load} disabled={loading} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">새로고침</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="현재 목록" value={stats.total || 0} />
        <Stat label="검수 대기" value={stats.RAW || 0} />
        <Stat label="승인" value={stats.APPROVED || 0} />
        <Stat label="반려" value={stats.REJECTED || 0} />
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="text-sm font-bold text-slate-600">
          상태
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="RAW">검수 대기</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
            <option value="EXPORTED">학습 반영</option>
            <option value="ALL">전체</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-600">
          평가
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="ALL">전체</option>
            <option value="LIKE">좋아요</option>
            <option value="DISLIKE">싫어요</option>
            <option value="COMMENT">의견</option>
            <option value="CORRECTION">수정 제안</option>
          </select>
        </label>
        {message && <div className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-blue-700">{message}</div>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="max-h-[680px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="p-3">상태</th>
                  <th className="p-3">평가</th>
                  <th className="p-3">질문/답변</th>
                  <th className="p-3">사용자</th>
                  <th className="p-3">생성일</th>
                </tr>
              </thead>
              <tbody>
                {loading && examples.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">불러오는 중...</td></tr>
                ) : examples.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">조건에 맞는 학습 데이터가 없습니다.</td></tr>
                ) : examples.map((item) => (
                  <tr key={item.id} onClick={() => open(item)} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50 ${selected?.id === item.id ? 'bg-blue-50' : ''}`}>
                    <td className="p-3"><Badge className={statusClass(item.status)}>{statusLabels[item.status] || item.status}</Badge></td>
                    <td className="p-3"><Badge className={ratingClass(item.rating)}>{ratingLabels[item.rating] || item.rating}</Badge></td>
                    <td className="p-3">
                      <p className="line-clamp-1 font-bold text-slate-900">{item.prompt || '질문 없음'}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.response || item.comment || '답변/의견 없음'}</p>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      <div className="font-bold text-slate-700">{item.user?.name || '사용자'}</div>
                      <div>{item.user?.doctorLicense || item.userId.slice(0, 8)}</div>
                    </td>
                    <td className="p-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="flex min-h-80 items-center justify-center text-center text-sm text-slate-500">왼쪽 목록에서 검수할 학습 데이터를 선택하세요.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusClass(selected.status)}>{statusLabels[selected.status] || selected.status}</Badge>
                <Badge className={ratingClass(selected.rating)}>{ratingLabels[selected.rating] || selected.rating}</Badge>
                <span className="text-xs text-slate-400">{selected.source}</span>
              </div>
              <Field label="질문 / 프롬프트">
                <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} className="min-h-32 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </Field>
              <Field label="AI 답변 / 승인될 정답 예시">
                <textarea value={editResponse} onChange={(e) => setEditResponse(e.target.value)} className="min-h-48 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </Field>
              <Field label="검수 의견 / 수정 코멘트">
                <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="왜 승인/반려하는지, 수정한 이유를 남기세요." />
              </Field>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button onClick={() => updateExample('APPROVED')} disabled={loading} className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-50">수정 후 승인</button>
                <button onClick={() => updateExample('REJECTED')} disabled={loading} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">반려</button>
                <button onClick={() => updateExample('RAW')} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">대기로 되돌림</button>
              </div>
              <details className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                <summary className="cursor-pointer font-bold text-slate-700">원본 JSON/대화 이력 보기</summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({ responseJson: selected.responseJson, history: selected.history }, null, 2)}</pre>
              </details>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-600">{label}</span>
      {children}
    </label>
  );
}
