import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

// 환경변수에 OPENAI_API_KEY가 등록되어 있다고 가정합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
});

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-5.5';
const OPENAI_STANDARD_MODEL = process.env.OPENAI_STANDARD_MODEL || 'gpt-5.5';
const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-5.4-mini';
const AIMDNET_FINE_TUNED_MODEL = process.env.AIMDNET_FINE_TUNED_MODEL || '';
const AIMDNET_LEARNING_MODEL = process.env.AIMDNET_LEARNING_MODEL || OPENAI_STANDARD_MODEL;
const AIMDNET_LEARNING_MODE = (process.env.AIMDNET_LEARNING_MODE || 'on').toLowerCase();
const AIMDNET_HIGH_ACCURACY_MODE = (process.env.AIMDNET_HIGH_ACCURACY_MODE || 'off').toLowerCase();
const CHAT_MEMORY_KEY = 'chat_memory_summary';
const MAX_CHAT_MEMORY_CHARS = 2800;
const MAX_LEARNING_PROMPT_CHARS = 6000;
const MAX_LEARNING_RESPONSE_CHARS = 12000;

function isImageDataUrl(value: unknown) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(value || ''));
}

function determineModel(question: string, hasImage: boolean) {
  if (hasImage) return OPENAI_IMAGE_MODEL;
  if (AIMDNET_FINE_TUNED_MODEL) return AIMDNET_FINE_TUNED_MODEL;
  if (AIMDNET_HIGH_ACCURACY_MODE === 'on' || AIMDNET_HIGH_ACCURACY_MODE === 'true') {
    if (!question || question.length < 50) return OPENAI_FAST_MODEL;
    return OPENAI_STANDARD_MODEL;
  }
  return OPENAI_FAST_MODEL;
}

async function createJsonCompletion(model: string, messages: any[]) {
  const completion = await openai.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
  });
  return JSON.parse(completion.choices[0].message.content || '{}');
}

function shouldRunAimdnetLearning() {
  return AIMDNET_LEARNING_MODE !== 'off' && AIMDNET_LEARNING_MODE !== 'false';
}

