# 의사용 AI 대화형 업무 플랫폼 - 시스템 상세 설계서

본 문서는 기획된 '의사 전용 대화형 AI 업무 플랫폼'을 바탕으로, 실제 프론트엔드/백엔드 개발자가 즉시 작업에 착수할 수 있도록 분리된 실무용 명세서입니다.

---

## 1. 화면별 상세 명세서 (UI/UX Specification)

### 1.1. 메인 채팅 화면 (대시보드 / 워크스페이스)
- **경로**: `/chat`
- **목적**: 대다수의 의료/행정 업무를 자연어로 해결하는 통합 워크스페이스
- **구성 요소**:
  - **좌측 사이드바 (Sidebar)**
    - 진행 중인 새 대화 (New Chat)
    - 최근 대화 목록 (날짜별 묶음)
    - 저장한 대화 / 즐겨찾기
    - 카테고리 필터 탭 (약제비교, 번역, 문서요약, 환자설명)
  - **중앙 메인 영역 (Chat Thread)**
    - 사용자 질문 버블 (우측 정렬)
    - **`AiResponseCard` (AI 답변 카드 - 좌측 정렬)**
      - **텍스트/표 영역**: 마크다운, 표 렌더링 지원
      - **근거(Source) 영역**: 참고 문헌, 가이드라인 출처 뱃지 및 아코디언 메뉴
      - **액션 툴바 (Action Toolbar)**: 복사, 북마크, 공유, 번역, 표 변환, 설명문 변환
      - **피드백 패널 (Feedback Panel)**: 👍🏻 / 👎🏻 / 💡의견쓰기(모달 팝업)
      - **집단 의견 요약 (Insight Summary Box)**: 다른 의사들의 찬반 경향 및 코멘트 클러스터링 요약 표시
  - **하단 입력 영역 (Input Area)**
    - 멀티라인 지원 텍스트 에어리어 (Enter 전송 / Shift+Enter 줄바꿈)
    - 파일 첨부(Drag&Drop), 이미지 첨부 버튼
    - **프롬프트 칩 (Prompt Chip)**: '근거 보여줘', '환자용으로 바꿔줘', '표로 정리' 등 원클릭 감지
  - **우측 보조 패널 (Context Panel, 토글형)**
    - 시스템 추천 연관 질문
    - 호출된 문서 원문 뷰어 (PDF 등)

### 1.2. 마이페이지
- **경로**: `/mypage`
- **목적**: 개인화된 설정 관리 및 내 저장 콘텐츠 조회
- **구성 요소**:
  - **프로필/보안 설정**: 소속 병원/부서/직책 수정, 비밀번호 변경
  - **내 저장소 (My Archive)**: 북마크한 답변, 저장한 대화 목록
  - **나의 활동 (My Activity)**: 내가 남긴 의견(Feedback) 이력 조회
  - **개인화 옵션**: 선호 번역 언어, 자주 쓰는 프롬프트 프리셋 설정

### 1.3. 전문 번역 페이지
- **경로**: `/translate`
- **목적**: 장문이나 병원 내 문서를 여러 모드(환자용, 논문용 등)로 텍스트 일괄 번역
- **구성 요소**:
  - **입력부**: 원문 텍스트 박스 및 파일 업로드 (PDF/Word)
  - **번역 컨트롤러**: 타겟 언어 선택 드롭다운, 번역 모드(직역, 환자용, 논문스타일 등) 선택 라디오
  - **출력부**: 좌측(원문) - 우측(결과) 스플릿 뷰 지원
  - **액션**: 클립보드 복사, 파일 다운로드, "채팅으로 보내 후속 질문하기" 버튼

### 1.4. 관리자 대시보드
- **경로**: `/admin`
- **목적**: 병원/계정 관리, 품질 관리, 시스템 모니터링
- **구성 요소**:
  - **사용자 관리**: 일반의/자문의 승인, 병원별 그룹 할당
  - **품질 대시보드**: 응답 성공률, 피드백 비율, 최다 검색 키워드 차트
  - **지식베이스(RAG) 관리**: 내부 규정/데이터 외부 API 연동 상태, PDF 인덱싱 상태
  - **AI 로그 모니터링**: 프롬프트별 AI 응답 시간, 에러 추적

---

## 2. 데이터베이스 테이블 설계서 (ERD & Schema)

*(RDBMS (PostgreSQL) 기준으로 작성됨)*

### 2.1. `User` & `Hospital`
- **`Hospital`**: 병원 식별 정보
  - `id` (PK, UUID), `name` (String), `type` (String), `region` (String)
- **`Department`**: 부서 정보
  - `id`, `hospital_id` (FK), `name` (String)
