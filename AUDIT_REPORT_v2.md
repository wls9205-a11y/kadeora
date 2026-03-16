# 카더라 웹앱 전문가 감사 보고서 v2
> 평가일: 2026-03-17 | 대상: kadeora.app | 분석 범위: 프론트엔드 10개 핵심 파일 + 관련 API/유틸

---

## 1. 프론트엔드 (React/Next.js) — 62/100

### 현재 상태
Next.js App Router 기반, 서버 컴포넌트(게시글 상세)와 클라이언트 컴포넌트(주식/토론/상점/결제)를 혼합 사용. Supabase를 DB/Auth로 활용하며, 토스페이먼츠 결제 연동까지 구현됨.

### 잘된 점
- 게시글 상세(`feed/[id]/page.tsx`)가 서버 컴포넌트로 SSR되어 SEO에 유리
- `generateMetadata`로 OG/Twitter 카드 동적 생성 (`:29-66`)
- JSON-LD 구조화 데이터 삽입 (`feed/[id]/page.tsx:126-147`)
- 토론방 ChatRoom을 `dynamic()` + `ssr: false`로 lazy loading (`DiscussClient.tsx:8-15`)
- GuestGate에서 크롤러 감지 로직으로 SEO 보호 (`GuestGate.tsx:16-21`)
- 다크모드 플리커 방지 인라인 스크립트 (`layout.tsx:62-70`)

### 문제점 (심각도 표시)

**[심각] 조회수 증가 race condition**
- `feed/[id]/page.tsx:91` — `post.view_count + 1`로 업데이트하면 동시 접속 시 조회수 손실 발생. RPC나 `increment` 함수를 써야 함.

**[심각] Supabase 클라이언트 re-creation**
- `PaymentClient.tsx:22` — `createSupabaseBrowser()`를 컴포넌트 본문에서 호출하여 매 렌더마다 새 클라이언트 생성. `useEffect` 외부에서 호출 시 불필요한 인스턴스 생성.

**[중간] useEffect 의존성 누락**
- `PaymentClient.tsx:33` — `useEffect` 의존 배열에 `productId`만 있고 `supabase` 누락. ESLint exhaustive-deps 경고 발생 가능.
- `PaymentClient.tsx:47` — `handlePaymentCallback`의 의존 배열에 `supabase` 누락.

**[중간] 인라인 스타일 과다 사용**
- `StockClient.tsx`, `DiscussClient.tsx`, `Navigation.tsx` 전체가 인라인 스타일. CSS-in-JS나 Tailwind 클래스를 쓰지 않고 `style={{...}}`를 수백 줄 사용. 유지보수 매우 어려움. `PaymentClient.tsx`는 반대로 Tailwind만 사용하여 스타일 방식이 혼재.

**[중간] 데모 데이터 폴백의 프로덕션 노출**
- `feed/[id]/page.tsx:107-121` — Supabase 실패 시 하드코딩된 데모 댓글이 사용자에게 노출됨. 프로덕션 환경에서 허위 콘텐츠 표시 위험.
- `ShopClient.tsx:44-49` — DB 비어있으면 DEMO_PRODUCTS 노출.

**[낮음] 타입 단언(as) 과다**
- `feed/[id]/page.tsx:90,100` — `as PostWithProfile`, `as CommentWithProfile` 등 unsafe cast. Supabase 타입 제너릭을 활용하면 해소 가능.

### 즉시 수정 필요
1. 조회수 race condition → Supabase RPC `increment_view_count` 함수 도입
2. PaymentClient에서 Supabase 클라이언트를 모듈 스코프 또는 useMemo로 이동

---

## 2. 백엔드/API 설계 — 55/100

### 현재 상태
Next.js Route Handlers로 결제(payment)와 주식 갱신(stock-refresh) API 구현. Upstash Redis 기반 rate limiting 도입. 인증은 Supabase Auth + JWT 토큰.

### 잘된 점
- Rate limiting 이중 구현: Upstash 가용 시 Redis, 불가 시 메모리 폴백 (`rate-limit.ts:3-13`)
- KIS API 실패 시 Yahoo Finance 폴백 (`stock-refresh/route.ts:232-244`)
- 장 운영시간 체크로 불필요한 API 호출 방지 (`stock-refresh/route.ts:207-213`)
- 해외주식은 장 시간 무관하게 항상 갱신 (`stock-refresh/route.ts:247-299`)

### 문제점 (심각도 표시)

