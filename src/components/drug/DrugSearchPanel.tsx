'use client';

import { useMemo, useState } from 'react';

type DrugItem = {
  id: string;
  productName: string;
  ingredientName: string;
  company: string;
  priceLabel: string;
  releaseDate: string;
  usageFrequency: number;
};

type SortKey = 'price' | 'releaseDate' | 'usageFrequency';
type SortDirection = 'asc' | 'desc';

function parsePrice(value: string) {
  const n = Number((value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : -1;
}

function parseDate(value: string) {
  if (!value) return 0;
  const normalized = value.replace(/\./g, '-').replace(/\//g, '-').trim();
  const t = new Date(normalized).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getUsageFrequencyRange(qty: number) {
  if (qty >= 100000) return '10만건 이상 (매우 높음)';
  if (qty >= 50000) return '5만건~10만건 (높음)';
  if (qty >= 10000) return '1만건~5만건 (보통)';
  if (qty > 0) return '1만건 미만 (낮음)';
  return '-';
}

export default function DrugSearchPanel() {
  const [form, setForm] = useState({
    productName: '',
    ingredientName: '',
    company: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<DrugItem[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedItems = useMemo(() => {
    const copied = [...items];

    copied.sort((a, b) => {
      let av = 0;
      let bv = 0;

      if (sortKey === 'price') {
        av = parsePrice(a.priceLabel);
        bv = parsePrice(b.priceLabel);
      } else if (sortKey === 'releaseDate') {
        av = parseDate(a.releaseDate);
        bv = parseDate(b.releaseDate);
      } else {
        av = a.usageFrequency || 0;
        bv = b.usageFrequency || 0;
      }

      const diff = av - bv;
      return sortDirection === 'asc' ? diff : -diff;
    });

    return copied;
  }, [items, sortKey, sortDirection]);

  const handleSearch = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/drugs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || '검색 중 오류가 발생했습니다.');
      }

      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || '검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ productName: '', ingredientName: '', company: '' });
    setItems([]);
    setError('');
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 mb-10 w-full animate-in fade-in zoom-in duration-300">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">의약품 검색</h2>
          <span className="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-md shadow-sm">리스트 정렬 지원</span>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">제품명</label>
            <input
              value={form.productName}
              onChange={(e) => setForm((prev) => ({ ...prev, productName: e.target.value }))}
              type="text"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="예: 타이레놀"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">주성분</label>
            <input
              value={form.ingredientName}
              onChange={(e) => setForm((prev) => ({ ...prev, ingredientName: e.target.value }))}
              type="text"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="예: 아세트아미노펜"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">제조사</label>
            <input
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              type="text"
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="예: 한국얀센"
            />
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3 p-5 sm:p-6">
          <button onClick={handleReset} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100">
            초기화
          </button>
          <button onClick={handleSearch} disabled={loading} className="px-10 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {loading ? '검색 중...' : '의약품 검색'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center gap-3 justify-between">
          <span className="text-sm font-bold text-slate-700">검색 결과 ({sortedItems.length})</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">정렬 기준</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="price">가격</option>
              <option value="releaseDate">출시일</option>
              <option value="usageFrequency">사용빈도</option>
            </select>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value as SortDirection)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
          </div>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">제품명</th>
                <th className="px-3 py-2 text-left">가격/급여구분</th>
                <th className="px-3 py-2 text-left">주성분</th>
                <th className="px-3 py-2 text-left">제조사</th>
                <th className="px-3 py-2 text-left">처방빈도(공공값)</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id} className="border-t hover:bg-blue-50">
                  <td className="px-3 py-2 font-semibold text-blue-700">{item.productName || '-'}</td>
                  <td className="px-3 py-2">{item.priceLabel || '-'}</td>
                  <td className="px-3 py-2">{item.ingredientName || '-'}</td>
                  <td className="px-3 py-2">{item.company || '-'}</td>
                  <td className="px-3 py-2">{getUsageFrequencyRange(item.usageFrequency)}</td>
                </tr>
              ))}
              {!loading && sortedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
