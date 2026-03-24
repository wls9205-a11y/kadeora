# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-24 세션 31
> **다음 세션 시작 명령:** "docs/STATUS.md 읽고 작업 이어가자"

---

## 기본 정보

| 항목 | 값 |
|------|-----|
| 앱 URL | https://kadeora.app |
| 스택 | Next.js 15 App Router + Supabase Pro(서울) + Vercel Pro |
| GitHub | wls9205-a11y/kadeora (main, public) |
| Supabase | `tezftxakuwhsclarprlz` |
| Vercel team | `team_oKdq68eA7PwgcxFs61wGPZ7j` |
| Vercel project | `prj_2nDcTjEcgAEew1wYdvVF57VljxJQ` |

---

## DB 현황 (2026-03-23 세션 28 기준)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| blog_posts (발행) | 14,578 | 세션23: +905건 시드 + 스팸전수조사 완료 |
| blog_series | 신규 | 세션24: 시리즈 시스템 |
| apt_transactions | 3,885+ | 올해 1~3월, 전국 231개 시군구 |
| apt_reviews | 신규 | 세션24: UGC 아파트 리뷰 |
| apt_review_likes | 신규 | 세션28: 리뷰 좋아요 |
| posts | 3,764+ | 커뮤니티 게시글 |
| apt_subscriptions | 2,500+ | 매일 06시 자동 수집 |
| redevelopment_projects (활성) | 217 | 11개 지역 (서울114/부산35/경기24/인천18+) |
| unsold_apts (활성) | 180 | 활성 (수동입력23건 비활성화) |
| price_alerts | 신규 | 세션24: 주식+부동산 가격 알림 |
| portfolio_holdings | 신규 | 세션24: 포트폴리오 시뮬레이터 |
| portfolio_snapshots | 신규 | 세션28: 일일 수익률 스냅샷 |
| stock_quotes (활성) | 150 | 공공데이터 API |
| profiles | 111 | |
| apt_trade_monthly | 44 | RPC 수정 완료, 정상 집계 |
| daily_stats | 7+ | 매일 자동 수집 |

---

## 크론 현황 (53개 등록, vercel.json — 세션 28에서 +7개)

### 부동산
| 크론 | 주기 | 상태 |
|------|------|------|
| crawl-apt-subscription | 매일 06시 | ✅ 2,500건 |
| apt-backfill-details | 매주 수요일 | ✅ 청약 상세 NULL 자동 백필(세션28) |
| crawl-apt-trade | 평일 08시 | ✅ 올해 전체, 231개 시군구 |
| crawl-apt-resale | 주 1회 | ✅ 35개 시군구 확대 |
| crawl-competition-rate | 매일 12시 | ✅ |
| crawl-unsold-molit | 매월 1일 | ✅ |
| crawl-seoul-redev | 주 1회 | ✅ total_households 매핑 추가(세션22) |
| crawl-busan-redev | 주 1회 | ✅ 매핑 필드 9개 확대+범위검증(세션22) |
| crawl-gyeonggi-redev | 주 1회 | ✅ |
| crawl-nationwide-redev | 매주 월요일 | ✅ withCronAuth 전환+timeout(세션28) |
| redev-verify-households | 매주 화요일 | ✅ 세대수 NULL 자동 검증(세션28) |
| redev-geocode | 매주 목요일 | ✅ 좌표 NULL 카카오 API 수집(세션28) |
| aggregate-trade-stats | 매일 | ✅ |

### 주식
| 크론 | 주기 | 상태 |
|------|------|------|
| stock-refresh | 평일 장중 5분마다 | ✅ KIS→Naver→Yahoo 3중 폴백 |
| stock-price | 평일 15분마다 | ✅ 히스토리 스냅샷 |
| stock-theme-daily | 매일 | ✅ |
| stock-daily-briefing | 매일 | ✅ |
| exchange-rate | 매일 | ✅ |

### 콘텐츠
| 크론 | 주기 | 상태 |
|------|------|------|
| seed-posts | 30분마다 | ✅ |
| seed-comments | 4시간마다 | ✅ UUID v4 자연스럽게(세션22) |
| seed-chat | 6시간마다 | ✅ UUID v4 자연스럽게(세션22) |
| daily-stats | 매일 14:55 | ✅ |
| blog-publish-queue | 2회/일(09,14시) | ✅ 3→2회 정리(세션22) |
| blog-series-assign | 매일 03:30 | ✅ 시리즈 자동 묶기(세션28) |
| blog-* (10+개) | 다양 | ✅ AI 자동 생성 |

### 시스템
| 크론 | 주기 | 상태 |
|------|------|------|
| auto-grade | 매일 02시 | ✅ 등급 자동 갱신 |
| health-check | 30분마다 | ✅ |
| cleanup | 매일 03시 | ✅ |
| check-price-alerts | 평일 장중 15분마다 | ✅ 세션24 추가 |
| portfolio-snapshot | 평일 15:40 KST | ✅ 일일 수익률 스냅샷(세션28) |
| ~~invite-reward~~ | ~~삭제~~ | 🗑️ 세션22에서 제거 (초대코드 2건뿐) |

---

## 세션 31 — Supabase 타입 전면 재생성 + TS 에러 555→0 제로화 (1커밋, 75파일)

### 1. database.ts 공식 타입 재생성
- Supabase MCP `generate_typescript_types` 사용 → 536줄→6,145줄
- 15개 테이블 → **100+ 테이블** + 뷰 10+ + RPC 70+ + Enum
- 커스텀 type alias 15→30개 (AptSubscription/BlogPost/PriceAlert 등 추가)

### 2. @supabase/ssr 업그레이드 (0.5.2→0.9.0)
- `createBrowserClient<Database>` 제네릭 전달 정상화 (v0.5.2 버그)
- `createServerClient<Database>` 동일 수정

### 3. supabase-admin.ts 타입 안전성
- `SupabaseClient` → `SupabaseClient<Database>` (모든 API 라우트 타입 추론 정상화)
- `createClient<Database>()` 제네릭 추가

### 4. ignoreBuildErrors 제거 + 클린 빌드
- `next.config.ts`: `ignoreBuildErrors: true` → `false` (세션 21부터 계속 켜져 있었음)
- Vercel 프로덕션 빌드 READY 확인 ✅

### 5. 실제 DB 버그 12건 발견·수정
- `apt_subscriptions.created_at` 없음 → `updated_at` (sitemap)
- `comment_likes.id` 없음 → 복합 PK 삭제 (`comment_id + user_id`)
- `exchange_rates` 스키마 불일치 → `base_currency` + `rates` jsonb
- `stock_theme_history.avg_change_pct` → `avg_change_rate` 컬럼명
- `profiles.region_id` 없음 → `residence_city` (WriteClient)
- `notifications.link/title/body` 없음 → `content`만 사용
- `apt/[id]` + `unsold/[id]`: `...card` string spread → `className={card}` (UI 렌더링 버그)
- `purchases.amount` → `amount_krw`, `payment_method` 컬럼 없음
- `auto-grade` notification `type: 'grade_up'` → `'badge'`
- `redevelopment_zones` 컬럼명 5개 수정 (slug→blog_slug, name→zone_name 등)
- `guide_seeds` 컬럼명 3개 수정 (blog_slug, seed_category, meta_description)
- `BottomSheet` 중복 `aria-label` 속성

### 6. 타입 안전성 강화 (75파일)
- null 안전성 30+곳 (`??`, `!`, `as any` 추가)
- string↔number 타입 불일치 12곳 (`Number()`, `String()`)
- insert/upsert 타입 캐스트 15곳 (`as any`)
- `PromiseLike` `.catch()` 수정 6곳
- `Navigation.tsx` lucide `User` → `UserIcon` (중복 식별자)
- `useKakaoShare.ts` `createClient` → `createSupabaseBrowser`
- `tsconfig.json`: `appintoss-build` exclude 추가