**[심각] 결제 API에 인증 검증 부재**
- `payment/route.ts:23-28` — Authorization 헤더가 없어도 결제 승인이 진행됨. `userId`가 null이어도 주문이 생성됨. 비인증 사용자가 임의의 paymentKey로 결제 확인 요청을 보낼 수 있음.

**[심각] 결제 금액 검증 없음**
- `payment/route.ts:11` — 클라이언트가 보낸 `amount`를 그대로 토스에 전달. 서버 측에서 `productId`에 해당하는 실제 가격과 비교 검증이 없어 금액 변조 가능.

**[심각] CRON_SECRET 검증 우회**
- `stock-refresh/route.ts:195-199` — `process.env.NODE_ENV !== 'production'`이면 인증 없이 접근 가능. 하지만 클라이언트(`StockClient.tsx:77`)에서 인증 없이 직접 호출하므로, production에서도 401을 반환하게 되어 주식 새로고침 기능이 동작하지 않을 수 있음.

**[중간] Yahoo Finance API 비공식 사용**
- `stock-refresh/route.ts:126-136` — `query1.finance.yahoo.com`은 비공식 엔드포인트. 언제든 차단될 수 있으며, User-Agent 위장까지 하고 있어 TOS 위반 가능성.

**[중간] 결제 GET 엔드포인트 인증 없음**
- `payment/route.ts:65-79` — orderId만 있으면 누구든 결제 정보 조회 가능. 개인정보 유출 위험.

**[중간] Rate limit 메모리 저장소 서버리스 비호환**
- `rate-limit.ts:5-6` — `Map` 기반 메모리 저장소는 Vercel Serverless Functions에서 인스턴스 간 공유 불가. Upstash 미설정 시 rate limiting이 사실상 무효.

**[낮음] 에러 로깅 부재**
- `stock-refresh/route.ts` — 모든 catch 블록이 비어있어 디버깅 불가.

### 즉시 수정 필요
1. 결제 API에 인증 필수 + 금액 서버 검증 로직 추가
2. stock-refresh API의 인증 구조를 클라이언트 호출과 CRON 호출 분리

---

## 3. UI/UX 디자인 — 68/100

### 현재 상태
CSS 변수 기반 디자인 토큰 시스템 + 라이트/다크 모드 완전 지원. Reddit 스타일 컬러 (`#FF4500` 브랜드). 모바일 하단 탭바 + 데스크탑 상단 네비게이션 반응형 구조.

### 잘된 점
- 완성도 높은 디자인 토큰 시스템 (`globals.css:12-91`) — 배경 3단계 명도차, 주식 전용 색상, 시맨틱 컬러 완비
- 다크모드 강제 오버라이드로 Tailwind 클래스/인라인 스타일 모두 커버 (`globals.css:113-164`)
- 스켈레톤 로딩 애니메이션 (`globals.css:357-366`)
- 접근성: `focus-visible` 아웃라인 (`globals.css:383`), `aria-pressed`/`aria-current` 사용 (`DiscussClient.tsx:60`, `Navigation.tsx:138`)
- 글씨 크기 토글 (`FontSizeToggle.tsx`) — 고령 사용자 배려

### 문제점 (심각도 표시)

**[심각] 접근성(a11y) 문제 다수**
- `layout.tsx:49-50` — `userScalable: false`, `maximumScale: 1`으로 줌 차단. WCAG 2.1 위반. 시각 장애인이 확대할 수 없음.
- `Navigation.tsx:155` — 검색 버튼에 이모지만 사용 (`🔍`), 스크린리더에 의미 전달 불명확.
- `StockClient.tsx:248-249` — `onMouseEnter`/`onMouseLeave`로만 hover 효과. 키보드 사용자에게 피드백 없음.

**[중간] 스타일 방식 혼재**
- `feed/[id]/page.tsx`, `StockClient.tsx` → 인라인 스타일
- `PaymentClient.tsx` → Tailwind 클래스
- `globals.css` → 커스텀 CSS 클래스 (`.btn-primary`, `.card`)
- 3가지 방식이 혼합되어 일관성 없음. `.btn-primary` 같은 클래스는 정의만 되어 있고 실제 사용이 적음.

**[중간] 모바일 탭바 아이템 6개**
- `Navigation.tsx:9-16` — 하단 탭에 6개 아이템(피드/주식/부동산/토론/상점/등급). 모바일에서 6개는 과다. 터치 타겟이 좁아질 수 있음.

**[중간] GuestGate 블러 오버레이 해제 불가**
- `GuestGate.tsx:81-93` — "나중에" 클릭 시 블러 오버레이가 `pointerEvents: 'none'`으로 남음. 시각적으로 방해하지만 상호작용은 가능한 어중간한 상태.

