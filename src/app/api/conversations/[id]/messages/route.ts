// src/app/api/conversations/[id]/messages/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const messages = await prisma.message.findMany({
      where: { conversationId: resolvedParams.id },
      orderBy: { createdAt: 'asc' },
      include: {
        sources: true,
        feedbacks: true,
        insightSummary: true,
      }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