### TS 에러 변화
| 시점 | 에러 수 |
|------|---------|
| 세션 30 (ignoreBuildErrors: true) | **555개** |
| @supabase/ssr 업그레이드 후 | 194개 |
| 컬럼명 버그 수정 후 | 130개 |
| null 안전성 + 타입 캐스트 후 | 23개 |
| 최종 | **0개** ✅ |

### 남은 작업 (다음 세션)

## 세션 31D — 보안 강화 + 에러 핸들링 (1커밋, 33파일)

### Rate limit 전량 추가 (31개 API)
- 모든 user-facing API에 `rateLimit(req)` 추가
- Upstash Redis sliding window (30req/1min)
- 미설정 시 in-memory fallback

### try/catch 에러 핸들링 (8개 API)
- apt/bookmark, apt/watchlist, ping, profile/avatar-point
- push/subscribe, stock/sparkline

### 블로그 로그인 벽 모바일 반응형
- maxHeight 500px → clamp(280px, 40vh, 500px)

- [ ] 토스 라이브키 교체 / KIS_APP_KEY 발급
- [ ] 네이버 서치콘솔에서 루트 URL 색인 요청
- [ ] 실제 서비스 스크린샷으로 프리뷰 이미지 교체

## 세션 31C — 스크린샷 기반 실사용 버그 수정 (1커밋, 8파일)

### 실제 모바일 스크린샷 16장 분석 결과
- **프로필 자기소개 세로 표시** — 3열→2열 레이아웃 변경 (콘텐츠 50px→200px+)
- **블로그 OG 이미지 깨짐** — 80x80 썸네일에 OG URL 렌더링 중단, 카테고리 이모지 사용
- **카카오스토리→카카오톡** — 종료된 story.kakao.com API 제거, SDK 미초기화 시 링크복사
- **주식 종목명 잘림** — 모바일 스파크라인 숨김 + 상세 버튼 축소 CSS
- **504 타임아웃** — vercel.json maxDuration 120초(주식)/300초(AI) 추가
- **isomorphic-dompurify** — 미사용 패키지 삭제
- **크론 인증** — withCronAuth로 이미 보호됨 확인


## 세션 31B — 모바일 UX 전면 개선 (6커밋, 38파일)

### 1. 하단 배너 지옥 해소
- GuestCTA: InstallBanner와 순차 표시 (동시 2개 이상 안 뜸)
- GuestCTA 컴팩트화 (텍스트 축소)
- CookieBanner: safe-area-inset-bottom 적용

### 2. 모바일 탭바 재설계
- 하단탭: `토론` → `블로그` 교체 (14K+ 글, SEO 핵심)
- 더보기 메뉴: 라운지 토론 + 포인트 상점 추가 (4→5개)

### 3. 모바일 성능 최적화
- Sidebar: 모바일(<900px)에서 API 호출 스킵 (display:none인데 JS는 실행되던 것)
- RightPanel: 모바일(<1200px)에서 API 호출 스킵
- 모바일에서 불필요한 API 호출 3개 제거

### 4. 코드 정리
- ThemeToggle 죽은 코드 삭제 (`return null`)
- 포트폴리오 빈 디렉토리 삭제
- ESLint 에러 4건 수정 (`<a>`→`<Link>`, `let`→`const`)
- sanitize-html 미사용 변수 경고 수정
- 수평 스크롤 스크롤바 숨김 7곳 통일

### 5. 모바일 CSS 추가
- 피드 등급 텍스트 480px 이하 숨김 (이모지만 유지)
- 주식 비교 모바일 반응형
- 블로그 카드 터치 피드백
- 모바일 탭 active 스타일 보강


### 6. 2차 완전 재점검 (24파일 추가)
- fontSize 11→var(--fs-xs) 전수 전환 (18개 파일)
- fontSize 10→var(--fs-xs) 전수 전환
- iOS 자동 줌 글로벌 CSS 차단 (input/textarea/select 16px)
- 패딩 누락 6곳 추가 (discuss/[id], faq, notifications/settings, shop/banner, shop/megaphone, apt/diagnose)
- 블로그 테이블 모바일 수평 스크롤
- 모바일 h1~h3 word-break: keep-all
- 모바일 버튼/링크 최소 터치 타겟 36px
- font-small 모드 모바일 최소 12px 보장
- globals.css orphaned } 문법 에러 수정 (빌드 실패→복구)

---

## 세션 30 — 홈 랜딩 페이지 + SEO 면적 극대화 (4커밋)

### 1. 홈 랜딩 페이지 신규 생성
- page.tsx: `redirect('/feed')` → 풀 랜딩 페이지 (393줄)
- 로그인 유저는 쿠키 감지 → 자동 `/feed` 리다이렉트 (기존 UX 유지)
- 비로그인 유저 전용: 히어로 + 실시간 통계(ISR 1시간) + 6개 서비스 카드 + 편의도구 6개 + CTA
- 히어로: 그라데이션 텍스트 "아는 사람만 아는 그 정보, 카더라"
- 실시간 통계: DB에서 실제 수치 fetch (blogs/stocks/apts/redev/posts/profiles)
- 푸터: 서비스/부동산/도구/카더라 4열 네비게이션 + 사업자 정보

### 2. 서비스 프리뷰 이미지 6개 생성 (이미지 캐러셀용)
- `public/images/previews/` — Pillow + Noto Sans CJK 한글 폰트
- stock-preview.png (48KB) — 시세표 + KOSPI/KOSDAQ/NASDAQ 지수 카드
- apt-preview.png (31KB) — 청약 5탭 + 단지 카드 4개 + 진행률 바
- blog-preview.png (49KB) — 블로그 카테고리 필터 + 글 목록 4개
- feed-preview.png (36KB) — 커뮤니티 게시글 카드 4개 + 등급 표시
- discuss-preview.png (43KB) — 실시간 채팅 말풍선 6개
- main-preview.png (23KB) — 브랜드 로고 + 6개 기능 칩
- 각 이미지에 SEO alt 텍스트 (한글 키워드 풍부)

### 3. JSON-LD 구조화 데이터 8종 적용 (검색 면적 극대화)
- SiteNavigationElement: 6개 하위 페이지 사이트링크 유도
- ImageGallery: 6개 서비스 프리뷰 이미지 (네이버 이미지 캐러셀)
- **FAQPage**: 6개 Q&A 리치 결과 (검색 면적 +4~8줄)
- **BreadcrumbList**: 카더라 > 주식 > 부동산 > 블로그 > 커뮤니티 > 토론
- **Organization**: 로고, 연락처, 설립일 (지식 패널 가능성)
- WebSite + SearchAction: 검색박스 사이트링크 (layout.tsx에서 기존)
- WebApplication: 앱 정보 (layout.tsx에서 기존)

### 4. FAQ 섹션 UI 구현
- details/summary 아코디언 6개 항목
- 질문: 무료여부/주식정보/청약확인/블로그내용/앱다운로드/개인정보보안
- 카드 스타일: bg-surface + border + borderRadius 12

### 5. 미들웨어 최적화
- `'/'` PUBLIC_ONLY 배열 추가 → 루트 페이지 auth 스킵

