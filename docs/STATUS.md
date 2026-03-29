# 카더라 STATUS.md — 세션 56 (2026-03-30)

## 최신 커밋
- `a99169ee` — blog-safe-insert regex s flag 제거 (Node)
- `1529d298` — 종목 description AI 크론 + 지오코딩 강화
- `a04540c2` — 어드민 대시보드: 데이터 커버리지 패널 추가

## 이번 세션 주요 작업

### 1. 어드민 대시보드 데이터 커버리지 패널
- API: dataCoverage KPI 쿼리 (aptPrice/aptCoords/stockDesc + apt-crawl-pricing 크론 이력)
- UI: 3열 커버리지 카드 (진행률 바 + 퍼센트 + 크론 상태 도트)
- 헬스바: 분양가/좌표/종목설명 HealthBadge 추가

### 2. stock-desc-gen 크론 신규
- Haiku 4.5로 배치 20건 description 동시 생성 (1 AI 콜)
- 매 6시간 실행 (00:30, 06:30, 12:30, 18:30 UTC)
- 578건 누락 → ~7일이면 완료
- GOD MODE ai 카테고리 추가

### 3. redev-geocode 강화
- Naver Local Search API 폴백 (카카오 실패 시)
- apt_sites 배치: 150→300건 확대
- 실행 빈도: 1일 1회→2회 (05:15, 17:15 UTC)
- maxDuration: 120→180초

### 4. apt-crawl-pricing 안정화
- BATCH_SIZE: 250→120 (300초 타임아웃 방지)

### 5. Node 동시 작업
- safeBlogInsert v3: 자동 TOC/내부링크/FAQ/지도링크 주입
- stock-refresh: stale 종목 개별 재시도 (Yahoo+Naver fallback)
- blog-safe-insert regex s flag 수정

## 라이브 확인 (2026-03-30)
- ✅ 크론 6h: 802성공 / 1실패
- ✅ 블로그 24h: 74편 발행 (Sonnet 4)
- ⚠️ 분양가: 175/2,692 (6.5%) — 수집 진행 중
- ❌ apt_sites 좌표: 0/5,512 — Naver 폴백 추가, 다음 실행 대기
- ⚠️ 종목 description: 150/728 (20.6%) — AI 크론 배포 완료

## PENDING
- [ ] KAKAO_REST_API_KEY Vercel 환경변수 확인 (플레이스홀더 발견)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출
- [ ] blog Sonnet 품질 확인 (GOD MODE 실행)
- [ ] 크론 총 79개 (stock-desc-gen 신규 추가)

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
