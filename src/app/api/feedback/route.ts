import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { sessionId, messageId, type, doctorId } = await req.json();
    
    // Save or update feedback
    const feedback = await prisma.feedback.create({
      data: {
        sessionId,
        messageId,
        type,
        doctorId: doctorId || 'anonymous'
      }
    });
    
    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save feedback' }, { status: 500 });
  }
}
