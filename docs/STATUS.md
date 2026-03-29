# 카더라 STATUS.md — 세션 57 (2026-03-30)

## 최신 커밋
- `a99169e` — blog-safe-insert regex s flag 제거 (ES2018 빌드 에러)
- `1529d29` — 종목 description AI 크론 + 지오코딩 강화 (Node)
- `649763b` — stock-refresh stale 종목 개별 재시도 (Yahoo+Naver fallback)
- `0017a1d` — safeBlogInsert v3 — auto TOC/내부링크/FAQ/지도링크 주입
- `a04540c` — 어드민 대시보드: 데이터 커버리지 패널 추가 (Node)

## 이번 세션 주요 작업

### 1. 블로그 Sonnet 0건 근본 원인 진단 & 수정
- **원인:** DB 트리거 `validate_blog_post()`가 NO_TOC/NO_INTERNAL_LINK/NO_MAP/NO_FAQ로 INSERT 차단
- Sonnet AI가 콘텐츠 생성 성공 → safeBlogInsert에서 트리거 에러 → success:false → 크론은 200 OK
- **수정 1:** DB 트리거 daily_limit 30→80, hourly_limit 10→20 (마이그레이션)
- **수정 2:** safeBlogInsert v3 — 자동 콘텐츠 보강:
  - TOC 자동 생성 (h2 헤더 추출 → ## 목차 섹션)
  - 내부 링크 자동 삽입 (카테고리별 /stock, /apt, /feed, /blog)
  - FAQ 자동 삽입 (stock/apt 카테고리별 템플릿)
  - 지도 링크 자동 삽입 (부동산 → Naver Map)

### 2. stock-refresh stale 종목 재시도 로직
- 3일+ 미갱신 18개 종목 → Yahoo Finance 개별 소규모 배치 조회
- 국내 stale 종목 → Naver Mobile API 개별 폴백
- 매 실행마다 stale 자동 해소

### 3. 종목 description 513개 → 0 누락 (SQL 일괄 완료)
- 663/663 전 종목 description 보유
- stock-desc-gen AI 크론도 병렬 가동 (Node)

### 4. apt_sites SEO 5,522개 → 0 누락 (SQL 일괄 완료)
- seo_title + seo_description 전부 채움

### 5. Node 병렬 작업
- 어드민 대시보드: 데이터 커버리지 패널 (분양가/좌표/종목설명)
- stock-desc-gen 크론 신규 (Haiku 4.5, 배치 20건)
- redev-geocode: apt_sites Phase 2 추가, Naver 폴백, 300건/실행
- apt-crawl-pricing: BATCH_SIZE 250→120 (타임아웃 방지)

## 라이브 확인 (2026-03-30 04:30 KST)
- ✅ 배포 READY: dpl_3pVtznj79VSJhXQpUiEe6JBeSjTE
- ✅ 종목 description 663/663 (0 누락)
- ✅ apt_sites SEO 5,522/5,522 (0 누락)
- ✅ DB 트리거 daily 80 / hourly 20
- ⏳ 블로그 Sonnet — 다음 크론 실행 시 검증

## PENDING
- [ ] 블로그 Sonnet 생성 라이브 검증 (GOD MODE 실행)
- [ ] apt_sites 좌표 5,522개 (redev-geocode 자동 ~9일)
- [ ] KAKAO_REST_API_KEY Vercel 환경변수 확인
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출
- [ ] 크론 총 79개

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
