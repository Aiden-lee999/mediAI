import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { messageId, userId } = await req.json();
    if (!messageId || !userId) {
      return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }
    
    // Toggle Bookmark
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_messageId: {
          userId,
          messageId
        }
      }
    });

    if (existing) {
      await prisma.bookmark.delete({
        where: { id: existing.id }
      });
      return NextResponse.json({ bookmarked: false });
    } else {
      await prisma.bookmark.create({
        data: { userId, messageId }
      });
      return NextResponse.json({ bookmarked: true });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed bookmark operation' }, { status: 500 });
  }
}
