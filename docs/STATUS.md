# 카더라 STATUS.md — 세션 58 (2026-03-30 06:30 KST)

## 최신 커밋
- `c007cc0` — 워터마크 선명도 recommended (35%/60%) 적용
- `4356b8a` — 타사 워터마크 차단 + 카더라 워터마크 베이킹 프록시 API
- `f3cadce` — collect-site-images 중괄호 누락 수정
- `98bfd4e` — 단지백과 Phase 1+2 전체 구현 + latestPrice 수정
- `b2057742` — 전월세 크롤링 인프라 (crawl-apt-rent + lawd-codes.ts)
- `83efa2de` — 단지백과 설계도면
- `ca3df09` — 이미지 수집 관련성 필터 (무관 이미지 차단)
- `d11d47d` — 이미지 수집 네이버+카카오 듀얼소스 병렬 (1.5일 완료)
- `90ac016` — 이미지 수집 최대 속도 350건x6회/일 (27일→2.5일)
- `90ac016` — 이미지 수집 최대 속도 350건×6회/일 (27일→2.5일)
- `dfe30c2` — 이미지 갤러리 CSP/Mixed Content 해결 + 라이트박스 + 워터마크
- `49e832c` — PWA 설치 직접 실행 + 이미지 갤러리 워터마크
- `43f9939` — 프로모 바텀시트 V1(회원가입) + V2(PWA설치)
- `cf75108` — 어드민 대시보드 하드코딩 수정 + STATUS.md 통합
- `8fed20d` — 세대수 총공급/일반/특별 구분 + 이미지 깨짐 + 미분양 레이블
- `e26f5cc` — DB 에러 3건 + 더보기 메뉴 강화 + 크론 타임아웃 수정
- `ec86cba` — 카카오 공유 팝업 about:blank 수정 (COOP)
- `1c42f31` — GOD MODE PromiseLike .catch() → try/catch
- `6cca8c9` — GOD MODE v2 — Phase 순차 + Fire-and-Forget

## 세션 58 작업 내역

### 단지백과 (/apt/complex) — 신규 섹션
- `/apt/complex` 메인 페이지: 연차별 시세 비교 차트 + 지역별 현황 + 필터/정렬
- `ComplexClient.tsx`: 연차/지역/정렬 인터랙티브 카드 그리드 (60개 단지)
- `/apt/complex/[name]` 상세: 전세/월세/전세가율 요약 카드 6개 + 전월세 거래 이력
- SEO: JSON-LD CollectionPage + OG + 메타 + naver:author
- 더보기 메뉴 🏢 단지백과 추가

### DB 마이그레이션
- `apt_rent_transactions`: 전월세 실거래 (5개 인덱스, UNIQUE 제약)
- `apt_complex_profiles`: 단지 프로필 캐시 (3개 인덱스)

### 크론 신규 (3개)
- `crawl-apt-rent`: 전월세 일일 크롤링 (09:00 KST) — 98,077건 수집 완료
- `sync-complex-profiles`: 단지 프로필 집계 (09:30 KST)
- `backfill-trades`: 과거 3년 매매+전월세 벌크 수집 (어드민 수동)

### 공유 라이브러리
- `src/lib/lawd-codes.ts`: LAWD_CODES 맵 + XML 파서 공용화

### 어드민 GOD MODE
- 특수작업: 연도별 매매/전월세 벌크 수집 버튼 6개 (2023/2024/2025)

### 데이터 현황
- 전월세: 98,077건 (전세 49,608 + 월세 48,469) — 158~164개 시군구
- 매매: 5,408건 (2026년 1~3월) — 벌크 수집으로 3년치 확장 예정
- 블로그: 20,855편

### PENDING (Node 실행 필요)
- [ ] 어드민 GOD MODE → 📊 매매 2025 → 📊 매매 2024 → 📊 매매 2023 (순차)
- [ ] 어드민 GOD MODE → 🏠 전월세 2025 → 🏠 전월세 2024 → 🏠 전월세 2023 (순차)
- [ ] sync-complex-profiles 크론 실행 (프로필 집계)
- [ ] Anthropic 크레딧 충전 (블로그 AI 크론 0건)

## 세션 56~57 통합 작업 내역

### 프로모 바텀시트 (신규)
- PromoSheet.tsx: V1(비로그인→카카오가입) + V2(로그인→PWA설치)
- 우선순위: 비로그인→V1(3초), 로그인+미설치→V2(5초), 설치→없음
- "오늘 하루 보지않기" / "다시 보지않기" localStorage
- iOS/Android 분기 가이드
- 기존 GuestWelcome 대체 (root layout에서 제거)

### 어드민 대시보드
- 데이터 커버리지 3열 패널 (분양가/좌표/종목설명)
- 시세 상태 동적 표시 (726/728 활성 99%)
- DB 크기 333MB 반영

### 부동산 상세 페이지
- 세대수→총 공급 + 일반/특별 구분 (카드/히어로/요약/일정표)
- 이미지 깨짐 해결 (CSP img-src naver 도메인 추가)
- 미분양 세대수 레이블 혼동 방지

### 더보기 메뉴
- 블로그/실거래검색/종목비교 추가 (9→12개, 4열)

### 카카오 공유
- COOP same-origin → same-origin-allow-popups
- NEXT_PUBLIC_KAKAO_JS_KEY 환경변수 누락 수정

### 블로그 Sonnet 복구
- enrichContent 자동보강 + 길이체크 전 이동
- 13개 크론 maxDuration 300초
- DB트리거 HOURLY/DAILY_LIMIT 80
- GOD MODE v2 Phase 순차 + Fire-and-Forget

### DB 에러 수정
- blog_posts.is_deleted, content_length 컬럼 미존재
- stock_theme_history.history_date → recorded_date

### 데이터 100%
- 종목 description: 728/728 (100%)
- apt_sites SEO: 5,512/5,512 (100%)

### 크론 안정화
- collect-site-* maxDuration 120초
- crawl-busan-redev JSON 안전 파싱
- stock-refresh stale Yahoo+Naver 폴백

## 데이터 현황 (라이브)
- ✅ 종목 설명: 728/728 (100%)
- ✅ apt_sites SEO: 5,512/5,512 (100%)
- ✅ 블로그: 20,853편
- ✅ 주식 시세: 726/728 활성
- ✅ 크론 6h: 800성공/3실패 (99.6%)
- 🔄 분양가: 947/2,692 (35.2%) — 자동 수집
- 🔄 좌표: 433/5,512 (7.9%) — 자동 수집
- ✅ 유저: 121명

## PENDING
- [ ] Google Search Console 사이트맵 제출
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급

## 크론 총 80개
## 아키텍처 규칙
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