- **`User`**: 의사 계정
  - `id` (PK), `email` (Unique), `password_hash`, `name`
  - `role` (Enum: `DOCTOR`, `REVIEWER`, `ADMIN`, `SUPER_ADMIN`)
  - `hospital_id` (FK), `department_id` (FK), `title` (String, 직책)
  - `status` (Enum: `PENDING`, `ACTIVE`, `INACTIVE`)

### 2.2. 대화 시스템 (`Conversation` & `Message`)
- **`Conversation`**: 대화 세션
  - `id` (PK), `user_id` (FK), `title` (String), `category` (String)
  - `created_at`, `updated_at`
- **`Message`**: 세션 내 개별 말풍선
  - `id` (PK), `conversation_id` (FK)
  - `role` (Enum: `user`, `assistant`, `system`)
  - `content` (Text), `message_type` (Enum: `qa`, `comparison`, `translation` 등)
  - `parent_message_id` (FK, 재생성 또는 분기 추적용)

### 2.3. RAG 자료 및 첨부파일 (`SourceReference` & `UploadedDocument`)
- **`SourceReference`**: AI 답변 시 참고한 근거 매핑
  - `id` (PK), `message_id` (FK), `source_type` (String - 논문, 가이드라인 등)
  - `source_title` (String), `source_url_or_id` (String), `snippet` (Text)
- **`UploadedDocument`**: 유저가 채팅에 업로드한 자료
  - `id` (PK), `user_id` (FK), `file_name` (String), `storage_path` (URL)
  - `parsed_text` (Text, 임베딩을 위함), `status` (Enum: `UPLOADING`, `PARSED`, `FAILED`)

### 2.4. 집단 지성 컴포넌트 (`Feedback` & `InsightSummary`)
- **`Feedback`**: 특정 AI 메시지에 대한 의사의 반응
  - `id` (PK), `message_id` (FK), `user_id` (FK)
  - `feedback_type` (Enum: `LIKE`, `DISLIKE`, `COMMENT`, `FLAG_NEEDS_REVIEW`)
  - `comment` (Text, 세부 의견)
- **`InsightSummary`**: 동일 카테고리 답변들의 피드백을 모아둔 집단 요약 (배치 처리)
  - `id` (PK), `message_id` (FK)
  - `summary_text` (Text - 총평)
  - `consensus_points` (JSON/Array - 합의점)
  - `disagreement_points` (JSON/Array - 이견)
  - `pending_checks` (JSON/Array - 검증 필요)

---

## 3. 백엔드 API 명세서 (RESTful API)

인증은 공통 Bearer Token (JWT) 방식(`Authorization: Bearer <token>`)을 사용.

### 3.1. 대화 (Conversations) API
- **`POST /api/conversations`**: 새 대화방 생성
  - Req: `{ title: string }`
  - Res: `{ id, title, createdAt }`
- **`GET /api/conversations`**: 사용자 대화 목록 조회 (페이징/필터 지원)
- **`DELETE /api/conversations/:id`**: 대화방 삭제

### 3.2. 메시지 (Messages) API
- **`POST /api/chat/messages`**: 사용자 메시지 전송 (AI 응답 트리거)
  - Req: `{ conversationId: string, message: string, attachments?: string[] }`
  - Res: SSE(Server-Sent Events) 스트리밍 응답 (AI 생성 텍스트)
  - Res(완료 시): `{ messageId, content, messageType, actions, sources: [] }`
- **`GET /api/conversations/:id/messages`**: 과거 채팅 히스토리 조회
- **`POST /api/chat/messages/:id/transform`**: 프롬프트 칩 (번역/표변환) 액션
  - Req: `{ action: "translate" | "table" | "patient_friendly" }`
  - Res: 변경된 텍스트 응답

### 3.3. 집단 지성 (Feedback & Insight) API
- **`POST /api/feedback`**: 좋아요/싫어요/의견 저장
  - Req: `{ messageId: string, feedbackType: "like"|"dislike"|"comment", comment?: string }`
  - Res: `201 Created`
- **`GET /api/messages/:id/insights`**: 답변 집단 의견 요약 조회
  - Res: `{ summary, consensusPoints: [], disagreementPoints: [], pendingChecks: [] }`

### 3.4. 문서 및 외부 어댑터 연동 (Documents & Adapters) API
- **`POST /api/documents/upload`**: 파일 업로드 및 파싱
  - Req: `multipart/form-data (file)`
  - Res: `{ documentId, storagePath, status }`
- **_Internal Usage:_** 외부 인증처리는 Backend의 Service Adapter Layer (Drug Adapter, Translation Adapter) 단에서 HMAC / OAuth2로 일괄 처리하여 프론트엔드 노출을 차단합니다. 