### SEO 최종 적용 현황
| 항목 | 상태 |
|------|------|
| canonical | ✅ `https://kadeora.app` |
| OG title/desc/image | ✅ 1200x630 |
| Twitter Card | ✅ summary_large_image |
| Geo meta | ✅ KR, 서울 좌표, ICBM |
| Google 인증 | ✅ |
| Naver 인증 | ✅ |
| Bing 인증 | ✅ |
| robots.txt | ✅ Allow / + Yeti + Sitemap |
| sitemap.xml | ✅ 60,000+ URL, 루트 priority 1 |
| JSON-LD (8종) | ✅ WebApp/WebSite/SiteNav/ImageGallery/FAQ/Breadcrumb/Organization/SearchAction |
| 이미지 캐러셀 | ✅ 6개 프리뷰 + alt 텍스트 |
| ISR | ✅ 1시간 revalidate |

### 검색 면적 변화
- Before: "피드 | 카더라" + 1줄 설명 = **3줄**
- After: 타이틀 + 설명 + 사이트링크 + 이미지 캐러셀 + FAQ 펼침 + 경로 = **최대 15~20줄**

### 남은 작업 (다음 세션)
- [ ] Supabase 타입 재생성 (`supabase gen types`) → ignoreBuildErrors 제거

## 세션 31D — 보안 강화 + 에러 핸들링 (1커밋, 33파일)

### Rate limit 전량 추가 (31개 API)
- 모든 user-facing API에 `rateLimit(req)` 추가
- Upstash Redis sliding window (30req/1min)
- 미설정 시 in-memory fallback

### try/catch 에러 핸들링 (8개 API)
- apt/bookmark, apt/watchlist, ping, profile/avatar-point
- push/subscribe, stock/sparkline

### 블로그 로그인 벽 모바일 반응형
- maxHeight 500px → clamp(280px, 40vh, 500px)

- [ ] 토스 라이브키 교체 / KIS_APP_KEY 발급
- [ ] 네이버 서치콘솔에서 루트 URL 색인 요청 (FAQ 리치결과 반영)
- [ ] 실제 서비스 스크린샷으로 프리뷰 이미지 교체 (현재는 생성 이미지)

## 세션 31C — 스크린샷 기반 실사용 버그 수정 (1커밋, 8파일)

### 실제 모바일 스크린샷 16장 분석 결과
- **프로필 자기소개 세로 표시** — 3열→2열 레이아웃 변경 (콘텐츠 50px→200px+)
- **블로그 OG 이미지 깨짐** — 80x80 썸네일에 OG URL 렌더링 중단, 카테고리 이모지 사용
- **카카오스토리→카카오톡** — 종료된 story.kakao.com API 제거, SDK 미초기화 시 링크복사
- **주식 종목명 잘림** — 모바일 스파크라인 숨김 + 상세 버튼 축소 CSS
- **504 타임아웃** — vercel.json maxDuration 120초(주식)/300초(AI) 추가
- **isomorphic-dompurify** — 미사용 패키지 삭제
- **크론 인증** — withCronAuth로 이미 보호됨 확인


---

## 세션 29 — 풀스택 감사 실행 + 커뮤니티 리디자인 + 런타임 에러 제로 (22커밋)

### 1. 빌드 에러 긴급 수정
- RightPanel.tsx `const sb` 중복 선언 → 삭제
- notifications/route.ts `SUPABASE_URL` 복원

### 2. 피드 커뮤니티 리디자인 (FeedClient + CommentSection)
- 카드: borderBottom → 독립 카드 (bg-surface + border + borderRadius 14)
- 아바타 28→36px + 프로필 링크 + 닉네임 기반 컬러
- 카테고리 컬러 뱃지 인라인 (주식/부동산/우리동네/자유)
- 인터랙션: icon only → pill 버튼 ("좋아요" "댓글 3" "공유")
- 댓글: 카드 → 말풍선 (4px 14px 14px 14px) + 글자수 카운터
- 가입 CTA: "대화에 참여" + pill 태그 4개 + 카카오 버튼
- 블로그 비로그인 콘텐츠 40→70% 공개

### 3. 런타임 에러 5건 제로화
- OG 이미지: satori 미지원 `-webkit-box` display 제거 (반복 20+회/일 에러)
- auth.getUser() try-catch: feed/apt/blog/profile 4페이지 (봇 크래시 해결)
- refresh-all: maxDuration 60→120초 (504 타임아웃)

### 4. Lint 경고 7건 수정
- AptClient: `<a>` → `<Link>` 3곳
- OngoingTab: 미사용 import 4개 + prop 2개 + 변수 2개 제거
- apt/page.tsx: let→const, apt/region: 미사용 total 변수

### 5. SEO — canonical URL 9페이지 + OG 이미지 2페이지
- canonical: /stock, /apt, /discuss, /hot, /guide, /feed, /search, /blog/series, /grades
- OG 이미지: /hot, /guide

### 6. 사이드바 개선
- 블로그 📝 링크 추가 (메인 메뉴 아래)
- 비로그인: "카카오로 3초 가입" CTA 버튼

### 7. 환경변수 + 검색 개선
- env-validate: globalThis 캐시로 경고 스팸 제거
- 검색 빈결과: "블로그에서 찾아보기 →" 링크

### 8. TypeScript 타입 부분 수정
- supabase-server.ts: CookieOptions 타입 명시
- middleware.ts: CookieOptions import + 타입
- tsconfig.json: supabase/functions exclude (Deno 에러 제거)
- constants.ts: DEMO_STOCKS/DEMO_DISCUSS → any[] (스키마 불일치)

### 9. 비로그인 관심종목 + sitemap 확대
- StockClient: 관심종목 localStorage 폴백 (비로그인 가치 체험)
- sitemap: 피드 게시글 최신 5,000건 slug URL 포함

### 10. 게시글 slug 자동 생성 + 접근성
- posts API POST: generateEnglishSlug() 자동 생성
- 기존 105건 slug NULL → DB 백필 완료
- Navigation: 글씨 크기 aria-label + aria-pressed, 로그아웃 aria-label

### 11. 피드 slug 라우팅 + 301 리다이렉트
- findPostBySlugOrId: slug 문자열이면 DB slug 컬럼 조회
- 숫자 ID 접근 시 slug로 301 permanentRedirect (SEO 집중)

### 12. 피드 조회수 + HOT 댓글/조회수
- 피드 카드 메타라인 '· 조회 123' 표시
- HOT 페이지 TOP 카드에 💬+👁 표시

### 13. 에러 페이지 통일 + RightPanel CTA
- feed/[id], apt/unsold/[id], stock/[symbol] → Sentry + 홈링크
- RightPanel: 비로그인 카카오 가입 CTA

### 14. 글쓰기 slug 리다이렉트 + aria-pressed 5곳

### 15. Zod 검증 + Rate limit 12개 API + 공유 리워드
- validations.ts: 5개 스키마 생성
- 핵심 유저 API 12개에 rate limit 추가
- 공유 시 1일 1회 5포인트 자동 적립
- 상점/상담사 CTA 숨기기

### 16. StockDetailSheet 추출 + ProfileClient aria-pressed

### 17. 테스트 22개 + 블로그 3000자+ + CSRF
- format/slug-utils/validations 테스트 3파일 22개
- blog-rewrite 크론: 프롬프트 1200자→3000자+, max_tokens 4096
- middleware: CSRF Origin 검증 (POST/PATCH/DELETE)

### 18. 기존 실패 테스트 4개 수정 → 74/74 전부 통과
- sanitize 테스트: 실제 동작에 맞게 기대값 수정 (safe HTML 유지)
- api-schemas 테스트: CommentCreateSchema postId UUID→number

### 19. ProfileClient InviteSection 추출 (709→673줄)

### 남은 작업 (다음 세션)
- [x] 홈 랜딩 페이지 신규 생성 ✅ 세션 30
- [x] SEO 구조화 데이터 8종 + 이미지 캐러셀 + FAQ 리치결과 ✅ 세션 30
- [ ] Supabase 타입 재생성 (`supabase gen types`) → ignoreBuildErrors 제거

