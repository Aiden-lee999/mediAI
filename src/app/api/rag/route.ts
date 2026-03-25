import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

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

    return NextResponse.json({
      answer: `요청하신 "${query}"에 대한 RAG 분석 결과입니다. 첨부된 레퍼런스를 참조해주시기 바랍니다.`,
      sources: mockSources,
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process RAG query' }, { status: 500 });
  }
}
