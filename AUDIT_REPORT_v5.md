# 카더라 전문가 감사 보고서 v5
> 평가일: 2026-03-17 | 15인 전문가 패널
> 코드베이스: ~9,500 LOC | 13 페이지 | 20 컴포넌트 | 21 API 라우트 | Next.js 15 + Supabase + Vercel
> v4 기준점: 560/700 (7개 분야) → v5: 15개 분야로 확장 평가

---

## 1. 프론트엔드 아키텍처 — 79/100

### 잘된 점
- Next.js 15 App Router의 Server/Client Component 경계가 명확. `feed/[id]/page.tsx`는 완전한 SSR, 상호작용 요소(LikeButton, CommentSection, BookmarkButton)만 클라이언트
- `generateMetadata` + JSON-LD 동적 생성으로 페이지별 메타데이터 완비
- ErrorBoundary 클래스 컴포넌트 + route-level error.tsx 7개로 에러 격리 우수
- Zod 스키마 7개(`src/lib/schemas.ts`) + `parseInput()` 헬퍼로 타입 안전한 입력 처리
- EmptyState, ConfirmModal, Toast 등 공통 UI 컴포넌트 추출

### 문제점
- **[High] 인라인 스타일 남용 — 전 컴포넌트**: `Navigation.tsx` 310줄 중 약 70%가 `style={{}}` 인라인. `globals.css`에 `.card`, `.btn-primary` 등 클래스가 정의되어 있으나 컴포넌트에서 거의 미사용. 유지보수성, 일관성, 번들 크기 모두 악영향
  - `Navigation.tsx:90-98` (header 스타일)
  - `GuestGate.tsx:83-93` (blur overlay)
  - `LikeButton.tsx:66-76` (버튼 스타일)
- **[Med] StockClient.tsx 비대화**: 단일 파일에 필터/정렬/환율변환/검색/모달/테이블 렌더링 전부 포함. 최소 StockTable, StockFilter, StockDetailModal로 분리 필요
- **[Med] `next.config.ts:5-6` — `ignoreBuildErrors: true`, `ignoreDuringBuilds: true`**: 타입 에러와 ESLint 경고를 빌드에서 완전 무시. 프로덕션 빌드에서 잠재 버그 미탐지
- **[Low] `feed/[id]/page.tsx:16-23` — `timeAgo()` 함수 중복**: StockClient.tsx의 `timeDiff()`와 동일 로직. `lib/utils.ts`로 추출 필요

### 즉시 수정 필요
1. `next.config.ts`에서 `ignoreBuildErrors`/`ignoreDuringBuilds` 제거 후 타입 에러 수정

---

## 2. 정보보안 — 78/100

### 잘된 점
- 미들웨어 5중 보안 체인: 봇 차단 → Rate Limiting → SSRF 방어 → 인증 리다이렉트 → CSP 삽입 (`middleware.ts`)
- CSP 동적 삽입(`middleware.ts:105-116`) + 정적 헤더(`next.config.ts:37-48`) 이중 적용
- 보안 헤더 9개 완비: HSTS, X-Frame-Options(DENY), COOP, CORP, X-Content-Type-Options 등
- SSRF 차단: Private IP 정규식 + 도메인 화이트리스트 (`middleware.ts:6-7, 45-57`)
- 결제 API POST/GET 모두 Bearer 토큰 + `getUser()` 검증 완료 (`payment/route.ts:15-24, 88-96`)
- 금액 서버 검증: `shop_products.price_krw`와 클라이언트 amount 비교 (`payment/route.ts:29-41`)
- `sanitize.ts`: XSS 벡터 제거(script, iframe, on* 이벤트, javascript:), SQL 키워드 제거, LIKE 와일드카드 이스케이프

