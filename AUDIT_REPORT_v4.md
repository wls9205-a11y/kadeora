# 카더라 웹앱 전문가 감사 보고서 v4

> 평가일: 2026-03-17 | 대상: kadeora.app | v3 대비 개선 반영
> 코드베이스: ~9,200 LOC, 22 페이지, 22 컴포넌트, 20 API 라우트

---

## 1. 프론트엔드 아키텍처 -- 81/100

### 현재 상태 (코드 근거)
- Next.js App Router, Server/Client Component 분리 적용
- 에러 바운더리 7개 + ErrorBoundary 클래스 컴포넌트 (`src/components/ErrorBoundary.tsx`)
- 로딩 스켈레톤 6개 (main, feed, stock, apt, discuss, grades)
- EmptyState 공통 컴포넌트 (`src/components/EmptyState.tsx`)
- 커스텀 404 페이지 (`src/app/not-found.tsx`)
- FontSizeToggle: 3단계 글씨 크기 조절 (`src/components/FontSizeToggle.tsx`)

### v3 대비 개선된 점
- `ErrorBoundary.tsx` 클래스 컴포넌트 추가 -- 컴포넌트 트리 레벨 에러 캐치 가능
- `EmptyState.tsx` 공통 컴포넌트 -- 빈 목록 상태의 일관된 UI
- `FontSizeToggle.tsx` -- 접근성 향상 (시력 약한 사용자 대응)
- 타입 시스템이 체계적: Zod 스키마 7개 (`src/lib/schemas.ts`), 인터페이스 활용

### 잘된 점
- Server/Client Component 경계 명확. `feed/[id]/page.tsx`는 SSR, 댓글/좋아요는 클라이언트
- `generateMetadata` + JSON-LD 동적 생성
- 에러 바운더리 7개로 섹션별 독립적 에러 격리
- ErrorBoundary 클래스 컴포넌트가 `fallback` prop과 `reset` 버튼 지원

### 남은 문제
- **[Med] 인라인 스타일 남용**: ErrorBoundary, EmptyState, FontSizeToggle 등 신규 컴포넌트도 여전히 `style={{}}` 인라인 패턴. `globals.css`의 클래스 시스템과 불일치 지속
- **[Med] StockClient.tsx 비대화**: 단일 컴포넌트에 필터/정렬/환율/렌더링 모두 포함. 서브 컴포넌트 분리 필요
- **[Low] view_count Race Condition**: `feed/[id]/page.tsx`에서 `post.view_count + 1` 패턴. Supabase RPC increment 권장

---

## 2. 백엔드/데이터 설계 -- 79/100

### 현재 상태 (코드 근거)
- API 20개, Zod 입력 검증 (`src/lib/schemas.ts`), 환경변수 Zod 검증 (`src/lib/env.ts`)
- Health API (`/api/health`) -- DB 연결 + 응답 지연시간 모니터링
- Web Push API 2개 (`/api/push/send`, `/api/push/subscribe`)
- Rate limiting 3티어: api(30/분), auth(5/분), search(20/분)

### v3 대비 개선된 점
- **GET /api/payment 인증 완성** (`payment/route.ts:92-96`): `getUser(token)` 호출로 실제 토큰 검증. v3의 최대 블로커 해소
- **환경변수 Zod 검증** (`src/lib/env.ts`): 서버/클라이언트 분리, lazy validation, 누락 시 명시적 에러
- **Zod 스키마 입력 검증** (`src/lib/schemas.ts`): Post, Comment, Payment, Search, Report 등 7개 스키마
- **Push 알림 API**: 관리자 인증 + `is_admin` 체크, 만료 구독 자동 삭제

### 잘된 점
- 결제 POST: 인증 + 금액 서버 검증 + 토스 승인 + 후처리 (프리미엄 배지, 닉네임 변경권)
- 결제 GET: `getUser(token)` 검증 완료
- Health API: latency_ms, 버전 해시, degraded 상태 구분
- `parseInput()` 헬퍼로 Zod 검증 결과를 Result 타입으로 반환
- Push send API: 관리자만 발송 가능, 앱 내 알림 + Web Push 병렬 처리

