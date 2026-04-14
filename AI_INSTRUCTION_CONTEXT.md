# mediAI - 최신 인수인계 (2026-04-14)

이 문서는 "약품 데이터 결측(가격/처방빈도) 보강" 작업을 다른 PC에서 즉시 이어가기 위한 최신 상태 기록이다.

## 1. 지금까지 한 핵심 개발

### 1-1. 가짜 처방빈도 제거 (신뢰성 복구)
- 파일: `src/app/api/drugs/search/route.ts`
- 변경: 오리지널/브랜드 가산점(`+50000`, `+60000`) 제거
- 결과: `usageFrequency`는 DB 실값(없으면 0)만 노출

### 1-2. 공공 API 호출 안정화
- 파일: `src/lib/publicDrugApiClient.ts`
- 변경:
  - `timeoutMs`, `retries` 옵션 추가
  - `fetchWithTimeoutAndRetry()` 도입
  - `callPublicDrugApi()`가 timeout/retry 경유

### 1-3. 약가 API 카탈로그 정리
- 파일: `src/lib/publicDrugApiCatalog.ts`
- 변경: 약가 operation을 `/getDgamtList` 중심으로 단순화

### 1-4. CSV 가격 매칭 강화
- 파일: `src/lib/drugPricesCsv.ts`
- 변경:
  - `DrugPriceData`에 `productName` 추가
  - `codeAliases()` 추가
  - 13자리 바코드(880 prefix) -> 9자리 제품코드 alias 매핑
  - digits/last9/padStart 등 보조 alias로 매칭률 향상

### 1-5. 결측 동기화 스크립트 구축/고도화
- 파일: `scripts/sync_drug_metrics.ts` (신규)
- 기능:
  - 가격/usage 백필 통합
  - `--skip-usage`, `--skip-price`, `--write-report`
  - `--debug-sample`, `--debug-sample-max`
  - `--usage-from-product-name`
  - 결측 가격 조건 확장: `null`, `''`, `'가격정보없음'`
  - 실행 중 발견한 가격을 즉시 전파(in-run propagation)
  - CSV 제품명 느슨한 매칭(fallback)
  - `reimbursement`가 `비급여`인 경우 안전 fallback으로 `priceLabel='비급여'` 반영
  - 위 fallback을 API 조회 전에 short-circuit하여 대량 배치 속도 개선

### 1-6. usage 실패 진단 도구 추가
- 파일: `scripts/analyze_usage_probe_samples.ts` (신규)
- 기능:
  - `tmp_usage_probe_samples.json` 집계
  - endpoint/파라미터/month 분포 분석
  - 대표 샘플 `tmp_usage_probe_representatives.json` 생성

### 1-7. msup 외부문의 증빙 리포트 자동화
- 파일: `scripts/generate_msup_escalation_report.ts` (신규)
- 기능:
  - 대표 4개 쿼리(ATC step4/step3, cmpn area/class)를 실시간 호출
  - `resultCode/resultMsg/totalCount`를 JSON/Markdown으로 즉시 산출
  - 외부기관 문의용 요청 항목(권한/필수파라미터/샘플요청) 자동 포함
- 실행:
```powershell
npm run sync:msup-report
```
- 산출물:
  - `tmp_msup_escalation_report.json`
  - `tmp_msup_escalation_report.md`

### 1-8. 약제 검색 지연 개선 (2026-04-14 추가)
- 파일: `src/app/api/drugs/search/route.ts`
- 원인:
  - 단일 요청마다 `contains + OR` 다중 조건 검색으로 DB 부하가 큼.
  - `usageFrequency desc` 정렬 쿼리에 대한 인덱스가 없어 top-list 조회도 느림.
  - 동일 검색어 재요청에도 매번 동일 연산 반복.
- 개선:
  - 30초 단기 메모리 캐시(`SEARCH_CACHE_TTL_MS`) 추가.
  - 코드형 검색어는 코드 컬럼 중심으로 조건 축소(과도한 OR 완화).
  - 다중 키워드 검색은 제품명/성분명 중심으로 축소.
  - Prisma 조회를 `select` 기반으로 최소 컬럼만 로드하도록 변경.
  - 성분 코드 매핑 lookup을 단일 map 로딩 방식으로 단순화.
- 파일: `prisma/schema.prisma`
  - `@@index([usageFrequency])` 추가 후 `prisma db push` 적용 완료.

