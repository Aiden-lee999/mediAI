// src/app/api/conversations/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    // 1. Get or Create Default User (Auth Mock)
    let user = await prisma.user.findFirst({ where: { email: 'doctor@hospital.com' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'doctor@hospital.com',
          passwordHash: 'dummy',
          name: '김닥터',
          role: 'DOCTOR',
          title: '내과 원장',
        }
      });
    }

    // 2. Fetch Conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await prisma.user.findFirst({ where: { email: 'doctor@hospital.com' } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const { title, category } = await req.json();

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || '새로운 대화',
        category: category || 'general',
      }
    });

    return NextResponse.json(conversation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