### 문제점
- **[High] CSP에 `'unsafe-inline' 'unsafe-eval'` 허용**: `middleware.ts:107` — XSS 공격 벡터 열림. 다크모드 인라인 스크립트와 토스 SDK 때문이지만, nonce 기반 전환이 시급
- **[High] `push/send/route.ts:16` — `getSession()` 사용**: Supabase 공식 문서는 서버 사이드에서 `getUser()` 사용을 명시적으로 권장. `getSession()`은 JWT를 검증 없이 신뢰하므로 관리자 API에서 사용 시 JWT 위변조 위험
- **[Med] CSRF 보호 부재**: 모든 상태 변경 POST에 CSRF 토큰 없음. SameSite 쿠키에만 의존. Supabase Auth 쿠키가 SameSite=Lax이므로 GET-based CSRF는 방어되나, POST-based는 브라우저에 따라 취약 가능
- **[Med] GuestGate 클라이언트 전용**: `GuestGate.tsx:12-14` — `kd_pv` 쿠키를 DevTools에서 삭제하면 무제한 열람. 서버 사이드 IP 기반 카운팅 보강 필요
- **[Med] `payment/route.ts:4-6` — 환경변수 `!` 단언**: `env.ts`의 Zod 검증 함수(`getServerEnv()`)가 존재하나 payment 라우트에서 미사용. `process.env!` 직접 접근
- **[Low] `middleware.ts:104` — nonce 생성 후 CSP에 미적용**: nonce를 생성하고 `x-nonce` 헤더에 설정하지만 정작 CSP의 `script-src`에 `nonce-{value}`를 포함하지 않음. nonce가 사실상 무용

### 즉시 수정 필요
1. `push/send/route.ts:16` — `getSession()` → `getUser()` 전환
2. `middleware.ts:107` — nonce를 CSP script-src에 실제 적용

---

## 3. 데이터베이스 — 72/100

### 잘된 점
- Supabase PostgreSQL 기반, RLS(Row Level Security) 활용 가능 구조
- `createSupabaseServer()`와 `createSupabaseBrowser()` 분리로 서버/클라이언트 Supabase 인스턴스 명확 구분
- Service Role Key는 서버 API에서만 사용 (`payment/route.ts:5`)
- `post_likes` 테이블로 좋아요 정규화, `push_subscriptions` 테이블로 구독 관리

### 문제점
- **[High] `payment/route.ts:68-70` — nickname_change_tickets Race Condition**: SELECT 후 UPDATE 패턴. 동시 결제 시 티켓 수 손실 가능. Supabase RPC `increment` 함수 필요
- **[High] `payment/route.ts:52-58` — shop_orders INSERT 실패 무시**: 결제는 토스에서 성공 확정인데 주문 기록 누락 가능. `console.warn`만 하고 넘어감. 최소한 재시도 로직 또는 dead-letter 큐 필요
- **[Med] view_count Race Condition**: `feed/[id]/page.tsx`에서 `post.view_count + 1` 클라이언트 계산 후 UPDATE. 동시 접속 시 조회수 손실. `rpc('increment_view', {post_id})` 패턴 권장
- **[Med] 댓글 100개 하드코딩 제한**: 페이지네이션/커서 기반 무한 스크롤 미구현. 인기 게시글에서 댓글 누락
- **[Low] 인덱스 전략 불투명**: 코드에서 Supabase 마이그레이션 파일 미확인. `post_likes(post_id, user_id)` 복합 인덱스, `notifications(user_id, is_read)` 인덱스 존재 여부 확인 필요

### 즉시 수정 필요
1. `payment/route.ts:68-70` — RPC increment로 교체
2. `payment/route.ts:52-58` — INSERT 실패 시 재시도 또는 에러 전파

---

## 4. 성능 최적화 — 68/100

### 잘된 점
- SSR 기반 TTFB 최적화 (feed 상세 페이지)
- `next/image` + avif/webp 자동 포맷 (`next.config.ts:19`)
- Turbopack 개발 서버 (`package.json:6`)
- Rate limiting 3티어로 서버 과부하 방지 (`src/lib/rate-limit.ts`)
- 주식 5분 간격 갱신으로 불필요한 폴링 방지 (`StockClient.tsx:97`)

### 문제점
- **[Critical] `Navigation.tsx:41-64` — 매 마운트마다 3개 쿼리 실행**: `getSession()` → `profiles` SELECT → `notifications` COUNT. SPA 네비게이션 시 매 페이지마다 반복. React Context 또는 SWR 캐싱 필수
- **[High] `StockClient.tsx:74-79` — 환율 API 매 마운트 호출**: `open.er-api.com` 외부 API를 컴포넌트 마운트마다 fetch. localStorage + 24시간 TTL 캐싱이면 충분
- **[Med] LikeButton.tsx:17-27 — 매 렌더링마다 좋아요 상태 재확인**: `initialLiked` prop을 받으면서도 useEffect에서 다시 DB 조회. 서버에서 전달한 값을 신뢰하거나, 조건부 조회로 변경 필요
- **[Med] StockClient 전체 리렌더링**: `refresh()` 시 전체 배열 교체, 개별 행에 `React.memo` 미적용. 50개 이상 종목 시 성능 저하
- **[Low] 번들 분석 미설정**: `@next/bundle-analyzer` 미설치. 불필요한 의존성 포함 여부 확인 불가

