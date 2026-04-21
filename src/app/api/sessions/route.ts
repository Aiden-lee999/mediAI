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

export async function GET() {
  const user = await getDemoUser();
  
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
      name: user.name,
      specialty: user.title,
      points: user.points
    } 
  });
}

export async function POST(req: Request) {
  const user = await getDemoUser();
  const { id, title, history } = await req.json();

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
