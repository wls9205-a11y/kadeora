# 카더라 웹앱 출시 전 전문가 감사 보고서

> **평가일:** 2026-03-17 | **대상:** kadeora.app | **평가자:** Claude Code AI Audit Team
> **기술 스택:** Next.js 15.2.4 + Supabase + Vercel + TypeScript + Tailwind CSS 3.4
> **코드베이스:** 20개 페이지 | 18개 API 라우트 | 17개 컴포넌트 | 9개 유틸리티 모듈

---

## 1. UX/UI 디자인 전문가 (10점 만점)

**점수: 7/10**

### 잘된 점
- **완성도 높은 디자인 토큰 시스템**: `src/app/globals.css`에 45개 이상의 CSS 변수를 정의하여 라이트/다크 모드 전환을 체계적으로 관리. `--bg-base`, `--bg-surface`, `--bg-elevated` 3단계 배경 구조가 시각적 depth를 명확하게 제공
- **모바일 퍼스트 네비게이션**: `src/components/Navigation.tsx`에서 상단 헤더(데스크탑) + 하단 탭바(모바일) 이중 네비게이션 구현. `env(safe-area-inset-bottom)` 처리로 노치/홈바 대응 완료
- **스켈레톤 로딩 UI**: `globals.css`의 `.skeleton` 클래스와 `src/app/(main)/loading.tsx`에서 shimmer 애니메이션 기반 스켈레톤 로더 제공. 토론방(`discussion/[type]/[roomKey]/page.tsx`)에서도 메시지 스켈레톤 구현
- **햅틱 피드백 시스템**: `src/hooks/useHaptic.ts` + `globals.css`의 `button:active { transform: scale(0.97) }` 조합으로 터치 반응성 확보
- **다크모드 플리커 방지**: `src/app/layout.tsx` line 61-69에서 `<head>` 내 인라인 스크립트로 hydration 전 테마 적용

### 문제점
- **인라인 스타일 과다 사용**: `Navigation.tsx` (309줄)에서 거의 모든 스타일이 인라인 `style={{}}` 객체로 작성됨. hover 효과를 `onMouseEnter/onMouseLeave` 이벤트 핸들러로 구현(line 121-122, 137-138, 177-178 등) -- 이는 코드 가독성을 해치고 hover 상태가 CSS로 처리될 때보다 성능이 떨어짐
- **PostCard.tsx에 유니코드 이스케이프 혼용**: `src/components/shared/PostCard.tsx` line 51에서 `"\uC775\uBA85"` 같은 유니코드 이스케이프를 직접 사용. 한글 리터럴 대비 가독성 저하
- **not-found.tsx 부재**: 프로젝트 전체에 `not-found.tsx` 파일이 없음. 존재하지 않는 URL 접근 시 Next.js 기본 404 페이지가 표시되어 브랜드 경험 단절
- **다크모드 강제 오버라이드의 취약성**: `globals.css` line 111-178에서 `!important`를 30회 이상 사용하여 Tailwind 클래스를 덮어쓰기. `.dark .rounded-lg, .dark .rounded-xl, .dark .rounded-2xl` 같은 범용 셀렉터는 의도치 않은 사이드이펙트 유발 가능
- **접근성(a11y) 미흡**: 이미지에 빈 `alt=""` 사용(PostCard.tsx line 58), 색상 대비만으로 정보 전달(주식 상승/하락), `aria-label` 누락 다수

### 개선 제안
1. **인라인 스타일을 Tailwind 유틸리티 클래스로 마이그레이션** -- Navigation.tsx의 유지보수성 대폭 향상
2. **`src/app/not-found.tsx` 글로벌 404 페이지 추가** -- 브랜드 일관성 유지 + 피드로 돌아가기 CTA 포함
3. **다크모드 전략 리팩토링**: `!important` 오버라이드 대신 Tailwind `dark:` 프리픽스를 컴포넌트 레벨에서 직접 사용
4. **WCAG 2.1 AA 준수 점검**: 주식 상승/하락에 아이콘 추가(색각이상 사용자 대응), 폼 필드에 `aria-describedby` 에러 메시지 연결

---

## 2. 프론트엔드 성능 전문가 (10점 만점)

**점수: 7/10**

