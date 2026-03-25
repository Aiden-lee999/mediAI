import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { sessionId, messageId, content, doctorId } = await req.json();
    
    const opinion = await prisma.opinion.create({
      data: {
        sessionId,
        messageId,
        content,
        doctorId: doctorId || 'anonymous'
      }
    });
    
    return NextResponse.json({ success: true, opinion });
  } catch (error) {
    console.error('Opinion error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save opinion' }, { status: 500 });
  }
}