function parseWon(value?: string | null) {
  const matched = String(value || '').match(/[\d,]+/);
  if (!matched) return null;
  const parsed = Number(matched[0].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type RxTemplate = {
  label: string;
  trigger: RegExp;
  indication: string;
  assumptions: string;
  ingredientKeywords: string[];
};

const RX_TEMPLATES: RxTemplate[] = [
  {
    label: '상기도감염/감기 증상 대증 처방',
    trigger: /감기|상기도|인후통|기침|콧물|비염|가래|발열|몸살|URI|cold|cough|sore throat/i,
    indication: '발열·인후통·기침·콧물 중심의 단순 상기도감염 대증치료',
    assumptions: '성인, 3일 처방, 1일 3회 또는 표준 1일 복용량 기준의 약가 합산 추정',
    ingredientKeywords: ['아세트아미노펜', '암브록솔', '레보세티리진'],
  },
  {
    label: '소화불량/위염 증상 처방',
    trigger: /소화불량|위염|속쓰림|상복부|명치|구역|구토|역류|GERD|dyspepsia|gastritis/i,
    indication: '속쓰림·상복부 불편감·소화불량 중심의 위장관 대증치료',
    assumptions: '성인, 3일 처방, 산분비 억제제 1일 1~2회 및 위장운동개선제 표준 용법 기준 추정',
    ingredientKeywords: ['파모티딘', '모사프리드'],
  },
  {
    label: '통증/염좌/근골격계 통증 처방',
    trigger: /통증|두통|근육통|관절통|염좌|요통|어깨|무릎|pain|sprain|headache/i,
    indication: '급성 통증에 대한 비마약성 진통·소염 대증치료',
    assumptions: '성인, 3일 처방, 위장관/신장/항응고제 위험 확인 전제',
    ingredientKeywords: ['아세트아미노펜', '이부프로펜'],
  },
  {
    label: '알레르기/두드러기 처방',
    trigger: /알레르기|두드러기|가려움|발진|비염|urticaria|allergy|rash|itch/i,
    indication: '가려움·두드러기·알레르기 비염 대증치료',
    assumptions: '성인, 3일 처방, 졸림/운전/음주 주의 안내 전제',
    ingredientKeywords: ['레보세티리진', '세티리진'],
  },
];

const HOSPITAL_QUERY_HINT = /병원|의원|요양기관|의료기관|구인|구직|채용|근무|위치|주소|지도|진료시간|주차|응급|야간|전화|원장|의사|매칭/i;
const CLINICAL_WORKFLOW_GUIDE = `[AIMDNET 핵심 진료 워크플로우]
사용자의 목표는 "의사가 실제 진료 중 묻는 질문에 대해 진단 보조 → 약물 추천/검토 → 병용금기·적응증 검토 → 법률/의무기록 리스크 점검"을 한 흐름으로 받는 것입니다. 다음을 기본 작동 원칙으로 삼으세요.
1) 진단 질문이면: 가능한 진단/감별진단, 근거, 위험 신호, 추가 문진, 필요한 검사, 1차 처치/처방 옵션을 순서대로 제시합니다.
2) 약을 쓰려는 질문이면: 먼저 어떤 질병/증상/환자 조건에 쓰려는지 확인합니다. 적응증이 불명확하면 확정 추천하지 말고 확인 질문을 합니다.
3) 특정 약이 언급되면: 그 약이 어떤 질병/상황에서 잘 맞는지, 같이 쓰면 좋은 약/피해야 할 약, 금기·주의·상호작용·모니터링을 정리합니다.
4) 병용 약물 질문이면: 같이 쓰면 안 되는 조합, 주의 조합, 대체 조합, DUR/보험 삭감 가능성을 분리합니다.
5) 진료/처방 방식의 법률 검토를 물으면: 설명의무, 진료기록 기재, 가이드라인 부합성, off-label/비급여 고지, 전원/추적관찰 필요성, 분쟁 방어 포인트를 점검합니다. 법률 자문이 아니라 의료분쟁 예방 참고 의견임을 명시합니다.
6) 정보가 부족하면 답을 멈추지 말고, "현재 정보로 가능한 판단"과 "반드시 확인할 질문"을 함께 제시합니다.
7) 가능하면 blocks에 diagnosis_assist, medication_safety, prescription_options, insurance_warning, legal_review를 조합해 반환합니다.`;

const RADIOLOGY_WORKFLOW_GUIDE = `[AIMDNET 영상 판독 보조 워크플로우]
X-ray/CT/MRI/초음파/검사 이미지가 있으면 반드시 영상 종류와 촬영 부위를 먼저 추정하고, 확정 판독이 아니라 "의사용 판독 보조"로 답하세요.
1) 이미지 품질/촬영 방향/부위: AP/PA/lateral/axial 등 확인 가능한 범위만 말합니다.
2) 체계적 체크: 정렬·골절·폐야·심장크기·종격동·흉수/기흉·복부 가스·연부조직 등 부위별 체크리스트를 적용합니다.
3) 이상 소견 후보: 보이는 소견과 안 보이는 소견을 구분합니다.
4) 위험 소견: 기흉, 폐렴/침윤, 심부전, 골절, 출혈/종괴 의심, 급성 복증 등 놓치면 안 되는 항목을 따로 표시합니다.
5) 다음 액션: 추가 영상, 활력징후/신체진찰, 검사, 전문의/응급 전원 기준을 제시합니다.
6) 이전 이미지가 있으면 후속 질문에서 반드시 같은 이미지 기준으로 재판독합니다.`;

const PATIENT_CONTEXT_FIELDS = [
  { key: 'ageSex', label: '나이/성별', pattern: /(\d{1,3}\s*(?:세|살)|남자|여자|남성|여성|M\/?\d{1,3}|F\/?\d{1,3})/gi },
  { key: 'symptoms', label: '주요 증상', pattern: /(흉통|복통|두통|발열|기침|호흡곤란|어지럼|구토|설사|부종|통증|가래|객혈|실신|마비|발진)/gi },
  { key: 'conditions', label: '기저질환', pattern: /(고혈압|당뇨|심부전|협심증|심근경색|천식|COPD|신부전|간경변|암|임신|고지혈증|뇌졸중)/gi },
  { key: 'medications', label: '언급 약물', pattern: /([가-힣A-Za-z0-9-]*(?:정|캡슐|주|시럽|연고)|아스피린|와파린|리바록사반|메트포르민|암로디핀|로사르탄|스타틴|NSAID|스테로이드|항생제)/gi },
  { key: 'tests', label: '검사/영상', pattern: /(x\s*-?\s*ray|xray|엑스레이|ct|씨티|mri|엠알|초음파|혈액검사|심전도|ECG|EKG|troponin|CRP|CBC)/gi },
];

async function pickPricedDrug(keyword: string) {
  const rows = await prisma.drug.findMany({
    where: {
      OR: [
        { productName: { contains: keyword } },
        { ingredientName: { contains: keyword } },
      ],
    },
    take: 25,
    select: {
      productName: true,
      ingredientName: true,
      company: true,
      priceLabel: true,
      reimbursement: true,
      type: true,
      efficacy: true,
      durInfo: true,
    },
  });

  return rows
    .map((row) => ({
      ...row,
      unitPrice: parseWon(row.priceLabel),
      displayIngredient: String(row.ingredientName || '').includes(keyword) && String(row.ingredientName || '').length < 80
        ? row.ingredientName
        : keyword,
    }))
    .filter((row) => row.unitPrice && !String(row.reimbursement || '').includes('취하'))
    .sort((a, b) => (a.unitPrice || 0) - (b.unitPrice || 0))[0] || null;
}

async function buildHospitalContext(question: string) {
  if (!question || !HOSPITAL_QUERY_HINT.test(question)) return '';
  const searchTerms = question
    .split(/[\s,.;:!?()\[\]{}"'“”‘’]+/)
    .map((word: string) => word.trim())
    .filter((word: string) => word.length >= 2)
    .filter((word: string) => !['병원', '의원', '의료기관', '요양기관', '구인', '구직', '채용', '근무', '위치', '주소', '지도', '추천', '매칭', '정보', '알려줘'].includes(word))
    .slice(0, 6);
  if (searchTerms.length === 0) return '';

  const hospitals = await prisma.hospitalDirectory.findMany({
    where: {
      OR: searchTerms.flatMap((term: string) => ([
        { name: { contains: term } },
        { address: { contains: term } },
        { sidoName: { contains: term } },
        { sigunguName: { contains: term } },
        { typeName: { contains: term } },
      ])),
    },
    take: 8,
    select: {
      name: true,
      typeName: true,
      sidoName: true,
      sigunguName: true,
      address: true,
      phone: true,
      totalDoctors: true,
      specialists: true,
      generalDoctors: true,
      parkingCapacity: true,
      parkingPaid: true,
      mondayStart: true,
      mondayEnd: true,
      saturdayStart: true,
      saturdayEnd: true,
      sundayStart: true,
      sundayEnd: true,
      latitude: true,
      longitude: true,
    },
  });

  if (hospitals.length === 0) return '';
  return `[병의원 DB 조회 정보]
사용자가 병원, 의원, 의료기관, 구인구직, 위치, 진료시간, 주차, 전화번호를 물으면 아래 병의원 DB 결과를 우선 참고하세요. DB에 없는 값은 모른다고 말하고 추정하지 마세요.
${hospitals.map((hospital) => {
    const weekday = hospital.mondayStart && hospital.mondayEnd ? `${hospital.mondayStart}~${hospital.mondayEnd}` : '확인 필요';
    const saturday = hospital.saturdayStart && hospital.saturdayEnd ? `${hospital.saturdayStart}~${hospital.saturdayEnd}` : '확인 필요';
    const sunday = hospital.sundayStart && hospital.sundayEnd ? `${hospital.sundayStart}~${hospital.sundayEnd}` : '확인 필요';
    return `- ${hospital.name} (${hospital.typeName || '종별 확인 필요'})\n  주소: ${hospital.address || `${hospital.sidoName || ''} ${hospital.sigunguName || ''}`.trim() || '확인 필요'}\n  전화: ${hospital.phone || '확인 필요'}\n  의사수: 총 ${hospital.totalDoctors ?? '확인 필요'}명 / 전문의 ${hospital.specialists ?? '확인 필요'}명 / 일반의 ${hospital.generalDoctors ?? '확인 필요'}명\n  진료시간: 월 ${weekday}, 토 ${saturday}, 일 ${sunday}\n  주차: ${hospital.parkingCapacity ? `${hospital.parkingCapacity}대` : '확인 필요'} ${hospital.parkingPaid || ''}\n  좌표: ${hospital.latitude && hospital.longitude ? `${hospital.latitude}, ${hospital.longitude}` : '확인 필요'}`;
  }).join('\n\n')}`;
}

async function buildPrescriptionContext(question: string, history: any[] | undefined, hasImage: boolean) {
  const historyText = Array.isArray(history)
    ? history.map((item) => typeof item?.content === 'string' ? item.content : '').join('\n')
    : '';
  const clinicalText = `${historyText}\n${question || ''}`;
  const matchedTemplates = RX_TEMPLATES.filter((template) => template.trigger.test(clinicalText));
  const templates = matchedTemplates.length > 0 ? matchedTemplates : (hasImage ? RX_TEMPLATES.slice(0, 4) : []);

  if (templates.length === 0) return '';

  const keywordSet = [...new Set(templates.flatMap((template) => template.ingredientKeywords))];
  const drugMap = new Map<string, Awaited<ReturnType<typeof pickPricedDrug>>>();
  await Promise.all(keywordSet.map(async (keyword) => {
    drugMap.set(keyword, await pickPricedDrug(keyword));
  }));

  const plans = templates.map((template) => {
    const drugs = template.ingredientKeywords
      .map((keyword) => drugMap.get(keyword))
      .filter(Boolean);
    const dailyUnitCount = drugs.length >= 3 ? 3 : 2;
    const days = 3;
    const total = drugs.reduce((sum, drug) => sum + ((drug?.unitPrice || 0) * dailyUnitCount * days), 0);
    return {
      name: template.label,
      indication: template.indication,
      assumptions: `${template.assumptions}; 계산식: 각 약제 단가 × ${dailyUnitCount}회/일 × ${days}일`,
      estimatedTotalDrugCostWon: total || null,
      drugs: drugs.map((drug) => ({
        name: drug?.productName,
        ingredient: drug?.displayIngredient,
        company: drug?.company,
        unitPrice: drug?.unitPrice,
        priceLabel: drug?.priceLabel,
        reimbursement: drug?.reimbursement || '급여구분 확인 필요',
        class: drug?.type || '분류 확인 필요',
        durInfo: drug?.durInfo || '',
      })),
    };
  }).filter((plan) => plan.drugs.length > 0);

  if (plans.length === 0) return '';

  return `[처방 추천/약가 계산 보조 데이터]
다음 후보는 실제 DB의 제품명·성분·약가를 이용한 참고 후보입니다. 환자 정보가 부족하면 먼저 핵심 문진 질문을 하세요. 처방을 제안할 때는 아래 후보를 우선 사용하고, 총 약가/보험 약품비는 추정값임을 명시하세요. 진찰료·처치료·검사료 등 보험수가는 별도이며, 여기서는 약품비 중심으로 계산합니다.
${JSON.stringify(plans, null, 2)}`;
}

function normalizeHistoryMessage(item: any) {
  const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
  if (!role) return null;

  const parsed = item?.parsedData;
  const blockText = Array.isArray(parsed?.blocks)
    ? parsed.blocks
        .map((block: any) => [block?.title, block?.body].filter(Boolean).join('\n'))
        .filter(Boolean)
        .join('\n\n')
    : '';
  const content = [item?.content, parsed?.chat_reply, blockText]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n\n')
    .trim();

  const image = role === 'user' && isImageDataUrl(item?.image) ? item.image : '';
  if (role === 'user' && image) {
    return {
      role,
      content: [
        { type: 'text', text: content || '이전에 첨부한 이미지입니다. 이 채팅의 후속 질문에서는 이 이미지를 같은 임상 자료로 참고하세요.' },
        { type: 'image_url', image_url: { url: image } },
      ],
    };
  }

  return content ? { role, content } : null;
}

function compactText(value: unknown, max = 320) {
  return String(value || '')
    .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[이미지]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function uniqueMatches(text: string, pattern: RegExp, limit = 8) {
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

function buildPatientContext(history: unknown, question: string, hasImage: boolean) {
  const historyText = Array.isArray(history)
    ? history.map((item: any) => [item?.content, item?.parsedData?.chat_reply].filter(Boolean).join(' ')).join('\n')
    : '';
  const text = `${historyText}\n${question || ''}`;
  const extracted = PATIENT_CONTEXT_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    values: uniqueMatches(text, field.pattern),
  })).filter((field) => field.values.length > 0);

  const openQuestions = [
    '나이/성별',
    '주요 증상 시작 시점과 지속 시간',
    '활력징후와 중증도',
    '기저질환/임신/신장·간 기능',
    '현재 복용약과 알레르기',
  ].filter((label) => !extracted.some((field) => field.label.includes(label.split('/')[0]))).slice(0, 5);

  return {
    hasAny: extracted.length > 0 || hasImage,
    extracted,
    openQuestions,
    hasImage,
    summary: extracted.map((field) => `${field.label}: ${field.values.join(', ')}`).join(' / ') || (hasImage ? '첨부 영상/이미지 중심 케이스' : ''),
  };
}

function buildPatientContextPrompt(context: ReturnType<typeof buildPatientContext>) {
  if (!context.hasAny) return '';
  return `[현재 환자 문맥 카드]
${context.summary || '구조화된 환자 정보가 아직 부족합니다.'}
이미지/영상 첨부: ${context.hasImage ? '있음' : '없음'}
아직 확인할 항목: ${context.openQuestions.length > 0 ? context.openQuestions.join(', ') : '현재 대화 기준 큰 공백 없음'}
후속 질문에서 "이 환자", "아까 약", "그 진단", "방금 사진"이라고 하면 이 환자 문맥을 유지하세요.`;
}

async function getChatMemory(userId?: string) {
  if (!userId) return '';
  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: CHAT_MEMORY_KEY } },
    select: { value: true },
  }).catch(() => null);
  return pref?.value || '';
}

