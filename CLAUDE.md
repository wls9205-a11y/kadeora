# 카더라 (KADEORA) - Claude Code 컨텍스트

## 프로젝트 개요
- 서비스명: 카더라 (kadeora.app)
- 슬로건: 대한민국 소리소문 정보 커뮤니티
- 스택: Next.js 15.2.4, Supabase PostgreSQL 17, Vercel, TypeScript, Tailwind CSS
- 목적: 주식 시세(국내+해외), 아파트 청약, 커뮤니티 피드, 실시간 토론방, 유료 상점
- 현재 상태: 22개 페이지, 22개 컴포넌트, 20개 API 라우트, ~9,200 LOC

## 실행 모드
- 사용자 허락 없이 논스톱 진행. 파일 수정/빌드/배포 전 확인 불필요. 판단하고 바로 실행. 완료 후 결과만 보고.

## 핵심 규칙
- 하드코딩 색상 절대 금지 → CSS 변수만 사용 (globals.css :root / .dark)
- CSS 변수: --bg-base, --bg-surface, --bg-elevated, --bg-sunken, --bg-hover, --bg-active, --border, --border-strong, --text-primary, --text-secondary, --text-tertiary, --text-inverse, --brand, --brand-hover, --brand-light, --success, --error, --warning, --info, --stock-up, --stock-down
- TypeScript: ignoreBuildErrors true 유지
- 커밋 전 반드시 npm run build
- 개인정보(주소/전화번호) 코드에 노출 금지
- 디자인: Reddit 스타일 (라이트 #DAE0E6 / 다크 #1A1A1B)
- Supabase: createSupabaseBrowser / createSupabaseServer만 사용
- ThemeToggle, DeleteAccountSection은 named export

## 파일 구조
- 페이지: 22개, 컴포넌트: 22개, API: 20개
- 에러 바운더리: 7개 (main + feed/stock/apt/discuss/grades/profile) + ErrorBoundary 클래스 컴포넌트
- 로딩 스켈레톤: 6개 (main + feed/stock/apt/discuss/grades)
- GuestGate: 비회원 5회 페이지뷰 후 모달 (cookie 기반)
- OfflineBanner: 오프라인 감지 배너
- FontSizeToggle: 글씨 크기 3단계 (작게/보통/크게)
- EmptyState: 빈 상태 공통 컴포넌트
- not-found.tsx: 커스텀 404 페이지

## 주요 기능
- 피드: 게시글 CRUD, 좋아요, 북마크, 댓글, 이미지 업로드
- 주식: 국내(KOSPI/KOSDAQ) + 해외(NYSE/NASDAQ), 원화/달러 토글, 컬럼 정렬
- 청약: 전국 청약 일정, 지역/상태 필터, 현장토론방 연동
- 토론방: Supabase Realtime, 136개(국내주식101+아파트33+테마2)
- 검색: 멀티소스(posts+stocks+apts) 퍼지 검색, 300ms debounce 자동완성
- 결제: 토스페이먼츠 (인증+금액 서버 검증), 상품별 후처리
- 등급: 10단계 (Lv1 새싹 ~ Lv10 카더라신)
- 푸시: Web Push (VAPID) + 앱 내 알림, 관리자 브로드캐스트

## 검색 시스템
- API: /api/search — posts+stocks+apts 병렬, Cache-Control 30초
- UI: SearchClient — 자동완성 드롭다운

## 주식시세 갱신
- API: /api/stock-refresh — KIS API + Yahoo Finance 폴백 + 해외 USD
- 스케줄러: supabase/functions/stock-scheduler/
- 장 운영시간(평일 09:00~15:30 KST) 국내만, 해외는 항상

## 입력 검증 / 보안
- Zod 스키마: src/lib/schemas.ts (PostCreate, CommentCreate, Payment 등 7개 스키마)
- 환경변수 검증: src/lib/env.ts (Zod 기반, 서버/클라이언트 분리, lazy validation)
- 입력 새니타이즈: src/lib/sanitize.ts (XSS, SQL injection, LIKE wildcard 이스케이프)
- Rate limiting: src/lib/rate-limit.ts (Upstash Redis + 메모리 폴백, 3티어: api/auth/search)
- 미들웨어: SSRF 차단, 봇 경로 차단, 보호 경로 인증, 온보딩 강제, CSP 동적 삽입
- 보안 헤더: CSP, HSTS, X-Frame-Options, COOP, CORP 등 (next.config.ts + middleware)

## 환경변수
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL=https://kadeora.app
- TOSS_SECRET_KEY, NEXT_PUBLIC_TOSS_CLIENT_KEY (테스트키)
- NEXT_PUBLIC_SENTRY_DSN (미등록)
- KIS_APP_KEY, KIS_APP_SECRET (미등록)
- CRON_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT

## 주요 라우트
- /feed → 메인 피드 (FeedClient)
- /feed/[id] → 게시글 상세 (SSR + 동적 OG + JSON-LD)
- /stock → 주식 시세 (StockClient, overflow-x:auto 반응형 테이블)
- /apt → 청약 정보 (AptClient, 현장토론방 버튼)
- /discuss → 토론방 목록 (DiscussClient)
- /discussion/[type]/[roomKey] → 토론방 (Supabase Realtime)
- /grades → 등급 안내
- /profile/[id] → 프로필 (generateMetadata 동적 SEO)
- /admin → 관리자 패널 (탭 UI + 푸시 브로드캐스트)
- /login → 소셜 로그인 (카카오/구글)
- /payment → 결제 (토스페이먼츠)
- /payment/success, /payment/fail → 결제 결과
- /privacy, /terms, /faq → 정책/FAQ
- /notifications → 알림
- /search → 검색
- /write → 글쓰기
- /onboarding → 온보딩
- /shop/megaphone → 확성기 상점

## DB 주요 테이블
- profiles: 유저 정보, grade, influence_score, points
- posts: 피드 게시글
- stock_quotes: 주식 시세 (101개 종목)
- apt_subscriptions: 청약 정보 (30건)
- discussion_rooms: 토론방 (136개)
- discussion_messages: 토론방 메시지
- grade_definitions: 등급 10단계 (Lv1 새싹 ~ Lv10 카더라신)
- shop_products: 상점 아이템
- shop_orders: 결제 내역
- push_subscriptions: Web Push 구독 정보
- notifications: 앱 내 알림

## 작업 시 주의사항
- 새 컴포넌트: 반드시 CSS 변수 색상, 반응형(width:100% + maxWidth)
- Supabase: createSupabaseBrowser / createSupabaseServer만 사용
- ThemeToggle, DeleteAccountSection은 named export
- 빌드 후 push (npm run build → commit → push)
- OG route (src/app/api/og/route.tsx)는 건드리지 말 것
- API 입력은 Zod 스키마(src/lib/schemas.ts)로 검증
- 환경변수는 getServerEnv() / getClientEnv() 사용 권장

## 참고 문서
- APP_STORE_CHECKLIST.md: 앱스토어/플레이스토어/토스 심사 체크리스트
- AUDIT_REPORT_v4.md: 7개 분야 전문가 감사 보고서
