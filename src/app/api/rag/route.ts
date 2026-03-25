import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { query, sessionId } = await request.json();

    // 1. 유저 메시지 저장
    let userMessage = null;
    if (sessionId) {
      userMessage = await prisma.message.create({
        data: {
          conversationId: sessionId,
          role: 'user',
          content: query,
        }
      });
    }

    // Mock RAG processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simulated matched references (RAG concept)
    const mockSources = [
      {
        id: "src_1",
        title: "대한의사협회 진료지침 2024",
        snippet: "해당 증상 발현 시 1차적으로 보존적 치료를 권장하며...",
        url: "https://example.com/guideline/1",
        rank: 1
      },
      {
        id: "src_2",
        title: "최신 논문: 보존적 치료의 효과",
        snippet: "통계적으로 초기 보존적 치료가 85%의 환자에게 유의미한 호전을 보였다.",
        url: "https://example.com/paper/451",
        rank: 2
      }
    ];

    const answerContent = `(RAG 병원 내부지식 기반 답변) 요청하신 "${query}"에 대한 RAG 분석 결과입니다. \n\n[출처 1] ${mockSources[0].title}: ${mockSources[0].snippet}\n[출처 2] ${mockSources[1].title}: ${mockSources[1].snippet}`;

    // 2. 어시스턴트 메시지 저장
    let assistantMessage = null;
    if (sessionId) {
      assistantMessage = await prisma.message.create({
        data: {
          conversationId: sessionId,
          role: 'assistant',
          content: answerContent,
        }
      });

      // 3. ReviewWorkflow 에 자동 등록 (RAG 답변은 검수가 필요하다고 가정)
      await prisma.reviewWorkflow.create({
        data: {
          messageId: assistantMessage.id,
          status: 'PENDING',
          version: 'v1.0 (RAG)',
        }
      });
    }

    return NextResponse.json({
      answer: answerContent,
      sources: mockSources,
    });
    
  } catch (error) {
    console.error('RAG Error', error);
    return NextResponse.json({ error: 'Failed to process RAG query' }, { status: 500 });
  }
}

