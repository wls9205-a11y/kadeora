# 카더라 웹앱 전문가 감사 보고서 v3

> 평가일: 2026-03-17 | 대상: kadeora.app | v2 대비 개선 상태 포함
> 감사 대상 파일: 9개 핵심 파일 코드 리뷰 기반

---

## 1. 프론트엔드 아키텍처 -- 78/100

### 현재 상태 (코드 근거)
- Next.js App Router 기반, Server Component와 Client Component 분리 적용
- `layout.tsx:14-35` -- 서버 컴포넌트에서 `getUser()` 호출 후 `GuestGate`에 전달하는 구조. 인증 상태를 서버에서 결정하므로 hydration 불일치 위험 낮음
- `feed/[id]/page.tsx:69-104` -- 게시글 상세는 Server Component로 SSR, 댓글/좋아요는 Client Component로 분리. 올바른 패턴
- `StockClient.tsx:1` -- `'use client'` 선언, 주식 페이지 전체가 클라이언트 렌더링
- `Navigation.tsx:1-69` -- 클라이언트 컴포넌트에서 `useEffect`로 세션+프로필+알림 3개 쿼리 동시 실행

### 잘된 점
- Server/Client Component 경계가 명확. 데이터 페칭은 서버, 인터랙션은 클라이언트
- `generateMetadata` 함수로 동적 OG 메타데이터 생성 (`feed/[id]/page.tsx:29-67`)
- JSON-LD 구조화 데이터 삽입 (`feed/[id]/page.tsx:126-154`)
- 타입 정의가 체계적 (`PostWithProfile`, `CommentWithProfile` 등 인터페이스 활용)
- `GuestGate` 컴포넌트로 비로그인 사용자 접근 제어를 레이아웃 레벨에서 처리

### 문제점

**[High] 인라인 스타일 남용**
- `feed/[id]/page.tsx`, `StockClient.tsx`, `Navigation.tsx` 전체에 걸쳐 `style={{...}}` 패턴이 지배적
- `globals.css`에 `.card`, `.btn-primary` 등 클래스 시스템이 이미 존재하나 실제 컴포넌트에서 거의 사용하지 않음
- 결과: 번들 크기 증가, 스타일 재사용 불가, 유지보수 난이도 상승
- 예시: `Navigation.tsx:95-100` 헤더 스타일이 인라인, `globals.css:268-281` `.nav-bar` 클래스가 별도 존재하나 미사용

**[Med] StockClient.tsx 컴포넌트 비대화**
- `StockClient.tsx` -- 314줄 단일 컴포넌트에 필터링, 정렬, 환율 변환, 테이블 렌더링 모두 포함
- 헤더, 필터바, 테이블 행 등을 서브 컴포넌트로 분리 필요

**[Med] Navigation.tsx 드롭다운 메뉴 외부 클릭 처리**
- `Navigation.tsx:310` -- overlay div로 외부 클릭 감지하나, ESC 키 핸들링 없음
- 접근성 측면에서 `useRef` + `useEffect` 기반 포커스 트랩 필요

**[Low] view_count 증가 로직의 Race Condition**
- `feed/[id]/page.tsx:91` -- `post.view_count + 1`로 업데이트하는데, 동시 접근 시 카운트 유실 가능
- Supabase RPC나 `increment` 함수 사용 권장

### v2 대비 개선된 점
- `GuestGate` 컴포넌트 신규 추가로 비로그인 사용자 흐름 체계화
- `layout.tsx`에서 `getUser()` (v2의 `getSession()` 대비 보안 강화)
- JSON-LD 구조화 데이터, OG 이미지 동적 생성 추가

---

## 2. 백엔드/데이터 설계 -- 72/100

### 현재 상태 (코드 근거)
- Supabase를 BaaS로 활용, 서버/클라이언트 분리된 Supabase 클라이언트 구성
- `payment/route.ts:1-84` -- 토스페이먼츠 결제 승인 API, 서비스 롤 키 사용
- `stock-refresh/route.ts:1-30` -- KIS OpenAPI 토큰 발급, rate limiting 적용
- `middleware.ts:1-30` -- SSRF 방어, 봇 차단, 보호 경로 정의

