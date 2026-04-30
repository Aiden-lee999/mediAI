import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getDemoUser() {
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

export async function GET(req: Request) {
  try {
    const user = await getDemoUser();
    const url = new URL(req.url);
    const key = (url.searchParams.get('key') || '').trim();

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    const pref = await prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId: user.id,
          key,
        },
      },
    });

    return NextResponse.json({ key, value: pref?.value ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch preference' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getDemoUser();
    const body = await req.json();
    const key = (body?.key || '').trim();
    const value = typeof body?.value === 'string' ? body.value : JSON.stringify(body?.value ?? null);

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    await prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId: user.id,
          key,
        },
      },
      update: { value },
      create: {
        userId: user.id,
        key,
        value,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 });
  }
}