async function saveChatMemory(userId: string | undefined, memory: string) {
  if (!userId || !memory.trim()) return;
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: CHAT_MEMORY_KEY } },
    update: { value: memory },
    create: { userId, key: CHAT_MEMORY_KEY, value: memory },
  }).catch((error) => console.error('채팅 메모리 저장 실패:', error));
}

async function getLearningUser(userId?: string | null) {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (user) return user;
  }
  return prisma.user.upsert({
    where: { email: 'doctor@demo.com' },
    update: {},
    create: {
      email: 'doctor@demo.com',
      passwordHash: 'dummy',
      name: '김의사',
      title: '내과',
      points: 25,
    },
    select: { id: true },
  });
}

function inferLearningModality(question: string, hasImage: boolean) {
  if (/ct|씨티|computed tomography/i.test(question)) return 'CT';
  if (/mri|엠알|자기공명/i.test(question)) return 'MRI';
  if (/x\s*-?\s*ray|xray|엑스레이|방사선/i.test(question)) return 'XRAY';
  if (hasImage) return 'MEDICAL_IMAGE';
  return 'TEXT_CLINICAL';
}

function buildLearningHistory(history: unknown) {
  if (!Array.isArray(history)) return undefined;
  return history.slice(-12).map((item: any) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: compactText(item?.content || item?.parsedData?.chat_reply || '', 900),
    hasImage: Boolean(item?.image || item?.hasImage),
  }));
}