### 잘된 점
- 결제 API에 인증 검증 + 금액 서버 검증 이중 체크 (`payment/route.ts:15-41`)
- `stock-refresh/route.ts:3` -- rate limiting 라이브러리 적용
- `middleware.ts:6-8` -- SSRF 방어를 위한 private IP 차단, 허용 도메인 화이트리스트
- `middleware.ts:13-15` -- 봇 경로(`.env`, `.git`, `wp-admin`) 차단
- 결제 후처리(프리미엄 배지, 닉네임 변경권)가 서버에서 처리 (`payment/route.ts:61-75`)

### 문제점

**[High] 결제 GET 엔드포인트 인증 불완전**
- `payment/route.ts:86-104` -- GET 핸들러에서 `Authorization` 헤더 존재 여부만 확인하고 실제 토큰 검증(getUser)을 하지 않음
- 아무 문자열이나 Authorization 헤더에 넣으면 통과됨
- 타인의 `orderId`로 결제 정보 조회 가능한 IDOR 취약점

**[Med] shop_orders insert 실패 무시**
- `payment/route.ts:52-58` -- `try-catch`로 주문 기록 실패를 `console.warn`으로만 처리
- 결제는 성공했으나 주문 기록이 누락되면 CS 대응 불가

**[Med] nickname_change_tickets Race Condition**
- `payment/route.ts:68-70` -- SELECT 후 UPDATE 패턴으로 동시 결제 시 티켓 수 유실 가능
- Supabase RPC 또는 SQL `increment` 사용 필요

**[Low] stock-refresh에서 KIS 토큰 캐싱 전략 미확인**
- `stock-refresh/route.ts:13-29` -- 매 요청마다 토큰 발급 시도 가능성 (전체 코드 미확인이나 함수 구조상 캐싱 로직 부재 추정)

### v2 대비 개선된 점
- 결제 API에 `Authorization` 헤더 인증 추가 (`payment/route.ts:15-24`)
- 서버 측 금액 검증 로직 추가 (`payment/route.ts:28-41`) -- v2의 가장 큰 블로커였던 금액 위변조 취약점 해소
- SSRF 방어 미들웨어 추가

---

## 3. 보안 -- 74/100

### 현재 상태 (코드 근거)
- 결제 보안 대폭 강화 (v2의 핵심 블로커 해결)
- 미들웨어 레벨 보안 계층 추가

### 잘된 점
- **결제 인증**: `payment/route.ts:15-24` -- Bearer 토큰으로 `getUser()` 호출, 실제 사용자 검증
- **금액 검증**: `payment/route.ts:28-41` -- `shop_products` 테이블의 `price_krw`와 클라이언트 전송 `amount` 비교
- **SSRF 차단**: `middleware.ts:6,22-23` -- private IP 정규식 + 도메인 화이트리스트
- **봇 차단**: `middleware.ts:8,13-15` -- 알려진 취약 경로 404 반환
- **서비스 롤 키 서버 전용**: `payment/route.ts:5` -- `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드 전용
- **GuestGate 크롤러 예외**: `GuestGate.tsx:16-21` -- 봇 User-Agent 감지하여 콘텐츠 접근 허용 (SEO 보호)

### 문제점

**[High] GET /api/payment 토큰 미검증 (재강조)**
- `payment/route.ts:88-91` -- `authHeader` 존재 여부만 확인, `getUser()` 호출 없음
- POST는 완벽하게 수정되었으나 GET은 여전히 취약

**[Med] GuestGate 클라이언트 사이드 전용 제한**
- `GuestGate.tsx:23-34` -- 쿠키 기반 페이지뷰 카운트가 클라이언트 JS로만 동작
- DevTools에서 `kd_pv` 쿠키를 삭제하면 무제한 열람 가능
- 핵심 콘텐츠 보호가 목적이라면 미들웨어 또는 서버 레벨 제한 필요

**[Med] CSRF 보호 부재**
- 결제 API 등 상태 변경 POST 요청에 CSRF 토큰 검증 없음
- Next.js의 `SameSite` 쿠키 정책에 의존하는 구조

**[Low] Content-Security-Policy 미설정**
- `dangerouslySetInnerHTML` 사용 (`feed/[id]/page.tsx:154`) -- JSON-LD이므로 XSS 위험은 낮으나 CSP 헤더 추가 권장

### v2 대비 개선된 점
- 결제 금액 위변조 취약점 완전 해소 (v2 최대 블로커)
- Bearer 토큰 기반 사용자 인증 추가
- SSRF 방어 미들웨어 신규
- 봇 경로 차단 신규

---

## 4. UI/UX 디자인 -- 80/100

### 현재 상태 (코드 근거)
- CSS 변수 기반 완전한 다크/라이트 모드 시스템
- 모바일 퍼스트 반응형, 하단 탭바 + 상단 네비게이션

### 잘된 점
- **디자인 토큰 시스템**: `globals.css:12-92` -- 60개 이상의 CSS 변수로 라이트/다크 모드 완전 분리
- **3단계 명도차**: `--bg-base` > `--bg-surface` > `--bg-sunken` 계층 구조로 시각적 깊이 표현
- **모바일 탭바**: `Navigation.tsx:283-308` -- `safe-area-inset-bottom` 적용, 6개 탭 균등 배분
- **반응형 검색바**: 데스크탑은 인라인, 모바일은 아이콘 버튼 (`Navigation.tsx:117-155`)
- **주식 색상 시스템**: `globals.css:41-43` -- `--stock-up`, `--stock-down` 전용 변수
- **접근성 기본**: `globals.css:383` -- `focus-visible` 전역 스타일, `aria-current` 속성 사용 (`Navigation.tsx:138`)
- **햅틱 피드백**: `globals.css:253-263` -- 버튼 터치 시 `scale(0.97)` 애니메이션
- **스켈레톤 로딩**: `globals.css:357-366` -- shimmer 애니메이션 정의

### 문제점

**[Med] 주식 테이블 모바일 가독성**
- `StockClient.tsx:216` -- `gridTemplateColumns: '40px 1fr 100px 100px 70px'` 고정, `minWidth: 500`
- 모바일에서 가로 스크롤 필요 -- 주요 정보(종목명, 현재가)만 보여주는 모바일 레이아웃 필요

**[Med] 인라인 스타일과 CSS 클래스 혼재**
- `globals.css`에 `.card`, `.btn-primary`, `.feed-card` 등 재사용 클래스 정의
- 실제 컴포넌트에서는 `style={{}}` 인라인만 사용하여 시스템 불일치

**[Low] 다크모드 강제 오버라이드의 취약성**
- `globals.css:113-131` -- `[style*="background-color: white"]` 패턴은 인라인 스타일 문자열 매칭에 의존
- `background-color: #FFFFFF`(대문자)나 `rgb(255,255,255)` 변형을 놓칠 수 있음