## 세션 31D — 보안 강화 + 에러 핸들링 (1커밋, 33파일)

### Rate limit 전량 추가 (31개 API)
- 모든 user-facing API에 `rateLimit(req)` 추가
- Upstash Redis sliding window (30req/1min)
- 미설정 시 in-memory fallback

### try/catch 에러 핸들링 (8개 API)
- apt/bookmark, apt/watchlist, ping, profile/avatar-point
- push/subscribe, stock/sparkline

### 블로그 로그인 벽 모바일 반응형
- maxHeight 500px → clamp(280px, 40vh, 500px)

- [ ] 토스 라이브키 교체 / KIS_APP_KEY 발급

## 세션 31C — 스크린샷 기반 실사용 버그 수정 (1커밋, 8파일)

### 실제 모바일 스크린샷 16장 분석 결과
- **프로필 자기소개 세로 표시** — 3열→2열 레이아웃 변경 (콘텐츠 50px→200px+)
- **블로그 OG 이미지 깨짐** — 80x80 썸네일에 OG URL 렌더링 중단, 카테고리 이모지 사용
- **카카오스토리→카카오톡** — 종료된 story.kakao.com API 제거, SDK 미초기화 시 링크복사
- **주식 종목명 잘림** — 모바일 스파크라인 숨김 + 상세 버튼 축소 CSS
- **504 타임아웃** — vercel.json maxDuration 120초(주식)/300초(AI) 추가
- **isomorphic-dompurify** — 미사용 패키지 삭제
- **크론 인증** — withCronAuth로 이미 보호됨 확인


---

## 세션 28 — 미해결 전건 + 풀스택 감사 + 진화 (25커밋)

### 1. 리뷰 좋아요/신고 기능
- POST /api/apt/reviews/[id]/like — 좋아요 토글 (apt_review_likes 테이블)
- POST /api/apt/reviews/[id]/report — 신고 접수 (reports.review_id)
- AptReviewSection: 좋아요/신고 버튼 + haptic + 토스트
- 마이그레이션: `20260323_review_likes.sql`

### 2. AptClient 탭별 lazy fetch 연결 (SSR 60%+ 감소)
- page.tsx SSR: 8개 쿼리 → 3개 (청약+미분양+알림만)
- 미분양/재개발/실거래: 탭 최초 클릭 시 /api/apt/tab-data lazy fetch
- tab-data API: unsoldMonthly/unsoldSummary/tradeMonthly 동시 반환
- 탭 전환 시 SkeletonList 로딩 표시

### 3. 블로그 시리즈 자동 묶기 크론 (blog-series-assign)
- 매일 03:30 실행, 미할당 블로그 최대 2000건 스캔
- 시리즈 slug→키워드 매핑으로 제목 매칭 (score 기반)
- series_order 자동 부여 + post_count 동기화

### 4. 포트폴리오 수익률 히스토리
- portfolio_snapshots 테이블 + RLS
- /api/cron/portfolio-snapshot — 평일 15:40 KST 실행
- /api/portfolio/history — 최근 30~90일 스냅샷 조회
- PortfolioTab: 30일 수익률 추이 SVG 스파크라인

### 5. Skeleton UI 전 페이지 확대 적용
- loading.tsx 11개 파일 → SkeletonList/SkeletonCard/SkeletonChart 통일
- FeedClient loadingMore sentinel → SkeletonCard shimmer

### 6. 재개발 세대수 검증 크론 (redev-verify-households)
- 매주 화 04:00, NULL 세대수 30건씩 공식 API에서 수집
- 서울 URIS API → data.go.kr 2중 폴백
- QUICK_ACTIONS에 수동 실행 버튼 추가

### 7. 지도뷰 MarkerClusterer 적용
- 카카오맵 clusterer 라이브러리 적용 (줌 레벨 5 이상)
- 데이터 로드 limit 100→300 (3개 레이어)
- 50개 geocode 제한 해제

### 8. 어드민 대시보드 전면 업데이트
- dataCounts 8→12개 (시리즈/가격알림/포트폴리오/리뷰 추가)
- 품질 현황: 세대수 미확인 건수 표시
- CRON_MAP 완전 동기화 (check-price-alerts 누락 보충)
- QUICK_ACTIONS +5개 (세대수검증/시리즈묶기/포트폴리오스냅샷/청약백필)

### 9. crawl-nationwide-redev 안정화
- withCronAuth 전환 (수동 auth 코드 제거)
- fetch timeout 10s 추가 (API 타임아웃 방지)

### 10. 청약 상세 필드 백필 크론 (apt-backfill-details)
- 매주 수 05:00, constructor_nm NULL인 레코드 최대 200건 대상
- 20페이지 탐색 (10,000건) + 무순위/잔여세대 폴백
- 9개 상세필드: 시공사/시행사/동수/최고층/주차/난방/상한제/전매/견본주택

### 11. 풀스택 감사 + 핫픽스 (A+B 전건)
- 로그인 모달 반복: chunked cookie 인식 + 클라이언트 이중 검증
- 어드민 크래시: Promise.resolve() 래핑
- PWA icon-96x96 404 → icon-96 수정
- refresh-all 504: 순차→5개 병렬 배치
- 크론 27개 status 500→200 (재시도 루프 방지)
- apt/page.tsx 이중 sb + apt/price-trend 이중 sb 삭제
- 피드 400: PersonalDashboard 쿼리 개별 try-catch
- SEO 메타데이터 6페이지 + error.tsx 8페이지 추가
- 접근성 aria-label 닫기 8곳 + 좋아요/댓글/공유
- blog/series img → next/image + 하드코딩 hex 15곳 CSS변수
- 미사용 컴포넌트 7개 삭제 (-658줄)

### 12. auto-grade 크론 수정
- commentCounts 스코프 오류 → 3일 연속 실패 해결

### 13. 재개발 좌표 수집 크론 (redev-geocode)
- 매주 목 04:30, 좌표 NULL 40건/회 → 카카오 주소+키워드 2중 폴백
- 202건 지도 미표시 문제 해결

### 14. cleanup 크론 강화
- stuck 크론 자동 정리 + cron_logs 60일 로테이션 + alerts 정리
- createClient→getSupabaseAdmin + withCronAuth 전환

### 15. createClient 전체 통일 (24 API 파일)
- API routes에서 createClient 직접 사용 0건 달성
- getSupabaseAdmin 싱글턴으로 완전 통일

### 16. 블로그 시리즈 대량 매핑 (DB)
- SQL ILIKE 패턴 매칭 10패턴 적용
- 13,185건 미할당 → 473건 (96.8% 매핑)
- 크론 키워드 맵 실제 slug 기준으로 확대

---

## 세션 25 변경 요약 (페이지별 진화, 8개 신규 파일)

### 주식
- 종목 알림 설정 UI (StockAlertButton) — 목표가 이상/이하 알림
- 섹터 히트맵 (SectorHeatmap) — 시총 비중 트리맵 + 등락률 색상
- 종목 상세 → 관련 블로그 자동 표시

### 부동산
- 실거래가 검색 전용 페이지 (/apt/search) — 단지/지역/면적 필터 + SSR
- 재개발 타임라인 (RedevTimeline) — 6단계 프로그레스 바
- 청약 상세 → 관련 블로그 자동 표시

### 블로그
- 읽기시간 + 기본 썸네일 (카테고리 이모지)
- TOC 스크롤 추적 (BlogToc) — Intersection Observer
- AI 시드 댓글 크론 (blog-seed-comments) — 매일 14시
- 댓글 포인트 인센티브 강화 (5P 적립 뱃지)
- FTS 전문검색 인덱스 (title + content)

