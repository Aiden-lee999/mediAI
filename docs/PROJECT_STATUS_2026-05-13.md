# AIMDNET 개발 현황 정리 — 2026-05-13

## 배포 현황

- 운영 alias: https://mediai-gules.vercel.app
- 최신 검증 배포: https://frontend-h3kgsjqvi-aiden-lee999s-projects.vercel.app
- 배포 플랫폼: Vercel Production
- 주요 검증 명령: `npm run build`

## 최근 개발 완료 내역

### 1. 약제 조회 및 AI 채팅 속도 개선

- 약제 검색 API의 기본/최대 검색량을 축소해 과도한 DB 조회를 줄였다.
- DB 결과가 있을 때는 외부 MFDS 실시간 보강 호출을 생략하도록 변경했다.
- 외부 API fallback timeout/retry를 줄여 검색 지연을 완화했다.
- AI 질의 API에서 직접 `PrismaClient`를 생성하던 구조를 공유 Prisma 클라이언트 사용 방식으로 정리했다.
- RAG 검색어를 정제하고 최대 개수를 제한했다.
- 무거운 원본 public API dump 필드 조회를 제외해 응답 부하를 줄였다.

주요 파일:

- `src/app/api/drugs/search/route.ts`
- `src/app/api/ask/route.ts`
- `src/lib/publicDrugApiCatalog.ts`

### 2. 약제 상세/검색 데이터 품질 보강

- 약제 상세 API에서 이미지, DUR, 성분, 허가정보, 급여정보 등 public API 병합 데이터를 더 많이 활용하도록 개선했다.
- 약제 DUR API와 상세 페이지용 API 응답 품질을 보강했다.
- 약제 상세 페이지 경로를 추가했다.
- 약제 검색 패널 및 대시보드 약제 검색 UI를 보강했다.
- 공공 API 병합/품질 검증/백필용 스크립트를 추가했다.

주요 파일:

- `src/app/api/drugs/detail/route.ts`
- `src/app/api/drugs/dur/route.ts`
- `src/app/api/drugs/item/route.ts`
- `src/app/drug/[drugKey]/page.tsx`
- `src/components/drug/DrugSearchPanel.tsx`
- `src/components/dashboard/DrugSearch.tsx`
- `scripts/audit_drug_detail_quality.ts`
- `scripts/backfill_nedrug_images.ts`
- `scripts/backfill_no_blank_core_fields.ts`
- `scripts/restore_real_fields_from_source.ts`
- `scripts/verify_no_blank_core_fields.ts`

### 3. 로그인/회원가입/인증 체계 정리

- 자체 인증 유틸리티를 추가했다.
- 비밀번호 해시, 세션 토큰, 비밀번호 재설정 토큰 생성/검증 로직을 정리했다.
- 의사 면허번호 형식 검증 및 allowlist/외부 API 연동 가능 구조를 추가했다.
- 로그인 API가 공개 사용자 정보에 직책, 병원명, 주소, 요양기관번호를 포함하도록 확장했다.
- 회원가입, 면허검증, 비밀번호 찾기, 비밀번호 재설정 API를 추가했다.

주요 파일:

- `src/lib/auth.ts`
- `src/app/api/v1/auth/login/route.ts`
- `src/app/api/v1/auth/signup/route.ts`
- `src/app/api/v1/auth/verify-license/route.ts`
- `src/app/api/v1/auth/forgot-password/route.ts`
- `src/app/api/v1/auth/reset-password/route.ts`

### 4. 회원가입 약관/개인정보/민감정보 동의 구조 개선

- 서비스 이용약관, 개인정보 처리 안내, 환자정보·민감정보 입력 특칙을 분리했다.
- 필수 동의와 선택 동의를 구분했다.
- 선택 동의 항목으로 비식별·가명 처리 데이터 활용 및 마케팅 수신 동의를 추가했다.
- DB에 각 동의 시각을 저장하도록 Prisma 스키마를 확장했다.
- 로그인 화면 하단에 의료 AI 사용상 주의 문구를 추가했다.

주요 파일:

