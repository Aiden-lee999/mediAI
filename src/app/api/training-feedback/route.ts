import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_PROMPT = 6000;
const MAX_RESPONSE = 12000;
const MAX_COMMENT = 3000;
const MAX_HISTORY_ITEMS = 30;

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
    const limit = Math.min(Number(url.searchParams.get('limit') || 50) || 50, 200);
    const examples = await prisma.aiTrainingExample.findMany({
      where: userId ? { userId } : undefined,
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
    return NextResponse.json({ success: true, examples });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '학습 피드백 조회 실패' }, { status: 500 });
  }
}
