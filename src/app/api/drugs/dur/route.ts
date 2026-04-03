import { NextResponse } from 'next/server';
import { callPublicDrugApi, extractItems } from '@/lib/publicDrugApiClient';
import { PUBLIC_DRUG_API_ENDPOINTS } from '@/lib/publicDrugApiCatalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DurBody = {
  productName: string;
  ingredientName?: string;
  company?: string;
  patientAge?: number;
  patientPregnant?: 'unknown' | 'yes' | 'no';
  patientDisease?: string;
  patientDiseaseCode?: string;
  patientPregnancyWeek?: number;
  prioritizePatientContext?: boolean;
};

type DurSection = {
  key: string;
  title: string;
  operation: string;
};

const DUR_SECTIONS: DurSection[] = [
  { key: 'usjnt', title: '병용금기', operation: '/getUsjntTabooInfoList03' },
  { key: 'spcify', title: '특정연령대금기', operation: '/getSpcifyAgrdeTabooInfoList03' },
  { key: 'pwnm', title: '임부금기', operation: '/getPwnmTabooInfoList03' },
  { key: 'cpcty', title: '용량주의', operation: '/getCpctyAtentInfoList03' },
  { key: 'mdctn', title: '투여기간주의', operation: '/getMdctnPdAtentInfoList03' },
  { key: 'odsn', title: '노인주의', operation: '/getOdsnAtentInfoList03' },
  { key: 'efcy', title: '효능군중복주의', operation: '/getEfcyDpcltInfoList03' },
];

function pick(item: any, keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function matchAgeRule(text: string, age: number) {
  const clean = text.replace(/\s+/g, '');
  const under = [...clean.matchAll(/(\d{1,3})세미만/g)].map((m) => Number(m[1]));
  if (under.some((limit) => age < limit)) return true;

  const over = [...clean.matchAll(/(\d{1,3})세이상/g)].map((m) => Number(m[1]));
  if (over.some((limit) => age >= limit)) return true;

  const between = [...clean.matchAll(/(\d{1,3})세이상(\d{1,3})세미만/g)].map((m) => ({ min: Number(m[1]), max: Number(m[2]) }));
  if (between.some((range) => age >= range.min && age < range.max)) return true;

  if ((clean.includes('소아') || clean.includes('소아청소년')) && age < 19) return true;
  if ((clean.includes('노인') || clean.includes('고령')) && age >= 65) return true;

  return false;
}

function matchPregnancyWeekRule(text: string, week: number) {
  const clean = text.replace(/\s+/g, '');
  const under = [...clean.matchAll(/임신(\d{1,2})주미만/g)].map((m) => Number(m[1]));
  if (under.some((limit) => week < limit)) return true;

  const over = [...clean.matchAll(/임신(\d{1,2})주이상/g)].map((m) => Number(m[1]));
  if (over.some((limit) => week >= limit)) return true;

  const between = [...clean.matchAll(/임신(\d{1,2})주이상(\d{1,2})주미만/g)].map((m) => ({ min: Number(m[1]), max: Number(m[2]) }));
  if (between.some((range) => week >= range.min && week < range.max)) return true;

  return false;
}

function computeRelevance(sectionKey: string, cautionText: string, body: DurBody) {
  const age = toNumber(body.patientAge);
  const pregnancyWeek = toNumber(body.patientPregnancyWeek);
  const pregnant = body.patientPregnant || 'unknown';
  const disease = (body.patientDisease || '').trim().toLowerCase();
  const diseaseCode = (body.patientDiseaseCode || '').trim().toLowerCase();
  const text = cautionText.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (sectionKey === 'pwnm' && pregnant === 'yes') {
    score += 3;
    reasons.push('임신 환자 관련');
  }

  if (sectionKey === 'odsn' && age !== undefined && age >= 65) {
    score += 3;
    reasons.push('고령 환자 관련');
  }

  if (sectionKey === 'spcify' && age !== undefined) {
    if (matchAgeRule(text, age)) {
      score += 3;
      reasons.push('연령 구간 매칭');
    }
  }

  if (sectionKey === 'pwnm' && pregnant === 'yes' && pregnancyWeek !== undefined) {
    if (matchPregnancyWeekRule(text, pregnancyWeek)) {
      score += 2;
      reasons.push('임신 주수 매칭');
    }
  }

  if (disease && text.includes(disease)) {
    score += 2;
    reasons.push('기저질환 키워드 매칭');
  }

  if (diseaseCode && text.includes(diseaseCode)) {
    score += 2;
    reasons.push('질환코드 매칭');
  }

  if (sectionKey === 'usjnt' || sectionKey === 'efcy') {
    score += 1;
    reasons.push('일반 병용/중복 위험');
  }

  return {
    score,
    reason: reasons.join(', '),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DurBody;
    if (!body.productName?.trim()) {
      return NextResponse.json({ success: false, message: 'productName 이 필요합니다.' }, { status: 400 });
    }

    const durService = PUBLIC_DRUG_API_ENDPOINTS.find((s) => s.baseUrl.includes('DURPrdlstInfoService03'));
    if (!durService) {
      return NextResponse.json({ success: false, message: 'DUR 서비스 설정을 찾지 못했습니다.' }, { status: 500 });
    }

    const settled = await Promise.allSettled(
      DUR_SECTIONS.map((section) =>
        callPublicDrugApi({
          serviceName: `${durService.serviceName}:${section.key}`,
          baseUrl: durService.baseUrl,
          operation: section.operation,
          query: {
            itemName: body.productName,
            item_name: body.productName,
            itemNm: body.productName,
            ingrName: body.ingredientName,
            ingr_name: body.ingredientName,
            ingrNm: body.ingredientName,
            entpName: body.company,
            entp_name: body.company,
            entpNm: body.company,
          },
        })
      )
    );

    const sections = DUR_SECTIONS.map((section, idx) => {
      const result = settled[idx];
      if (result.status !== 'fulfilled') {
        return {
          key: section.key,
          title: section.title,
          total: 0,
          items: [],
          message: '조회 실패',
        };
      }

      const items = extractItems(result.value).map((item) => ({
        productName: pick(item, ['itemName', 'ITEM_NAME', '품목명']),
        ingredientName: pick(item, ['ingrName', 'MAIN_INGR', 'mainIngr', '성분명']),
        caution: pick(item, ['prohbtContent', 'ATPN_QESITM', '주의사항', 'mixProhbtCn']),
        contraDrug: pick(item, ['mixTabooDurs', 'tabooMix', '병용금기성분']),
        ageInfo: pick(item, ['ageInfo', '특정연령']),
        pregnantInfo: pick(item, ['pregInfo', '임부금기']),
        relevanceScore: 0,
        relevanceReason: '',
        raw: item,
      }));

      const scored = items.map((entry) => {
        const cautionText = [entry.caution, entry.contraDrug, entry.ageInfo, entry.pregnantInfo]
          .filter(Boolean)
          .join(' ');
        const relevance = computeRelevance(section.key, cautionText, body);
        return {
          ...entry,
          relevanceScore: relevance.score,
          relevanceReason: relevance.reason,
        };
      });

      const prioritized = body.prioritizePatientContext
        ? scored
            .filter((entry) => entry.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
        : scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const finalItems = prioritized.slice(0, 20);

      return {
        key: section.key,
        title: section.title,
        total: finalItems.length,
        items: finalItems,
      };
    });

    return NextResponse.json({
      success: true,
      total: sections.reduce((sum, s) => sum + s.total, 0),
      sections,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'DUR 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