### 잘된 점
- **Server Component + Client Component 분리 원칙 준수**: 총 34개 `'use client'` 파일이 있으나, 페이지 레벨은 대부분 Server Component로 유지. `src/app/(main)/feed/page.tsx`가 서버에서 데이터를 fetch하고 `FeedClient`에 props로 전달하는 패턴 일관 적용
- **unstable_cache 활용**: `feed/page.tsx` line 10-27에서 `unstable_cache`로 게시글(60초), 트렌딩(300초) 캐시 적용. DB 부하 절감
- **이미지 최적화 설정**: `next.config.ts` line 19에서 `formats: ["image/avif", "image/webp"]` 지정. Supabase Storage, Google, Kakao CDN 도메인별 remotePatterns 설정 완료
- **Sentry + Vercel Analytics 통합**: `@sentry/nextjs`, `@vercel/analytics`, `@vercel/speed-insights` 모두 설치 및 설정 완료. `src/components/common/Analytics.tsx`에서 통합 컴포넌트 제공
- **의존성 최소화**: `package.json` dependencies가 14개로 lean함. 불필요한 UI 라이브러리 없이 네이티브 구현

### 문제점
- **`ignoreBuildErrors: true` + `ignoreDuringBuilds: true`**: `next.config.ts` line 5-6에서 TypeScript 에러와 ESLint 에러를 빌드 시 무시. 이는 런타임 에러의 원인이 되는 타입 오류가 프로덕션에 배포될 수 있음
- **dynamic import 부재**: 프로젝트에서 `next/dynamic`을 사용하는 파일이 `DiscussClient.tsx` 단 1개. `PaymentClient`, `AdminClient`, `AdminPushNotification` 같은 무거운 컴포넌트가 eager loading됨
- **Navigation.tsx의 auth 워터폴**: line 47-58에서 `getSession()` -> `profiles` + `notifications` 순차 요청. 매 페이지 마운트마다 3회 DB 호출이 클라이언트에서 발생
- **Supabase 브라우저 클라이언트 재생성**: `createSupabaseBrowser()`가 호출될 때마다 새 인스턴스 생성(`supabase-browser.ts`). 싱글톤 패턴 미적용으로 불필요한 객체 생성 반복
- **서비스 워커 캐시 전략 미흡**: `public/sw.js`에서 네트워크 우선 전략만 사용하고, `install` 이벤트에서 프리캐시(pre-cache)가 전혀 없음. 오프라인 시 빈 화면 표시

### 개선 제안
1. **`ignoreBuildErrors`와 `ignoreDuringBuilds` 즉시 제거** -- 현재 존재하는 타입 에러를 수정 후 CI에서 빌드 실패가 감지되도록 복원 (출시 전 필수 블로커)
2. **결제/관리자 페이지 dynamic import**: `const PaymentClient = dynamic(() => import('./PaymentClient'), { ssr: false })` 패턴 적용
3. **Supabase 브라우저 클라이언트 싱글톤**: `let client: SupabaseClient | null = null;` 패턴으로 재사용
4. **Service Worker에 앱 셸 프리캐시 추가**: `/feed`, `/stock`, `/apt` 등 주요 페이지 HTML + CSS를 install 시 캐시

---

## 3. 백엔드/DB 전문가 (10점 만점)

**점수: 7/10**

### 잘된 점
- **환경변수 검증 시스템**: `src/lib/env.ts`에서 Zod 스키마로 서버/클라이언트 환경변수를 lazy validation. `CRON_SECRET`에 32자 최소 길이 제약 등 보안 기준 적용
- **입력 검증 이중 방어**: `src/lib/schemas.ts` (Zod 스키마) + `src/lib/sanitize.ts` (XSS 제거)를 API 라우트에서 조합 사용. 예: `api/posts/route.ts`에서 `sanitizePostInput()` 호출 후 길이 검증
- **구조화된 에러 처리**: `src/lib/errors.ts`에서 10종 에러 코드(AUTH_REQUIRED ~ INTERNAL_ERROR)를 한/영 메시지와 HTTP 상태코드로 매핑. Sentry 연동 대비 JSON 로그 형식
- **Rate Limiting 이중 구현**: `src/lib/rate-limit.ts`에서 Upstash Redis(프로덕션) + 메모리 스토어(폴백) 이중 구조. api(30/분), auth(5/분), search(20/분) 3단계 tier 분리
- **계정 삭제 프로세스**: `api/account/delete/route.ts`에서 확인 문구 검증 -> profiles soft-delete -> Supabase Auth hard-delete 순서로 GDPR 스타일 처리