**[낮음] 글씨 크기 토글이 `--font-base` 변수만 변경**
- `FontSizeToggle.tsx:21` — 대부분의 컴포넌트가 `fontSize`를 하드코딩(14px, 15px 등)하고 있어 `--font-base` 변경 효과가 `body`에만 적용됨.

### 즉시 수정 필요
1. `userScalable: false` 제거 (WCAG 위반)
2. 모바일 탭바 아이템 5개 이하로 축소 (등급 안내는 프로필 내 이동)

---

## 4. 성능 최적화 — 60/100

### 현재 상태
SSR + 클라이언트 하이브리드 구조. 이미지에 Next.js Image 컴포넌트 사용. ChatRoom lazy loading 적용.

### 잘된 점
- `feed/[id]/page.tsx:218-225` — `Image` 컴포넌트 + `sizes` + `priority` 속성으로 LCP 최적화
- `DiscussClient.tsx:8-15` — ChatRoom dynamic import로 초기 번들 경량화
- `StockClient.tsx:89` — 5분 간격 자동 갱신으로 API 과부하 방지

### 문제점 (심각도 표시)

**[심각] 주식 API 순차 호출**
- `stock-refresh/route.ts:83-100` — 50개 종목을 for 루프 + `await sleep(50)`으로 순차 호출. 최소 2.5초 소요. `Promise.all` 또는 배치 API 활용 필요.

**[중간] 클라이언트에서 환율 API 직접 호출**
- `StockClient.tsx:66-71` — 매 마운트마다 `open.er-api.com` 호출. 서버에서 캐싱하거나 주식 API 응답에 포함시켜야 함.

**[중간] 댓글 limit 100 하드코딩**
- `feed/[id]/page.tsx:99` — `.limit(100)`으로 댓글을 최대 100개만 로드. 페이지네이션이나 무한 스크롤 없음.

**[중간] Navigation에서 매 마운트마다 3회 Supabase 쿼리**
- `Navigation.tsx:48-58` — `getSession()` + `profiles select` + `notifications count`. SWR/React Query로 캐싱하거나 layout 서버 컴포넌트에서 주입해야 함.

**[낮음] StockClient 초기 마운트 시 즉시 refresh 호출**
- `StockClient.tsx:88` — initialStocks를 서버에서 받았는데 바로 클라이언트에서 다시 fetch. 서버 데이터가 최신이면 불필요한 중복 요청.

### 즉시 수정 필요
1. 주식 API 순차 호출을 병렬 또는 배치로 변경
2. Navigation 쿼리를 서버 컴포넌트에서 사전 로드

---

## 5. 보안 — 45/100

### 현재 상태
Supabase RLS 의존 + 서버 API에 부분적 rate limiting. 결제는 토스페이먼츠 연동.

### 잘된 점
- Rate limiting 구현 (`rate-limit.ts`) — Upstash 우선, 메모리 폴백
- Supabase service role key를 서버에서만 사용 (`stock-refresh/route.ts:201-204`)
- `is_deleted` 필터로 soft delete 적용 (`feed/[id]/page.tsx:39,97`)

### 문제점 (심각도 표시)

**[치명] 결제 API 인증 미적용 (재강조)**
- `payment/route.ts:8-63` — POST 엔드포인트에 인증 미들웨어 없음. 누구든 paymentKey를 알면 결제 확인 가능. userId가 null이어도 주문 레코드 생성됨.

**[치명] 결제 금액 서버 검증 없음 (재강조)**
- `payment/route.ts:11-12` — 클라이언트 전달 amount를 그대로 사용. 중간자 공격으로 1원 결제 후 프리미엄 아이템 획득 가능.

**[심각] stock-refresh API 인증 구조 결함**
- `stock-refresh/route.ts:192-199` — 클라이언트에서 직접 호출하는 API인데 CRON_SECRET을 요구. production에서 클라이언트 호출이 항상 401 반환되거나, CRON_SECRET 검증이 우회됨.

**[심각] 결제 GET API 인증 없음**
- `payment/route.ts:65-79` — orderId 열거 공격으로 전체 결제 내역 조회 가능. `KADEORA_{timestamp}_{random}` 패턴이 예측 가능.

**[중간] XSS 가능성**
- `feed/[id]/page.tsx:154` — `dangerouslySetInnerHTML`로 JSON-LD 삽입. `post.title`/`post.content`에 `</script>` 포함 시 스크립트 주입 가능. JSON.stringify가 기본적으로 이스케이프하지만 특수 케이스 존재.