### 즉시 수정 필요
1. Navigation 세션/프로필 데이터를 React Context + 캐싱으로 전환
2. 환율 API 결과를 localStorage에 24시간 캐싱

---

## 5. UX 디자인 — 80/100

### 잘된 점
- CSS 변수 기반 완전한 디자인 토큰 시스템 (`globals.css`: 60+ 변수, 3단계 명도 계층)
- 다크/라이트 모드 완비, FOUC 방지 인라인 스크립트
- 모바일 퍼스트: 하단 5탭 네비게이션 + `safe-area-inset-bottom` 대응
- 햅틱 피드백 (`LikeButton.tsx:31` — `navigator.vibrate(10)`)
- 낙관적 업데이트 (`LikeButton.tsx:40-41`) — 즉각적인 UI 반응
- FontSizeToggle 3단계로 시각 접근성 대응
- 스켈레톤 로딩 shimmer 애니메이션 6개 섹션
- GuestGate: blur 오버레이 + 모달로 자연스러운 가입 유도 퍼널

### 문제점
- **[Med] 주식 테이블 모바일 UX**: `StockClient.tsx`에서 `minWidth: 500` 고정, 모바일에서 강제 가로 스크롤. 카드 레이아웃 또는 주요 정보만 보여주는 모바일 뷰 필요
- **[Med] Navigation 드롭다운 — ESC 키 미지원**: `Navigation.tsx:223` — 키보드 사용자가 메뉴를 닫을 방법이 클릭뿐. `useEffect`로 Escape 키 리스너 추가 필요
- **[Med] 알림 배지 접근성**: `Navigation.tsx:172` — `aria-label="알림"`이 고정. 읽지 않은 알림 수를 포함한 동적 `aria-label` 필요 (예: "읽지 않은 알림 3개")
- **[Low] 로그인/회원가입 버튼 동일 목적지**: `Navigation.tsx:260-275` — 둘 다 `/login`으로 이동. 회원가입 전용 경로가 없어 사용자 혼란 가능

### 즉시 수정 필요
1. 주식 페이지 모바일 카드 레이아웃 추가

---

## 6. 모바일/PWA — 76/100

### 잘된 점
- `manifest.json` 완비: standalone 모드, portrait-primary, shortcuts 3개 (피드/주식/글쓰기)
- Web Push 완성: VAPID 키 기반, `PushNotificationSetup.tsx` + `push/subscribe` API
- 만료 구독 자동 삭제 (`push/send/route.ts:71-72`)
- `OfflineBanner.tsx` 오프라인 상태 감지 UI
- `safe-area-inset-bottom` 적용 (`Navigation.tsx:288`)
- 모바일 탭바 5개: 피드/주식/부동산/토론/내정보
- `viewport.maximumScale: 1` 설정으로 의도치 않은 확대 방지

### 문제점
- **[High] Service Worker 미확인**: `manifest.json`은 있으나 실제 `sw.js` 또는 `next-pwa` 설정 미확인. 오프라인 캐싱 전략 부재 시 PWA 설치 후 오프라인에서 빈 화면
- **[Med] manifest.json 아이콘 — SVG만 사용**: `manifest.json:11-13` — 모든 아이콘이 `favicon.svg`. Android/iOS PWA는 PNG 192x192, 512x512를 요구. Lighthouse PWA 점수 감점
- **[Med] `manifest.json:16` — screenshots 빈 배열**: Play Store/앱 설치 프롬프트에서 스크린샷 미표시. 설치 전환율 저하
- **[Low] 관리자 브로드캐스트만 가능**: 개인화된 푸시(댓글 알림, 좋아요 알림 등) 미구현. 푸시 인프라는 있으나 트리거 이벤트 연동 미완

### 즉시 수정 필요
1. PNG 아이콘 192x192, 512x512 생성 및 manifest.json 반영

---

## 7. SEO — 83/100

### 잘된 점
- `layout.tsx`: metadataBase, title template, description, keywords 8개, canonical, alternates, robots 완비
- 동적 OG: 게시글별 `generateMetadata` + OG 이미지 API (`/api/og`)
- JSON-LD: WebApplication (루트) + Article (게시글 상세)
- `sitemap.ts`: 정적 9개 + 동적 게시글 200개
- `robots.ts`: 민감 경로 차단 + sitemap URL 명시
- Twitter Card summary_large_image
- GuestGate 크롤러 예외: `isCrawler()` 함수로 구글봇 등에 콘텐츠 접근 허용

