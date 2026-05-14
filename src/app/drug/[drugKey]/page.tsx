'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

type SectionKey = 'efficacy' | 'usage' | 'caution' | 'insurance' | 'alt_dur';

type DrugLike = {
  id?: string;
  productName?: string;
  ingredientName?: string;
  company?: string;
  reimbursement?: string;
  priceLabel?: string;
  insuranceCode?: string;
  standardCode?: string;
  atcCode?: string;
  type?: string;
  releaseDate?: string;
  usageFrequency?: number;
  brandClass?: string;
  imageUrl?: string;
};

function toText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function cleanText(value: unknown) {
  const text = toText(value)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';
  const lowered = text.toLowerCase();
  if (['null', 'undefined', 'nan', '-', '데이터 없음', '없음'].includes(lowered)) return '';
  return text;
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractLongText(detail: any) {
  const raw = detail?.raw || {};
  const easy = raw.easyItem || {};
  const permit = raw.permitItem || {};

  const efficacy =
    cleanText(detail?.efficacyText) ||
    cleanText(easy?.efcyQesitm) ||
    cleanText(easy?.EE_DOC_DATA) ||
    cleanText(permit?.eeDocData);
  const usage =
    cleanText(detail?.usageText) ||
    cleanText(easy?.useMethodQesitm) ||
    cleanText(easy?.UD_DOC_DATA) ||
    cleanText(permit?.udDocData);
  const caution =
    cleanText(detail?.cautionText) ||
    cleanText(easy?.atpnWarnQesitm) ||
    cleanText(easy?.atpnQesitm) ||
    cleanText(easy?.NB_DOC_DATA) ||
    cleanText(permit?.nbDocData);

  return {
    efficacy: efficacy || '데이터 없음',
    usage: usage || '데이터 없음',
    caution: caution || '데이터 없음',
  };
}

function hasText(value: string) {
  return !!(value || '').trim() && value !== '데이터 없음';
}

function fallbackClinicalText(drug: DrugLike) {
  const text = `${drug.productName || ''} ${drug.ingredientName || ''}`.toLowerCase();
  const atc = (drug.atcCode || '').toUpperCase();
  if (text.includes('아세트아미노펜') || text.includes('acetaminophen') || text.includes('paracetamol') || text.includes('프로파세타몰') || atc.startsWith('N02BE')) {
    return {
      efficacyText: '아세트아미노펜 계열 약제는 해열 및 진통 목적으로 사용됩니다. 두통, 치통, 근육통, 월경통 등 통증 완화와 감기 등에서 동반되는 발열 완화에 사용되는 성분입니다.',
      usageText: '제품별 함량과 제형에 따라 용법·용량이 다르므로 허가사항과 처방 지시를 우선 확인해야 합니다. 동일 성분 중복 복용 및 1일 최대용량 초과를 피해야 합니다.',
      cautionText: '과량 복용 시 간독성 위험이 증가합니다. 간질환, 만성 음주, 와파린 복용, 다른 감기약·진통제와의 중복 복용 여부를 확인하세요.',
    };
  }

  const label = drug.ingredientName || drug.productName || '해당 약제';
  return {
    efficacyText: `${label}의 공식 효능·효과 원문을 확인 중입니다. 성분명, ATC 코드와 허가사항을 기준으로 보강됩니다.`,
    usageText: `${label}의 용법·용량은 제형, 함량, 적응증, 환자 상태에 따라 달라질 수 있으므로 허가사항과 처방 지시를 우선 적용하세요.`,
    cautionText: `${label} 복용 전 알레르기, 임신·수유, 소아·고령, 간·신장 기능, 병용약 및 중복 성분 여부를 확인하세요.`,
  };
}

function makeImmediateDetail(drug: DrugLike) {
  const fallback = fallbackClinicalText(drug);
  return {
    productName: drug.productName,
    company: drug.company,
    insuranceInfo: `${drug.insuranceCode || '-'} / ${drug.priceLabel || drug.reimbursement || '-'}`,
    atcCode: drug.atcCode,
    ingredientContent: drug.ingredientName,
    imageUrl: drug.imageUrl,
    packageInfo: [{ label: '-', standardCode: drug.standardCode || '-' }],
    ...fallback,
  };
}

export default function DrugDetailPage() {
  const router = useRouter();
  const params = useParams<{ drugKey: string }>();
  const searchParams = useSearchParams();

  const [drug, setDrug] = useState<DrugLike>({
    productName: searchParams.get('productName') || '',
    ingredientName: searchParams.get('ingredientName') || '',
    company: searchParams.get('company') || '',
    standardCode: searchParams.get('standardCode') || '',
    insuranceCode: searchParams.get('insuranceCode') || '',
    atcCode: searchParams.get('atcCode') || '',
    reimbursement: searchParams.get('reimbursement') || '',
    priceLabel: searchParams.get('priceLabel') || '',
    brandClass: searchParams.get('brandClass') || '',
    imageUrl: searchParams.get('imageUrl') || '',
    usageFrequency: Number(searchParams.get('usageFrequency') || 0),
  });

  const [imageBroken, setImageBroken] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [durInfo, setDurInfo] = useState<any>(null);
  const [durLoading, setDurLoading] = useState(false);
  const [llmInfo, setLlmInfo] = useState<any>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    efficacy: true,
    usage: false,
    caution: false,
    insurance: false,
    alt_dur: false,
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');

      try {
        let baseDrug = { ...drug };
        if (!baseDrug.productName) {
          const res = await fetch(`/api/drugs/item?key=${encodeURIComponent(params.drugKey || '')}`, { cache: 'no-store' });
          const data = await res.json();
          if (!res.ok || !data?.success || !data?.item) {
            throw new Error(data?.message || '약품 기본정보를 찾을 수 없습니다.');
          }
          baseDrug = data.item;
          setDrug(baseDrug);
        }

        setDetail(makeImmediateDetail(baseDrug));
        setLoading(false);

        const detailRes = await fetch('/api/drugs/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: baseDrug.productName,
            company: baseDrug.company,
            standardCode: baseDrug.standardCode,
            insuranceCode: baseDrug.insuranceCode,
            atcCode: baseDrug.atcCode,
            fastOnly: true,
          }),
        });

        const detailData = await detailRes.json();

        if (detailData?.detail) setDetail(detailData.detail);
      } catch (e) {
        const err = e as Error;
        if (!detail) setError(err.message || '상세 조회 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.drugKey]);

  useEffect(() => {
    if (!openSections.alt_dur || durInfo || durLoading || !drug.productName) return;

    setDurLoading(true);
    fetch('/api/drugs/dur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: drug.productName,
        ingredientName: drug.ingredientName,
      }),
    })
      .then((res) => res.json())
      .then((data) => setDurInfo(data || null))
      .catch(() => setDurInfo({ sections: [] }))
      .finally(() => setDurLoading(false));
  }, [openSections.alt_dur, durInfo, durLoading, drug.productName, drug.ingredientName]);

  useEffect(() => {
    if (!(openSections.insurance || openSections.alt_dur) || llmInfo || llmLoading || !drug.productName) return;

    setLlmLoading(true);
    fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: `약품명: ${drug.productName}, 성분명: ${drug.ingredientName}. 해당 약제의 최신 건강보험 심평원 급여 인정 기준(삭감 주의사항 포함)과 동일 성분의 대표적인 대체 약제 2~3가지를 추천해줘. "textbook" 블록과 "drug_cards" 블록을 같이 반환해줘.`,
      }),
    })
      .then((res) => res.json())
      .then((data) => setLlmInfo(data || null))
      .catch(() => setLlmInfo({ blocks: [], chat_reply: '' }))
      .finally(() => setLlmLoading(false));
  }, [openSections.insurance, openSections.alt_dur, llmInfo, llmLoading, drug.productName, drug.ingredientName]);

  const longText = useMemo(() => extractLongText(detail), [detail]);
  const alternatives = useMemo(() => {
    const rawAlternatives = llmInfo?.blocks?.find((b: any) => b.block_type === 'drug_cards')?.meta_json?.drugs || [];
    const normalized = rawAlternatives
      .map((d: any) => ({
        name: cleanText(d?.name),
        ingredient: cleanText(d?.ingredient),
        company: cleanText(d?.company),
      }))
      .filter((d: any) => d.name && d.ingredient);
    return uniqueBy(normalized, (d: any) => `${d.name}|${d.ingredient}`).slice(0, 5);
  }, [llmInfo]);

  const cautionBlocks = useMemo(() => {
    const blocks = (llmInfo?.blocks || [])
      .filter((b: any) => b.block_type === 'insurance_warning' || b.block_type === 'expert_warning' || b.block_type === 'textbook')
      .map((b: any) => ({
        title: cleanText(b?.title) || '주의사항',
        body: cleanText(b?.body),
      }))
      .filter((b: any) => b.body);
    return uniqueBy(blocks, (b: any) => `${b.title}|${b.body}`).slice(0, 6);
  }, [llmInfo]);

  const durSections = durInfo?.sections || [];
  const durSignals = durSections.filter((s: any) => s.total > 0);
  const riskLevel = durSignals.length > 0 || cautionBlocks.length > 0 ? '주의 필요' : '양호';
  const summaryText = [
    hasText(longText.efficacy) ? '효능 데이터 존재' : '효능 데이터 부족',
    hasText(longText.usage) ? '용법 데이터 존재' : '용법 데이터 부족',
    durSignals.length > 0 ? `DUR ${durSignals.length}개 항목` : 'DUR 특이사항 없음',
  ].join(' / ');

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const imageSrc = cleanText(detail?.imageUrl) || cleanText(drug?.imageUrl);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-100">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            뒤로가기
          </button>
          <span className="text-xs text-slate-500">상세 의약품 정보</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            인쇄
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">상세 정보를 불러오는 중입니다...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 print-grid-single">
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden print-break-inside-avoid">
                <div className="border-b border-slate-200 bg-blue-700 text-white px-5 py-3">
                  <h1 className="text-xl font-extrabold">{drug.productName || detail?.productName || '-'}</h1>
                  <p className="text-xs text-blue-100 mt-1">{drug.ingredientName || detail?.ingredientName || '-'} / {drug.company || detail?.company || '-'}</p>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_190px] gap-4">
                  <div className="text-sm rounded-lg border border-slate-200 bg-white p-4">
                    <div className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-2.5 items-start">
                      <div className="text-slate-500">구분</div><div className="font-semibold text-slate-800">{drug.brandClass || '복제약(제네릭)'}</div>
                      <div className="text-slate-500">업체명</div><div className="font-semibold text-slate-800">{drug.company || detail?.company || '-'}</div>
                      <div className="text-slate-500">보험정보</div><div className="font-semibold text-slate-800">{detail?.insuranceInfo || `${drug.insuranceCode || '-'} / ${drug.reimbursement || '-'}`}</div>
                      <div className="text-slate-500">KIMS 분류</div><div className="font-semibold text-slate-800 underline decoration-dotted underline-offset-2">{detail?.kimsClass || '-'}</div>
                      <div className="text-slate-500">ATC 코드</div><div className="font-semibold text-slate-800 underline decoration-dotted underline-offset-2">{drug.atcCode || detail?.atcCode || '-'}</div>
                      <div className="text-slate-500">주성분 코드</div><div className="font-semibold text-slate-800">{detail?.ingredientCode || '-'}</div>
                      <div className="text-slate-500">성분 및 함량</div><div className="font-semibold text-slate-800">{detail?.ingredientContent || drug.ingredientName || '-'}</div>
                      <div className="text-slate-500">포장정보</div><div className="font-semibold text-slate-800">{detail?.packageInfo?.[0]?.label || '-'}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center min-h-[160px] text-xs text-slate-400">
                    {imageSrc && !imageBroken ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageSrc}
                        alt={drug.productName || 'drug'}
                        className="max-h-[150px] object-contain"
                        onError={() => setImageBroken(true)}
                      />
                    ) : (
                      '의약품 이미지 없음'
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden print-break-inside-avoid">
                <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <div className="px-3 py-2 border-r border-slate-200">상세허가정보</div>
                  <div className="px-3 py-2 border-r border-slate-200">식별정보</div>
                  <div className="px-3 py-2 border-r border-slate-200">성분정보</div>
                  <div className="px-3 py-2 border-r border-slate-200">복약지도</div>
                  <div className="px-3 py-2">약가인정정보</div>
                </div>

                <div className="divide-y divide-slate-200">
                  <section>
                    <button type="button" onClick={() => toggleSection('efficacy')} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 bg-slate-50 flex items-center justify-between">
                      <span>효능 · 효과</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-700 text-xs">{openSections.efficacy ? '−' : '+'}</span>
                    </button>
                    {openSections.efficacy && <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-slate-700">{longText.efficacy}</div>}
                  </section>

                  <section>
                    <button type="button" onClick={() => toggleSection('usage')} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 bg-slate-50 flex items-center justify-between">
                      <span>용법 · 용량</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-700 text-xs">{openSections.usage ? '−' : '+'}</span>
                    </button>
                    {openSections.usage && <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-slate-700">{longText.usage}</div>}
                  </section>

                  <section>
                    <button type="button" onClick={() => toggleSection('caution')} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 bg-slate-50 flex items-center justify-between">
                      <span>복약지도 · 사용상 주의사항</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-700 text-xs">{openSections.caution ? '−' : '+'}</span>
                    </button>
                    {openSections.caution && <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-slate-700">{longText.caution}</div>}
                  </section>

                  <section>
                    <button type="button" onClick={() => toggleSection('insurance')} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 bg-slate-50 flex items-center justify-between">
                      <span>급여심사기준 · 약가인정정보</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-700 text-xs">{openSections.insurance ? '−' : '+'}</span>
                    </button>
                    {openSections.insurance && (
                      <>
                        <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-slate-700">{llmLoading ? '급여 기준을 불러오는 중입니다...' : (cleanText(llmInfo?.chat_reply) || '급여 분석 정보가 없습니다.')}</div>
                        {cautionBlocks.length > 0 && (
                          <div className="px-4 pb-3 space-y-2">
                            {cautionBlocks.map((block: any, idx: number) => (
                              <div key={idx} className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800 whitespace-pre-wrap">
                                <div className="font-bold mb-1">{block.title || '주의사항'}</div>
                                  {block.body}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  <section>
                    <button type="button" onClick={() => toggleSection('alt_dur')} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 bg-slate-50 flex items-center justify-between">
                      <span>대체가능의약품 · DUR · 병용금기</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-700 text-xs">{openSections.alt_dur ? '−' : '+'}</span>
                    </button>
                    {openSections.alt_dur && <div className="px-4 py-3 space-y-4">
                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-2">대체가능의약품</div>
                        {llmLoading ? (
                          <div className="text-sm text-slate-500">대체약제 정보를 불러오는 중입니다...</div>
                        ) : alternatives.length > 0 ? (
                          <ul className="space-y-2 text-sm">
                            {alternatives.map((d: any, idx: number) => (
                              <li key={idx} className="rounded border border-slate-200 p-2">
                                <div className="font-semibold text-blue-700">{d.name}</div>
                                <div className="text-xs text-slate-600">{d.ingredient} / {d.company || '-'}</div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-slate-500">대체약제 정보가 없습니다.</div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-600 mb-2">DUR 점검</div>
                        <div className="space-y-2">
                          {durLoading ? (
                            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">DUR 정보를 불러오는 중입니다...</div>
                          ) : durSections.map((sec: any, sIdx: number) => {
                            const hasItems = (sec.total || 0) > 0 && Array.isArray(sec.items) && sec.items.length > 0;
                            return (
                              <div
                                key={sIdx}
                                className={`rounded border p-2 text-xs ${hasItems ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                              >
                                <div className="font-bold mb-1">{sec.title} ({sec.total || 0}건)</div>
                                {hasItems ? (
                                  sec.items.slice(0, 4).map((it: any, idx: number) => (
                                    <div key={idx} className="mt-1">- {cleanText(it.summary || it.contraDrug || it.ageInfo || it.pregnantInfo) || '사유 정보 없음'}</div>
                                  ))
                                ) : (
                                  <div className="text-[11px] text-slate-500">해당 항목은 조회 결과가 없습니다.</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>}
                  </section>
                </div>
              </section>
            </div>

            <aside className="space-y-4 sticky top-4 self-start no-print">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-extrabold text-slate-800 mb-2">핵심 요약</h3>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li><span className="text-slate-400">약가</span> {toText(drug.priceLabel).split('/')[0].trim() || '-'}</li>
                  <li><span className="text-slate-400">급여</span> {drug.reimbursement || '-'}</li>
                  <li><span className="text-slate-400">처방빈도</span> {Number(drug.usageFrequency || 0).toLocaleString()}건</li>
                  <li><span className="text-slate-400">ATC</span> {drug.atcCode || '-'}</li>
                </ul>
                <p className="mt-3 rounded bg-slate-50 px-2 py-2 text-[11px] text-slate-500">{summaryText}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-extrabold text-slate-800 mb-2">임상 플래그</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5">
                    <span className="text-slate-500">종합 위험도</span>
                    <span className={`font-bold ${riskLevel === '주의 필요' ? 'text-red-700' : 'text-emerald-700'}`}>{riskLevel}</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5">
                    <span className="text-slate-500">삭감/주의 블록</span>
                    <span className="font-bold text-slate-700">{cautionBlocks.length}건</span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5">
                    <span className="text-slate-500">DUR 신호</span>
                    <span className="font-bold text-slate-700">{durSignals.length}건</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-extrabold text-slate-800 mb-2">빠른 동작</h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    검색으로 돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    상단으로 이동
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
