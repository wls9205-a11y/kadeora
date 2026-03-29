# 카더라 STATUS.md — 세션 57 (2026-03-30 06:00 KST)

## 최신 커밋
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