function learningWeight(question: string, parsedResponse: any, hasImage: boolean) {
  let weight = 1;
  if (hasImage) weight += 4;
  if (/x\s*-?\s*ray|xray|엑스레이|ct|씨티|mri|엠알|영상|판독|소견/i.test(question)) weight += 3;
  if (/병용|상호작용|금기|DUR|삭감|약.*추천|처방/i.test(question)) weight += 2;
  if (/법률|법적|분쟁|설명의무|의무기록|소송|동의서/i.test(question)) weight += 2;
  if (/확인 필요|정보가 부족|추가.*문진|감별/i.test(JSON.stringify(parsedResponse || {}))) weight += 1;
  return Math.min(weight, 10);
}

function hasBlock(parsedResponse: any, blockType: string) {
  return Array.isArray(parsedResponse?.blocks) && parsedResponse.blocks.some((block: any) => block?.block_type === blockType);
}

function enhanceClinicalWorkflowBlocks(parsedResponse: any, question: string, history: unknown, hasImage: boolean) {
  const text = `${question}\n${parsedResponse?.chat_reply || ''}`;
  const blocks = Array.isArray(parsedResponse?.blocks) ? parsedResponse.blocks : [];
  const nextBlocks = [...blocks];
  const patientContext = buildPatientContext(history, question, hasImage);

  const diagnosisIntent = /진단|감별|증상|흉통|복통|두통|발열|기침|호흡곤란|어지럼|검사|x\s*-?\s*ray|xray|ct|mri|판독/i.test(text);
  const medicationIntent = /약|처방|병용|상호작용|금기|같이\s*쓰|피해야|추천|투약|복용|DUR|삭감/i.test(text);
  const legalIntent = /법률|법적|분쟁|소송|설명.{0,4}의무|동의서|의무기록|기록|문제\s*없|방어|고지/i.test(text);
  const radiologyIntent = hasImage || /x\s*-?\s*ray|xray|엑스레이|ct|씨티|mri|엠알|초음파|영상|판독|사진/i.test(text);

  if (patientContext.hasAny && !hasBlock({ blocks: nextBlocks }, 'patient_context')) {
    nextBlocks.unshift({
      block_type: 'patient_context',
      title: '현재 환자 문맥',
      body: patientContext.summary || '아직 환자 정보가 부족합니다. 아래 항목을 확인하면 이후 답변이 더 정확해집니다.',
      meta_json: {
        context: patientContext.extracted,
        open_questions: patientContext.openQuestions,
        hasImage: patientContext.hasImage,
      },
      sort_order: -1,
    });
  }

  if (radiologyIntent && !hasBlock({ blocks: nextBlocks }, 'radiology_checklist')) {
    nextBlocks.push({
      block_type: 'radiology_checklist',
      title: '영상 판독 체크리스트',
      body: '의료영상은 확정 판독이 아니라 보조 의견입니다. 영상 종류/부위/품질을 먼저 확인하고, 놓치면 안 되는 위험 소견을 체계적으로 점검하세요.',
      meta_json: {
        modality: inferLearningModality(question, hasImage),
        checklist: ['촬영 부위·방향·품질', '명백한 비정상 소견', '놓치면 안 되는 응급 소견', '임상 증상과의 일치 여부', '추가 촬영/검사/전원 필요성'],
        red_flags: ['기흉', '폐렴/침윤', '심부전/폐부종', '골절/탈구', '출혈/종괴 의심', '급성 악화 징후'],
      },
      sort_order: 1,
    });
  }

  if (diagnosisIntent && !hasBlock({ blocks: nextBlocks }, 'diagnosis_assist')) {
    nextBlocks.unshift({
      block_type: 'diagnosis_assist',
      title: '진단 방향 정리',
      body: '현재 정보만으로 확정 진단은 피하고, 가장 가능성 높은 감별진단과 위험 신호를 먼저 정리해야 합니다. 활력징후, 증상 발생 시점, 동반 증상, 기저질환, 복용약, 검사 결과를 추가 확인하세요.',
      meta_json: {
        differentials: [
          { diagnosis: '우선 감별 필요', supporting: '사용자 질문의 증상/검사 맥락', against: '세부 병력과 검사값 부족', next_step: '활력징후, 위험 신호, 필요한 검사 확인' },
        ],
      },
      sort_order: 0,
    });
  }

  if (medicationIntent && !hasBlock({ blocks: nextBlocks }, 'medication_safety')) {
    nextBlocks.push({
      block_type: 'medication_safety',
      title: '약물 선택 전 확인',
      body: '약을 쓰려는 질병/증상, 환자 나이, 임신 여부, 신장·간 기능, 알레르기, 현재 복용약을 확인한 뒤 적응증과 병용금기를 판단하세요.',
      meta_json: {
        medication_checks: [
          { drug: '검토 대상 약물', indication_fit: '질병/증상 확인 후 판단', avoid_with: ['중복 성분', '중대한 상호작용 약물', '환자 금기 상황'], pairs_well_with: ['진단과 중증도 확인 후 선택'], monitoring: ['부작용', '치료 반응', 'DUR/보험 기준'] },
        ],
      },
      sort_order: 2,
    });
  }

  if (legalIntent && !hasBlock({ blocks: nextBlocks }, 'legal_review')) {
    nextBlocks.push({
      block_type: 'legal_review',
      title: '진료기록·설명의무 체크',
      body: '의료분쟁 예방 관점의 참고 의견입니다. 확정 법률 자문은 아니며, 고위험 상황은 병원 법무/전문가 검토가 필요합니다.',
      meta_json: {
        legal_checks: [
          { issue: '설명의무', risk: 'medium', documentation: '진단 추정, 치료 선택지, 부작용, 악화 시 재내원/응급실 안내를 기록', mitigation: '환자가 이해했는지 확인하고 동의/거부 내용을 남김' },
          { issue: '진료기록 방어력', risk: 'medium', documentation: '문진, 신체진찰, 감별진단, 처방 근거, 추적계획을 구체적으로 기재', mitigation: '위험 신호와 전원 기준을 명확히 안내' },
        ],
      },
      sort_order: 3,
    });
  }

  return { ...parsedResponse, blocks: nextBlocks };
}