### 남은 문제
- **[Med] shop_orders insert 실패 무시**: `payment/route.ts:52-58` -- `try-catch`로 `console.warn`만. 결제 성공인데 주문 기록 누락 가능
- **[Med] nickname_change_tickets Race Condition**: SELECT 후 UPDATE 패턴. RPC increment 필요
- **[Med] Zod 스키마 미적용 라우트 존재**: `payment/route.ts`의 POST가 `PaymentCreateSchema`를 import하지 않고 수동 검증. 스키마 정의는 있으나 실제 사용이 불완전
- **[Low] push/send에서 getSession() 사용**: `getUser()` 대신 `getSession()` 사용. 보안 권장사항상 `getUser()` 사용 필요

---

## 3. 보안 -- 82/100

### 현재 상태 (코드 근거)
- 미들웨어 5중 보안: 봇 차단 → SSRF 방어 → 인증 리다이렉트 → 온보딩 강제 → CSP 삽입
- 입력 새니타이즈: `src/lib/sanitize.ts` (XSS, SQL injection, LIKE wildcard)
- Rate limiting: Upstash Redis + 메모리 폴백

### v3 대비 개선된 점
- **GET /api/payment 토큰 검증 완료**: v3의 핵심 블로커였던 IDOR 취약점 해소
- **CSP 미들웨어 동적 삽입**: `middleware.ts:76-88` -- nonce 기반 CSP를 미들웨어에서 동적 생성. v3에서 "CSP 미설정"으로 감점된 부분 해소
- **환경변수 Zod 검증**: process.env! 단언 대신 스키마 기반 검증 추가

### 잘된 점
- 결제 인증: POST/GET 모두 Bearer 토큰 + `getUser()` 검증 완료
- 금액 서버 검증: `shop_products.price_krw`와 클라이언트 amount 비교
- SSRF 차단: private IP 정규식 + 도메인 화이트리스트
- 봇 차단: `.env`, `.git`, `wp-admin` 등 알려진 취약 경로 404
- CSP: `next.config.ts` 정적 + `middleware.ts` 동적, 이중 적용
- 보안 헤더 9개: HSTS, X-Frame-Options, COOP, CORP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control, X-Permitted-Cross-Domain-Policies
- sanitizeSearchQuery: SQL 키워드 제거, 특수문자 제거, LIKE 와일드카드 이스케이프
- sanitizePostInput: XSS 벡터 제거 (script, iframe, on* 이벤트, javascript: 등)

### 남은 문제
- **[Med] GuestGate 클라이언트 사이드 전용**: `kd_pv` 쿠키를 DevTools에서 삭제하면 무제한 열람
- **[Med] CSRF 보호 부재**: 상태 변경 POST에 CSRF 토큰 없음. SameSite 쿠키에 의존
- **[Low] push/send, push/subscribe에서 getSession()**: `getUser()` 대신 사용. JWT 위변조 위험은 낮으나 Supabase 공식 권장 패턴 준수 필요
- **[Low] CSP에 'unsafe-inline' 'unsafe-eval' 허용**: 다크모드 인라인 스크립트와 토스 SDK 때문. nonce 기반 전환 권장

---

## 4. UI/UX 디자인 -- 82/100

### 현재 상태 (코드 근거)
- CSS 변수 기반 완전한 다크/라이트 모드 (60+ 변수)
- 모바일 퍼스트 반응형, 하단 탭바 + 상단 네비게이션
- `safe-area-inset-bottom` 적용
- 햅틱 피드백 (`useHaptic` 훅 + CSS scale 애니메이션)