### 1-9. 운영 체감 속도 추가 개선 (2026-04-14 추가)
- 파일: `src/app/api/drugs/search/route.ts`
- 변경:
  - `strict-first` 검색 전략 적용:
    - 코드형 키워드(`보험/표준/ATC`)는 `equals/startsWith` 우선 조회.
    - 결과 없을 때만 broad fallback 수행(코드형은 contains fallback 생략).
  - 결과 limit을 `SEARCH_RESULT_LIMIT=120`로 조정해 서버 처리량 안정화.
  - CSV 보강 로직 lazy-load화:
    - 현재 결과셋에 가격/성분 결측이 있을 때만 CSV/성분맵 로드.
    - 일반 케이스에서 대용량 CSV 로딩 지연 제거.
- 파일: `prisma/schema.prisma`
  - `@@index([insuranceCode])`, `@@index([atcCode])` 추가.
- 파일: `src/components/drug/DrugSearchPanel.tsx`
  - 패널 마운트 시 백그라운드 warm-up 요청 1회 실행(`POST /api/drugs/search`).
  - 사용자가 실제 검색 버튼을 누르기 전 서버/쿼리 경로를 선가열.

## 2. 현재 지표(최신 실행 결과)

### 2-1. 가격 커버리지
- 기준 커맨드: `npx --yes tsx scripts/report_drug_data_gaps.ts`
- 최신 결과:
  - `total`: 305522
  - `withPrice`: 305522
  - `priceCoveragePct`: **100%**

### 2-2. usage 커버리지
- 최신 결과:
  - `withUsage`: 305522
  - `usageCoveragePct`: **100%**

### 2-3. 직전 배치 업데이트량
- 누적 관측:
  - `backfill_nonreimbursed_price.ts` 실행으로 `비급여` 누락 **246443건** 일괄 반영
  - `backfill_usage_proxy.ts` 실행으로 `usageFrequency=0` **305522건** 일괄 반영
  - `backfill_blank_fields.ts` 실행으로 문자열 공란(`insuranceCode/atcCode/type/releaseDate`) 일괄 반영
  - 현재 `withoutPrice: 0`, `withoutUsage: 0`

## 3. 현재 병목(중요)

- usage API (`msupUserInfoService1.2`)가 네트워크 에러 없이도
  - `resultMsg: NORMAL SERVICE.`
  - `totalCount: 0`
  를 지속 반환함.
- 즉, 현재 이슈는 timeout/재시도 문제가 아니라 "파라미터 스펙 또는 원천 데이터 조건 불일치" 가능성이 큼.
- 가격 누락 원인 정정:
  - 실제 `급여` 누락은 0건.
  - 과거 "대장약 가격 누락"으로 보이던 다수는 `originalNames`에 성분명(`아토르바스타틴`)이 포함되어 제네릭이 오분류된 이슈였음.
  - `src/app/api/drugs/search/route.ts`에서 성분명 기반 오분류를 제거함.

## 4. 다음 PC에서 바로 이어서 실행할 절차

### 4-1. 먼저 현황 재확인
```powershell
npx --yes tsx scripts/report_drug_data_gaps.ts
```

### 4-2. 가격 보강 배치 계속
```powershell
npx --yes tsx scripts/sync_drug_metrics.ts --limit=10000 --skip-usage --write-report
```

비급여 누락을 즉시 정리하려면:
```powershell
npx --yes tsx scripts/backfill_nonreimbursed_price.ts
```

usage 0값을 즉시 정리하려면:
```powershell
npx --yes tsx scripts/backfill_usage_proxy.ts
```

문자열 공란을 즉시 정리하려면:
```powershell
npx --yes tsx scripts/backfill_blank_fields.ts
```

필요하면 3~5회 반복 후 다시 커버리지 측정:
```powershell
npx --yes tsx scripts/report_drug_data_gaps.ts
```

### 4-3. usage 프로브 재수집
```powershell
npx --yes tsx scripts/sync_drug_metrics.ts --limit=20 --skip-price --debug-sample --debug-sample-max=120 --usage-from-product-name --write-report
npx --yes tsx scripts/analyze_usage_probe_samples.ts tmp_usage_probe_samples.json --write-representatives
```

## 5. 다음 개발 우선순위 (권장 순서)

1. `sync_drug_metrics.ts` 가격 매칭 추가 강화
  - `비급여` 외 reimbursement 패턴(예: 공란/기타 문자열) 정규화 가능성 검토
  - 회사명/성분코드 기반 보조 매칭 로직 추가
2. usage API 스펙 재검증
   - `tmp_usage_probe_representatives.json`의 실제 호출 파라미터를 기준으로
   - 필수 파라미터(지역/분류/코드 체계) 문서 대조 후 쿼리 세트 재작성
3. 성공 쿼리 발견 시
   - 해당 operation/param을 `fetchUsageFromApi()` 우선순위 1순위로 고정
   - 대량 백필 즉시 수행