### 문제점
- **[Med] 주식 페이지 완전 CSR**: `StockClient.tsx` 전체가 `'use client'`. 주식 데이터가 검색엔진에 인덱싱 불가. 종목별 상세 페이지(`/stock/[symbol]`) 추가 시 롱테일 키워드 유입 가능
- **[Med] canonical URL 게시글별 미설정**: `feed/[id]/page.tsx:48` — `openGraph.url`은 있으나 `alternates.canonical` 명시 부재. 중복 콘텐츠 이슈 가능
- **[Low] sitemap 200개 제한**: 게시글 증가 시 sitemap index 분할 필요
- **[Low] OG 이미지가 SVG**: `layout.tsx:23` — `og-image.svg`. 일부 SNS(카카오톡, Facebook)는 SVG OG 이미지를 지원하지 않음. PNG/JPG 권장

### 즉시 수정 필요
1. OG 이미지를 PNG로 변환 (`og-image.png`)

---

## 8. 결제/핀테크 — 74/100

### 잘된 점
- 토스페이먼츠 연동 완성: confirm → 주문 기록 → 후처리 파이프라인
- POST: 인증 + 금액 서버 검증 + 토스 승인 + shop_orders INSERT + 상품별 후처리 (`payment/route.ts`)
- GET: Bearer 토큰 + `getUser()` 검증 후 주문 조회 (`payment/route.ts:86-109`)
- 상품별 후처리: premium_badge → `is_premium: true`, nickname_change → 티켓 +1

### 문제점
- **[Critical] `payment/route.ts:52-58` — 결제 성공 후 주문 기록 실패 무시**: 토스에서 결제 확정 후 `shop_orders` INSERT가 실패하면 `console.warn`만 출력. 사용자는 결제됐는데 주문 내역 없는 상태. 환불 처리도 불가능해짐
- **[High] `payment/route.ts:68-70` — Race Condition**: SELECT → +1 → UPDATE 패턴. 동시 결제 시 티켓 수 손실
- **[High] `payment/route.ts:6` — TOSS_SECRET_KEY 폴백 빈 문자열**: `|| ''`로 빈 문자열 허용. 43행에서 체크하지만 그 사이에 인증/DB 조회가 이미 실행됨. early return으로 변경 필요
- **[Med] PaymentCreateSchema 미사용**: `schemas.ts:36-41`에 정의되어 있으나 `payment/route.ts`에서 import하지 않음. 수동 `if (!paymentKey || !orderId || !amount)` 체크
- **[Med] 환불/취소 API 부재**: 결제 승인만 있고 취소/환불 엔드포인트 없음. 전자상거래법상 7일 이내 청약 철회 대응 불가
- **[Low] 결제 금액 검증 — productId 선택적**: `payment/route.ts:28-41` — `productId`가 없으면 금액 검증 스킵. 임의 금액 결제 가능

### 즉시 수정 필요
1. shop_orders INSERT 실패 시 에러 전파 + 토스 결제 취소 API 호출
2. 환불/취소 API 엔드포인트 추가

---

## 9. DevOps — 65/100

### 잘된 점
- Vercel 배포 파이프라인 (git push → 자동 배포)
- Sentry 통합 설정 (`next.config.ts:63-71`, `@sentry/nextjs`)
- Vercel Analytics + Speed Insights 패키지 포함
- Health API (`/api/health`) — DB 연결 + 지연시간 모니터링
- Turbopack 개발 서버 성능 최적화

### 문제점
- **[Critical] `next.config.ts:5-6` — TypeScript/ESLint 에러 빌드 무시**: 프로덕션 배포에서 타입 에러가 있어도 빌드 성공. 런타임 버그 직결
- **[High] Sentry DSN 미등록**: 설정만 있고 실제 DSN이 환경변수에 없음. 프로덕션 에러 트래킹 사실상 비활성
- **[High] 테스트 코드 부재**: `vitest`, `@playwright/test` 의존성은 있으나 실제 테스트 파일 0개. CI/CD 파이프라인에 테스트 단계 없음
- **[Med] `next.config.ts:69` — `sourcemaps: { disable: true }`**: Sentry 소스맵 비활성. 프로덕션 에러 디버깅 시 난독화된 스택 트레이스만 확인 가능
- **[Med] CI/CD 파이프라인 미확인**: GitHub Actions, Vercel 빌드 훅, 스테이징 환경 등 미확인
- **[Low] 환경변수 관리**: `env.ts`의 Zod 검증이 존재하나 실제 API 라우트(`payment/route.ts`)에서 `process.env!` 직접 접근 패턴 잔존

