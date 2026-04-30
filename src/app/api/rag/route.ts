import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function buildRagMetrics(query: string, sourceCount: number, latencyMs: number) {
  const evidenceScore = Math.min(100, 50 + sourceCount * 20);
  const latencyScore = latencyMs <= 3000 ? 100 : latencyMs <= 8000 ? 85 : 65;
  const relevanceScore = query.trim().length >= 8 ? 85 : 70;
  const overallScore = Math.round((evidenceScore * 0.5) + (latencyScore * 0.2) + (relevanceScore * 0.3));
  const grade = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : 'D';

  return [
    '---',
    '### 의사용 객관 지표',
    '| 지표 | 값 |',
    '|---|---|',
    '| 모델 | rag-mock-engine |',
    `| 응답 지연시간 | ${latencyMs}ms |`,
    `| 근거 출처 수 | ${sourceCount}개 |`,
    `| 근거 점수 | ${evidenceScore}점 |`,
    `| 관련성 점수 | ${relevanceScore}점 |`,
    `| 종합 점수 | ${overallScore}점 (${grade}) |`,
  ].join('\n');
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
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

    const latencyMs = Date.now() - startedAt;
    const metricsMd = buildRagMetrics(query || '', mockSources.length, latencyMs);
    const answerContent = `(RAG 병원 내부지식 기반 답변) 요청하신 "${query}"에 대한 RAG 분석 결과입니다. \n\n[출처 1] ${mockSources[0].title}: ${mockSources[0].snippet}\n[출처 2] ${mockSources[1].title}: ${mockSources[1].snippet}\n\n${metricsMd}`;

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