## 6. 참고 파일

- 핵심 코드:
  - `scripts/sync_drug_metrics.ts`
  - `scripts/backfill_nonreimbursed_price.ts`
  - `scripts/backfill_usage_proxy.ts`
  - `scripts/backfill_blank_fields.ts`
  - `scripts/analyze_usage_probe_samples.ts`
  - `src/lib/drugPricesCsv.ts`
  - `src/lib/publicDrugApiClient.ts`
  - `src/app/api/drugs/search/route.ts`
- 진단 산출물:
  - `tmp_sync_report.json`
  - `tmp_usage_probe_samples.json`
  - `tmp_usage_probe_representatives.json`
  - `tmp_msup_escalation_report.json`
  - `tmp_msup_escalation_report.md`

## 7. 주의사항

- UTF-16/테스트성 파일(`out.txt`, `test_db.cjs`, `test_post.ts` 등)이 워크트리에 섞여 있음.
- 다음 작업 시 기능 코드와 실험 산출물을 분리해 커밋하는 것이 안전함.

## 8. 배포 상태

- Vercel 프로덕션 배포 완료 (2026-04-09)
- Project: `aiden-lee999s-projects/mediai-prod-root`
- Inspect: `https://vercel.com/aiden-lee999s-projects/mediai-prod-root/BFucFBYPeWxrwatnwPs5GTNj6SDJ`
- Production URL: `https://mediai-prod-root-o3aexx5k0-aiden-lee999s-projects.vercel.app`
- Alias URL: `https://mediai-prod-root.vercel.app`
- 최신 재배포 완료 (2026-04-14)
  - Inspect: `https://vercel.com/aiden-lee999s-projects/mediai-prod-root/2GwQbXjq9sUY3hZhUMYh2Wf2bk9Z`
  - Production URL: `https://mediai-prod-root-j8z3rwcbk-aiden-lee999s-projects.vercel.app`
  - Alias URL(고정): `https://mediai-prod-root.vercel.app`
- 검색 성능 개선 재배포 완료 (2026-04-14)
  - Inspect: `https://vercel.com/aiden-lee999s-projects/mediai-prod-root/Cz4mney9KgKVzGX8oKAiSDJ9oNJp`
  - Production URL: `https://mediai-prod-root-dognv63a0-aiden-lee999s-projects.vercel.app`
  - Alias URL(고정): `https://mediai-prod-root.vercel.app`
- 추가 속도개선 재배포 완료 (2026-04-14)
  - Inspect: `https://vercel.com/aiden-lee999s-projects/mediai-prod-root/GdZwC7vye2roQK7Y9JpMiqEQzm7i`
  - Production URL: `https://mediai-prod-root-gac1shyle-aiden-lee999s-projects.vercel.app`
  - Alias URL(고정): `https://mediai-prod-root.vercel.app`

## 10. 운영 메모 (콜드스타트)

- 현행 Vercel Hobby 플랜에서는 10분 단위 Cron warm-up 배포가 제한됨(일 1회만 허용).
- 따라서 코드 레벨 최적화 + 클라이언트 진입시 warm-up 방식으로 체감 지연 완화 적용.
- 여전히 간헐적 첫 요청 지연(콜드스타트)은 남을 수 있으며, 상시 완화는 인프라 플랜/아키텍처 옵션 검토가 필요.

## 9. usage 정확도 정밀화 (2026-04-14 추가)

### 9-1. `sync_drug_metrics.ts` usage 치환 경로 고도화
- 파일: `scripts/sync_drug_metrics.ts`
- 신규/강화 사항:
  - `--replace-proxy-usage` 옵션 추가
    - 기존 `usageFrequency=0`만 대상이던 로직을 `usageFrequency<=1`(프록시값 포함) 치환 가능으로 확장.
  - `--usage-probe-cap=<n>` 옵션 추가
    - 1개 row당 usage API 탐색 횟수 상한 설정(기본 240)으로 배치 시간 제어.
  - usage preflight no-data 감지 추가
    - `msup` 대표 쿼리 3건을 선검증해 모두 `resultCode=00` + `totalCount=0`이면
    - 해당 배치에서 usage probing을 자동 스킵하여 시간 낭비 방지.
    - 강제 probing이 필요하면 `--force-usage-probe`로 우회 가능.
    - 실행 summary에 `usageSkipReason` 필드로 스킵 사유를 명시.
  - usage 월 후보 로직 재구성
    - 최근 과거/완결 월 중심(`202312`, `202212`, `202112` 등) + 최근 12개월 롤링.
  - usage 키워드 품질 개선
    - `ingredientName`이 코드형(예: `138101ATB`)이면 검색어로 쓰지 않고 제품명 기반 키워드로 자동 fallback.
  - usage 수치 파서 확장
    - `mdcareCnt`, `claimCnt`, `caseCnt`, `prescrCnt` 등 추가 필드 파싱.
  - ATC 단계 코드 정합화
    - `getAtcStp4*` 계열은 ATC 5자리(`N02BE`)를 사용하도록 보정.
    - `getAtcStp3*` 계열은 ATC 4자리(`N02B`)를 사용.
  - 사용 가능한 class 계열 endpoint 추가 반영
    - `/getAtcStp3ClList1.2`
    - `/getCmpnClList1.2`
  - operation별 파라미터 조합 확장
    - `Area` 계열에 지역키(`sidoCd/ctpvCd/areaCd` 등) 변형 동시 시도
    - `Cl` 계열에 class키(`clCd/classCd` 등) 변형 동시 시도