### 즉시 수정 필요
1. `next.config.ts`에서 `ignoreBuildErrors`/`ignoreDuringBuilds` 제거
2. Sentry DSN 환경변수 등록

---

## 10. 데이터 분석 — 55/100

### 잘된 점
- Vercel Analytics 패키지 포함 (`@vercel/analytics`)
- Vercel Speed Insights 패키지 포함 (`@vercel/speed-insights`)
- Health API에서 서버 지연시간 모니터링 가능
- `view_count` 필드로 게시글 조회수 추적

### 문제점
- **[High] 사용자 행동 추적 부재**: 좋아요/북마크/댓글/검색 등 핵심 이벤트의 분석 이벤트 미전송. 사용자 퍼널 분석 불가
- **[High] A/B 테스트 인프라 없음**: GuestGate 무료 열람 횟수(5회), 푸시 메시지 내용 등 최적화 실험 불가
- **[Med] 검색어 분석 미구현**: `/api/search` 호출 시 검색어 로깅/집계 없음. 사용자 관심사 파악 불가
- **[Med] 리텐션/코호트 분석 미구현**: 가입일 기준 재방문율, DAU/MAU 비율 등 핵심 지표 추적 불가
- **[Low] Vercel Analytics만으로는 심층 분석 한계**: GA4 또는 Mixpanel 등 이벤트 기반 분석 도구 미연동

### 즉시 수정 필요
1. 핵심 전환 이벤트(가입, 첫 글 작성, 결제) 최소 추적 구현

---

## 11. 금융정보 컴플라이언스 — 60/100

### 잘된 점
- 주식 데이터 출처 명시 가능 구조 (KIS API, Yahoo Finance 폴백)
- 주식 가격 "~분 전" 표시로 실시간 아님을 암시 (`StockClient.tsx:41-48`)
- 투자 자문이 아닌 정보 제공 커뮤니티 포지셔닝

### 문제점
- **[Critical] 투자 경고 면책조항 미표시**: 주식 시세 페이지에 "본 정보는 투자 권유가 아닙니다" 등 법적 면책조항 없음. 자본시장법 위반 소지
- **[High] 데이터 지연 고지 미비**: 주식 데이터가 실시간이 아닌 5분 지연인데, 이를 명확히 고지하는 UI 없음. "실시간"으로 오인 가능
- **[Med] KIS API 키 미등록**: 한국투자증권 API 키 미설정 시 Yahoo Finance 폴백인데, Yahoo Finance의 한국 시장 데이터 정확도/적시성 보장 불가
- **[Med] 게시글 내 종목 추천 규제 미대응**: 사용자가 "삼성전자 무조건 매수" 같은 글을 올릴 경우 플랫폼 책임 소재 불분명. 신고/필터링 시스템은 있으나 금융 특화 필터 없음
- **[Low] 가격 알림/목표가 기능에 대한 규제 검토 미비**: 향후 기능 확장 시 금융투자업 인가 필요 여부 검토 필요

### 즉시 수정 필요
1. 주식 페이지 상단에 투자 경고 면책조항 배너 추가
2. 데이터 지연 시간 명확히 표시 ("5분 지연 데이터")

---

## 12. 법무/개인정보 — 62/100

### 잘된 점
- 개인정보처리방침 경로 존재 (`/privacy`)
- 이용약관 경로 존재 (`/terms`)
- 계정 삭제 기능 (`/api/account/delete`)
- 온보딩 강제로 동의 절차 유도 가능 구조

### 문제점
- **[Critical] 개인정보처리방침 내용 미확인**: 경로는 있으나 GDPR/개인정보보호법 필수 항목(수집 목적, 보유 기간, 제3자 제공, 파기 절차) 포함 여부 확인 필요
- **[High] 쿠키 동의 배너 없음**: `kd_pv` 쿠키를 사용자 동의 없이 설정 (`GuestGate.tsx:33`). 정보통신망법 및 GDPR 쿠키 규정 위반 가능
- **[High] 결제 데이터 보관 정책 불명확**: `shop_orders`에 `raw_response` (토스 전체 응답) 저장 (`payment/route.ts:56`). 카드 정보 포함 여부, 보관 기간, 암호화 여부 확인 필요
- **[Med] 미성년자 이용 제한 미구현**: 금융 정보 + 결제 기능이 있으나 연령 확인 절차 없음
- **[Med] 데이터 이동권 미구현**: 개인정보보호법상 사용자 데이터 다운로드/이전 기능 필요
- **[Low] 제3자 서비스 데이터 전달 고지**: 토스페이먼츠, Supabase, Vercel, Sentry, Upstash 등에 사용자 데이터 전달. 개인정보처리방침에 명시 필요