### 문제점
- **`getSession()` vs `getUser()` 혼용**: Supabase 공식 문서는 서버 사이드에서 `getUser()`(JWT 검증) 사용을 권장하나, `admin/page.tsx`(line 14), `push/send/route.ts`(line 16), `push/subscribe/route.ts`(line 7)에서 `getSession()`을 사용 -- 이는 JWT를 서버에서 재검증하지 않으므로 토큰 위조 공격에 취약
- **ADMIN_IDS 하드코딩**: `admin/page.tsx` line 5-8에서 관리자 UUID를 소스코드에 직접 기입. DB의 `is_admin` 컬럼이 존재함에도 사용하지 않아 관리자 변경 시 코드 배포 필요
- **stock-sync API에 N+1 쿼리**: `api/stock-sync/route.ts` line 53-60에서 각 종목을 개별 `update()` 호출로 처리. 101종목 기준 101회 DB 호출 발생. Supabase `upsert` batch 처리 미활용
- **payment API에서 인증 불안전**: `api/payment/route.ts`에서 Authorization 헤더 기반 토큰 추출(line 23-28)을 사용하나, 쿠키 기반 세션 검증을 하지 않고 `createClient`로 직접 연결. `createSupabaseServer()`를 사용하지 않아 미들웨어 세션 새로고침과 단절
- **검색 SQL Injection 위험 완화 부족**: `api/search/route.ts` line 15에서 `ilike.%${query}%` 패턴 사용. `sanitizeSearchQuery()`가 SQL 키워드를 제거하지만, `%`와 `_` 와일드카드 문자는 이스케이프하지 않아 LIKE injection 가능

### 개선 제안
1. **모든 서버 사이드 인증을 `getUser()`로 통일** -- `getSession()`은 클라이언트 전용으로 제한 (보안 블로커)
2. **관리자 판별을 DB `is_admin` 컬럼 기반으로 변경**: `const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single()`
3. **stock-sync를 batch upsert로 리팩토링**: `supabase.from('stock_quotes').upsert(batchArray, { onConflict: 'symbol' })`
4. **검색 쿼리에서 `%`, `_` 이스케이프**: `query.replace(/%/g, '\\%').replace(/_/g, '\\_')`

---

## 4. 보안 전문가 (10점 만점)

**점수: 7/10**

### 잘된 점
- **포괄적 보안 헤더**: `next.config.ts` line 22-53에서 X-Frame-Options(DENY), HSTS(2년), CSP, COOP, CORP 등 11개 보안 헤더 설정. `middleware.ts` line 77-88에서 런타임 CSP 추가 주입
- **SSRF 방어**: `middleware.ts` line 17-29에서 apt-proxy 요청에 대해 private IP 차단(`PRIVATE_IP_REGEX`) + 허용 도메인 화이트리스트(`ALLOWED_APT_DOMAINS`) 이중 검증
- **봇 경로 차단**: `middleware.ts` line 8에서 `/wp-admin`, `/.env`, `/.git` 등 공격 경로를 404 반환
- **파일 업로드 보안**: `src/lib/upload-validate.ts`에서 MIME 타입 + magic byte 이중 검증. 5MB 크기 제한. 빈 파일 차단
- **XSS 방어 다층 구조**: `src/lib/sanitize.ts`에서 `<script>`, `onerror=`, `javascript:`, `<iframe>` 등 위험 패턴 제거 + `isomorphic-dompurify` 라이브러리 별도 설치

### 문제점
- **CSP에 `'unsafe-inline'` + `'unsafe-eval'` 허용**: `next.config.ts` line 40과 `middleware.ts` line 79 모두에서 `script-src 'unsafe-inline' 'unsafe-eval'`을 허용. nonce를 생성하지만(`middleware.ts` line 76) 실제 CSP 지시어에 `'nonce-xxx'`를 사용하지 않음 -- XSS 방어 효과 대폭 감소
- **CSP 중복 정의 충돌**: `next.config.ts` headers()와 `middleware.ts` 양쪽에서 CSP를 정의. `middleware.ts`가 `response.headers.set()`으로 덮어쓰므로 `next.config.ts`의 CSP는 무효화될 수 있으나, 두 곳의 설정이 다름(예: 토스 도메인은 middleware에만 포함)
- **push/send API 인증 취약**: `api/push/send/route.ts` line 16에서 `getSession()`으로 인증 후 admin 확인. 위에서 언급한 `getSession()` 취약점과 동일. 관리자 전용 API이므로 보안 수준이 더 높아야 함
- **레디스 fallback의 보안 한계**: `rate-limit.ts`의 메모리 스토어는 Vercel Serverless 환경에서 인스턴스 간 상태가 공유되지 않음. 공격자가 다수 인스턴스에 분산 요청하면 rate limit 우회 가능
- **debug redirect 불충분**: `next.config.ts` line 57-58에서 `/api/stock-debug`를 redirect 하지만, 다른 디버그 엔드포인트(예: `/api/stock-refresh`)가 노출 상태