### v3 대비 개선된 점
- **EmptyState 공통 컴포넌트**: 빈 목록 상태의 일관된 UI (아이콘 + 제목 + 설명 + 액션 버튼)
- **FontSizeToggle**: 시각 접근성 향상 (작게 13px / 보통 15px / 크게 17px)
- **AdminPushNotification**: 관리자 브로드캐스트 UI, CSS 변수 사용
- **커스텀 404**: not-found.tsx 추가, 브랜드 일관성 유지

### 잘된 점
- 디자인 토큰 시스템: `--bg-base` > `--bg-surface` > `--bg-sunken` 3단계 명도 계층
- 주식 색상 전용 변수: `--stock-up`, `--stock-down`
- 모바일 탭바: 6개 탭 균등 배분, safe-area 대응
- 다크모드 플리커 방지: `<script>` 인라인으로 FOUC 차단
- 반응형 검색바: 데스크탑 인라인 / 모바일 아이콘 전환
- 스켈레톤 로딩: shimmer 애니메이션

### 남은 문제
- **[Med] 주식 테이블 모바일**: `minWidth: 500` 고정, 모바일에서 가로 스크롤 필수. 주요 정보만 보여주는 모바일 레이아웃 필요
- **[Med] 인라인 스타일과 CSS 클래스 혼재**: `globals.css`에 `.card`, `.btn-primary` 존재하나 컴포넌트에서 미사용
- **[Low] 알림 배지 접근성**: `aria-label`에 동적 카운트 미반영
- **[Low] ESC 키로 드롭다운 닫기 미구현**: Navigation 메뉴

---

## 5. 성능 최적화 -- 73/100

### 현재 상태 (코드 근거)
- SSR 활용, `next/image` 최적화, Rate limiting으로 서버 보호
- Upstash Redis 캐싱 인프라 구축

### v3 대비 개선된 점
- **Rate limiting 3티어**: api/auth/search 별도 한도로 API 남용 방지
- **Redis 캐싱 인프라**: Upstash Redis 연동, 메모리 폴백 (서버리스 환경 대응)
- **Health API**: 서버 상태 + 지연시간 모니터링

### 잘된 점
- `feed/[id]/page.tsx`: Server Component SSR로 TTFB 최적화
- `next/image`: `sizes` 반응형 + avif/webp 자동 포맷 최적화
- `next.config.ts:19`: `formats: ["image/avif", "image/webp"]` 설정
- 5분 간격 주식 자동 갱신 (불필요한 실시간 폴링 방지)
- Turbopack 개발 서버 (`next dev --turbopack`)

### 남은 문제
- **[High] Navigation 매 페이지 전환마다 세션 재확인**: `useEffect`에서 getSession → profiles + notifications 쿼리. SWR/전역 상태 캐싱 필요
- **[High] 환율 API 매번 호출**: `https://open.er-api.com/v6/latest/USD`를 컴포넌트 마운트마다 호출. 하루 1번 캐싱이면 충분
- **[Med] 댓글 100개 하드코딩 제한**: 페이지네이션/무한 스크롤 없음
- **[Low] StockClient 전체 리렌더링**: `refresh` 시 전체 배열 교체, `React.memo` 미적용

---

## 6. SEO/마케팅 -- 85/100

### 현재 상태 (코드 근거)
- 동적 메타데이터, JSON-LD, OG 이미지, sitemap.ts, robots.ts 완비
- 크롤러 감지를 통한 GuestGate 예외 처리

### v3 대비 개선된 점
- **sitemap.ts 추가**: 정적 9개 + 동적 게시글 200개 자동 생성 (`src/app/sitemap.ts`)
- **robots.ts 추가**: `/api/`, `/admin/`, `/payment/` 등 크롤링 차단, sitemap URL 명시 (`src/app/robots.ts`)
- v3에서 "sitemap/robots 미확인"으로 감점된 부분 완전 해소