### 즉시 수정 필요
1. 쿠키 동의 배너 구현
2. 개인정보처리방침 필수 항목 완비 여부 검토

---

## 13. 글로벌라이제이션 — 45/100

### 잘된 점
- `layout.tsx:37` — `alternates.languages: { 'ko-KR': 'https://kadeora.app' }` 설정
- `manifest.json` 한국어 완비
- 한국 시장 특화 (KOSPI/KOSDAQ + KRW/USD 환율 변환)

### 문제점
- **[High] i18n 인프라 전무**: 모든 문자열이 하드코딩된 한국어. `next-intl`, `react-i18next` 등 i18n 라이브러리 미사용
- **[High] 다국어 라우팅 미설정**: Next.js의 `i18n` 설정 또는 `[locale]` 동적 세그먼트 없음
- **[Med] 날짜/숫자 포맷 하드코딩**: `toLocaleString('ko-KR')` 직접 호출 (`StockClient.tsx:26`, `fmt()` 함수). 로케일 변경 시 전체 수정 필요
- **[Med] USD 표시 하드코딩**: `StockClient.tsx:32-34` — `$` 기호 하드코딩. 다국어 확장 시 `Intl.NumberFormat` 활용 필요
- **[Low] RTL(Right-to-Left) 미고려**: 아랍어 등 RTL 언어 지원 불가

### 즉시 수정 필요
- 현재 한국어 단일 시장이면 긴급도 낮음. 글로벌 확장 계획 시 i18n 인프라 우선 구축

---

## 14. 커뮤니티 운영 — 70/100

### 잘된 점
- 신고 시스템 완비: `ReportSchema` (Zod) + `/api/report` API
- 관리자 패널 (`/admin`) + 푸시 브로드캐스트
- 사용자 등급 시스템 (`/grades` 페이지)
- 댓글 시스템 + 대댓글 (`parentId` 필드)
- 토론 게시판 별도 분리 (`/discuss`)
- 게시글 카테고리: stock, apt, community, free, bug

### 문제점
- **[Med] 관리자 콘텐츠 관리 도구 미비**: 신고 접수는 되나 관리자가 게시글/댓글을 삭제/숨김 처리하는 UI/API 미확인. `/api/posts/[id]`에 DELETE는 있으나 관리자 전용 일괄 관리 기능 부재
- **[Med] 사용자 차단/제재 시스템 미확인**: 악성 사용자 IP 차단, 계정 정지 등의 관리 도구 미확인
- **[Med] 콘텐츠 필터링 자동화 부재**: 비속어/광고/스팸 자동 감지 시스템 없음. `sanitize.ts`는 XSS 방어용이지 콘텐츠 모더레이션 아님
- **[Low] 커뮤니티 가이드라인 링크 미확인**: `/terms`에 포함 여부 불분명
- **[Low] 사용자 간 팔로우/팔로워**: `/api/follow` 존재하나 팔로우 기반 피드 필터링 미구현

### 즉시 수정 필요
1. 관리자 게시글/댓글 숨김/삭제 UI 추가

---

## 15. 그로스해킹 — 67/100

### 잘된 점
- GuestGate 퍼널: 5회 무료 열람 → 로그인 유도 모달 → blur 오버레이 (`GuestGate.tsx`)
- 온보딩 강제: 미들웨어 레벨에서 프로필 미완성 사용자 리다이렉트 (`middleware.ts:91-101`)
- 상점 시스템: 프리미엄 배지, 닉네임 변경권 등 수익화 아이템
- PWA 설치 + Push 알림 = 리텐션 도구
- 소셜 공유: `ShareButtons.tsx` 컴포넌트
- SEO 최적화로 오가닉 트래픽 유입 기반 구축