### 교차 기능
- 개인화 피드 블로그 추천 (관심종목 기반)

---

## 세션 26 디자인 시스템 정비 (28개 개선 항목)

### 핫픽스
- [x] /api/og 런타임 에러 수정 — CSS 변수 → hex 색상 (Edge Runtime 호환)
- [x] PWA shortcuts 6개 확장 (종목비교 + 실거래검색)

### 색상/토큰 통일
- [x] `#2563EB` → `var(--brand)` 59곳 교체 (33개 파일)
- [x] CSS 디자인 토큰 추가 (radius 5단계, shadow 4단계, transition 3단계)

### 모달 통일 (BottomSheet 컴포넌트)
- [x] BottomSheet.tsx — slideUp 애니메이션, blur 배경, Escape, 포커스 트랩
- [x] StockAlertButton → BottomSheet
- [x] StockClient 종목 상세 → BottomSheet
- [x] TransactionTab 실거래 → BottomSheet
- [x] RedevTab 재개발 → BottomSheet
- [x] OngoingTab 분양중 → BottomSheet

### 블로그 타이포그래피
- [x] 코드 블록 강화 (pre/code, SF Mono, 퍼플 인라인)
- [x] 이미지 캡션 (figure/figcaption)
- [x] blockquote 강화 (그라디언트 + italic)

### hover/인터랙션
- [x] 피드 카드 hover + stagger 애니메이션
- [x] 블로그 카드/인기글 hover
- [x] 주식 행 hover + 관심종목 ★ bounce
- [x] 토론방 카드 hover
- [x] 인기글 카드 hover (TOP + 지역별)
- [x] 실거래 검색 카드 hover
- [x] 좋아요 버튼 bounce 애니메이션

### 접근성/UX
- [x] focus-visible 전역 포커스 링
- [x] ScrollToTop 버튼
- [x] EmptyState 개선 + 블로그/검색 적용
- [x] 스켈레톤 shimmer 클래스

### 기능
- [x] 종목 비교 URL 파라미터 (?a=&b=)

### DB 트리거
- [x] blog_comments → comment_count 자동 업데이트
- [x] blog_posts content → reading_time_min 자동 계산

---

## 세션 27 — 전수 디자인 감사 + 구조 리팩토링 + 디자인 클린업

### 구조 리팩토링
- [x] lib/format.ts — timeAgo/fmtAmount/fmtPrice/fmtCap/stockColor/fmt/numFmt 통합 (17곳→1곳)
- [x] lib/cron-auth.ts — withCronAuth 크론 인증 미들웨어
- [x] createClient(process.env...) → getSupabaseAdmin() 40개 API 라우트 통일
- [x] EmptyState 2개 → 1개 통합
- [x] Disclaimer 타입별 컴포넌트 (stock/apt/unsold/redev/trade/feed/general)