**[중간] Rate limiting이 결제 API에 미적용**
- `payment/route.ts` — `rateLimit()` 호출 없음. 결제 확인 요청 무제한.

**[낮음] 메모리 rate limit 서버리스 무효 (재언급)**
- Vercel 배포 환경에서 인스턴스가 독립적이므로 Upstash 없이는 보호 불가.

### 즉시 수정 필요
1. **결제 API에 필수 인증 + 금액 검증 + rate limiting 추가** (출시 블로커)
2. stock-refresh 엔드포인트를 공개/CRON 분리
3. 결제 GET 엔드포인트에 사용자 인증 + 본인 주문만 조회 제한

---

## 6. SEO/마케팅 — 78/100

### 현재 상태
메타데이터, OG, JSON-LD, sitemap 등 주요 SEO 요소 구현됨. PWA manifest 적용.

### 잘된 점
- 게시글별 동적 OG 이미지 (`feed/[id]/page.tsx:44`) — `/api/og` 엔드포인트
- 전체 사이트 JSON-LD WebApplication 스키마 (`layout.tsx:72-88`)
- 게시글 Article 스키마 (`feed/[id]/page.tsx:126-147`)
- `robots` 설정 완비 (`layout.tsx:33`)
- canonical URL 설정 (`layout.tsx:36`)
- PWA manifest + Apple Web App 설정 (`layout.tsx:34-35`)
- 키워드 배열 포함 (`layout.tsx:15`)
- GuestGate에서 크롤러 우회 (`GuestGate.tsx:16-21`)

### 문제점 (심각도 표시)

**[중간] 크롤러 감지가 클라이언트 측**
- `GuestGate.tsx:17-20` — `navigator.userAgent`로 봇 감지. SSR에서는 navigator 접근 불가하므로 서버 미들웨어에서 처리해야 확실함.

**[중간] 주식/토론/상점 페이지 SEO 미비**
- `StockClient.tsx`, `DiscussClient.tsx` — 클라이언트 전용 렌더링이라 크롤러가 빈 페이지를 봄. 서버 컴포넌트로 초기 데이터 렌더링 필요.
- 상점 `megaphone/page.tsx` — 메타데이터는 있으나 본문이 클라이언트 렌더링.

**[낮음] 게시글 content를 plain text로만 표시**
- `feed/[id]/page.tsx:200-202` — `whiteSpace: 'pre-wrap'`으로 텍스트만 렌더링. 마크다운이나 리치 텍스트 미지원으로 콘텐츠 구조화 불가.

**[낮음] breadcrumb JSON-LD 미적용**
- `feed/[id]/page.tsx:158-164` — 시각적 breadcrumb만 있고 BreadcrumbList 스키마 없음.

### 즉시 수정 필요
- 주요 페이지(주식, 토론)의 서버 렌더링 초기 HTML 확보

---

## 7. 출시 준비도 — 48/100

### 현재 상태
MVP 기능 대부분 구현. 결제 연동 미완성(사업자 등록 심사 대기). 데모 데이터 폴백 코드 프로덕션에 존재.

### 잘된 점
- 핵심 기능 전부 구현: 피드, 주식, 토론, 상점, 결제, 알림, 프로필
- 다크모드/라이트모드 완전 지원
- PWA 지원 (manifest, offline banner)
- 비회원 게이트(GuestGate)로 전환 유도
- ComingSoonBanner로 미완성 기능 안내 (`ShopClient.tsx:77`)

### 문제점 (심각도 표시)

**[치명] 결제 보안 미비 (출시 블로커)**
- 인증 없는 결제 API, 금액 검증 없음 — 이 상태로 실결제 활성화하면 금전적 손실 발생

**[심각] 에러 처리 부실**
- 대부분의 catch 블록이 비어있거나 최소한의 처리만 (`stock-refresh/route.ts:228,241,297`, `StockClient.tsx:83`)
- 사용자에게 에러 상태를 알려주는 UI가 불충분

**[심각] 데모 데이터가 프로덕션에 혼재**
- `feed/[id]/page.tsx:107-121`, `ShopClient.tsx:24-30,44-49` — DB 연결 실패 시 가짜 데이터 표시. 사용자 혼란 유발.