### 개선 제안
1. **CSP nonce 실제 적용**: middleware에서 생성한 nonce를 `script-src 'nonce-${nonce}'`로 적용하고, `'unsafe-inline'` 제거. `layout.tsx`의 인라인 스크립트에 `nonce` 속성 추가 (보안 블로커)
2. **CSP 정의를 middleware.ts 한 곳으로 통합**: `next.config.ts`의 CSP 제거하여 충돌 방지
3. **관리자 API를 `getUser()` + `is_admin` DB 확인으로 강화**
4. **Upstash Redis 필수화**: 프로덕션 환경에서 Upstash 미설정 시 서버 시작 실패 처리 또는 경고 로그 강화
5. **`/api/stock-refresh` 라우트에 CRON_SECRET 인증 추가** (현재 인증 없이 노출 가능성 확인 필요)

---

## 5. SEO/마케팅 전문가 (10점 만점)

**점수: 8/10**

### 잘된 점
- **메타데이터 완성도**: `src/app/layout.tsx`에서 title template, description, keywords(8개), Open Graph(locale: ko_KR), Twitter Card(summary_large_image), canonical URL 모두 설정
- **JSON-LD 구조화 데이터**: `layout.tsx` line 71-87에서 `WebApplication` 스키마 적용. `applicationCategory: 'FinanceApplication'`, `operatingSystem`, `inLanguage: 'ko-KR'` 등 상세 정보 포함
- **동적 sitemap**: `src/app/sitemap.ts`에서 정적 9개 경로 + DB에서 최근 200개 게시글을 동적으로 포함. changeFrequency와 priority 세분화
- **robots.txt 세분화**: `src/app/robots.ts`에서 `/api/`, `/admin/`, `/payment/`, `/write/` 등 인덱싱 불필요 경로를 disallow 처리
- **OG 이미지 자동 생성**: `src/app/api/og/route.tsx`에서 Edge Runtime 기반 동적 OG 이미지 생성. 제목, 작성자, 카테고리별 커스텀 이미지

### 문제점
- **페이지별 metadata 불완전**: `write/page.tsx`, `payment/page.tsx`에 title/description metadata가 없음. `grades/page.tsx`, `onboarding/page.tsx`도 metadata 확인 필요
- **OG 이미지 URL 불일치**: `layout.tsx` line 24에서 `images: [{ url: 'https://kadeora.app/api/og' }]`이나, `api/og/route.tsx` line 8에서는 `process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app'` -- vercel 도메인이 폴백으로 노출 가능
- **게시글 상세 페이지 SEO**: `feed/[id]/page.tsx`에서 개별 게시글의 동적 metadata(generateMetadata) 적용 여부 확인 필요. 가장 중요한 SEO 대상 페이지
- **한국어 폰트 최적화 부재**: `layout.tsx`에서 `Inter` 폰트만 로드. 한국어 콘텐츠 중심 서비스인데 `Noto Sans KR` 등 한글 웹폰트를 next/font로 최적화 로딩하지 않음. `globals.css` line 101에서 시스템 폰트 스택으로 폴백
- **`maximumScale: 1, userScalable: false`**: `layout.tsx` line 48-49에서 사용자 줌을 차단. 접근성 위반이며 일부 SEO 감사 도구에서 감점 요소

### 개선 제안
1. **모든 page.tsx에 `export const metadata` 또는 `generateMetadata` 추가** -- 특히 `feed/[id]/page.tsx`에 게시글 제목/내용 기반 동적 메타데이터 필수
2. **OG 이미지 URL을 환경변수 `NEXT_PUBLIC_SITE_URL` 기반으로 통일**
3. **`userScalable: false` 제거**: `maximumScale`을 5 이상으로 변경하여 줌 허용
4. **한글 웹폰트 next/font 통합**: `const notoSansKR = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '700'] })` 추가

---

## 6. 비즈니스/수익화 전문가 (10점 만점)

