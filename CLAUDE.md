# 카더라 (KADEORA) - Claude Code 컨텍스트

## 프로젝트 개요
- 서비스명: 카더라 (kadeora.app)
- 슬로건: 대한민국 소리소문 정보 커뮤니티
- 스택: Next.js 15.5.12, Supabase PostgreSQL 17, Vercel, TypeScript, Tailwind CSS
- 목적: 주식 시세, 아파트 청약, 커뮤니티 피드, 실시간 토론방

## 핵심 규칙 (반드시 준수)
- 절대로 주소, 전화번호 등 개인정보를 코드/페이지에 노출하지 말 것
- 계정탈퇴 버튼은 항상 숨겨진 상태로 (작은 텍스트 링크만)
- 다크모드: 하드코딩 색상(#fff, #000, white, black) 절대 사용 금지, 반드시 CSS 변수 사용
- CSS 변수 목록: var(--bg-base), var(--bg-surface), var(--bg-elevated), var(--bg-sunken), var(--bg-hover), var(--bg-active), var(--border), var(--border-strong), var(--text-primary), var(--text-secondary), var(--text-tertiary), var(--brand), var(--brand-hover), var(--brand-light), var(--success), var(--error), var(--warning), var(--stock-up), var(--stock-down)
- TypeScript: ignoreBuildErrors는 true 유지 (any 타입 허용)
- 커밋 전 항상 npm run build 로 빌드 검증

## 파일 구조 핵심
- Supabase 클라이언트: @/lib/supabase-browser (createSupabaseBrowser) / @/lib/supabase-server (createSupabaseServer)
- 훅: @/hooks/useHaptic (햅틱 피드백)
- 테마: src/components/ThemeToggle.tsx (named export)
- 계정삭제: src/components/DeleteAccountSection.tsx (named export)
- 다크모드 인라인 스크립트: src/app/layout.tsx (플리커 방지)

## DB 주요 테이블
- profiles (45컬럼): 유저 정보, grade, influence_score, points
- posts (22컬럼): 피드 게시글
- stock_quotes: 주식 시세 (101개 종목)
- apt_subscriptions: 청약 정보 (30건)
- discussion_rooms: 토론방 (136개 - stock 101, apt 33, theme 2)
- discussion_messages: 토론방 메시지
- grade_definitions: 등급 정의 (10단계, Lv1 새싹 ~ Lv10 카더라신)

## 주요 라우트
- / → 메인(피드 리다이렉트)
- /feed → 메인 피드
- /stock → 주식 시세 (StockClient.tsx)
- /apt → 청약 정보 (AptClient.tsx) - 현장토론방 버튼 포함
- /discuss → 토론방 목록
- /discussion/stock/[symbol] → 주식 종목 토론방
- /discussion/apt/[id] → 아파트 현장 토론방
- /grades → 회원 등급 안내
- /profile/[id] → 프로필
- /admin → 관리자 패널
- /login → 로그인 (카카오/구글 소셜)
- /privacy, /terms → 정책 페이지

## 환경변수 (Vercel에 등록된 것)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL=https://kadeora.app
- TOSS_SECRET_KEY (⚠️ 아직 테스트키 - 라이브 전환 필요)
- TOSS_CLIENT_KEY (⚠️ 아직 테스트키 - 라이브 전환 필요)
- NEXT_PUBLIC_SENTRY_DSN (⚠️ 아직 미등록 - 등록 필요)

## 작업 시 주의사항
- 새 컴포넌트 만들 때 반드시 CSS 변수로 색상 적용
- Supabase import 시 반드시 createSupabaseBrowser / createSupabaseServer 사용
- ThemeToggle, DeleteAccountSection은 named export
- 빌드 후 push (npm run build 먼저, 성공하면 commit/push)
- 토스페이먼츠는 현재 테스트 환경 - 결제 관련 코드 수정 시 주의

## 신규 추가 파일 (최근 작업)
- src/components/GuestGate.tsx: 비회원 5회 페이지뷰 후 모달+블러. cookie 기반(kd_pv, 7일). 크롤러 감지.
- supabase/functions/stock-scheduler/: 주식시세 자동갱신 Supabase Edge Function
- APP_STORE_CHECKLIST.md: 앱스토어/플레이스토어/토스 심사 체크리스트
- AUDIT_REPORT.md: 7개 분야 전문가 감사 보고서 (49/70점, B등급)

## 검색 시스템
- API: src/app/api/search/route.ts — posts+stocks+apts 병렬 퍼지 검색
- UI: src/app/(main)/search/SearchClient.tsx — 300ms debounce 자동완성 드롭다운
- 검색 대상: posts(title,content), stock_quotes(name,symbol), apt_subscriptions(house_nm,region_nm)

## 주식시세 갱신
- API: src/app/api/stock-refresh/route.ts — KIS API 우선 + Yahoo Finance 폴백
- 스케줄러: supabase/functions/stock-scheduler/ — Supabase Cron으로 5분마다 호출
- 환경변수 필요: KIS_APP_KEY, KIS_APP_SECRET, CRON_SECRET
- 장 운영시간(평일 09:00~15:30 KST)에만 갱신, 그 외 캐시 반환

## 디자인 시스템
- 스타일: Reddit 스타일 (라이트 #DAE0E6 / 다크 #1A1A1B)
- 카드: borderRadius:4, border:1px solid var(--border), shadow-sm
- 버튼: 브랜드(#FF4500) pill 스타일, outline 변형 있음
- 모든 색상 CSS 변수 기반 — globals.css :root / .dark