- `src/app/login/page.tsx`
- `src/app/api/v1/auth/signup/route.ts`
- `prisma/schema.prisma`

### 5. 구인·구직 AI 매칭 기능 추가

- 로그인 사용자가 병원 원장/관리자이면 구인 모드, 그 외 사용자는 구직 모드로 동작하도록 구현했다.
- 원장 계정은 병원 채용 공고를 생성할 수 있다.
- 일반 의료진 계정은 희망 근무 조건을 저장하고 공고 추천을 받을 수 있다.
- 매칭 기준:
  - 진료과/전문 분야
  - 근무 형태
  - 근무 방식
  - 근무 시간
  - 급여 범위
  - 거리
  - 사용자가 중요하게 보는 우선순위
- 매칭 결과는 점수, 등급, 추천 이유, 확인할 조건을 함께 제공한다.

주요 파일:

- `src/lib/recruitMatching.ts`
- `src/components/dashboard/RecruitMatch.tsx`
- `src/app/api/recruit/profile/route.ts`
- `src/app/api/recruit/postings/route.ts`
- `src/app/api/recruit/matches/route.ts`
- `src/app/dashboard/page.tsx`
- `prisma/schema.prisma`

### 6. 네이버 지도 API 기반 경로 안내 연결

- 네이버 Maps API 키를 Vercel Production 환경변수로 등록했다.
- 구인·구직 추천 상세에서 네이버 API를 우선 사용하도록 연결했다.
- 주소만 입력해도 네이버 Geocoding으로 좌표를 자동 변환한다.
- 좌표 확보 후 네이버 Directions API로 차량 거리/시간을 계산한다.
- 대중교통/도보는 현재 거리 기반 추정값과 지도 링크를 병행 제공한다.
- 네이버/카카오/구글 지도 링크를 함께 제공한다.

주요 파일:

- `src/lib/naverMaps.ts`
- `src/app/api/recruit/route-info/route.ts`
- `src/app/api/recruit/profile/route.ts`
- `src/app/api/recruit/postings/route.ts`
- `src/components/dashboard/RecruitMatch.tsx`

검증 결과:

- 한글 주소 기반 요청에서 `source: naver-directions` 반환 확인
- 차량 거리/시간 반환 확인
- 운영 alias에서 `/api/recruit/route-info` 정상 동작 확인

## DB 스키마 변경 요약

### User 모델 확장

- 환자정보·민감정보 안내 동의 시각
- 서비스 품질 개선용 비식별·가명 처리 데이터 활용 동의 시각
- 마케팅 수신 동의 시각
- 구인·구직 프로필 관계
- 채용 공고 관계

### RecruitProfile 모델 추가

- 구직/구인 모드
- 위치 주소 및 좌표
- 전문 분야
- 근무 형태/방식/시간
- 희망 급여 범위
- 매칭 우선순위
- 가능 시작일
- 자기소개

### RecruitPosting 모델 추가

- 공고 소유자
- 병원명
- 공고 제목
- 진료과
- 근무지 주소 및 좌표
- 근무 형태/방식/시간
- 급여 범위
- 매칭 우선순위
- 설명
- 상태

## 운영 환경변수

값은 Git에 기록하지 않고 Vercel 환경변수로만 관리한다.

- `DATABASE_URL`
- `DIRECT_URL`
- `OPENAI_API_KEY`
- `NAVER_MAPS_CLIENT_ID`
- `NAVER_MAPS_CLIENT_SECRET`
- 선택: `GOOGLE_MAPS_API_KEY`

## 품질/운영 메모

- 네이버 지도 API는 무료 제공량이 큰 종량제이므로 초기 서비스 트래픽에서는 비용 부담이 낮을 가능성이 높다.
- 네이버 Directions는 차량 경로 계산에 우선 사용한다.
- 대중교통/도보 정확도를 높이려면 추가 지도/교통 API 검토가 필요하다.
- PowerShell에서 한글 JSON을 직접 전송하면 깨질 수 있으므로 배포 검증은 Unicode escape 또는 Node fetch 방식으로 진행했다.
