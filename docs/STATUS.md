# 카더라 STATUS.md — 세션 57 (2026-03-30)

## 최신 커밋
- `1c42f31` — GOD MODE Supabase PromiseLike .catch() → try/catch
- `6cca8c9` — GOD MODE v2 — Phase 순차 + Fire-and-Forget
- `6f87b1d` — 블로그 AI 크론 13개 maxDuration 60→300초
- `b8ed111` — safeBlogInsert enrichContent 길이체크 전 이동
- `a99169e` — blog-safe-insert regex s flag 수정
- `649763b` — stock-refresh stale 종목 재시도
- `0017a1d` — safeBlogInsert v3 auto TOC/링크/FAQ/지도

## 이번 세션 주요 작업

### 1. 블로그 Sonnet 0건 → 6건 생성 (근본 원인 5단계 수정)
- **원인 1:** DB 트리거 NO_TOC/NO_INTERNAL_LINK/NO_FAQ/NO_MAP → enrichContent 자동 보강
- **원인 2:** enrichContent가 길이체크 후에 실행 → 길이체크 전으로 이동
- **원인 3:** maxDuration 60s vs Sonnet 180s → 13개 크론 300초로 일괄 수정
- **원인 4:** HOURLY_LIMIT 20건 → GOD MODE 병렬 실행 시 즉시 소진 → 80으로 마이그레이션
- **원인 5:** DAILY_LIMIT 30건 → 80으로 마이그레이션
- **결과:** Sonnet AI 2건 (3,289자/2,936자) + 템플릿 4건 생성 확인

### 2. GOD MODE v2 — 전체 실행 성공
- **문제:** v1은 80개 크론을 flat 20개 배치 + 45s 타임아웃 → Sonnet 크론 전부 timeout
- **수정:** Phase 순차 (data→process→ai→content→system)
- AI/content: Fire-and-Forget (요청만 발사, 백그라운드 실행)
- data/process/system: 병렬 배치 + 응답 대기
- UI: dispatched 카운트 + phase 컬럼 표시
- **결과:** 전체 실행 ~105초 정상 완료, 타임아웃 에러 0건

### 3. 데이터 일괄 채우기
- 종목 description: 513개 SQL → **663/663 (100%)**
- apt_sites SEO: 5,522개 SQL → **5,512/5,512 (100%)**
- stock-refresh stale retry 로직 추가 (Yahoo+Naver 개별 폴백)

### 4. Node 병렬 작업
- 어드민 대시보드: 데이터 커버리지 패널 + 더보기 메뉴 강화
- redev-geocode: 3단 폴백 + withCronLogging + apt_sites Phase 2
- DB 에러 3건 수정 (is_deleted, content_length, history_date)
- 카카오 공유 COOP 헤더 수정, 크론 타임아웃 수정

## 데이터 커버리지 (2026-03-30 05:20 KST)
- ✅ **블로그**: 20,855편 (Sonnet AI 2편 큐 대기)
- ✅ **종목 설명**: 663/663 (100%)
- ✅ **apt_sites SEO**: 5,512/5,512 (100%)
- ✅ **주식 시세**: 663개 활성 (stale 18개 — 주말, 평일 자동 해소)
- 🔄 **좌표 apt_sites**: 433/5,512 (7.9%) — 자동 수집 중 (~8일 남음)
- 🔄 **좌표 재개발**: 25/217 (11.5%) — 자동 수집 중
- ✅ **크론 24h**: 1,224 성공 / 3 실패 (99.8%)

## PENDING
- [ ] apt_sites 좌표 자동 진행 중 (~8일, redev-geocode 크론)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급 (수동)
- [ ] Google Search Console 사이트맵 제출 (수동)
- [ ] 크론 총 80개

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY_LIMIT 80 / DAILY_LIMIT 80
10. Supabase RPC: try/catch 사용 (.catch() 금지)