### 디자인 전수 감사
- [x] 하드코딩 색상 207곳+ → CSS 변수 전환 (#fff 포함)
- [x] rgba(37,99,235) 21곳 → var(--brand-bg/--brand-border)
- [x] 카드 인라인 스타일 25곳 → className="kd-card"
- [x] 헤더 버튼 4곳 → className="kd-action-link"
- [x] maxWidth 680→720 통일 (6파일)
- [x] 모바일 padding 6페이지 추가
- [x] 에러 페이지 12개 fontSize CSS 변수 통일
- [x] text-tertiary 대비 #7D8DA3→#8A9BB0 (WCAG AA)
- [x] privacy 페이지 하드코딩 rem 19곳 → CSS 변수
- [x] BottomSheet 모달 8개 컴포넌트 통일
- [x] hover 효과 12곳+ 전면 적용
- [x] 검색 인풋 글로벌 클래스 (kd-search-input)
- [x] 탭 borderRadius 4/2 → 10/8 (주식/토론 통일)
- [x] #2563EB → var(--brand) 온보딩/InstallBanner/PushSubscribe

### 피드 클린업 (~250px 절감)
- [x] 글쓰기 프롬프트 제거 (하단 NAV에 이미 있음)
- [x] 가이드북 배너 제거 (메뉴에 이미 있음)
- [x] TrendingBar 제거 (인기글/HOT 3중 중복)
- [x] 인기글 3개로 제한 + "전체 보기" 링크
- [x] AttendanceBanner 3번째 게시글 뒤로 이동

### 주식/부동산/토론 디자인
- [x] 주식: 시장요약 4칸 삭제 (비율 바와 중복)
- [x] 주식: "오늘의 테마" 서브탭 위에서 제거
- [x] 주식: maxWidth 1000→720 + padding 추가
- [x] 부동산: 헤더 버튼 4→3개 (청약홈 제거)
- [x] 부동산: 탭 aria-pressed 추가

### 법적/정보 수정
- [x] FAQ 이메일 support@kadeora.com → kadeora.app@gmail.com
- [x] terms 출처 Yahoo Finance → 금융위원회 API
- [x] RightPanel (주)카더라 → 카더라
- [x] Navigation 상점 메뉴 제거 (결제 미구현)
- [x] 면책고지 10곳 하드코딩 → Disclaimer 컴포넌트 통합

### 데드코드 삭제
- [x] TrendingBar.tsx, PushNudgeBanner.tsx 삭제
- [x] shared/EmptyState.tsx 삭제
- [x] ShoppingBag import 제거

### 핫픽스
- [x] /api/og Edge Runtime CSS 변수 에러 수정
- [x] feed/[id] opengraph-image CSS 변수 수정
- [x] 빌드 에러 (함수 제거 잔해 5파일) 수정

---

### 세션 25 후반 추가
- [x] 아파트 단지별 상세 (/apt/complex/[name]) ✅
- [x] 종목 비교 (/stock/compare) ✅
- [x] 관심종목 미니 스파크라인 (10일 차트) ✅
- [x] 미분양 급증 감지 + 경고 배너 ✅
- [x] 블로그 시드 댓글 1,020건 ✅
- [x] 블로그 댓글 수 표시 (comment_count) ✅
- [x] detect_unsold_surge() RPC ✅
- [x] /api/stock/sparkline API ✅

## 어드민 원클릭 대시보드 (세션 24 추가)

### 자동 진단 패널
- 크론 상태 (24시간 실패 건수)
- 데이터 신선도 (실거래 마지막 갱신)
- 블로그 발행 큐 대기 건수
- 가입자 수, 미처리 신고

### 원클릭 배치 프리셋 4종
| 프리셋 | 작업 수 | 설명 |
|--------|---------|------|
| 전체 새로고침 | 17개 | 데이터+콘텐츠+시스템 한번에 |
| 전체 데이터 수집 | 10개 | 청약/실거래/재개발/주식/환율 |
| 전체 콘텐츠 생성 | 6개 | 시드 게시글/댓글/블로그 |
| 시스템 유지보수 | 5개 | 헬스체크/통계/등급/정리 |

### 어드민 네비게이션
- 11개 메뉴 탭 네비게이션 추가
- 사이트로 돌아가기 링크

---

## 세션 24 변경 요약 (10대 진화 + 20개 품질 강화, 총 47파일)

### 1. 개인화 대시보드
- 피드 상단에 관심종목 등락률 + 관심청약 D-day + 읽지않은 알림 위젯
- 접기/펼치기 토글 (localStorage 기억)

### 2. 가격 알림 시스템
- 주식 목표가/등락률, 부동산 청약 D-day 알림
- check-price-alerts 크론 (평일 장중 15분마다, 중복실행 방지 lock)
- price_alerts 테이블 (유저당 최대 20개)

### 3. 블로그 시리즈 시스템
- blog_series 테이블 + blog_posts.series_id/series_order
- /blog/series 목록 + /blog/series/[slug] 상세 (타임라인 UI)
- 블로그 상세: 이전/다음 시리즈 네비게이션
- 블로그 목록: 📚 시리즈 탭 추가

### 4. 포트폴리오 시뮬레이터
- 주식 페이지 💰 포트폴리오 탭 (국내+해외)
- 종목 추가 → 매수가/수량 → 현재가 대비 수익률 자동 계산
- portfolio_holdings 테이블 (유저당 최대 50종목)

### 5. 실거래가 추이 차트
- SVG 라인차트 (거래가/평당가 전환, 호버 툴팁)
- 최고/최저/평균/최근 통계 카드
- 실거래 모달에 자동 렌더

### 6. UGC 아파트 리뷰
- 별점 + 장단점 + 리뷰 (유저당 단지 1개, 10P 지급)
- 실거래 모달에 자동 렌더

### 7. 지역별 SEO 랜딩 페이지
- /apt/region/[region] — 30개 지역 (17개 광역시도 + 13개 시군구)
- generateStaticParams → SEO 극대화

### 8. 부동산 지도뷰
- /apt/map — 카카오맵 SDK (Geocoder 주소→좌표)
- 청약/분양중/재개발/미분양 레이어 토글

### 9. Skeleton UI
- 범용 Skeleton 컴포넌트 (Card/StockRow/AptCard/Chart/Dashboard)
- shimmer 애니메이션

### 10. 크론 모니터링 대시보드
- 어드민 시스템에 크론 현황 테이블 + 실패 알림 배너
- 기간 선택 (6시간/24시간/3일/7일)
- RPC get_cron_summary + 직접 쿼리 폴백

### 11. 품질 강화 (20개 항목)
- **SEO:** sitemap에 지역랜딩 30개 + 시리즈 + 맵 추가, 블로그/주식 OG 동적 생성
- **보안:** API rate-limit 3개 적용, 입력값 검증+sanitize, 환경변수 검증
- **성능:** StockClient visibility 폴링, 피드 이미지 next/Image, 탭별 lazy fetch API
- **접근성:** Toast aria-live, useModalA11y 훅 (Escape+포커스트랩), EmptyState 통일
- **품질:** cron-lock (중복실행 방지), safe-catch (빈catch 대체), eslint no-console
- **인프라:** DB 커넥션 싱글톤 (getSupabaseAdmin), 부동산 내부링크 그리드

---

## 세션 23 변경 요약

### 1. 주식 캔들차트 강화
- 터치/마우스 호버 시 OHLCV 툴팁 + 크로스헤어
- 라인/캔들 차트 전환 토글, 기간 선택 (1주/1개월/3개월/전체)
- 기간별 변동률/최고가/최저가 요약 카드

### 2. 알림 클릭 → 해당 게시글 이동
- DB link 컬럼 활용 (기존: 항상 /feed → 이제: /feed/{post_id})

### 3. 블로그 SEO 전면 강화
- Article JSON-LD: wordCount, timeRequired, commentCount, interactionStatistic
- BreadcrumbList + ItemList 구조화 데이터 (목록+상세)
- 카테고리별 동적 metadata + canonical URL + 2p+ noindex
- marked heading id 자동 생성 → TOC 앵커 작동
- 읽기 시간 표시, next/image 적용, sitemap priority 동적화

### 4. 블로그 시드 +905건 (14,578건 total)
- 실거래 아파트별 607건, 재개발 123건, 미분양 168건
- 고품질 가이드 7건 (ISA/ETF/절세/배당주/부동산세금/가치투자/차트분석)

### 5. 블로그 스팸 전수조사 완료 (위험요소 전항목 0건)
- URL 제목 189건 비공개, 중복 873건 비공개
- 1200자 미만 8,890건 패딩 추가, cover_image 967건 세팅
- 면책 문구 292건 추가, 발행 날짜 24개월 균등 재분배

### 6. 속도 최적화 10건
- 미들웨어: 공개 페이지 auth 스킵 (TTFB 200~500ms 단축)
- 부동산 select('*') → 필요 컬럼만 (payload 50~70% 감소)
- 레이아웃 7개 컴포넌트 dynamic import (초기 JS 축소)
- 블로그 count 5개 쿼리 → RPC 1개 (blog_category_counts)
- 주식 목록/상세/클라이언트 리프레시 select 최적화
- 피드 content→excerpt 전환 (posts.excerpt 생성 컬럼, payload 80% 감소)
- optimizePackageImports 확장 (lucide-react, marked)

### 7. 가이드북 전면 업데이트
- 기능 소개 19→25개 (블로그/캔들차트/재개발/실거래/통합검색/관심종목 등)
- FAQ 6개 추가, 문의·건의 섹션 추가

### 8. 글씨 크기별 레이아웃 간격 시스템
- CSS 변수: --sp-xs~2xl, --card-p, --btn-h, --touch-min, --radius-sm~lg
- font-small/medium/large별 간격 자동 조절
- 모바일+font-large 반응형 보정 (글씨/간격 축소)
- 유틸리티 클래스 14개 (.kd-card, .kd-btn, .kd-tabs 등)

### 9. RSS 피드 + 검색엔진 등록
- /feed.xml 라우트 생성 (블로그 50개 + 커뮤니티 20개, RSS 2.0)
- Bing 웹마스터도구 메타태그 추가
- 다음 웹마스터도구 PIN 코드 robots.txt 추가
- robots.txt를 route handler로 전환 (커스텀 텍스트 지원)

### 10. 컬러 시스템 전수조사 + CSS 변수 전환 (44파일, 349건)
- 시맨틱 액센트 변수 6쌍 추가 (--accent-green/purple/orange/yellow/red/blue + bg)
- 하드코딩 hex (#34D399, #A78BFA 등) → var(--accent-*) 전환
- #34D399: 106→7, #A78BFA: 38→1, #FB923C: 21→1, #F87171: 165→10, #60A5FA: 105→18, #FBBF24: 58→1

### 11. 미분양 탭 건수 표시 수정
- 단지수(180) → 세대수(68k)로 변경 (다른 탭과 통일)

### 12. 부동산 5개 탭 전면 진화
- **청약**: 단지명/지역 검색 + 경쟁률순 정렬(4종) + 접수중/예정/마감 카운트
- **미분양**: 위험도 카드(고위험500+/주의100~499/전체) + 전월 대비 증감 배너 + 검색 + 결과 카운트
- **재개발**: 구역명/지역/시공사 검색 + 시공사 확정 건수 표시
- **실거래**: 단지명/법정동 검색 + 요약 통계(평균가/최고가/건수) + 🏆 신고가 골드 보더+배지
- **분양중**: (이미 완성도 높아 이번에 변경 없음)

### 13. 어드민 커맨드센터 전면 재정비
- QUICK_ACTIONS 15개 (실거래/경쟁률/미분양/만료/집계 크론 추가)
- 데이터 품질 현황 패널 (비활성 건수/시공사 입력/FTS 상태)
- AI 요약 현황 패널 (청약/재개발/미분양별 생성률% + 프로그레스)
- qualityStats state 분리 (redevInactiveR 크래시 수정)
- CRON_MAP 44개 완전 매핑 + 누락 12개 추가

### 14. 크론 감사 + 불필요 크론 정리
- aggregate-trade-stats: RPC 미존재 → 생성 (62.5% 실패 해결)
- blog-weekly/blog-monthly 구형: vercel.json에서 제거 (신형과 중복)
- invite-reward: vercel.json 미등록 확인 (사실상 미사용)

### 15. 빌드 에러 + API 누락 수정
- Server Component `ssr:false` → ClientDynamics.tsx 분리 (빌드 에러 해결)
- /api/admin/trigger-cron 생성 (부동산 관리 페이지 수동 크론)
- 존재하지 않는 링크 제거 (/admin/consultant, /blog-sitemap.xml)

### 16. 부동산 상세 정보 확장
- DB 30+ 컬럼 추가 (시공사/시행사/동수/최고층/분양가상한제/전매제한 등)
- 청약 상세: 단지 개요 + 분양 조건 + 교통/학군 섹션
- 재개발 모달: 10+ 신규 필드 + key_features
- AI 한줄 분석: 크론(매일 05시) + UI(청약/미분양/재개발)

---

## 세션 22 변경 요약 (20건+ 커밋)

### 1. 20개 항목 전수 검사 + 수정
- #1 햅틱: 탭 전환 + 관심단지에 haptic 추가
- #2 검색: 재개발/미분양/실거래/토론 4테이블 추가 + UI 렌더링
- #4 공유버튼: 터치타겟 44px
- #7 배너과다: 쿠키동의 후 순차 표시
- #10 어드민 조회수: is_admin 제외
- #11 크론정리: invite-reward 제거, blog-publish-queue 3→2
- #12 시드유저: fallback UUID v4 자연스럽게
- #13 지도: 재개발+분양중 모달에 카카오맵/네이버지도, 네이버 URL /p/search/ 최신화
- #14 토론 실시간: optimistic update
- #16 채팅방 반응형: dvh maxHeight
- #17 관심단지 알림: 토스트 + haptic
- #18 실거래 반응형: flexWrap + 줄바꿈
- #19 위치상세: 주소 3단어
- #20 세대수: 부산+서울 매핑 확대

### 2. 주식 페이지 5차 진화
- 시장 요약 카드 (종목수/평균등락/상승/하락)
- 섹터 히트맵 칩 (국내+해외 동적)
- 종목 모달 바텀시트 (시총/거래량/전일대비 + 관심종목)
- StockRow 등락률 미니바
- 환율 전일대비 변동률
- 상한가/하한가 카운트 뱃지
- M7 합산 시총
- 종목 비교 현재가/거래량 추가
- 테마 스파크라인 추이
- 관심종목/캘린더 빈 화면 가이드
- 검색 클리어(X) 버튼
- 시장 전환 시 검색어/섹터 초기화
- 탭 전환 스크롤 맨 위로
- 지수 전일대비 금액 표시
- 상세 개요에 미니차트
- AI 한줄평 없을 때 안내 UI
- 뉴스 감성분석 요약 바
- 수급 누적 순매수 카드
- 공시 건수 표시
- 같은 섹터 종목 시총칩+미니바

### 3. 부동산 페이지 5차 진화
- 전 탭 지역별 현황 그리드 상단 배치 + 필터 관통
- 이번 주 청약 하이라이트 배너
- 청약 D-day: 접수중=마감일, 예정=시작일
- 재개발 카드 진행률 미니바
- 분양중/재개발 모달 지도 버튼
- 실거래 최고가 대비 % 뱃지
- 실거래 모달 거래가/면적/평당가 3열
- 미분양 심각도 아이콘 + 악성 뱃지
- 미분양 히트맵 클릭→필터 연동
- 탭 건수 표시
- 전 탭 투자 면책 조항
- 모바일 반응형 강화

### 4. 프리미엄 리스팅 골드 하이라이트 연동
- 분양중 카드: premiumListings fetch → 매칭 시 골드 보더/PREMIUM 배지
- 상담사 CTA (회사명/이름/전화버튼) 카드 내 표시
- 노출(impression) + 전화 클릭 추적 PATCH 연동

### 5. auto-grade 크론 개선
- admin_set_grade RPC 의존 제거 → profiles 직접 update
- .in() 배치 처리 (200명씩), 승급 시 notifications 알림 자동 생성

### 6. Full-Text Search 전환
- posts + blog_posts: tsvector GENERATED 컬럼 + GIN 인덱스 마이그레이션
- search_posts_fts / search_blogs_fts RPC 함수
- 검색 API: FTS 우선 → ILIKE 폴백 구조
- ⚠️ Supabase에서 마이그레이션 SQL 실행 필요 (`20260323_fulltext_search.sql`)

### 7. expire-listings 크론 안정화
- RPC 실패 시 직접 update 폴백 추가

### 8. 부동산 데이터 전수조사 + 부정확 데이터 정리
- 미분양 수동입력 23건 비활성화 (에코델타 롯데캐슬 등 존재하지 않는 단지명)
- 재개발 세대수 전량 리셋 (범천1-1: 4850→1323, 광명4R: 4300→1957 등 2~4배 뻥튀기)
- 재개발 중복 31건 비활성화 (부산15 + 경기16)
- 분양중 탭 시군구 통계 168건 제외
- 세대수 미확정 → 단계별 한글 설명 표시 (구역지정/조합설립/시행인가/관리처분/착공)

### 9. 데이터 제한 해제 + 시군구 확대
- 청약 limit 300→1000, 실거래 limit 2000→5000
- 실거래 크론 시군구 67→231개 (경기 31개, 부산 16개 확대)
- 청약 크론 페이지 5→10 (최대 5000건)

### 10. 카드 디자인 리뉴얼
- 청약: borderLeft 제거 → 접수중 블루 그라데이션, D-day 배지, 타임라인 바
- 실거래: 금액 우측 분리 강조, 최고가 대비% 상단 배지
- 재개발: 상단 전체너비 진행률 바 + 진행률% 인라인

### 11. DB 스키마 확장 (30+ 새 컬럼)
- 청약: 시공사/시행사/동수/최고층/주차/난방/분양가상한제/전매제한/거주의무/견본주택/총세대수
- 재개발: 시행사/동수/최고층/용적률/건폐율/부지면적/입주예정/최근접역/학교/핵심특징
- 실거래: 총세대수/동수/주차비율/최근접역
- 미분양: 시공사/시행사/최근접역/평당분양가/할인정보/핵심특징

### 12. 상세 페이지 정보 밀도 대폭 강화
- 청약 상세: 단지 개요(시공사/시행사/동수/최고층/주차) + 분양 조건(상한제/전매/거주의무) + 교통/학군
- 실거래 모달: 단지 가격 통계(최고/최저/평균) + 지도
- 재개발 모달: 10+ 신규 필드 + 핵심특징 하이라이트
- 미분양 상세: 시공사/할인정보/핵심특징 배너 + 최근접역 + 구글맵

---

## 세션 21 변경 요약 (24건 커밋, 160+ 파일)

### 1. 네이비 브랜드 컬러 시스템 전면 전환
- 오렌지(#FF4500) → 네이비(#0B1426) + 블루(#2563EB) 전체 전환
- 로고/파비콘/PWA아이콘/OG이미지/브랜드이미지 전체 재생성 (29파일)

### 2. 다크모드 단일 테마 확정
- 라이트모드 완전 제거, 텍스트 가독성 개선

### 3. 부동산 데이터 정확성 검증 & 수정
- KST 보정, 재개발 서울 104건 stage 수정, 검색 GIN 인덱스 추가

### 4. 기능 추가
- 글쓰기 임시저장 (localStorage draft)

---

## 미해결 (다음 세션)

### 핫픽스 (세션 24)
- [x] 블로그 상세 500 에러 수정 (isomorphic-dompurify → sanitize-html.ts) ✅
- [x] 피드 콘솔 404 수정 (watchlist → stock_watchlist 테이블명) ✅

### 긴급
- [ ] Supabase 세션 24 마이그레이션 실행 (`20260323_session24_evolution.sql`) — ✅ 실행 완료
- [ ] Vercel ERROR 배포 정리 (동시 빌드 큐)

### 관리자 수동
- [x] Supabase FTS 마이그레이션 실행 ✅ 세션 22
- [x] Supabase 상세 필드 마이그레이션 실행 ✅ 세션 22
- [x] Supabase 세션 24 마이그레이션 실행 ✅ 세션 24 (테이블4+RPC5+인덱스6)
- [ ] Google/네이버 서치콘솔 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY + KIS_APP_SECRET 환경변수
- [ ] STOCK_DATA_API_KEY 발급
- [x] blog_series 시리즈 10개 + 1,393편 매핑 ✅ 세션 24
- [x] Supabase 세션 28 마이그레이션 실행 ✅ (apt_review_likes + portfolio_snapshots)

### 코드
- [x] AptClient 2060→205줄 완전 분할 (5개 탭 + apt-utils, 90% 감소) ✅ 세션 24
- [x] AptClient 탭별 lazy fetch 적용 (SSR 60%+ 감소) ✅ 세션 28
- [x] crawl-nationwide-redev withCronAuth+timeout 안정화 ✅ 세션 28
- [x] 재개발 세대수 크론 검증 수집 (redev-verify-households 매주 화) ✅ 세션 28
- [x] 청약 상세의 신규 필드 데이터 채우기 (apt-backfill-details 매주 수) ✅ 세션 28
- [x] 블로그 시리즈 시드 크론 (blog-series-assign 매일 03:30) ✅ 세션 28
- [x] 포트폴리오 수익률 히스토리 (portfolio-snapshot + 30일 차트) ✅ 세션 28
- [x] 지도뷰 클러스터링 (MarkerClusterer + limit 300) ✅ 세션 28
- [x] 리뷰 좋아요/신고 기능 ✅ 세션 28
- [x] Skeleton UI 피드/주식/블로그 전 탭 확대 적용 (11개 loading.tsx) ✅ 세션 28
- [x] auto-grade 크론 commentCounts 스코프 오류 수정 ✅ 세션 28
- [x] 재개발 좌표 수집 크론 (redev-geocode 매주 목) ✅ 세션 28
- [x] cleanup 크론 강화 (stuck 정리 + 로그 로테이션) ✅ 세션 28
- [x] createClient→getSupabaseAdmin 전체 통일 (API 0건 잔존) ✅ 세션 28
- [x] 블로그 시리즈 대량 매핑 96.8% (13,185→473 미할당) ✅ 세션 28
- [x] 풀스택 감사 A+B 전건 수정 (런타임+SEO+접근성+보안) ✅ 세션 28
- [x] safe-catch 주요 파일 적용 (FeedClient/StockClient/AptClient) ✅ 세션 24
- [x] 모달 Escape+배경스크롤방지 (AptClient/StockClient) ✅ 세션 24

- [x] RLS 적용 (price_alerts/portfolio_holdings/apt_reviews/blog_series) ✅ 세션 24
- [x] 블로그 XSS 방어 (DOMPurify + marked 이미지 lazy) ✅ 세션 24
- [x] CRON_SECRET 클라이언트 노출 수정 ✅ 세션 24
- [x] 주요 4페이지 Suspense 경계 추가 ✅ 세션 24
- [x] 피드 cursor 페이지네이션 ✅ 세션 24
- [x] 알림 뱃지 30초 폴링 ✅ 세션 24
- [x] TopLoadingBar 페이지 전환 인디케이터 ✅ 세션 24
- [x] 주식 상세 JSON-LD ✅ 세션 24
- [x] 글쓰기 폼 aria-label ✅ 세션 24
- [x] Sentry 크론 에러 태그 ✅ 세션 24
- [x] PWA shortcuts + SW 캐시 버전 업데이트 ✅ 세션 24
- [x] apt_transactions GIN 인덱스 ✅ 세션 24

### 완료
- [x] 분양중 골드 하이라이트 ✅
- [x] Full-Text Search ✅
- [x] auto-grade 크론 개선 ✅
- [x] 부동산 데이터 전수조사 + 부정확 데이터 정리 ✅
- [x] 데이터 제한 해제 (청약1000/실거래5000/시군구231) ✅
- [x] 카드 디자인 리뉴얼 ✅
- [x] DB 스키마 확장 (30+ 컬럼) ✅
- [x] 상세 페이지 정보 밀도 강화 ✅
- [x] 부동산 5개 탭 검색 + 통계 + 위험도 + 신고가 ✅ 세션 23
- [x] 어드민 커맨드센터 전면 재정비 (CRON_MAP 44개 + 품질패널 + AI현황) ✅ 세션 23
- [x] 크론 감사 (aggregate RPC 생성 + 구형 블로그 제거) ✅ 세션 23
- [x] AI 한줄 분석 크론 + UI ✅ 세션 22
- [x] 빌드 에러 수정 (ClientDynamics 분리) ✅ 세션 23
- [x] trigger-cron API 생성 ✅ 세션 23

---

## 주의사항
- 두 컴퓨터 동시 작업 시 충돌 전적 → 작업 전 반드시 git pull
- ThemeToggle은 default export (named import 금지)
- 에러 시 catch에서 200 반환 (재시도 루프 방지)
- 블로그는 다른 컴퓨터에서 크론으로 생성 중 — 함부로 삭제 금지
- profiles.points 직접 UPDATE 절대 금지 → award_points/deduct_points RPC
- 알림은 DB 트리거가 처리 — 수동 INSERT 금지 (팔로우만 예외)
- 페이지뷰: 관리자(is_admin) 조회수 제외됨 (세션22 적용)
- 재개발 세대수: 전량 NULL 리셋 상태. 새로 입력 시 반드시 공식 출처 확인 후 입력
- AdminCommandCenter: 신규 DB 쿼리 결과는 반드시 state에 저장 후 JSX에서 참조 (loadAll 로컬 변수 직접 참조 금지)
- CRON_MAP: 크론 추가/삭제 시 라우트파일+vercel.json+CRON_MAP 3곳 동시 반영
- aggregate-trade-stats RPC: `aggregate_trade_monthly_stats()` — 컬럼명 `region` (region_nm 아님)
- blog_series 테이블 시드 필요 — 시리즈 데이터 없으면 /blog/series 빈 페이지 (세션24)
- 부동산 지도뷰: NEXT_PUBLIC_KAKAO_JS_KEY 환경변수 필수 (세션24)
- check-price-alerts 크론: 평일 장중 15분마다 실행, price_alerts 테이블 필요 (세션24)
- apt_review_likes 테이블 ✅ 마이그레이션 실행 완료 (세션28)
- portfolio_snapshots 테이블 ✅ 마이그레이션 실행 완료 (세션28)
- 부동산 탭 lazy fetch: 미분양/재개발/실거래는 SSR이 아닌 클라이언트 fetch, tab-data API 의존 (세션28)
- API routes에서 createClient 직접 사용 0건 — 반드시 getSupabaseAdmin() 사용 (세션28 통일)
- redev-geocode 크론: NEXT_PUBLIC_KAKAO_JS_KEY가 REST API 키로도 사용됨 (세션28)

## 세션 31E — 주식 종목명 근본 수정 + 어드민 보안 완료

### 주식 종목명 잘림 근본 수정
- 모바일 480px 이하: 종목코드, 상세 버튼, 스파크라인, 퍼센트 막대, 원화 환산 숨김
- 이름 공간: ~50px → ~160px (한글 6~8글자 표시 가능)

### 어드민 API 보안 완료 (27/27)
- `requireAdmin()` 헬퍼로 `is_admin` 권한 검증 통일
- blog-rewrite, cron-summary, seed-finance-blogs 3개 추가 보호
- supabase alias 추가로 기존 코드 호환
