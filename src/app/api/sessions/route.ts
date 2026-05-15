import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// For demo purposes, we will upsert a dummy user based on a fixed email.
async function getDemoUser() {
  return await prisma.user.upsert({
    where: { email: 'doctor@demo.com' },
    update: {},
    create: {
      email: 'doctor@demo.com',
      passwordHash: 'dummy',
      name: '김의사',
      title: '내과',
      points: 25 // default points
    }
  });
}

async function getSessionUser(userId?: string | null) {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user;
  }
  return getDemoUser();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = await getSessionUser(searchParams.get('userId'));
  
  // Fetch sessions for this user
  const dbConvs = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { messages: true }
  });

  const formattedSessions = dbConvs.map(conv => {
    const rawHistory = conv.messages.map(m => {
       try {
          return JSON.parse(m.content);
       } catch(e) {
          return { role: m.role, content: m.content };
       }
    });

    return {
      id: conv.id,
      title: conv.title,
      date: new Date(conv.updatedAt).toLocaleDateString(),
      history: rawHistory.filter(h => h !== null)
    };
  });

  return NextResponse.json({ 
    sessions: formattedSessions,
    user: {
      id: user.id,
      name: user.name,
      specialty: user.specialty || user.title,
      points: user.points
    } 
  });
}

export async function POST(req: Request) {
  const { id, title, history, userId } = await req.json();
  const user = await getSessionUser(userId);

  // Create or Update Session
  const conv = await prisma.conversation.upsert({
    where: { id: id },
    update: {
      title,
      updatedAt: new Date()
    },
    create: {
      id,
      userId: user.id,
      title: title || '새로운 대화',
    }
  });

  // Re-save entire history (for simplicity, delete old and recreate)
  await prisma.message.deleteMany({
    where: { conversationId: id }
  });

  const msgsToCreate = history.map((h: any) => ({
     conversationId: id,
     role: h.role || 'user',
     content: JSON.stringify(h)
  }));

  if (msgsToCreate.length > 0) {
     await prisma.message.createMany({ data: msgsToCreate });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = await getSessionUser(searchParams.get('userId'));
  const sessionId = searchParams.get('sessionId');
  const clearAll = searchParams.get('all') === 'true';

  const conversations = await prisma.conversation.findMany({
    where: clearAll ? { userId: user.id } : { id: sessionId || '', userId: user.id },
    select: { id: true }
  });

  if (!clearAll && conversations.length === 0) {
    return NextResponse.json({ success: false, error: '삭제할 최근 기록을 찾지 못했습니다.' }, { status: 404 });
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  if (conversationIds.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  const messageIds = (await prisma.message.findMany({
    where: { conversationId: { in: conversationIds } },
    select: { id: true }
  })).map((message) => message.id);

  await prisma.$transaction(async (tx) => {
    if (messageIds.length > 0) {
      await tx.sourceReference.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.feedback.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.insightSummary.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.bookmark.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.messageTag.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.reviewWorkflow.deleteMany({ where: { messageId: { in: messageIds } } });
      await tx.message.updateMany({
        where: { parentMessageId: { in: messageIds } },
        data: { parentMessageId: null }
      });
      await tx.message.deleteMany({ where: { id: { in: messageIds } } });
    }

    await tx.conversation.deleteMany({ where: { id: { in: conversationIds }, userId: user.id } });
  });

  return NextResponse.json({ success: true, deleted: conversationIds.length });
}
