import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (messageId) {
      const review = await prisma.reviewWorkflow.findUnique({
        where: { messageId },
        include: { reviewer: true }
      });
      return NextResponse.json(review);
    }

    const reviews = await prisma.reviewWorkflow.findMany({
      include: { reviewer: true, message: true },
    });
    return NextResponse.json(reviews);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, reviewerId, status, reviewNotes, version } = body;

    const review = await prisma.reviewWorkflow.create({
      data: {
        messageId,
        reviewerId,
        status: status || 'PENDING',
        reviewNotes,
        version: version || 'v1.0'
      }
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create review workflow' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, reviewNotes, reviewerId } = body;

    const review = await prisma.reviewWorkflow.update({
      where: { id },
      data: {
        status,
        reviewNotes,
        reviewerId
      }
    });

    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update review workflow' }, { status: 500 });
  }
}
