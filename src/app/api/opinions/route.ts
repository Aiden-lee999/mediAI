import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

export async function POST(req: Request) {
  const { userId } = await req.json();

  const user = await getUser(userId);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { points: { increment: 1 } },
    select: { points: true },
  });

  return NextResponse.json({ success: true, updatedPoints: updated.points });
}