### 잘된 점
- 동적 OG: 게시글별 title, description, OG image, Twitter card 자동 생성
- JSON-LD: WebApplication 스키마 (루트 레이아웃) + Article 스키마 (게시글 상세)
- sitemap: Supabase에서 최신 200개 게시글 동적 반영, `changeFrequency`/`priority` 설정
- robots: 민감 경로 차단, sitemap 연결
- `layout.tsx`: metadataBase, canonical URL, alternates, keywords 완비
- 크롤러 우대: GuestGate에서 봇 User-Agent 감지 시 콘텐츠 접근 허용

### 남은 문제
- **[Med] 주식 페이지 SEO**: 전체 `'use client'`, 종목별 상세 페이지 없음 -- 롱테일 키워드 유입 불가
- **[Low] canonical URL 게시글별 미설정**: `openGraph.url`은 있으나 `alternates.canonical` 명시 부재
- **[Low] sitemap 게시글 200개 제한**: 게시글 증가 시 동적 sitemap index 분할 필요

---

## 7. 출시 준비도 -- 78/100

### 현재 상태 (코드 근거)
- 핵심 기능 6개 섹션 완비 (피드, 주식, 청약, 토론, 상점, 등급)
- 결제 보안 완성 (POST/GET 모두 인증 + 금액 검증)
- PWA + Web Push + 관리자 브로드캐스트
- 커스텀 404, 에러 바운더리 7개, 로딩 스켈레톤 6개

### v3 대비 개선된 점
- **GET /api/payment 인증 완성**: v3 최대 블로커 해소. 출시 조건부 → 가능으로 전환
- **환경변수 부팅 검증**: `src/lib/env.ts` -- Zod 스키마 기반, 누락 시 명시적 에러
- **입력 검증 체계화**: Zod 스키마 7개, sanitize 함수 5개
- **커스텀 404 페이지**: `not-found.tsx` 추가
- **Web Push 완성**: VAPID 키 기반 브라우저 푸시, 만료 구독 자동 삭제

### 잘된 점
- 결제 시스템 완성: 인증 + 금액 검증 + 후처리 + 주문 기록
- 게스트 제한(5회 무료 열람) 마케팅 퍼널
- 온보딩 강제 (미들웨어 레벨)
- 관리자 패널 + 푸시 브로드캐스트
- Sentry 통합 준비 (`@sentry/nextjs` 설치, `withSentryConfig` 적용)
- Vercel Analytics + Speed Insights 패키지 포함

### 남은 문제
- **[Med] Sentry DSN 미등록**: `@sentry/nextjs` 설치 + config 적용되었으나 실제 DSN 미설정. 프로덕션 에러 트래킹 불가
- **[Med] KIS API 키 미등록**: 주식 실시간 갱신 불가. Yahoo Finance 폴백에 의존
- **[Med] TOSS_SECRET_KEY 테스트키**: 라이브 전환 필요
- **[Low] 테스트 코드 부재**: `vitest`, `@playwright/test` 의존성은 있으나 실제 테스트 파일 미확인
- **[Low] 데모 데이터 폴백**: DB 오류 시 데모 데이터 노출 가능

---

## 종합

| 영역 | v3 점수 | v4 점수 | 변동 |
|------|---------|---------|------|
| 프론트엔드 아키텍처 | 78 | 81 | +3 |
| 백엔드/데이터 설계 | 72 | 79 | +7 |
| 보안 | 74 | 82 | +8 |
| UI/UX 디자인 | 80 | 82 | +2 |
| 성능 최적화 | 70 | 73 | +3 |
| SEO/마케팅 | 82 | 85 | +3 |
| 출시 준비도 | 71 | 78 | +7 |

- **총점: 560/700**
- **v3 대비: +33점** (527 -> 560)
- **등급: A-**
- **출시 가능: YES (조건 해소)**

v3의 최대 블로커였던 GET /api/payment 인증 미완성이 해소되었다. 조건부 출시에서 출시 가능으로 상향.

---

## v3 대비 주요 개선 요약