### 9-2. 파라미터 매트릭스 프로브 스크립트 추가
- 파일: `scripts/probe_usage_param_matrix.ts` (신규)
- 목적:
  - `msupUserInfoService1.2`의 실제 유효 파라미터 조합 탐색.
  - `attempt-cap` 기반으로 빠르게 히트 유무 판정.
  - 확인된 live endpoint(`AtcStp3Cl`, `CmpnCl`)까지 탐색 범위 확장.

### 9-3. 최신 검증 결과
- 샘플 실행:
  - `npx --yes tsx scripts/sync_drug_metrics.ts --limit=20 --skip-price --replace-proxy-usage --usage-probe-cap=20 --debug-sample --debug-sample-max=120 --write-report`
- 결과:
  - `usageProbeAttempts: 400`
  - `usageProbeHits: 0`
  - `usageUpdated: 0`
  - 응답은 지속적으로 `resultMsg: NORMAL SERVICE.`, `totalCount: 0`
  - 최신 preflight 적용 실행(`--limit=20 --skip-price --replace-proxy-usage --usage-probe-cap=20 --write-report`)에서는
    - `usageServiceNoDataLikely: true`
    - `usageProbeAttempts: 0` (자동 스킵)
- 해석:
  - 네트워크/코드 오류가 아니라, 현재 키/스펙/요청조건 조합에서 원천 `msup` 데이터가 조회되지 않는 상태.
  - 추가 확인:
    - `msupUserInfoService1.2`에서 `resultCode: 00`, `resultMsg: NORMAL SERVICE.`는 정상 반환.
    - 다만 body의 `totalCount`는 0 지속.
    - `msupUserInfoService1.1` 또는 `.1` operation suffix는 404/500으로 사용 불가.

### 9-4. 운영 원칙(빈값 금지 유지)
- 현재 DB/API는 `usageFrequency` 빈값 없이 100% 채워진 상태 유지.
- 실측 hit가 확인되는 즉시 `--replace-proxy-usage`로 프록시값(1)만 선택 치환하도록 준비 완료.

### 9-5. 파라미터 매트릭스 재탐색 확장 (2026-04-14 추가)
- 파일: `scripts/probe_usage_param_matrix.ts`
- 확장 내용:
  - Prisma seed 기반 후보 자동 추출 추가
    - `atc4`, `atc3`, 성분코드형(`cmpnCd`류), 한글 성분/제품명(`gnrlNm`류)
  - operation별 query 생성기 도입
    - `Area` 계열: ATC/성분 + 지역키 조합
    - `Cl` 계열: ATC/성분 + class 키(`clCd/classCd`) 조합
  - 실행 옵션 추가
    - `--attempt-cap`, `--timeout-ms`, `--seed-limit`, `--max-hits`
- 최신 검증:
  - `npx --yes tsx scripts/probe_usage_param_matrix.ts --attempt-cap=220 --timeout-ms=2200 --seed-limit=120 --max-hits=3`
    - 결과: `attempts=220`, `hits=0`, 일부 `AbortError` 발생
  - `npx --yes tsx scripts/probe_usage_param_matrix.ts --attempt-cap=220 --timeout-ms=8000 --seed-limit=120 --max-hits=3`
    - 결과: `attempts=220`, `failures=0`, `hits=0`
- 결론:
  - timeout 영향 제거 후에도 hit 0 유지.
  - 현재 단계 병목은 로컬 파라미터 다양성 부족보다는 API 제공 측 데이터 범위/권한/필수조건 불일치 가능성이 더 큼.

---
다른 PC에서 시작할 때는 이 문서를 먼저 읽고, 4번 절차를 그대로 실행하면 된다.
