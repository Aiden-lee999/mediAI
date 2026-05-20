import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_PROMPT = 6000;
const MAX_RESPONSE = 12000;
const MAX_COMMENT = 3000;
const MAX_HISTORY_ITEMS = 30;
const TRAINING_SYSTEM_PROMPT = '당신은 AIMDNET의 전문 의학 보조 AI입니다. 한국어로 간결하고 임상적으로 안전하게 답하며, 약품·병원·보험·구인구직 데이터가 주어지면 이를 우선 근거로 사용합니다.';

function trimText(value: unknown, max: number) {
  return String(value || '')
    .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[이미지 첨부]')
    .trim()
    .slice(0, max);
}

async function getUser(userId?: string | null) {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
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
  });
}

function sanitizeHistory(history: unknown) {
  if (!Array.isArray(history)) return undefined;
  return history.slice(-MAX_HISTORY_ITEMS).map((item: any) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: trimText(item?.content || item?.parsedData?.chat_reply || '', 1200),
    hasImage: Boolean(item?.image),
  })).filter((item) => item.content || item.hasImage);
}

function isExportable(example: { rating: string; prompt: string | null; response: string | null; status: string }) {
  if (example.status === 'REJECTED') return false;
  if (!example.prompt?.trim() || !example.response?.trim()) return false;
  return ['LIKE', 'COMMENT', 'CORRECTION'].includes(example.rating);
}

function toFineTuneJsonl(example: { prompt: string; response: string }) {
  return JSON.stringify({
    messages: [
      { role: 'system', content: TRAINING_SYSTEM_PROMPT },
      { role: 'user', content: example.prompt },
      { role: 'assistant', content: example.response },
    ],
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await getUser(body.userId);
    const rating = String(body.rating || '').toUpperCase();
    if (!['LIKE', 'DISLIKE', 'COMMENT', 'CORRECTION'].includes(rating)) {
      return NextResponse.json({ success: false, error: 'rating은 LIKE, DISLIKE, COMMENT, CORRECTION 중 하나여야 합니다.' }, { status: 400 });
    }

    const prompt = trimText(body.prompt, MAX_PROMPT);
    const response = trimText(body.response, MAX_RESPONSE);
    const comment = trimText(body.comment, MAX_COMMENT) || null;
    if (!prompt && !response && !comment) {
      return NextResponse.json({ success: false, error: '저장할 질문, 답변 또는 의견이 필요합니다.' }, { status: 400 });
    }

    const example = await prisma.aiTrainingExample.create({
      data: {
        userId: user.id,
        sessionId: trimText(body.sessionId, 200) || null,
        source: trimText(body.source, 80) || 'CHAT_FEEDBACK',
        rating,
        prompt,
        response,
        responseJson: body.responseJson ?? undefined,
        history: sanitizeHistory(body.history) ?? undefined,
        comment,
      },
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { points: { increment: rating === 'LIKE' ? 1 : 2 } },
      select: { points: true },
    });

    return NextResponse.json({ success: true, id: example.id, updatedPoints: updated.points });
  } catch (error: any) {
    console.error('training-feedback error:', error);
    return NextResponse.json({ success: false, error: error?.message || '학습 피드백 저장 실패' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || undefined;
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    const limit = Math.min(Number(url.searchParams.get('limit') || 50) || 50, 200);
    const exportOnly = format === 'jsonl';
    const examples = await prisma.aiTrainingExample.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(exportOnly ? { rating: { in: ['LIKE', 'COMMENT', 'CORRECTION'] }, status: { not: 'REJECTED' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        sessionId: true,
        rating: true,
        source: true,
        prompt: true,
        response: true,
        comment: true,
        status: true,
        createdAt: true,
      },
    });
    if (format === 'jsonl') {
      const jsonl = examples
        .filter(isExportable)
        .map((example: { prompt: string; response: string }) => toFineTuneJsonl({ prompt: example.prompt, response: example.response }))
        .join('\n');
      return new Response(jsonl ? `${jsonl}\n` : '', {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Content-Disposition': 'attachment; filename="aimdnet-training.jsonl"',
        },
      });
    }
    return NextResponse.json({ success: true, examples });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '학습 피드백 조회 실패' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = trimText(body.id, 120);
    const status = String(body.status || '').toUpperCase();
    if (!id) return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });
    if (!['RAW', 'APPROVED', 'REJECTED', 'EXPORTED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'status는 RAW, APPROVED, REJECTED, EXPORTED 중 하나여야 합니다.' }, { status: 400 });
    }

    const updated = await prisma.aiTrainingExample.update({
      where: { id },
      data: {
        status,
        comment: typeof body.comment === 'string' ? trimText(body.comment, MAX_COMMENT) : undefined,
      },
      select: { id: true, status: true, comment: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, example: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '학습 피드백 검수 상태 변경 실패' }, { status: 500 });
  }
}