**[Low] 알림 배지 접근성**
- `Navigation.tsx:184-195` -- 알림 카운트가 시각적으로만 표시, `aria-label`에 동적 카운트 미반영

### v2 대비 개선된 점
- 통합 디자인 토큰 시스템 도입 (v2에서 하드코딩된 색상 제거)
- 다크모드 완전 지원 (60+ CSS 변수)
- 버튼 시스템 통일 (`.btn-primary`, `.btn-secondary`)
- 모바일 safe-area 대응 강화

---

## 5. 성능 최적화 -- 70/100

### 현재 상태 (코드 근거)
- SSR 활용, 이미지 최적화 부분 적용

### 잘된 점
- `feed/[id]/page.tsx` -- Server Component로 초기 렌더링 서버 수행, TTFB 최적화
- `feed/[id]/page.tsx:218-225` -- `next/image` 사용, `sizes` 반응형 속성, `priority` 플래그 적용
- `StockClient.tsx:89` -- 5분 간격 자동 갱신, 불필요한 실시간 폴링 방지
- `globals.css:107` -- `body`에 `transition: background-color 0.2s` -- 테마 전환 시 부드러운 전환

### 문제점

**[High] Navigation.tsx 초기 로딩 3개 쿼리 직렬/병렬 혼재**
- `Navigation.tsx:48-58` -- `getSession()` 후 `Promise.all`로 profiles + notifications 병렬 호출
- 그러나 매 페이지 전환마다 `useEffect`가 세션 재확인 -- SWR이나 전역 상태로 캐싱하면 불필요한 호출 제거 가능

**[High] StockClient.tsx 환율 API 매번 호출**
- `StockClient.tsx:66-71` -- 컴포넌트 마운트마다 `https://open.er-api.com/v6/latest/USD` 호출
- 환율은 하루 1번 변동이므로 서버 캐싱 또는 `localStorage` + TTL 필요

**[Med] 댓글 100개 제한이지만 페이지네이션 없음**
- `feed/[id]/page.tsx:99` -- `.limit(100)` 하드코딩
- 인기 게시글에서 100개 초과 댓글 조회 불가, 무한 스크롤 또는 페이지네이션 필요