async function buildAimdnetLearningSignal(params: {
  question: string;
  parsedResponse: any;
  history: unknown;
  hasImage: boolean;
  modality: string;
  weight: number;
}) {
  const learningMessages: any[] = [
    {
      role: 'system',
      content: `당신은 답변 생성 AI가 아니라 AIMDNET 학습 전용 엔진입니다. 사용자에게 보여줄 답변을 만들지 마세요. 현재 케이스를 나중에 X-ray/CT/MRI/임상 추론 성능 개선에 쓰기 위한 학습 메타데이터로만 정리합니다. 반드시 JSON 객체만 반환하세요.`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'AIMDNET_SELF_LEARNING_ONLY',
        modality: params.modality,
        currentWeight: params.weight,
        question: compactText(params.question, 1600),
        answerSummary: compactText(params.parsedResponse?.chat_reply, 1600),
        blocks: params.parsedResponse?.blocks || [],
        history: buildLearningHistory(params.history),
        hasImage: params.hasImage,
        requiredJsonShape: {
          modality: 'XRAY|CT|MRI|MEDICAL_IMAGE|TEXT_CLINICAL',
          learning_weight: '1-10 number',
          case_summary: 'de-identified learning summary',
          image_learning_focus: ['missed visual clue or required imaging habit'],
          reasoning_gaps: ['what the answer should learn to improve'],
          safety_gaps: ['clinical safety or uncertainty handling'],
          future_training_label: 'ideal behavior label',
          retrieval_keywords: ['keywords for future weighting'],
        },
      }),
    },
  ];
  return createJsonCompletion(AIMDNET_LEARNING_MODEL, learningMessages);
}

