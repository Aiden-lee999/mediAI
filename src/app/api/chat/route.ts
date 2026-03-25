// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import OpenAI from 'openai';

// Initialize external OpenAI client
// It will gracefully fall back to mock logic if no API key is provided yet
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// Mock Drug API Simulator (To be replaced with real DUR/KIMS API)
async function fetchDrugInfo(query: string) {
  // Simulate an external API call for medication data
  return `[약제 API 데이터 결과] '${query}'에 대한 최신 주의사항: 신장 기능 저하 환자 투여 시 용량 조절 필요. 병용 금기: 특정 항진균제.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Support two types of payload formats (legacy vs new)
    const conversationId = body.conversationId || body.sessionId; 
    const content = body.content || body.query;
    const role = body.role || 'USER';

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Missing conversationId or content' }, { status: 400 });
    }

    // 1. Save User Message
    const userMsg = await prisma.message.create({
      data: {
        conversationId,
        role: role.toUpperCase() === 'USER' ? 'USER' : role,
        content,
        messageType: 'query'
      }
    });

    let aiContent = "답변을 생성할 수 없습니다.";
    let messageType = "general";
    let blocks: any = null;
    let sources: any[] = [];

    // 2. Real LLM Integration Logic
    if (process.env.OPENAI_API_KEY) {
      // 2-a. Fetch actual history for context window
      const history = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      const messagesForOpenAI: any[] = [
        { role: 'system', content: '당신은 전문 의사들을 위한 임상 지식 보조 AI인 mediAI입니다. 답변은 철저히 의학적이고 전문적인 어조로, 신뢰할 수 있는 출처를 기반으로 작성해야 합니다.' },
        ...history.map(m => ({
          role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];

      // 2-b. Function Call / Tool use for real-time external APIs
      if (content.includes('약') || content.includes('부작용') || content.includes('비교')) {
        const drugData = await fetchDrugInfo(content);
        messagesForOpenAI.push({ role: 'system', content: `[외부 약제 API 검색 결과]: ${drugData}` });
        sources.push({ title: '의약품안전사용서비스(DUR)', snippet: '최신 병용 연령 주의 데이터 연동' });       
        messageType = "comparison";
      }

      // Determine model based on complexity (5.4 / pro rules)
      let targetModel = "gpt-4o-mini"; // fallback to gpt-4o-mini as realistic baseline if 5.4 not available in your region yet
      const isComplexTask = content.includes('비교') || content.includes('분석') || content.includes('진단');
      const isVeryHardTask = content.includes('논문') || content.includes('추론') || content.includes('연구');

      if (isVeryHardTask) {
        targetModel = "gpt-4-turbo"; // Placeholder for gpt-5.4-pro
      } else if (isComplexTask) {
        targetModel = "gpt-4o"; // Placeholder for gpt-5.4
      }

      // 2-c. Chat Completion Create
      const completion = await openai.chat.completions.create({
        model: targetModel,
        messages: messagesForOpenAI,
        temperature: 0.3,
      });

      aiContent = completion.choices[0].message.content || '답변을 생성할 수 없습니다.';
    } else {
      // 3. Fallback Mock Logic (If API key is absent)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (content.includes('비교')) {
        messageType = "comparison";
        aiContent = "요청하신 약제 비교 분석 결과입니다. (OpenAI API 키가 등록되지 않아 시뮬레이션 결과가 출력됩니다.)";
        sources.push({ title: '시뮬레이션 가이드라인.pdf', snippet: '모의 테스트 문서' });
      } else if (content.includes('요약')) {
        messageType = "summary";
        aiContent = "해당 환자의 경우 장기적인 호흡기 관리가 요구되며, 지속적인 모니터링이 필요합니다.";
      } else {
        messageType = "general";
        aiContent = "지정하신 증상에 대한 가이드라인 확인 결과, 추가 검사를 요할 수 있습니다. 정상적인 AI 응답을 위해 환경 변수에 OPENAI_API_KEY를 설정해 주세요.";
      }
    }

    // 4. Save AI Message to DB
    const aiMsg = await prisma.message.create({
      data: {
        conversationId,
        role: 'AI',
        content: aiContent,
        messageType: messageType,
      }
    });

    // 5. Save Sources to DB
    for (const src of sources) {
      await prisma.sourceReference.create({
        data: {
          messageId: aiMsg.id,
          sourceType: 'API_OR_DOCUMENT',
          sourceTitle: src.title,
          snippet: src.snippet,
        }
      });
    }

    // Fetch the newly created message with its sources
    const finalAiMsg = await prisma.message.findUnique({
      where: { id: aiMsg.id },
      include: { sources: true }
    });

    return NextResponse.json({
      userMessage: userMsg,
      aiMessage: finalAiMsg
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 });
  }
}