**[Med] CSS 번들 비효율**
- `globals.css:113-180` -- 다크모드 강제 오버라이드가 67줄 차지, 실제 인라인 스타일 사용 시에만 필요한 핵 코드
- 컴포넌트가 CSS 변수를 직접 사용하면 이 오버라이드 전체 불필요

**[Low] 주식 데이터 전체 리렌더링**
- `StockClient.tsx:74-85` -- `refresh` 시 전체 `stocks` 배열 교체, `React.memo` 미적용

### v2 대비 개선된 점
- `next/image`의 `sizes` 속성으로 반응형 이미지 최적화
- Navigation에서 프로필+알림 병렬 쿼리 (`Promise.all`)

---

## 6. SEO/마케팅 -- 82/100

### 현재 상태 (코드 근거)
- 동적 메타데이터, 구조화 데이터, OG 이미지 자동 생성

### 잘된 점
- **동적 OG**: `feed/[id]/page.tsx:29-67` -- 게시글별 title, description, OG image, Twitter card 자동 생성
- **OG 이미지 API**: `feed/[id]/page.tsx:44` -- `/api/og?title=...&author=...` 동적 OG 이미지 엔드포인트
- **JSON-LD**: `feed/[id]/page.tsx:126-147` -- Article 스키마, publisher, datePublished 등 검색엔진 최적화
- **레이아웃 메타데이터**: `layout.tsx:7-12` -- 템플릿 기반 title, 키워드, locale 설정
- **크롤러 우대**: `GuestGate.tsx:16-21` -- 봇 User-Agent 감지 시 GuestGate 비활성화하여 크롤링 허용

### 문제점

**[Med] 주식 페이지 SEO 부재**
- `StockClient.tsx` -- 전체가 `'use client'`, Server Component 래퍼에서 메타데이터 설정 여부 미확인
- 주식 종목별 페이지가 없어 롱테일 키워드 유입 불가

**[Med] 토론 링크 404 가능성**
- `StockClient.tsx:284` -- `/discussion/stock/${s.symbol}` 링크가 존재하나 해당 라우트 존재 미확인

**[Low] sitemap.xml / robots.txt 미확인**
- 감사 대상 파일에 포함되지 않아 존재 여부 판단 불가

**[Low] canonical URL 미설정**
- `feed/[id]/page.tsx` -- `openGraph.url`은 있으나 `<link rel="canonical">` 별도 미설정

### v2 대비 개선된 점
- JSON-LD 구조화 데이터 완전 신규
- 동적 OG 이미지 생성 API 추가
- Twitter Card 메타데이터 추가
- 크롤러 감지를 통한 GuestGate 예외 처리

---

## 7. 출시 준비도 -- 71/100

### 현재 상태 (코드 근거)
- 핵심 기능 구현 완료, 결제-보안 기본 체계 수립
- PWA + 웹 푸시 알림 지원 (최근 커밋 이력)
- 관리자 패널 존재

### 잘된 점
- 결제 시스템 토스페이먼츠 연동 완료, 인증+금액 검증 적용
- 게스트 제한(5회 무료 열람) 마케팅 퍼널 구현
- 피드, 주식, 부동산, 토론, 상점, 등급 -- 6개 주요 섹션 라우팅 완비 (`Navigation.tsx:9-16`)
- 다크/라이트 테마 완전 지원
- 모바일 PWA 대응

### 문제점

**[High] GET /api/payment 인증 미완성 (블로커)**
- 운영 환경에서 결제 정보 노출 위험. 배포 전 반드시 수정 필요

**[Med] 에러 처리 사용자 피드백 부족**
- `feed/[id]/page.tsx:102-104` -- DB 오류 시 빈 catch로 데모 데이터 폴백, 사용자에게 오류 상황 미통지
- `StockClient.tsx:83` -- 주식 새로고침 실패 시 빈 catch, 사용자 알림 없음

**[Med] 환경 변수 검증 부재**
- `payment/route.ts:4-6` -- `!` 단언으로 환경 변수 존재 가정, 런타임 에러 가능
- 앱 부팅 시 환경 변수 검증 로직 필요

**[Low] 데모 데이터와 실제 데이터 혼재**
- `feed/[id]/page.tsx:106-122` -- DB 조회 실패 시 `DEMO_POSTS` 폴백
- 프로덕션에서 데모 데이터 노출은 사용자 혼란 유발

### v2 대비 개선된 점
- PWA + 웹 푸시 알림 시스템 추가
- 관리자 패널 + 브로드캐스트 UI 추가
- GuestGate로 전환 퍼널 구축

