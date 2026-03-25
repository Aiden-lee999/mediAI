import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { messageId, tag } = await req.json();
    if (!messageId || !tag) {
      return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }
    
    const existing = await prisma.messageTag.findUnique({
      where: {
        messageId_tag: {
          messageId,
          tag
        }
      }
    });

    if (existing) {
      return NextResponse.json({ message: 'Tag already exists' });
    }

    const newTag = await prisma.messageTag.create({
      data: { messageId, tag }
    });
    
    return NextResponse.json({ tag: newTag });
  } catch (err) {
    return NextResponse.json({ error: 'Failed tag operation' }, { status: 500 });
  }
}