**점수: 6/10**

### 잘된 점
- **다양한 수익 모델 설계**: `src/lib/constants.ts` line 118-127에서 8종 상품 정의 -- 메가폰(게시글 상단 고정), 등급 뱃지, 익명 게시, 프리미엄 멤버십 등 커뮤니티 특화 아이템
- **토스페이먼츠 결제 연동**: `api/payment/route.ts`에서 토스 결제 승인 API 연동 완료. orderId/paymentKey 검증, shop_orders 테이블 저장, 결제 상태 조회(GET) 모두 구현
- **등급 시스템**: `grade_definitions` 10단계 + `GRADE_INFO` 7개 등급(씨앗~다이아)으로 사용자 참여 동기 부여 구조 설계
- **팔로우 시스템**: `api/follow/route.ts` + 프로필 페이지에서 팔로워/팔로잉 카운트 표시. 소셜 기능으로 리텐션 강화 기반 마련

### 문제점
- **결제가 테스트 환경**: 토스페이먼츠가 현재 테스트 키로 운영 중. 실결제 전환 시 사업자 등록, PG 심사, 전자금융업 등록 등 법적 절차 미완료 추정
- **상품 데이터가 하드코딩**: `DEMO_PRODUCTS`가 `constants.ts`에 정적 배열로 정의. DB 기반 상품 관리/가격 변경/할인 이벤트 등 동적 운영 불가
- **수익 분석 도구 부재**: 결제 완료 후 analytics 이벤트 추적, 전환율 측정, ARPU 계산 등의 비즈니스 인텔리전스 코드가 없음
- **구독/반복 결제 미지원**: 프리미엄 멤버십(30일)이 1회성 결제로만 구현 가능. 자동 갱신, 만료 알림, 쿠폰 시스템 미구현
- **금융 서비스 면책/규제 준수**: 이용약관(`terms/page.tsx` 제5조, 제6조)에 투자 면책 조항이 있으나, 금융위원회 신고/등록 의무(투자자문업, 전자금융업) 해당 여부 법률 검토 필요

### 개선 제안
1. **사업자 등록 + 토스페이먼츠 실결제 심사 진행** (출시 전 필수, 결제 기능 포함 출시 시)
2. **상품/가격을 DB(shop_products 테이블)로 이관**: 관리자 패널에서 CRUD 가능하도록
3. **결제 전환 퍼널 추적**: 상품 조회 -> 결제 페이지 -> 결제 완료 단계별 이벤트를 Vercel Analytics 커스텀 이벤트로 추적
4. **법률 자문**: 금융정보 제공 서비스의 규제 해당 여부 + 전자상거래법 준수(청약철회, 환불정책) 확인

---

## 7. 모바일/PWA 전문가 (10점 만점)

**점수: 7/10**

### 잘된 점
- **PWA manifest 완성도**: `public/manifest.json`에 8종 아이콘(72~512px), display: standalone, orientation: portrait-primary, shortcuts 3개(피드/주식/글쓰기), categories 설정 완료
- **Web Push 전체 파이프라인**: VAPID 키 기반 Web Push 구현 완료. `api/push/subscribe`(구독), `api/push/send`(발송), `public/sw.js`(수신/표시/클릭) 전 과정 커버. 만료 구독 자동 삭제(410/404 응답 시)
- **모바일 최적화 CSS**: `globals.css` line 340-343에서 모바일 폰트 사이즈 15px, 하단 탭바 높이 보정. `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` 적용
- **safe-area-inset 대응**: 네비게이션 탭바(`Navigation.tsx` line 285), 토론방 입력창(`discussion/[type]/[roomKey]/page.tsx` line 148)에서 `env(safe-area-inset-bottom)` 적용
- **Realtime Presence**: 토론방에서 Supabase Realtime Presence API로 접속자 수 실시간 표시. 채널 기반 postgres_changes 구독으로 새 메시지 실시간 반영