### 문제점
- **[High] 전환율 추적 미구현**: 가입 → 첫 글 작성 → 결제 퍼널의 단계별 전환율 측정 불가. 어디서 이탈하는지 모름
- **[Med] 리퍼럴 시스템 없음**: 사용자 초대 보상, 공유 인센티브 등 바이럴 루프 부재
- **[Med] 이메일/카카오 리마케팅 미구현**: 이탈 사용자 재방문 유도 수단 없음. 가입 후 7일 미접속 사용자 푸시는 인프라만 있고 자동화 없음
- **[Med] GuestGate 5회 제한 최적화 근거 없음**: A/B 테스트 없이 5회로 고정. 3회 vs 5회 vs 10회 중 최적값 모름
- **[Low] 가입 허들**: 카카오/구글 소셜 로그인은 있으나 이메일 미인증 자유 열람 옵션 없음. 가입 마찰 높을 수 있음

### 즉시 수정 필요
1. 핵심 퍼널 전환 이벤트 추적 구현 (최소 GA4 이벤트)

---

## 종합: 1034/1500 (등급 B+)

| # | 분야 | 점수 | 핵심 이슈 |
|---|------|------|-----------|
| 1 | 프론트엔드 아키텍처 | 79/100 | 인라인 스타일 남용, 빌드 에러 무시 |
| 2 | 정보보안 | 78/100 | CSP unsafe-inline, push API getSession |
| 3 | 데이터베이스 | 72/100 | Race condition, 주문 기록 실패 무시 |
| 4 | 성능 최적화 | 68/100 | Navigation 매번 3쿼리, 환율 매번 fetch |
| 5 | UX 디자인 | 80/100 | 주식 모바일 UX, 접근성 개선 필요 |
| 6 | 모바일/PWA | 76/100 | PNG 아이콘 부재, SW 미확인 |
| 7 | SEO | 83/100 | 주식 CSR, canonical 미설정 |
| 8 | 결제/핀테크 | 74/100 | 주문 실패 무시, 환불 API 없음 |
| 9 | DevOps | 65/100 | 빌드 에러 무시, 테스트 0개, Sentry 미활성 |
| 10 | 데이터 분석 | 55/100 | 이벤트 추적 전무, A/B 테스트 없음 |
| 11 | 금융정보 컴플라이언스 | 60/100 | 투자 면책조항 없음, 데이터 지연 미고지 |
| 12 | 법무/개인정보 | 62/100 | 쿠키 동의 없음, 결제 데이터 정책 불명확 |
| 13 | 글로벌라이제이션 | 45/100 | i18n 전무 (한국 단일 시장이면 감안) |
| 14 | 커뮤니티 운영 | 70/100 | 관리자 모더레이션 도구 미비 |
| 15 | 그로스해킹 | 67/100 | 전환율 추적 없음, 리퍼럴 없음 |

### v4 대비 비교 (7개 공통 분야)

| 분야 | v4 점수 | v5 점수 | 변동 | 비고 |
|------|---------|---------|------|------|
| 프론트엔드 아키텍처 | 81 | 79 | -2 | v5 기준 엄격화 (빌드 에러 무시 감점) |
| 정보보안 (v4: 보안) | 82 | 78 | -4 | nonce 미적용, getSession 문제 재평가 |
| 성능 최적화 | 73 | 68 | -5 | LikeButton 중복 쿼리 추가 발견 |
| UX 디자인 (v4: UI/UX) | 82 | 80 | -2 | 접근성 기준 강화 |
| SEO (v4: SEO/마케팅) | 85 | 83 | -2 | OG 이미지 SVG 문제 발견 |
| 데이터베이스 (v4: 백엔드) | 79 | 72 | -7 | DB 특화 평가로 Race Condition 비중 증가 |
| DevOps (v4: 출시 준비도) | 78 | 65 | -13 | DevOps 특화 평가, 테스트 0개 중과실 |

> **참고**: v4는 7개 분야 560/700이었으나 v5는 15개 분야로 확장하며 평가 기준도 엄격화. 단순 점수 비교보다 각 분야별 개선 사항에 집중할 것.

---

## TOP 5 즉시 개선