| 항목 | v3 상태 | v4 상태 |
|------|---------|---------|
| GET /api/payment 인증 | authHeader 존재만 확인 (블로커) | getUser(token) 검증 완료 |
| CSP 헤더 | 미설정 | 미들웨어 동적 삽입 + next.config 정적 |
| sitemap.xml | 미확인 | 정적 9개 + 동적 200개 자동 생성 |
| robots.txt | 미확인 | 민감 경로 차단, sitemap 연결 |
| 환경변수 검증 | process.env! 단언 | Zod 스키마 검증 (env.ts) |
| 입력 검증 | 수동 if 체크 | Zod 스키마 7개 (schemas.ts) |
| 에러 바운더리 | 7개 (route level) | 7개 + ErrorBoundary 클래스 컴포넌트 |
| 빈 상태 UI | 없음 | EmptyState 공통 컴포넌트 |
| 404 페이지 | 기본 Next.js | 커스텀 not-found.tsx |
| Web Push | 미완성 | VAPID 기반 완성 + 만료 구독 삭제 |
| 글씨 크기 | 고정 | FontSizeToggle 3단계 |

---

## 남은 개선 사항 (우선순위별)

### P1 -- 출시 직후 1주 내
| 항목 | 파일 | 예상 시간 |
|------|------|-----------|
| Sentry DSN 등록 + 에러 트래킹 활성화 | Vercel 환경변수 | 30분 |
| TOSS_SECRET_KEY 라이브 전환 | Vercel 환경변수 | 1시간 |
| Navigation 세션 캐싱 (SWR/Context) | Navigation.tsx | 3시간 |
| 환율 API 캐싱 (localStorage + TTL) | StockClient.tsx | 1시간 |

### P2 -- 출시 후 1개월 내
| 항목 | 파일 | 예상 시간 |
|------|------|-----------|
| shop_orders insert 실패 재시도/알림 | payment/route.ts | 1시간 |
| nickname_change_tickets RPC increment | payment/route.ts | 30분 |
| Zod 스키마 실제 적용 (payment POST 등) | payment/route.ts | 1시간 |
| push API에서 getUser() 전환 | push/send, push/subscribe | 30분 |
| 주식 테이블 모바일 레이아웃 | StockClient.tsx | 2시간 |
| 인라인 스타일 -> CSS 클래스 마이그레이션 | 전체 | 8시간 |
| 댓글 페이지네이션/무한 스크롤 | feed/[id]/page.tsx | 3시간 |

### P3 -- 3개월 내
| 항목 | 파일 | 예상 시간 |
|------|------|-----------|
| GuestGate 서버 사이드 강화 | middleware.ts | 2시간 |
| CSRF 토큰 도입 | 전체 API | 4시간 |
| CSP unsafe-inline/unsafe-eval 제거 | middleware.ts, layout.tsx | 4시간 |
| 주식 종목별 상세 페이지 (SEO) | 신규 | 8시간 |
| 테스트 코드 작성 (vitest + playwright) | 신규 | 16시간 |
| StockClient 컴포넌트 분리 + React.memo | StockClient.tsx | 3시간 |
| sitemap 동적 index 분할 | sitemap.ts | 2시간 |

---

> **핵심 요약**: v3의 최대 블로커(GET /api/payment 인증)가 해소되어 출시 가능 상태로 전환. CSP 미들웨어 동적 삽입, sitemap/robots 자동 생성, 환경변수 Zod 검증, Zod 입력 스키마, ErrorBoundary 클래스 컴포넌트, EmptyState, 커스텀 404 등 전반적 품질 향상. 보안이 v3 대비 가장 크게 개선(+8점). 인라인 스타일 남용과 Navigation 세션 캐싱은 기술 부채로 남아있으나 출시를 막는 수준은 아니다. Sentry DSN 등록과 토스 라이브키 전환을 출시 직후 즉시 처리할 것.
