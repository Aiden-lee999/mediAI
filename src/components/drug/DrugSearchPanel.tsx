'use client';

import { useEffect, useMemo, useState } from 'react';

type DrugItem = {
  id: string;
  productName: string;
  ingredientName: string;
  company: string;
  priceLabel: string;
  reimbursement: string;
  insuranceCode: string;
  standardCode: string;
  atcCode: string;
  type: string;
  releaseDate: string;
  usageFrequency: number;
  brandClass?: '오리지널(대장약)' | '복제약(제네릭)';
};

type DrugPackageInfo = {
  label: string;
  standardCode: string;
};

type DrugDetail = {
  productName: string;
  type: string;
  company: string;
  seller: string;
  productionStatus: string;
  insuranceInfo: string;
  ministryClass: string;
  kimsClass: string;
  atcCode: string;
  ingredientCode: string;
  ingredientContent: string;
  additives: string;
  packageInfo: DrugPackageInfo[];
  imageUrl?: string;
};

type SortKey = 'price' | 'releaseDate' | 'usageFrequency' | 'brandClass';
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

function cleanProductName(value: string) {
  return (value || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function DrugSearchPanel() {
  const [form, setForm] = useState({
    productName: '',
    ingredientName: '',
    company: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastMeta, setLastMeta] = useState('');
  const [items, setItems] = useState<DrugItem[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DrugItem | null>(null);
  const [detail, setDetail] = useState<DrugDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    // Warm up the search API in background to reduce first interactive request latency.
    void fetch('/api/drugs/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName: '타이레놀' }),
      cache: 'no-store',
    }).catch(() => {
      // Ignore warm-up failures silently; this should not affect UX.
    });
  }, []);

  const sortedItems = useMemo(() => {
    const copied = [...items];

    copied.sort((a, b) => {
      const classRank = (v: DrugItem['brandClass']) => (v === '오리지널(대장약)' ? 0 : 1);
      const classDiff = classRank(a.brandClass) - classRank(b.brandClass);
      if (classDiff !== 0) return classDiff;

      let av = 0;
      let bv = 0;

      if (sortKey === 'price') {
        av = parsePrice(a.priceLabel);
        bv = parsePrice(b.priceLabel);
      } else if (sortKey === 'releaseDate') {
        av = parseDate(a.releaseDate);
        bv = parseDate(b.releaseDate);
      } else if (sortKey === 'brandClass') {
        av = a.brandClass === '오리지널(대장약)' ? 0 : 1;
        bv = b.brandClass === '오리지널(대장약)' ? 0 : 1;
      } else {
        av = a.usageFrequency || 0;
        bv = b.usageFrequency || 0;
      }

      const diff = av - bv;
      if (diff !== 0) return sortDirection === 'asc' ? diff : -diff;

      const freqDiff = (b.usageFrequency || 0) - (a.usageFrequency || 0);
      if (freqDiff !== 0) return freqDiff;
      return cleanProductName(a.productName).localeCompare(cleanProductName(b.productName), 'ko');
    });

    return copied;
  }, [items, sortKey, sortDirection]);

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setLastMeta('');

    try {
      const res = await fetch('/api/drugs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        cache: 'no-store',
      });

      const dataTxt = await res.text();
      let data: any;

      try {
        data = JSON.parse(dataTxt);
      } catch {
        data = null;
      }

      // Fallback: when POST fails/parsing fails/empty list, retry through GET keyword endpoint.
      const needsFallback = !res.ok || !data?.success || !Array.isArray(data?.items) || data.items.length === 0;
      if (needsFallback) {
        const fallbackKeyword = (form.productName || form.ingredientName || form.company || '').trim();
        const keyword = encodeURIComponent(fallbackKeyword);
        const fallbackRes = await fetch(`/api/drugs/search?keyword=${keyword}`, { cache: 'no-store' });
        const fallbackTxt = await fallbackRes.text();
        let fallbackData: any;
        try {
          fallbackData = JSON.parse(fallbackTxt);
        } catch {
          throw new Error('API 응답 해석 실패: ' + fallbackTxt.substring(0, 120));
        }

        if (!fallbackRes.ok || !fallbackData?.success || !Array.isArray(fallbackData?.items)) {
          throw new Error(fallbackData?.error || fallbackData?.message || '검색 중 오류가 발생했습니다.');
        }

        setItems(fallbackData.items);
        setLastMeta(`GET fallback 결과 ${fallbackData.items.length}건`);
        return;
      }

      setItems(data.items);
      setLastMeta(`POST 결과 ${data.items.length}건`);
    } catch (e: any) {
      setError(e?.message || '검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ productName: '', ingredientName: '', company: '' });
    setItems([]);
    setSelectedDrug(null);
    setDetail(null);
    setDetailError('');
    setError('');
  };

  const handleSelectDrug = async (item: DrugItem) => {
    setSelectedDrug(item);
    setDetailLoading(true);
    setDetailError('');

    try {
      const res = await fetch('/api/drugs/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: cleanProductName(item.productName),
          company: item.company,
          standardCode: item.standardCode,
          insuranceCode: item.insuranceCode,
          atcCode: item.atcCode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success || !data?.detail) {
        throw new Error(data?.message || '상세 정보 조회에 실패했습니다.');
      }

      setDetail(data.detail as DrugDetail);
    } catch (e: any) {
      setDetail(null);
      setDetailError(e?.message || '상세 정보 조회 중 오류가 발생했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="max-w-[1650px] mx-auto p-4 sm:p-6 mb-10 w-full animate-in fade-in zoom-in duration-300">
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
      {!error && lastMeta && (
        <div className="mt-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-700">{lastMeta}</div>
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
              <option value="brandClass">대장약/복제약</option>
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
                <th className="px-3 py-2 text-left">구분</th>
                <th className="px-3 py-2 text-left">주성분</th>
                <th className="px-3 py-2 text-left">제조사</th>
                <th className="px-3 py-2 text-left">처방빈도(공공값)</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, idx) => (
                <tr
                  key={`${item.id}-${idx}`}
                  className={`border-t hover:bg-blue-50 cursor-pointer ${selectedDrug?.id === item.id ? 'bg-blue-50' : ''}`}
                  onClick={() => handleSelectDrug(item)}
                >
                  <td className="px-3 py-2 font-semibold text-blue-700">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSelectDrug(item);
                      }}
                      className="text-left text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {cleanProductName(item.productName) || '-'}
                    </button>
                  </td>
                  <td className="px-3 py-2">{item.priceLabel || '-'}</td>
                  <td className="px-3 py-2">{item.brandClass || '복제약(제네릭)'}</td>
                  <td className="px-3 py-2">{item.ingredientName || '-'}</td>
                  <td className="px-3 py-2">{item.company || '-'}</td>
                  <td className="px-3 py-2">{getUsageFrequencyRange(item.usageFrequency)}</td>
                </tr>
              ))}
              {!loading && sortedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <span className="text-sm font-bold text-slate-700">약제 상세 정보</span>
        </div>

        {!selectedDrug && (
          <div className="px-4 py-8 text-sm text-slate-500">검색 결과에서 약제를 클릭하면 상세 정보가 표시됩니다.</div>
        )}

        {selectedDrug && detailLoading && (
          <div className="px-4 py-8 text-sm text-slate-500">상세 정보를 불러오는 중입니다...</div>
        )}

        {selectedDrug && !detailLoading && detailError && (
          <div className="px-4 py-8 text-sm text-red-600">{detailError}</div>
        )}

        {selectedDrug && !detailLoading && detail && (
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">구분</div>
                <div>{detail.type || selectedDrug.type || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">업체명</div>
                <div>{detail.company || selectedDrug.company || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">판매사</div>
                <div>{detail.seller || detail.company || selectedDrug.company || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">생산판매현황</div>
                <div>{detail.productionStatus || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">보험정보</div>
                <div>{detail.insuranceInfo || `${selectedDrug.insuranceCode || '-'} / ${selectedDrug.priceLabel || '-'}`}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">복지부 분류</div>
                <div>{detail.ministryClass || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">KIMS 분류</div>
                <div>{detail.kimsClass || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">ATC 코드</div>
                <div>{detail.atcCode || selectedDrug.atcCode || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">주성분코드</div>
                <div>{detail.ingredientCode || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">성분 및 함량</div>
                <div className="whitespace-pre-wrap break-words">{detail.ingredientContent || selectedDrug.ingredientName || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1 border-b border-slate-100">
                <div className="font-semibold text-slate-700">첨가제</div>
                <div className="whitespace-pre-wrap break-words">{detail.additives || '-'}</div>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 py-1">
                <div className="font-semibold text-slate-700">포장정보(표준코드)</div>
                <div className="space-y-1">
                  {(detail.packageInfo || []).map((pkg, idx) => (
                    <div key={`${pkg.standardCode}-${idx}`} className="text-xs sm:text-sm">
                      {pkg.label} {pkg.standardCode ? ` ${pkg.standardCode}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-start justify-center">
              {detail.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.imageUrl} alt={detail.productName || selectedDrug.productName} className="w-full max-w-[220px] rounded-lg border border-slate-200 object-contain bg-white" />
              ) : (
                <div className="w-full max-w-[220px] h-[150px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 flex items-center justify-center text-center p-3">
                  식별 이미지 없음
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