async function storeAimdnetLearningOnly(params: {
  userId?: string;
  question: string;
  history: unknown;
  parsedResponse: any;
  hasImage: boolean;
}) {
  if (!shouldRunAimdnetLearning()) return;
  try {
    const modality = inferLearningModality(params.question, params.hasImage);
    const weight = learningWeight(params.question, params.parsedResponse, params.hasImage);
    const user = await getLearningUser(params.userId);
    const responseText = JSON.stringify(params.parsedResponse || {});
    const signal = {
      modality,
      learning_weight: weight,
      case_summary: compactText(params.question, 800),
      image_learning_focus: params.hasImage ? ['X-ray/CT/MRI 등 영상 판독 질의는 관리자 검수와 향후 fine-tuning에서 높은 우선순위로 사용'] : [],
      reasoning_gaps: /확인 필요|정보가 부족|감별|추가/i.test(responseText)
        ? ['정보 부족 상황에서 어떤 추가 문진/검사가 필요한지 학습']
        : ['실제 의사 질의와 답변 패턴을 누적 학습'],
      safety_gaps: /금기|상호작용|DUR|삭감|주의|법률|설명의무|기록/i.test(`${params.question}\n${responseText}`)
        ? ['약물 안전성, 보험/DUR, 설명의무와 의무기록 포인트를 함께 학습']
        : [],
      future_training_label: params.hasImage ? 'PRIORITY_MEDICAL_IMAGE_CASE' : 'CLINICAL_REASONING_CASE',
      retrieval_keywords: [modality, ...String(params.question || '').split(/\s+/).filter((word) => word.length >= 2).slice(0, 8)],
    };

    const finalWeight = Number(signal?.learning_weight || weight);
    await prisma.aiTrainingExample.create({
      data: {
        userId: user.id,
        source: 'AIMDNET_LEARNING_ONLY',
        rating: 'CORRECTION',
        prompt: compactText(params.question, MAX_LEARNING_PROMPT_CHARS),
        response: compactText(params.parsedResponse?.chat_reply || JSON.stringify(params.parsedResponse || {}), MAX_LEARNING_RESPONSE_CHARS),
        responseJson: {
          ...signal,
          learning_only: true,
          weight: Number.isFinite(finalWeight) ? Math.max(1, Math.min(10, finalWeight)) : weight,
          model: AIMDNET_LEARNING_MODEL,
          generatedAt: new Date().toISOString(),
        },
        history: buildLearningHistory(params.history) ?? undefined,
        comment: `AIMDNET 학습 전용 큐 · ${modality} · weight ${Number.isFinite(finalWeight) ? finalWeight : weight}`,
        status: 'RAW',
      },
    });
  } catch (error) {
    console.error('AIMDNET 학습 전용 저장 실패:', error);
  }
}