### 문제점
- **Service Worker 캐시 전략 부실**: `sw.js`에서 `CACHE_NAME = 'kadeora-v1'`을 정의하지만 실제 캐시에 아무것도 저장하지 않음. `install` 이벤트에서 `skipWaiting()`만 호출. fetch 핸들러는 `fetch(e.request).catch(() => caches.match(e.request))` -- 캐시가 비어있으므로 오프라인 시 모든 요청 실패
- **manifest 아이콘이 모두 SVG**: `manifest.json`에 `"type": "image/svg+xml"` -- 일부 Android 버전과 Samsung Internet에서 SVG 아이콘을 지원하지 않음. PNG 래스터 아이콘 필요
- **sw.js 내 아이콘 경로 불일치**: line 18-19에서 `icon: '/icons/icon-192.png'`, `badge: '/icons/icon-72.png'`을 참조하지만 실제 파일은 `.svg`만 존재 -- 푸시 알림에 아이콘 표시 안 됨
- **screenshots 미설정**: `manifest.json` line 22에서 `"screenshots": []` 빈 배열. PWA 설치 프롬프트 시 스크린샷이 없어 설치 전환율 저하
- **앱 업데이트 알림 미구현**: Service Worker 버전 변경 시 사용자에게 업데이트 알림/새로고침 프롬프트가 없음

### 개선 제안
1. **SVG 아이콘 외에 PNG 아이콘 추가** -- 192x192, 512x512 필수. sw.js 내 경로도 `.png`로 맞추기 (출시 전 필수)
2. **Service Worker에 앱 셸 캐시 추가**: install 이벤트에서 오프라인 폴백 페이지 + 핵심 CSS/JS 프리캐시
3. **manifest screenshots 추가**: 모바일 피드 화면, 주식 시세 화면 등 2~3장 캡처 추가
4. **SW 업데이트 감지 및 알림**: `registration.addEventListener('updatefound')` + "새 버전이 있습니다. 새로고침하시겠습니까?" 토스트 표시

---

## 종합 평가

| 분야 | 점수 |
|------|------|
| UX/UI 디자인 | 7/10 |
| 프론트엔드 성능 | 7/10 |
| 백엔드/DB | 7/10 |
| 보안 | 7/10 |
| SEO/마케팅 | 8/10 |
| 비즈니스/수익화 | 6/10 |
| 모바일/PWA | 7/10 |
| **종합** | **49/70** |

### 출시 가능 등급: B (경미한 수정 후 출시 가능)

전체적으로 개인 또는 소규모 팀이 만든 프로젝트 치고는 **아키텍처 설계, 보안 인프라, SEO 기반이 매우 양호**합니다. Zod 검증, rate limiting, CSP 헤더, 구조화된 에러 처리 등 시니어 레벨의 엔지니어링 패턴이 적용되어 있습니다. 다만 아래 블로커 항목을 해결해야 안전한 출시가 가능합니다.

---

### 출시 전 필수 수정 (블로커)

1. **`ignoreBuildErrors: true` 제거** (`next.config.ts` line 5) -- 타입 에러가 프로덕션에 배포되는 것을 방지. 현존 타입 에러 수정 후 제거
2. **`getSession()` -> `getUser()` 전환** -- `admin/page.tsx`, `push/send/route.ts`, `push/subscribe/route.ts` 등 서버사이드 인증 코드 16개 파일 점검. JWT 검증 없이 세션 쿠키만 신뢰하는 보안 허점 제거
3. **PWA 아이콘 PNG 추가 + sw.js 경로 수정** -- 현재 SVG만 있어 Android에서 홈 화면 아이콘 및 푸시 알림 아이콘 미표시
4. **CSP `'unsafe-eval'` 제거 검토** -- 토스페이먼츠 SDK가 eval을 사용하는 경우가 아니라면 제거. nonce 기반 CSP로 전환
5. **`userScalable: false` 제거** (`layout.tsx` line 49) -- 접근성 규정 위반 + SEO 감점 요소

### 출시 후 개선 권장

1. **인라인 스타일 -> Tailwind 마이그레이션**: Navigation.tsx 우선, 점진적 리팩토링
2. **stock-sync batch upsert 최적화**: 101회 개별 update -> 2회 batch upsert
3. **검색 Full-text Search 도입**: Supabase `to_tsvector` + `ts_rank` 활용하여 `ilike` 대체
4. **not-found.tsx 글로벌 404 페이지 추가**
5. **상품 데이터 DB 이관 + 관리자 패널 확장**
6. **Service Worker 오프라인 캐시 전략 구현**
7. **한글 웹폰트 next/font 최적화 로딩**
8. **결제 기능 출시 시 사업자 등록 + 전자상거래법 준수 점검**
9. **manifest screenshots 추가 + 앱 업데이트 알림 구현**
10. **dynamic import 확대**: PaymentClient, AdminClient, ReportModal 등 조건부 로드 컴포넌트
