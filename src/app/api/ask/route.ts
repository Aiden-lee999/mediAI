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
const CHAT_MEMORY_KEY = 'chat_memory_summary';
const MAX_CHAT_MEMORY_CHARS = 2800;

function isImageDataUrl(value: unknown) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(value || ''));
}

function determineModel(question: string, hasImage: boolean) {
  if (hasImage) return OPENAI_IMAGE_MODEL;
  if (AIMDNET_FINE_TUNED_MODEL) return AIMDNET_FINE_TUNED_MODEL;
  if (!question || question.length < 50) return OPENAI_FAST_MODEL;
  return OPENAI_STANDARD_MODEL;
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

    const messages: any[] = [];
    messages.push({
      role: 'system',
      content: `당신은 뛰어난 전문 의학 어시스턴트입니다. 아래에 [사용자 장기 대화 메모리], [사전 제공된 지식베이스 RAG 정보], [병의원 DB 조회 정보] 또는 [처방 추천/약가 계산 보조 데이터]가 있다면 반드시 이를 최우선으로 참고하여 답변의 <채팅내용>과 <blocks>에 활용해야 합니다. 같은 채팅창의 이전 대화와 이전에 첨부된 이미지는 현재 질문의 직접적인 문맥입니다. 사용자가 "다시", "이렇게", "이전 사진", "방금 이미지"처럼 말하면 새 이미지를 요구하지 말고 대화 이력의 가장 최근 이미지를 기준으로 재분석하세요.
    ${chatMemory ? `[사용자 장기 대화 메모리]\n${chatMemory}\n` : ''}${ragContext}\n${hospitalContext}\n${prescriptionContext}\n
반드시 아래의 JSON 포맷으로만 응답해주세요. 프론트엔드의 블록 UI를 렌더링하기 위한 필수 규격입니다:
{
  "intent_type": "general|disease|drug|image|recruit|translation",
  "orchestration_summary": "수행한 AI 인텔리전스 작업 (예: X-ray 판독 및 전문의 소견 종합)",
  "chat_reply": "사용자에게 건넬 친절한 일반 텍스트 답변",
  "blocks": [
    {
      "block_type": "textbook|journal|md_tip|doctor_consensus|doctor_opinion|insurance_warning|expert_warning|image_read|sponsor_card|recruit_cards|drug_cards|prescription_options|translation",
      "title": "화면에 표시될 블록의 제목",
      "body": "블록의 내용 (HTML 태그 허용 안됨, 일반 텍스트)",
      "meta_json": {
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

    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: messages,
      response_format: { type: "json_object" }
    });

    const replyContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(replyContent || '{}');
    await saveChatMemory(userId, buildUpdatedChatMemory(chatMemory, question || '', parsedResponse));

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