---

## 종합

| 영역 | 점수 | v2 추정 | 변동 |
|------|------|---------|------|
| 프론트엔드 아키텍처 | 78 | 68 | +10 |
| 백엔드/데이터 설계 | 72 | 55 | +17 |
| 보안 | 74 | 42 | +32 |
| UI/UX 디자인 | 80 | 65 | +15 |
| 성능 최적화 | 70 | 62 | +8 |
| SEO/마케팅 | 82 | 58 | +24 |
| 출시 준비도 | 71 | 50 | +21 |

- **총점: 527/700**
- **v2 대비: +127점** (400 -> 527 추정)
- **등급: B+**
- **출시 가능: CONDITIONAL**

조건: GET /api/payment 토큰 검증 수정 완료 시 출시 가능

---

## 즉시 수정 필요 (블로커)

1. **GET /api/payment 인증 완성** (`payment/route.ts:86-104`)
   - `authHeader` 존재 확인만으로는 부족. POST와 동일하게 `getUser(token)` 검증 추가
   - 추가로 `orderId`가 해당 사용자의 주문인지 소유권 확인 필요
   ```
   수정 위치: src/app/api/payment/route.ts:86-104
   예상 작업량: 15분
   ```

2. **shop_orders insert 실패 처리 강화** (`payment/route.ts:52-58`)
   - 결제 승인 성공 후 주문 기록 실패 시 최소 재시도 1회 또는 알림 발송
   ```
   수정 위치: src/app/api/payment/route.ts:52-58
   예상 작업량: 30분
   ```

---

## 출시 전 권고

| 우선순위 | 항목 | 파일 | 예상 시간 |
|----------|------|------|-----------|
| P1 | 주식 테이블 모바일 레이아웃 | StockClient.tsx:216 | 2h |
| P1 | Navigation 세션 캐싱 (SWR/Context) | Navigation.tsx:46-69 | 3h |
| P1 | 환율 API 캐싱 | StockClient.tsx:66-71 | 1h |
| P2 | 인라인 스타일을 CSS 클래스로 마이그레이션 | 전체 | 8h |
| P2 | 댓글 페이지네이션 | feed/[id]/page.tsx:99 | 3h |
| P2 | view_count 원자적 증가 (RPC) | feed/[id]/page.tsx:91 | 1h |
| P2 | 에러 상태 사용자 피드백 UI | StockClient, feed 등 | 2h |
| P3 | ESC 키로 드롭다운 닫기 | Navigation.tsx | 30min |
| P3 | canonical URL 메타데이터 | feed/[id]/page.tsx | 30min |
| P3 | 환경 변수 부팅 검증 | 새 파일 | 1h |

---

## 3개월 로드맵

### 1개월차: 안정화 + 블로커 해소
- GET /api/payment 인증 완성
- 주문 기록 실패 복구 메커니즘
- Navigation 세션 캐싱
- 인라인 스타일 -> CSS 모듈 또는 Tailwind 클래스 마이그레이션 (주요 페이지)
- 에러 바운더리 + 사용자 친화적 에러 페이지

### 2개월차: 성능 + 확장
- 댓글 무한 스크롤 / 페이지네이션
- 주식 종목별 상세 페이지 (SEO 롱테일 키워드)
- StockClient 컴포넌트 분리 + React.memo 적용
- 이미지 업로드 최적화 (압축, WebP 변환)
- Sentry 또는 LogRocket 에러 트래킹 도입

### 3개월차: 성장 + 수익화
- GuestGate 서버 사이드 강화 (미들웨어 레벨)
- A/B 테스트 인프라 (전환율 최적화)
- sitemap.xml 자동 생성 + Google Search Console 연동
- CSP 헤더 적용
- 결제 대시보드 + 매출 분석 어드민 페이지
- 실시간 주식 WebSocket 전환 (현재 5분 폴링 -> 실시간)

---

> **핵심 요약**: v2 대비 보안이 가장 크게 개선되었다(+32점). 결제 인증+금액 검증이 추가되어 최대 블로커가 해소되었으나, GET 엔드포인트 인증 미완성 1건이 남아있다. 디자인 토큰 시스템과 SEO 인프라는 프로덕션 수준에 근접했다. 인라인 스타일 남용과 컴포넌트 비대화는 기술 부채로 남아있으나, 출시를 막는 수준은 아니다. GET /api/payment 수정 후 조건부 출시 가능.
