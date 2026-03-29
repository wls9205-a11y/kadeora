# 카더라 STATUS.md — 세션 57 (2026-03-30 05:30 KST)

## 최신 커밋
- `8fed20d7` — 세대수 총공급/일반/특별 구분 + 이미지 깨짐 + 미분양 레이블
- `e26f5cc1` — DB 에러 3건 + 더보기 메뉴 강화 + 크론 타임아웃 수정
- `1c42f315` — GOD MODE Supabase PromiseLike .catch() → try/catch
- `6cca8c91` — GOD MODE v2 — Phase 순차 + Fire-and-Forget
- `ec86cba1` — 카카오 공유 팝업 about:blank 수정 (COOP)
- `ab9f2702` — redev-geocode 전면 수정 (withCronLogging + 3단 폴백)
- `a04540c2` — 어드민 대시보드 데이터 커버리지 패널

## 세션 56~57 통합 작업 내역

### 어드민 대시보드 강화
- 데이터 커버리지 3열 패널 (분양가/좌표/종목설명 진행률 + 크론 상태 도트)
- HealthBadge: 분양가/좌표/종목설명 추가
- DB 에러 3건 수정 (blog_posts.is_deleted/content_length, stock_theme_history.history_date)

### 블로그 Sonnet 0건→정상 (5단계 근본 수정)
- enrichContent 자동 보강 (TOC/내부링크/FAQ/지도링크)
- enrichContent 길이체크 전으로 이동
- 13개 크론 maxDuration 60→300초
- DB트리거 HOURLY/DAILY_LIMIT 80으로 확대
- GOD MODE v2: Phase 순차 + AI Fire-and-Forget

### 데이터 커버리지
- 종목 description: **728/728 (100%)** — SQL 직접 배치 + stock-desc-gen 크론
- apt_sites SEO: 5,512/5,512 (100%)
- 분양가: 947/2,692 (35.2%) — 자동 수집 중

### 카카오 공유 수정
- COOP: same-origin → same-origin-allow-popups (about:blank 해소)
- CSP img-src: pstatic.net/naver.net/naver.com 추가 (이미지 깨짐 해소)
- NEXT_PUBLIC_KAKAO_JS_KEY 환경변수 누락 발견 → 추가 완료

### 부동산 상세 페이지
- 세대수 카드: '세대수'→'총 공급' + 서브텍스트 '일반 185 · 특별 215'
- 히어로/요약/일정표 전부 일반/특별 구분 표시
- RegionStackedBar: '↳ 세대수'→'↳ 미분양 세대수' (혼동 방지)

### 더보기 메뉴
- 블로그(📰)/실거래검색(🔍)/종목비교(⚖️) 추가 (9→12개)
- 3열→4열 그리드, 블로그 접근 불가 해소

### 지오코딩
- redev-geocode: withCronLogging + 3단 폴백(카카오→카카오키워드→네이버)
- apt_sites 좌표: 433/5,512 (7.9%) 수집 중

### 크론 안정화
- collect-site-* 504 해소: maxDuration 120초 추가
- crawl-busan-redev JSON 안전 파싱
- apt-crawl-pricing BATCH 250→120 타임아웃 방지
- stock-refresh stale 종목 Yahoo+Naver 개별 폴백

### 환경변수 전수 조사
- NEXT_PUBLIC_KAKAO_JS_KEY 누락 → 수정
- NEXT_PUBLIC_KAKAO_APP_KEY (Dead) 발견
- KAKAO_REST_API_KEY 정상 확인

## 데이터 현황 (라이브 — 2026-03-30 05:30 KST)
- ✅ **종목 설명**: 728/728 (100%)
- ✅ **apt_sites SEO**: 5,512/5,512 (100%)
- ✅ **블로그**: 20,853편 (24h 77편)
- ✅ **주식 시세**: 726/728 활성 (주말 제외 정상)
- ✅ **크론 6h**: 800성공 / 3실패 (99.6%)
- 🔄 **분양가**: 947/2,692 (35.2%) — 자동 수집 ~14시간 남음
- 🔄 **좌표 apt_sites**: 433/5,512 (7.9%) — 자동 ~8일
- ✅ **유저**: 121명

## PENDING (Node 직접)
- [ ] Google Search Console 사이트맵 제출
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] 좌표/분양가 자동 진행 모니터링

## 크론 총 80개 (stock-desc-gen 추가)

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY_LIMIT 80 / DAILY_LIMIT 80
10. Supabase RPC: try/catch 사용 (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