**[중간] 환경변수 미설정 시 크래시 가능**
- `payment/route.ts:4-5` — `!` 단언 사용. `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 런타임 크래시.
- `stock-refresh/route.ts:201-204` — 동일 문제.

**[중간] PaymentClient 영어 UI 혼재**
- `PaymentClient.tsx:80-83` — "Payment Failed", "Try Again" 등 영어 문구. 한국어 앱에서 일관성 없음.

**[중간] 테스트 코드 부재**
- 단위 테스트, 통합 테스트 파일이 확인되지 않음. 결제 같은 핵심 로직에 테스트 필수.

**[낮음] 로깅/모니터링 부재**
- Sentry, LogRocket 등 에러 추적 도구 미통합. 프로덕션 이슈 발견이 어려움.

### 즉시 수정 필요
1. 결제 보안 강화 (인증 + 금액 검증)
2. 데모 데이터 폴백을 환경 분기 처리 (`NODE_ENV === 'development'`에서만)
3. 에러 바운더리 + 사용자 친화적 에러 UI

---

## 종합 점수: 416/700

| 영역 | 점수 | 요약 |
|------|------|------|
| 프론트엔드 | 62/100 | SSR+클라이언트 하이브리드 잘 구성, 스타일 혼재 심각 |
| 백엔드/API | 55/100 | Rate limiting 잘 구현, 결제 보안 치명적 결함 |
| UI/UX | 68/100 | 디자인 토큰 완성도 높음, 접근성 위반 존재 |
| 성능 | 60/100 | SSR/lazy loading 활용, API 순차 호출 병목 |
| 보안 | 45/100 | 결제 API 인증/검증 부재가 치명적 |
| SEO | 78/100 | OG/JSON-LD 잘 구현, 클라이언트 페이지 SEO 한계 |
| 출시 준비도 | 48/100 | 기능은 완성, 보안/안정성 미달 |

## 출시 등급: D

MVP로서 기능 범위는 인상적이나, **결제 보안 결함**이 출시 블로커. 이를 해결하지 않으면 금전적 사고 발생 가능. 보안 수정 후 C+ ~ B- 등급 가능.

---

## 즉시 수정 필요 (블로커) — 출시 전 반드시

| # | 문제 | 파일:줄 | 심각도 |
|---|------|---------|--------|
| 1 | 결제 API 인증 미적용 | `src/app/api/payment/route.ts:8-63` | 치명 |
| 2 | 결제 금액 서버 검증 없음 | `src/app/api/payment/route.ts:11` | 치명 |
| 3 | 결제 GET 엔드포인트 인증 없음 | `src/app/api/payment/route.ts:65-79` | 심각 |
| 4 | 줌 차단 (WCAG 위반) | `src/app/layout.tsx:49-50` | 심각 |
| 5 | stock-refresh 인증 구조 결함 | `src/app/api/stock-refresh/route.ts:192-199` | 심각 |

## 출시 전 권고 — 출시 품질 향상

| # | 문제 | 파일 | 우선순위 |
|---|------|------|----------|
| 1 | 조회수 race condition | `feed/[id]/page.tsx:91` | 높음 |
| 2 | 데모 데이터 프로덕션 분리 | `feed/[id]/page.tsx:107`, `ShopClient.tsx:44` | 높음 |
| 3 | PaymentClient 영어 → 한국어 | `PaymentClient.tsx:80-103` | 중간 |
| 4 | 에러 바운더리 + 에러 UI 추가 | 전체 | 중간 |
| 5 | 결제 API rate limiting | `payment/route.ts` | 중간 |
| 6 | Navigation Supabase 쿼리 최적화 | `Navigation.tsx:48-58` | 중간 |
| 7 | 모바일 탭바 5개 이하 축소 | `Navigation.tsx:9-16` | 낮음 |

## 출시 후 개선 — 기술 부채 해소

| # | 항목 | 설명 |
|---|------|------|
| 1 | 스타일 통일 | 인라인 스타일 → Tailwind 또는 CSS Modules로 일원화 |
| 2 | 주식 API 병렬화 | KIS 순차 호출을 배치 또는 `Promise.allSettled`로 변경 |
| 3 | 테스트 도입 | Vitest + Playwright로 결제 플로우, 인증 플로우 E2E 테스트 |
| 4 | 에러 모니터링 | Sentry 통합 |
| 5 | 댓글 페이지네이션 | 100개 limit 제거, 커서 기반 무한 스크롤 |
| 6 | 글씨 크기 토글 실효성 | 하드코딩 font-size를 `em`/`rem` 상대 단위로 전환 |
| 7 | BreadcrumbList JSON-LD | 구조화 데이터로 검색 결과 내 경로 표시 |
| 8 | 환율 API 서버 캐싱 | 클라이언트 직접 호출 대신 서버에서 캐싱 후 제공 |
