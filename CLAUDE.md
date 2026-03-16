# 카더라 (KADEORA) - Claude Code 컨텍스트

## 프로젝트 개요
- 서비스명: 카더라 (kadeora.app)
- 슬로건: 대한민국 소리소문 정보 커뮤니티
- 스택: Next.js 15.5.12, Supabase PostgreSQL 17, Vercel, TypeScript, Tailwind CSS
- 목적: 주식 시세, 아파트 청약, 커뮤니티 피드, 실시간 토론방
- 현재 상태: 22개 페이지, 19개 컴포넌트, 19개 API 라우트

## 핵심 규칙 (반드시 준수)
- 절대로 주소, 전화번호 등 개인정보를 코드/페이지에 노출하지 말 것
- 계정탈퇴 버튼은 항상 숨겨진 상태로 (작은 텍스트 링크만)
- 다크모드: 하드코딩 색상(#fff, #000, white, black) 절대 사용 금지, 반드시 CSS 변수 사용
- CSS 변수: var(--bg-base), var(--bg-surface), var(--bg-elevated), var(--bg-sunken), var(--bg-hover), var(--bg-active), var(--border), var(--border-strong), var(--text-primary), var(--text-secondary), var(--text-tertiary), var(--brand), var(--brand-hover), var(--brand-light), var(--success), var(--error), var(--warning), var(--info), var(--stock-up), var(--stock-down), var(--text-inverse)
- TypeScript: ignoreBuildErrors는 true 유지
- 커밋 전 항상 npm run build 빌드 검증
- 디자인: Reddit 스타일 (라이트 #DAE0E6 / 다크 #1A1A1B)

## 파일 구조
- Supabase 클라이언트: @/lib/supabase-browser (createSupabaseBrowser) / @/lib/supabase-server (createSupabaseServer)
- 훅: @/hooks/useHaptic (햅틱 피드백)
- 테마: src/components/ThemeToggle.tsx (named export)
- 계정삭제: src/components/DeleteAccountSection.tsx (named export)
- 비회원 게이트: src/components/GuestGate.tsx (cookie 기반, 5회 페이지뷰 후 모달)
- 오프라인 배너: src/components/OfflineBanner.tsx
- 다크모드 인라인 스크립트: src/app/layout.tsx (플리커 방지)
- 에러 바운더리: 7개 (main + feed/stock/apt/discuss/grades/profile)
- 로딩 스켈레톤: 6개 (main + feed/stock/apt/discuss/grades)

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

## 주요 라우트
- /feed → 메인 피드 (FeedClient)
- /stock → 주식 시세 (StockClient, overflow-x:auto 반응형 테이블)
- /apt → 청약 정보 (AptClient, 현장토론방 버튼)
- /discuss → 토론방 목록 (DiscussClient)
- /discussion/[type]/[roomKey] → 토론방 (Supabase Realtime)
- /grades → 등급 안내
- /profile/[id] → 프로필 (generateMetadata 동적 SEO)
- /admin → 관리자 패널
- /login → 소셜 로그인 (카카오/구글)
- /payment → 결제 (토스페이먼츠)
- /payment/success, /payment/fail → 결제 결과
- /privacy, /terms, /faq → 정책/FAQ
- /notifications → 알림
- /search → 검색
- /write → 글쓰기
- /onboarding → 온보딩
- /shop/megaphone → 확성기 상점

## 검색 시스템
- API: /api/search — posts+stocks+apts 병렬 퍼지 검색, Cache-Control 30초
- UI: SearchClient — 300ms debounce 자동완성 드롭다운 (종목/청약/게시글)

## 주식시세 갱신
- API: /api/stock-refresh — KIS API 우선 + Yahoo Finance 폴백
- 스케줄러: supabase/functions/stock-scheduler/ (Edge Function)
- 장 운영시간(평일 09:00~15:30 KST)에만 갱신
- 환경변수: KIS_APP_KEY, KIS_APP_SECRET, CRON_SECRET

## 환경변수
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL=https://kadeora.app
- TOSS_SECRET_KEY, NEXT_PUBLIC_TOSS_CLIENT_KEY (⚠️ 테스트키 → 라이브 전환 필요)
- NEXT_PUBLIC_SENTRY_DSN (⚠️ 미등록)
- KIS_APP_KEY, KIS_APP_SECRET (⚠️ 미등록 — 주식 실시간 갱신용)
- CRON_SECRET (주식 스케줄러 인증)

## 작업 시 주의사항
- 새 컴포넌트: 반드시 CSS 변수 색상, 반응형(width:100% + maxWidth)
- Supabase: createSupabaseBrowser / createSupabaseServer만 사용
- ThemeToggle, DeleteAccountSection은 named export
- 빌드 후 push (npm run build → commit → push)
- OG route (src/app/api/og/route.tsx)는 건드리지 말 것

## 참고 문서
- APP_STORE_CHECKLIST.md: 앱스토어/플레이스토어/토스 심사 체크리스트
- AUDIT_REPORT.md: 7개 분야 전문가 감사 보고서 (49/70점, B등급)
