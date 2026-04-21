import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const { sessionId, content } = await req.json();

  const user = await prisma.user.upsert({
    where: { email: 'doctor@demo.com' },
    update: { points: { increment: 1 } },
    create: {
      email: 'doctor@demo.com',
      passwordHash: 'dummy',
      name: '김의사',
      title: '내과',
      points: 1
    }
  });

  return NextResponse.json({ success: true, updatedPoints: user.points });
}
