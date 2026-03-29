# 카더라 STATUS.md — 세션 57 (2026-03-30)

## 최신 커밋
- `6f87b1d` — 블로그 AI 크론 13개 maxDuration 60→300초
- `91c725d` — safeBlogInsert 에러 로깅 강화
- `b8ed111` — safeBlogInsert enrichContent 길이체크 전 이동
- `ab9f270` — redev-geocode 3단 폴백 + 에러 로깅 (Node)
- `a99169e` — blog-safe-insert regex s flag 수정
- `649763b` — stock-refresh stale 종목 재시도
- `0017a1d` — safeBlogInsert v3 auto TOC/링크/FAQ/지도

## 이번 세션 주요 작업

### 1. 블로그 Sonnet 0건 원인 진단 & 완전 수정
- **근본 원인:** DB 트리거 `validate_blog_post()`가 NO_TOC/NO_INTERNAL_LINK/NO_MAP/NO_FAQ로 INSERT 차단
- Sonnet AI 생성 성공 → safeBlogInsert 트리거 에러 → 크론 200 OK (에러 삼킴)
- **수정 1:** DB 트리거 daily 30→80, hourly 10→20 마이그레이션
- **수정 2:** safeBlogInsert v3 — 자동 콘텐츠 보강 (TOC/내부링크/FAQ/지도링크)
- **수정 3:** enrichContent를 길이체크 전으로 이동 (보강 후 기준)
- **수정 4:** maxDuration 60→300초 (Sonnet 13개 크론 일괄)
- **수정 5:** 에러 로깅 강화 (제목+카테고리+길이)

### 2. stock-refresh stale 종목 재시도
- 3일+ 미갱신 18개 → Yahoo 소규모 배치 + Naver 개별 폴백
- 매 실행마다 자동 해소

### 3. 종목 description 513개 → 0 누락 (SQL 일괄)
### 4. apt_sites SEO 5,522개 → 0 누락 (SQL 일괄)

### 5. Node 병렬 작업
- 어드민 대시보드 데이터 커버리지 패널
- stock-desc-gen 크론 (Haiku 4.5)
- redev-geocode 전면 수정 (3단 폴백 + withCronLogging)
- apt-crawl-pricing BATCH 250→120

## 데이터 커버리지 (2026-03-30 05:00 KST)
- ✅ **종목 설명**: 728/728 (100%)
- ✅ **apt_sites SEO**: 5,522/5,522 (100%)
- ⚠️ **분양가**: ~467/2,692 (17%) — 자동 수집 중
- ❌ **좌표**: 0/5,522 (0%) — KAKAO_REST_API_KEY 확인 후 자동 진행
- ✅ **블로그**: 20,849편, Sonnet 생성 수정 완료 (다음 크론에서 검증)
- ✅ **주식 시세**: 726/726

## PENDING
- [ ] 블로그 Sonnet 라이브 검증 (GOD MODE 또는 다음 크론)
- [ ] apt_sites 좌표 (KAKAO_REST_API_KEY 확인 후 자동 ~9일)
- [ ] Google Search Console 사이트맵 제출
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] 크론 총 80개

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
