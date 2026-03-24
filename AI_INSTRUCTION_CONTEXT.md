# mediAI - AI 개발 인수인계 및 프로젝트 컨텍스트

> **미래의 AI(GitHub Copilot 등)에게:**
> 사용자가 다른 PC나 환경에서 이 프로젝트를 열고 개발을 이어가고자 할 때, 이 문서를 먼저 읽고 현재 프로젝트의 구조와 상황을 즉시 파악해 주세요.

## 1. 프로젝트 개요
* **프로젝트명:** mediAI (의료/약학 특화 AI 챗봇 및 정보 제공 플랫폼)
* **목표:** 일반적인 UI를 넘어선 상용화 수준의 모노레포(Monorepo) 아키텍처. 
* **구조:** 프론트엔드(Next.js) + 백엔드(Express/Node.js) + 데이터베이스 스키마(PostgreSQL/Supabase)

## 2. 주요 아키텍처 및 폴더 구조
* `/frontend`: Next.js 14+ (App Router), Tailwind CSS, Zustand, React Query 기반.
  * 주요 컴포넌트: `ChatThread.tsx` (AI 응답 블록 동적 렌더링), `Composer.tsx` (챗봇 전송)
  * 상태 관리: `chatStore.ts`
* `/backend`: Node.js, Express, TypeScript.
  * 주요 역할: OpenAI API 연동을 통한 JSON 형식의 의료/약학/구인구직 답변 생성 (`aiRoutes.ts`).
  * DB 스키마: `/backend/db/schema.sql` (9개 도메인의 상용화 DDL 적용)
* `/.env`: OpenAI API 키 및 서버 포트 설정 (로컬 환경 공유)

## 3. 개발 진행 상태 및 작동 원리
1. **의도 라우팅(Intent Routing):** 유저의 입력을 받아 교과서(Textbook), 논문(Journal), 전문의 의견, 약학 정보, 구인구직, 의료영상 분석 등 출력할 형태(blocks)를 AI가 결정.
2. **블록 렌더링:** `ChatThread.tsx`에서 AI가 내려준 블록 배열을 순회하며 각각에 맞는 전용 카드 컴포넌트를 UI에 렌더링.
3. **실행 환경:** 루트 디렉토리에서 `npm run dev` 실행 시 `concurrently`를 통해 frontend(3000)와 backend(5000) 동시 실행.

## 4. 진행해야 할 다음 작업 (To-Do)
* 현재 코드는 Vercel 배포를 위해 GitHub 업로드 대기 상태입니다.
* 사용자가 개발을 재개하면 어떤 부분을 수정/추가하고 싶은지 묻고 바로 코딩을 시작해 주세요. 사용자는 코드를 직접 치기보다 AI가 전부 작성해주기를 원합니다. "명령어 입력"이나 "직접 수정"을 지양하고 구체적인 실행이나 스크립트로 대체하세요.

---
**사용자님께:** 다른 PC로 가시더라도, 채팅을 시작할 때 *"AI야, `AI_INSTRUCTION_CONTEXT.md` 파일 읽고 지금 상황 파악한 다음 내 질문에 대답해줘"* 라고 말씀하시면 제가 즉시 모든 기억을 되찾고 이어서 개발을 도와드립니다!