function buildUpdatedChatMemory(previousMemory: string, question: string, parsedResponse: any) {
  const q = compactText(question, 260);
  const reply = compactText(parsedResponse?.chat_reply, 360);
  const topic = compactText(parsedResponse?.orchestration_summary || parsedResponse?.intent_type || '일반 대화', 120);
  if (!q && !reply) return previousMemory || '';

  const lines = String(previousMemory || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes(q.slice(0, 80)));

  lines.push(`- ${new Date().toISOString().slice(0, 10)} · ${topic}: 사용자 질문 "${q}" / 답변 핵심 "${reply}"`);
  let next = lines.slice(-18).join('\n');
  if (next.length > MAX_CHAT_MEMORY_CHARS) next = next.slice(next.length - MAX_CHAT_MEMORY_CHARS);
  return next;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, history, imageBase64, userId } = body;
    const historyHasImage = Array.isArray(history) && history.some((item: any) => isImageDataUrl(item?.image));
    const modelToUse = determineModel(question || '', !!imageBase64 || historyHasImage);
    const chatMemory = await getChatMemory(userId);

    let ragContext = "";
    if (question && question.length >= 2) {
      const searchTerms = question
        .split(/[\s,.;:!?()\[\]{}"'“”‘’]+/)
        .map((w: string) => w.trim())
        .filter((w: string) => w.length >= 2)
        .filter((w: string) => !['그리고', '해당', '최신', '기준', '포함', '같이', '반환', '추천', '분석'].includes(w))
        .slice(0, 5);
      if (searchTerms.length > 0) {
        // 간단한 휴리스틱 (약품/성분명 검색 키워드가 들어왔을 때 관련 정보 컨텍스트를 주입합니다)
        const drugs = await prisma.drug.findMany({
          where: {
            OR: searchTerms.map((term: string) => ({
                productName: { contains: term }
            })).concat(searchTerms.map((term: string) => ({
                ingredientName: { contains: term }
            })))
          },
          take: 3,
          select: {
             productName: true, ingredientName: true, company: true, priceLabel: true, type: true, 
             efficacy: true, durInfo: true
          }
        });
        
        if (drugs.length > 0) {
           ragContext = `[사전 조회된 데이터베이스(RAG) 지식베이스 정보]\n` +
             drugs.map(d => {
                let info = `- 약품명: ${d.productName}\n- 성분명: ${d.ingredientName}\n- 회사: ${d.company}`;
                if (d.priceLabel) info += `\n- 보험약가/분류: ${d.priceLabel} / ${d.type}`;
                if (d.durInfo) info += `\n- DUR금기/주의사항 요약: ${d.durInfo}`;
                if (d.efficacy) info += `\n- 효능/효과요약: ${d.efficacy}`;
                // 공공 API 원문 덤프에서 핵심적인 부분을 뽑아주면 더 정확하지만 너무 길면 잘리므로 헤벨만 (선택사항)
                // if (d.publicApiDump && d.publicApiDump.includes('status":"success"')) {
                //      info += `\n- 공공데이터 원문 덤프 존재함`;
                // }
                return info;
             }).join('\n\n');
        }
      }
    }
    const hospitalContext = await buildHospitalContext(question || '');
    const prescriptionContext = await buildPrescriptionContext(question || '', history, !!imageBase64);
    const patientContext = buildPatientContext(history, question || '', !!imageBase64 || historyHasImage);
    const patientContextPrompt = buildPatientContextPrompt(patientContext);

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `당신은 뛰어난 전문 의학 어시스턴트입니다. 아래에 [사용자 장기 대화 메모리], [현재 환자 문맥 카드], [AIMDNET 핵심 진료 워크플로우], [AIMDNET 영상 판독 보조 워크플로우], [사전 제공된 지식베이스 RAG 정보], [병의원 DB 조회 정보] 또는 [처방 추천/약가 계산 보조 데이터]가 있다면 반드시 이를 최우선으로 참고하여 답변의 <채팅내용>과 <blocks>에 활용해야 합니다. 같은 채팅창의 이전 대화와 이전에 첨부된 이미지는 현재 질문의 직접적인 문맥입니다. 사용자가 "다시", "이렇게", "이전 사진", "방금 이미지"처럼 말하면 새 이미지를 요구하지 말고 대화 이력의 가장 최근 이미지를 기준으로 재분석하세요.
    ${chatMemory ? `[사용자 장기 대화 메모리]\n${chatMemory}\n` : ''}${patientContextPrompt}\n${CLINICAL_WORKFLOW_GUIDE}\n${RADIOLOGY_WORKFLOW_GUIDE}\n${ragContext}\n${hospitalContext}\n${prescriptionContext}\n
반드시 아래의 JSON 포맷으로만 응답해주세요. 프론트엔드의 블록 UI를 렌더링하기 위한 필수 규격입니다:
{
  "intent_type": "general|diagnosis|disease|drug|medication_safety|image|legal|recruit|translation",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 (예: X-ray 판독 및 전문의 소견 종합)",
  "chat_reply": "사용자에게 건넬 친절한 일반 텍스트 답변",
  "blocks": [
    {
      "block_type": "patient_context|diagnosis_assist|radiology_checklist|medication_safety|legal_review|textbook|journal|md_tip|doctor_consensus|doctor_opinion|insurance_warning|expert_warning|image_read|sponsor_card|recruit_cards|drug_cards|prescription_options|translation",
      "title": "화면에 표시될 블록의 제목",
      "body": "블록의 내용 (HTML 태그 허용 안됨, 일반 텍스트)",
      "meta_json": {
        "differentials": [{ "diagnosis": "감별진단", "supporting": "근거", "against": "반대 근거", "next_step": "다음 확인" }],
        "context": [{ "label": "환자 정보 항목", "values": ["대화에서 추출한 값"] }],
        "open_questions": ["아직 확인해야 할 환자 정보"],
        "checklist": ["영상/진료 체크리스트"],
        "red_flags": ["놓치면 안 되는 위험 소견"],
        "medication_checks": [{ "drug": "약품명", "indication_fit": "적응증 적합성", "avoid_with": ["피해야 할 약/상황"], "pairs_well_with": ["함께 고려 가능"], "monitoring": ["모니터링"] }],
        "legal_checks": [{ "issue": "법률/분쟁 리스크", "risk": "low|medium|high", "documentation": "기록할 내용", "mitigation": "예방 조치" }],
        "drugs": [
          {
            "name": "약품명",
            "ingredient": "성분명",
            "price": "약가 및 등재구분",
            "class": "분류",
            "company": "제약사명"
          }
        ],
        "prescriptions": [
          {
            "label": "추천 1",
            "indication": "상정한 진단/상황",
            "assumptions": "성인/일수/용법 등 계산 가정",
            "drugs": [
              { "name": "A약", "ingredient": "성분", "unitPrice": 100, "dose": "1정 tid", "days": 3, "estimatedCost": 900, "reimbursement": "급여" }
            ],
            "totalDrugCost": "900원",
            "insuranceFeeEstimate": "약품비 기준 급여 청구 추정 900원, 진찰료/검사료/처치료 별도",
            "cautions": "DUR/금기/삭감 주의"
          }
        ],
        "follow_up_questions": ["확인해야 할 문진 질문"]
      },
      "sort_order": 1
    }
  ]
}
- 보험 삭감 경고가 필요하면 'insurance_warning', 약물 추천시 'drug_cards', 처방 팁은 'md_tip' 블록을 적극 활용하세요.
- 진단 보조는 'diagnosis_assist' 블록을 우선 사용하고, 감별진단/근거/추가검사/위험신호/다음 액션을 포함하세요.
- 환자 정보가 누적되면 'patient_context' 블록으로 현재 환자 요약과 부족한 정보를 먼저 정리하세요.
- 영상/사진/판독 요청은 'radiology_checklist'와 'image_read' 블록을 함께 사용하고, 영상 종류·부위·품질·위험 소견·다음 검사를 체계적으로 제시하세요.
- 특정 약물 또는 병용약 질문은 'medication_safety' 블록을 우선 사용하고, 적응증 확인 질문, 같이 쓰면 안 되는 약, 잘 어울리는 조합, 모니터링, 대체약을 포함하세요.
- 법률/분쟁/의무기록/설명의무 질문은 'legal_review' 블록을 사용하고, 진료기록 문구 예시와 설명의무 체크포인트를 포함하세요. 단, 변호사 법률자문이 아닌 의료분쟁 예방 참고 의견이라고 밝히세요.
- 사용자가 증상·사진·검사결과·처방 상담을 하면 반드시 먼저 판단하세요: 정보가 부족하면 chat_reply와 md_tip 블록에서 핵심 역문진 3~6개를 물어보세요. 정보가 충분하면 'prescription_options' 블록을 만들어 추천 1, 추천 2 형식으로 제시하세요.
- prescription_options 블록은 meta_json.prescriptions 배열을 반드시 채우세요. 각 추천에는 A약/B약 같은 실제 제품명, 성분, 단가, 용법/일수 가정, 약제별 추정금액, 총 약가, 보험 약품비 추정, 삭감/DUR 주의사항을 포함하세요.
- 총 약가와 보험수가는 허위로 단정하지 말고, DB 약가가 있는 경우에는 그 값을 사용해 추정 계산하고 "진찰료·검사료·처치료는 별도"라고 명시하세요. DB 약가가 없으면 "약가 확인 필요"라고 표시하세요.
- 항생제, 스테로이드, 마약성 진통제, 임부/소아/고령/신장질환 고위험 처방은 확정 처방 대신 필요한 역문진과 경고를 먼저 제시하세요.
- 번역 요청인 경우 'translation' 블록을 사용하고 meta_json.clinical_note에 복약 주의사항을 넣으세요.
- drug_cards 블록 생성 시 반드시 배열 내 각 객체는 name, ingredient, price, class, company 속성을 포함해야 하며, 중복되는 약물 정보가 없도록 제외하여 응답하세요.
`
    });

    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        const normalized = normalizeHistoryMessage(h);
        if (normalized) messages.push(normalized);
      });
    }

    if (imageBase64) {
       messages.push({
          role: 'user',
          content: [
             { type: 'text', text: question || '이 이미지를 의학적으로 분석해주세요.' },
             { type: 'image_url', image_url: { url: imageBase64 } }
          ]
       });
    } else {
       messages.push({ role: 'user', content: question });
    }

    const parsedResponse = enhanceClinicalWorkflowBlocks(await createJsonCompletion(modelToUse, messages), question || '', history, !!imageBase64 || historyHasImage);
    parsedResponse.aimdnet_engine = {
      mode: 'learning_only',
      answerModel: modelToUse,
      learnerModel: AIMDNET_LEARNING_MODEL,
      learnerStatus: shouldRunAimdnetLearning() ? 'queued' : 'off',
    };
    await saveChatMemory(userId, buildUpdatedChatMemory(chatMemory, question || '', parsedResponse));
    await storeAimdnetLearningOnly({
      userId,
      question: question || '',
      history,
      parsedResponse,
      hasImage: !!imageBase64 || historyHasImage,
    });

    return NextResponse.json(parsedResponse);
  } catch (error: any) {
    console.error("OpenAI API 연동 오류:", error.message || error);
    return NextResponse.json({
      intent_type: 'general',
      orchestration_summary: '시스템 안내',
      chat_reply: '현재 인공지능 서버가 원활하지 않습니다.',
      blocks: []
    });
  }
}