| 우선순위 | 항목 | 파일:줄번호 | 예상 시간 | 영향 분야 |
|----------|------|-------------|-----------|-----------|
| **P0** | `ignoreBuildErrors` / `ignoreDuringBuilds` 제거 후 타입 에러 수정 | `next.config.ts:5-6` | 2-8시간 | DevOps, 프론트엔드 |
| **P0** | 결제 주문 기록 실패 시 에러 전파 + 토스 취소 API 호출 | `payment/route.ts:52-58` | 2시간 | 결제/핀테크, DB |
| **P0** | 투자 경고 면책조항 + 데이터 지연 고지 배너 | `StockClient.tsx` (상단) | 1시간 | 금융 컴플라이언스 |
| **P1** | `push/send/route.ts:16` — `getSession()` → `getUser()` 전환 | `push/send/route.ts:16` | 30분 | 정보보안 |
| **P1** | Navigation 세션 캐싱 (React Context/SWR) | `Navigation.tsx:41-64` | 3시간 | 성능, UX |

---

## 출시 후 30일 로드맵

### Week 1: 법적/보안 긴급 대응
| 작업 | 파일 | 예상 시간 |
|------|------|-----------|
| `ignoreBuildErrors` 제거 + 타입 에러 전수 수정 | `next.config.ts` + 전체 | 8시간 |
| 결제 주문 기록 실패 처리 + 환불 API 추가 | `payment/route.ts` | 4시간 |
| 투자 면책조항 배너 + 데이터 지연 고지 | `StockClient.tsx` | 1시간 |
| 쿠키 동의 배너 구현 | 신규 컴포넌트 | 3시간 |
| `getSession()` → `getUser()` 전환 (push API) | `push/send/route.ts`, `push/subscribe` | 1시간 |
| Sentry DSN 등록 + sourcemaps 활성화 | Vercel 환경변수, `next.config.ts` | 1시간 |
| nickname_change_tickets RPC increment | Supabase RPC + `payment/route.ts` | 1시간 |

### Week 2: 성능/UX 개선
| 작업 | 파일 | 예상 시간 |
|------|------|-----------|
| Navigation 세션 캐싱 (AuthContext) | `Navigation.tsx` + 신규 Context | 4시간 |
| 환율 API localStorage 캐싱 (24h TTL) | `StockClient.tsx` | 1시간 |
| 주식 모바일 카드 레이아웃 | `StockClient.tsx` | 3시간 |
| PNG 아이콘 생성 + manifest.json 업데이트 | `public/`, `manifest.json` | 1시간 |
| OG 이미지 PNG 변환 | `public/og-image.png` | 30분 |
| CSP nonce 실제 적용 | `middleware.ts` | 2시간 |

### Week 3: 분석/그로스
| 작업 | 파일 | 예상 시간 |
|------|------|-----------|
| GA4 또는 Mixpanel 연동 + 핵심 이벤트 추적 | 전체 | 4시간 |
| 전환 퍼널 이벤트 (가입→글작성→결제) | 주요 페이지 | 3시간 |
| 검색어 로깅/분석 | `/api/search` | 1시간 |
| PaymentCreateSchema 실제 적용 | `payment/route.ts` | 1시간 |
| 관리자 콘텐츠 관리 UI (숨김/삭제) | 관리자 패널 | 4시간 |

### Week 4: 안정화/테스트
| 작업 | 파일 | 예상 시간 |
|------|------|-----------|
| Vitest 단위 테스트: 결제/인증/sanitize | `__tests__/` | 8시간 |
| Playwright E2E: 가입→글작성→결제 플로우 | `e2e/` | 8시간 |
| 인라인 스타일 → CSS 클래스 마이그레이션 (주요 컴포넌트) | Navigation, GuestGate 등 | 8시간 |
| 개인정보처리방침 법률 검토 + 보완 | `/privacy` 페이지 | 외부 검토 |
| 번들 분석 + 불필요 의존성 제거 | `@next/bundle-analyzer` | 2시간 |

---

> **핵심 요약**: 카더라는 기능적으로 완성도 높은 한국형 금융/부동산 커뮤니티 웹앱이다. SSR/CSR 분리, 보안 헤더, 결제 인증 등 핵심 아키텍처는 견고하다. 그러나 v5에서 15개 분야로 확장 평가한 결과, **법적 컴플라이언스**(투자 면책조항, 쿠키 동의), **DevOps 성숙도**(빌드 에러 무시, 테스트 0개), **데이터 분석 부재**가 출시 리스크로 드러났다. 특히 `next.config.ts`의 `ignoreBuildErrors: true`는 즉시 제거해야 하며, 결제 주문 기록 실패 무시 패턴은 금전적 분쟁으로 이어질 수 있다. 기술 부채(인라인 스타일, Navigation 성능)는 출시를 막지 않으나, 법적 요건(면책조항, 쿠키 동의)은 출시 전 반드시 대응해야 한다.
