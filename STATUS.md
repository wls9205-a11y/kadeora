# Session 189 — Post-Marathon Recovery (2026-04-28 KST)

브랜치: `fix/post-marathon-recovery` · 한 commit 한 deploy.

## 0) DB 인시던트 — `match_related_blogs` row_to_jsonb(record) 버그 (Architecture Rule #11)
- claude.ai 측에서 production DB 에 직접 핫픽스 적용 (마이그레이션: `fix_match_related_blogs_row_to_jsonb_record`).
- 본 PR 에서는 추가 SQL 마이그레이션을 추가하지 않음. (사후 마이그레이션은 `supabase mcp` 로 등록·관리됨.)

## 1) Track A — Chrome 단일화 (LiveBar)
- `(main)/layout.tsx` 가 이미 단일 `Navigation` (header + mobile bottom nav) 을 갖고 있음 → 추가 변경 불필요.
- 누락 영역인 LiveBar 만 layout 으로 이전:
  - `src/components/ui/LiveBarChrome.tsx` 신설 — `usePathname()` 기반 page 분기, fetch 실패/로딩 시 skeleton (텍스트 ❌).
  - `src/app/api/livebar/route.ts` 신설 — `?page=apt|stock|blog|feed` 카운트 합쳐 `{text}` 반환. 60s revalidate.
  - `(main)/layout.tsx` 에 `<LiveBarChrome />` 1회 mount.
  - `/apt`, `/stock`, `/blog`, `/feed` 페이지에서 인라인 `<LiveBar text=…/>` + import 제거.
- 결과: 4 페이지 nav DOM 동일, LiveBar 텍스트는 클라이언트 fetch 후 채워지며 실패 시 텍스트 0.

## 2) Track B — 클라이언트 버그 3종
- **B-1** `src/app/(main)/apt/page.tsx`, `src/app/(main)/stock/page.tsx` — Suspense fallback 텍스트("부동산 정보를 불러오는 중...", "주식 시세를 불러오는 중...") → `null`. SSR HTML 에 자열 박힘 제거 (view-source 0건 충족).
- **B-2** `src/lib/market-hours.ts` 신설 — KST(Asia/Seoul) 환산 후 weekday 판정. `kstWeekday`, `isKstWeekend`, `isKstWeekday`, `kstWeekdayLabel`, `isKrxOpen` export. `DailyReportCard.tsx` 가 새 helper 사용.
- **B-3** `src/components/PageViewTracker.tsx` — `/api/analytics/pageview` 전송 경로를 `navigator.sendBeacon` 우선, 실패 시 `fetch({ keepalive: true })` 폴백으로 변경. (`/api/analytics/events` 는 이미 `src/lib/analytics.ts` 에서 sendBeacon 사용 중.)
- **B-4 og-blog TypeError** `src/app/api/og-blog/route.tsx` — Vercel logs 에서 6장 burst 마다 6번 throw → 302 redirect 폴백 중. 원인: `renderCover` (line 84) `post.title.length`, `renderKeyPoints` (line 130-131) `post.title.slice/length` 가 `post.title === null` row 에서 TypeError. 기존 try 는 `new ImageResponse(...)` 만 감싸 render fn 호출(body 구성) 시점의 throw 를 잡지 못함. 수정:
  - `fetchPost()` 후 row 정규화 — title/excerpt/tldr/meta_description/hub_cta_target/hub_apt_slug 를 string 또는 null 로 강제. title 이 비면 slug 또는 `'카더라 콘텐츠'` 사용.
  - body 구성 + ImageResponse 를 단일 `try` 로 wrapping → 어떤 필드 throw 도 fallback redirect (`/images/brand/kadeora-hero.png`) 로 다운그레이드.
  - error log 에 `{ slug, card, hasPost, message, stack }` 포함 → 차후 원인 row 추적 용이.

## 3) Track C — ISR + 카드
- **C-1** `scripts/revalidate-sweep.ts` 신설 — `'use server'` action, `requireAdmin()` 가드. `/apt`, `/blog`, `/feed`, `/apt/region` 루트 + 활성 `apt_sites.slug` 전수 + 게시 `blog_posts.slug` 전수 + region/sigungu/category 조합 일괄 `revalidatePath`. 어드민 라우트에서 import 해 호출.
- **C-2 popularity_score === 100 hide** — 4 곳에 `!== 100` 가드 추가:
  - `src/components/apt/AptHubCuration.tsx` (오늘의 추천 카드 ★ pill)
  - `src/app/(main)/apt/page.tsx` (HeroCard stat)
  - `src/app/(main)/apt/ranking/[region]/[category]/page.tsx`
  - `src/app/(main)/apt/region/[region]/[sigungu]/[category]/page.tsx`
- **C-2 카드 Link wrap** — 활성 apt 카드 렌더링 사이트(`AptClient.tsx`, `AptHubCuration.tsx`, `LandmarkAptCards.tsx`, `AptRankingCard.tsx`, region/sigungu/category 페이지) 모두 이미 `<Link>` 래핑 확인. 별도 누락 발견 사례 없음.

## 검증
- 로컬 `npm run build` (Track D).
- 로컬 smoke 8 URL — view-source 에서 "잠시만요" / "불러오는 중" 0건 확인.

## 금지 사항 준수
- daily_create_limit 미변경.
- 블로그 데이터 미변경.
- DB 마이그레이션 미추가.
- profiles.points 직접 UPDATE 없음.
- CSP middleware.ts 외 미변경.

---

# Session 188 — signup_source OAuth 보존 + 온보딩 미션 UI 활성화 (2026-04-27 KST)

## 배경 (실측 데이터)
- signup_source 추적률 8.9% (518건 중 46건만 기록 — **91% 누락**)
- first_mission 완료율 2.2% (638명 중 14명)
- 7일 재방문율 6.7% (15명 중 1명)
- 가입 후 행동: 스크롤만, 글/댓글/북마크 0건
- 인프라 (`first_mission_progress` jsonb, `WelcomeReward`, `GlobalMissionBar`) 는 이미 존재. 노출 부족이 진짜 병목.

## 변경

### 1) `src/app/auth/callback/route.ts` — signup_source 91% 누락 해결
- **버그:** `void supabase.from('profiles').update({signup_source}).then(()=>{})` fire-and-forget 패턴이 직후 `NextResponse.redirect(...)` 가 발사되며 cancel 됨 (서버리스 함수 종료). 이게 91% 누락의 직접 원인.
- **부수 버그:** `searchParams.get('source') ?? 'direct'` 가 "URL 에 source 없음" 케이스를 'direct' 로 덮어 `!== 'direct'` 가드가 항상 통과되는 것처럼 보이지만, 실제로는 어떤 source 값이라도 update 자체가 cancel 되어 무용지물.
- **수정:**
  - `sourceParam = searchParams.get('source')` (raw, null 가능) 추가 — 'direct' fallback 과 분리.
  - admin client (`getSupabaseAdmin`) + `await` + `.is('signup_source', null)` 멱등 가드.
  - `sourceParam !== 'direct'` 일 때만 update — URL 에 없으면 건너뜀.
  - try/catch 로 실패 로깅 (silent fail 방지).

### 2) `src/components/GlobalMissionBar.tsx` — 미션 완료율 2.2% → 노출 강화
- **버그:** `useState(false)` (collapsed 기본값) — 사용자가 헤더 클릭해야만 4개 미션 보임. 14/638 의 직접 원인.
- **수정:**
  - `useState(true)` — 기본 expanded.
  - collapsed 시에도 4개 진행도 도트 (• • • •) 시각 노출 — 클릭 안 해도 진행 상황 인지 가능.
  - 댓글 미션 link `/feed` → `/blog` (블로그 글 읽고 댓글 다는 동선이 자연스러움).
  - 관심 미션 link `/onboarding` → `/apt` (interest mission 은 apt_site_interests 와 매핑됨).

### 3) `src/app/(main)/layout.tsx` — SignupNudgeModal 제거
- StickySignupBar 와 동일 대상 (비로그인) 에 중복 노출. SignupNudgeModal 은 모달 (intrusive), Sticky 는 하단 바 (gentle). gentler 옵션 유지.
- import + mount 둘 다 제거. 컴포넌트 파일 (`SignupNudgeModal.tsx`) 자체는 미삭제 — 향후 A/B 가능성 보존.

### 4) redirect URL 이중 인코딩 — 검증 결과 **버그 없음**
- `grep encodeURIComponent(encodeURIComponent` → 0 매치.
- 모든 `?redirect=...` 콜사이트가 `encodeURIComponent(pathname)` 1회 적용 (pathname 은 `usePathname()` 또는 `window.location.pathname` — 이미 디코드됨).
- `InterestRegisterHero.tsx` 의 변수 사전인코딩 패턴은 가독성만 다를 뿐 단일 인코딩. 행동 동일.

## 검증
- `npx tsc --noEmit --skipLibCheck` → src 코드 0 errors. (`.next/types/validator.ts` 의 stale admin/pulse_v3, master/execute-all, master/status 참조는 사전 빌드 잔여물 — 이번 변경과 무관)

## 다음 (재측정 시점 권장: 7일 후)
- signup_source 추적률 8.9% → ?
- first_mission_completed 2.2% → ?
- 7일 재방문율 6.7% → ?
- 만약 signup_source 추적률이 여전히 낮다면: `complete_signup_frictionless` RPC 가 자체적으로 signup_source 를 'direct' 로 덮어쓰는지 (RPC 본문 SQL 확인 필요) 추가 점검.

---

# Session 173 — P0 크론 stagger + P1 피드 정비 + s168 build fix 재적용 (2026-04-25 KST)

## 배경
s169+s170 머지가 origin 에서 33e071fd 로 revert 되며 s168 build fix 도 함께 사라짐.
이번 세션은 (a) P0 크론 안정화 + (b) P1 피드 정비 + (c) s168 build fix 재적용 (cherry-pick).
신규 컴포넌트 (LiveActivityBar/LiveDiscussionCards/DailyReportBadge) 생성 금지 — 기존 컴포넌트 수정만.

## P0 (Supabase 연결풀 보호)
1. **`vercel.json` 크론 stagger** — 매시 :00 동시 발사 5개 분산
   - `seed-posts`: `0 * * * *` (유지, 가벼움)
   - `refresh-mv`: `0 * * * *` → `12 * * * *`
   - `collect-site-images`: `0 * * * *` → `22 * * * *`
   - `blog-generate-images`: `0 * * * *` → `32 * * * *`
   - `blog-enrich-rewrite`: `0 * * * *` → `42 * * * *`
   - `0 */N * * *` 카덴스 크론은 의미 보존 위해 미변경
2. **`blog-quality-score/route.ts`** — `BATCH = 200 → 50` (Vercel 60s 제한 + DB 부하 보호)
3. **`AdminShell.tsx` + `NotificationBell.tsx`** — `setInterval 60s → 300s`
4. **`apt/search`** — RPC + revalidate=300 + perPage=30 이미 적용 (SKIP)
5. **`issue-draft` 중복** — 단일 entry, 중복 없음 (SKIP)

## P1 (피드 UX)
1. **`Sidebar.tsx`** — `🔔 알림` Link 제거 + orphan state/import 정리
2. **`AnonymousFeedHero.tsx`** — 거대 `🚀` CTA 카드 블록 제거. 가치/통계/청약/블로그/토픽 유지
3. **`QuickPostBar.tsx`** — collapsed state 1줄 슬림 (24px 아바타 + "무슨 생각이세요?")
4. **`AdBanner.tsx`** — 금색 1.5px 테두리 + soft glow
5. **`FeedClient.tsx`** — AttendanceBanner 양쪽 push 경로 + import 제거. 비로그인 i===2 컴팩트 CTA (poll/vs/predict/normal 모두)
6. **면책 문구** — s172 가 이미 변경 (SKIP)

## s168 build fix 재적용 (cherry-pick)
- `e9c0256a → 66d29116`: 4 cron force-dynamic + us-market-cron-helpers lazy
- `e7c780a9 → 71284cd2`: 5 page.tsx generateStaticParams=[] + 17 route.ts force-dynamic
- ⚠️ blog/[slug]/page.tsx 는 generateStaticParams 만 변경 (렌더링 로직 미변경)

## 검증
- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npm run build` (`.env.local` 제거 상태) → exit=0

## CTA 보존 확인 (s145 재발 방지)
- 카카오 CTA 3곳 건재: i===2 컴팩트 (신규) / i===3 RelatedContentCard / following 탭 안내 (line 382)
- AnonymousFeedHero 거대 CTA 만 제거 — 컴팩트 CTA 가 대체

## Forbidden 영역 준수
- ❌ blog/[slug]/page.tsx 렌더링 로직 미변경 — generateStaticParams 만 변경
- ❌ Navigation.tsx 신규 컴포넌트 삽입 안 함
- ❌ LiveActivityBar/LiveDiscussionCards/DailyReportBadge 신규 컴포넌트 생성 안 함
- ❌ award_points/deduct_points RPC 미변경
- ❌ vercel.json 크론 path 미변경 (schedule 만 변경)

## 다음 세션 잔여
- GitHub PAT 토큰 revoke
- Edge Function 2개 삭제 (`github-commit-patch`, `github-read-file`)
- Supabase Auth Leaked password protection
- RLS `auth_rls_initplan` 99건 래핑
- `mv_apt_pulse` RPC+cache
- `naver-complex-sync` 401
- 매 2/4/6 시간 :00 크론 stagger 필요 여부 모니터링

---

# Session 174 — 크론 stagger 확장 + canonical 정규화 + 진단 (2026-04-25 KST)

## 실제 변경 3건 (코드)
1. **`vercel.json`** — 매시 :00 발사 multi-hour 크론 5개 stagger
   - `check-price-alerts`: `0 */2` → `9 */2`
   - `issue-preempt`: `0 */2` → `11 */2`
   - `apt-parse-announcement`: `0 */4` → `43 */4`
   - `indexnow-new-content`: `0 */4` → `9 */4`
   - `blog-upcoming-projects`: `0 */4` → `49 */4`
   - 매 6시간 (`0 */6`) 4개 (`apt-parse-pdf-pricing`, `indexnow-mass`, `refresh-trending`, `auto-verify-households`)는 빈도 낮아 미변경
2. **`blog/[slug]/page.tsx:265`** — canonical URL 한글 slug 정규화
   - `${SITE}/blog/${slug}` → `${SITE}/blog/${encodeURIComponent(slug)}`
   - generateMetadata 내 alternates.canonical 만 변경. 페이지 렌더링 로직 미변경
3. **`apt/search/page.tsx`** — pg_trgm 인덱스 TODO 주석 추가 (실제 코드 변경 無)
   - 추가 권장: `CREATE INDEX ... USING gin (apt_name gin_trgm_ops)`

## 진단 결과 (코드 변경 無 — STATUS 기록)

### Task C: 면책 문구
- 현재 line 1236: "공공 데이터(국토교통부, 한국거래소, 금융위원회 등) 기반의 정보 제공" — s172 가 이미 변경
- **SKIP** (작업 불필요)

### Task D: 포인트 기능 검증
- `award_points` RPC 호출 경로 (10+ 지점 확인):
  - `welcome-bonus` 100P / `feed/short` 10P / `feed/vs` 10P / `comment` 5P / `share` 5P / `chat` 1P
  - `attendance-check` 10P (+streak7 30P, +streak30 100P)
  - `profile/mission` 50P / `profile/complete-bonus` 50P / `stock/watchlist` 50/200P
- `lib/point-rules.ts` POINT_RULES 정의 정상
- `AuthProvider.points` context → `ProfileHeader` 표시. Navigation 헤더엔 미표시 (디자인 결정)
- **상태: 정상. 수정 불필요**

### Task F: naver-complex-sync 401 진단
- 파일: `src/app/api/cron/naver-complex-sync/route.ts`
- API 호출처:
  - `https://new.land.naver.com/api/search` (line 30)
  - `https://fin.land.naver.com/front-api/v1/search/complex` (line 32)
  - `https://new.land.naver.com/api/complexes/{complexNo}` (line 44)
- **인증 방식: API 키 無 — Mozilla User-Agent + Referer 헤더로 스크래핑**
- **401 원인 추정:**
  1. 네이버가 봇 트래픽 감지 → User-Agent/IP 차단 (가장 가능성 높음)
  2. Referer 헤더 검증 강화 (네이버 land 도메인 외 거부)
  3. 일일 호출 한도 (스크래핑이라 공식 한도 없음, 실효적 throttle)
- **해결 옵션:**
  - (a) 네이버 부동산 공식 Open API 가입 (`fin.land.naver.com` 비공개라 어려울 수 있음)
  - (b) User-Agent 로테이션 + 헤더 다양화
  - (c) Vercel IP 회피 위해 별도 프록시 경유
  - (d) 크론 빈도 축소 (현 매시 → 6시간마다)
- **권장: (d) 즉시 적용 후 (b) 점진 도입. 코드 수정은 다음 세션에서**

### Task G: 슬로우 쿼리 인프라
- `/api/admin/analytics` 만 존재 (page_view 집계)
- pg_stat_statements 모니터링 엔드포인트 없음
- **TODO**: `/api/admin/slow-queries` 엔드포인트 추가
  ```sql
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
  ```

## 검증
- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npm run build` (`.env.local` 제거) → exit=0

## Forbidden 영역 준수
- ❌ blog/[slug]/page.tsx 렌더링 로직 미변경 (generateMetadata.alternates.canonical 만 변경, 사용자 명시 허용 범위)
- ❌ Navigation.tsx 미수정
- ❌ award_points/deduct_points RPC 미수정
- ❌ vercel.json cron path 미변경 (schedule 만)
- ❌ LiveActivityBar/LiveDiscussionCards/DailyReportBadge 미수정 (origin/main ff41d3cb 가 재추가했으나 건드리지 않음)

## 수동 처리 필요 (코드 외)
- GitHub PAT 토큰 revoke → GitHub Settings → Developer settings → PATs
- RESEND_WEBHOOK_SECRET → Vercel Dashboard → Settings → Environment Variables
- RLS `auth_rls_initplan` 99건 → Supabase SQL Editor 직접 실행
- 네이버 부동산 Open API 키 발급 검토 (naver-complex-sync 대안)
- pg_stat_statements 활성화 확인 + slow query 어드민 라우트 추가

---

# Session 161 — 위성 라우트 + VACUUM 크론 복구 (2026-04-24 KST)

## 작업 요약
1. **VACUUM 크론 dblink 우회로 수정** (Claude SQL, pg_cron 80개 schedule 무건드림)
   - `weekly_vacuum_analyze_blog` 재생성 **금지** — 이미 dblink로 수정 완료된 경로 유지
2. **위성 라우트 PR 머지 + 24,719편 위성 썸네일 복구**
   - PR `fix/satellite-endpoint` → `main` 머지 → Vercel 자동 배포
   - `src/app/api/satellite/route.ts` (edge, 30일 immutable): Esri World Imagery → OSM fallback → `/api/og-chart` 302
   - `src/components/AptImageGallery.tsx`: 위성 슬라이드에 🛰️ 위성 사진 배지 (모바일 캐러셀 + 데스크탑 1+2)
   - 머지 후 1회 SQL (`apt_complex_profiles` 만):
     ```sql
     UPDATE apt_complex_profiles
     SET images = jsonb_build_array(metadata->>'satellite_url_pending') || images,
         og_image_url = metadata->>'satellite_url_pending'
     WHERE metadata->>'satellite_url_pending' IS NOT NULL;
     ```
   - 외부 API 키 0개 추가. 인증 불필요 타일 소스만 사용.

## 잔여 이슈
- **`naver-complex-sync` 401** — Node에서 수동 재시도 필요. cron 루프가 아닌 일회성 backfill 스크립트.

## 금지 영역 (건드리지 말 것)
- `pg_cron` 기존 80개 schedule
- `weekly_vacuum_analyze_blog` 재생성 (dblink 경로 유지)
- `apt_complex_profiles.images` 직접 수정 (위 SQL 1회 외)

---

# Session 145 — v2.0 Week 1 (2026-04-22 KST)

## Commit 5 — `feat(admin): pulse_v3 tab + 4 widgets`
- **신규**:
  - `src/app/api/admin/pulse_v3/route.ts` — GET requireAdmin. 4 뷰 Promise.all 병렬 fetch.
  - `src/app/admin/pulse_v3/page.tsx` + `PulseV3Client.tsx` — 전용 라우트 + 클라이언트 렌더
- **수정**: `src/app/admin/AdminShell.tsx` — 'pulse_v3' 탭 등록 (🫀 아이콘, 맨 오른쪽)
- **위젯 4종**:
  1. **KPI 8-grid**: active_now / pv_today (yst ±%) / uv_today / signups_today / signups_7d / cta_ctr_7d / whales_unconverted / action_items
  2. **Blog × APT 전환 매트릭스**: 6-bucket 색상 (gray→red→yellow→green→emerald). 각 셀 signups/visitors (pct%)
  3. **미가입 고래 TOP 10**: visitor_id / pv / active_days / uniq_pages / deep_reads / last_seen
  4. **Action Items**: severity pill (red/yellow/cyan) + key + message + action
- **배너**: red/yellow severity Action Items 있을 때 상단 경고 배너
- **DB deps**: `v_admin_master_v3`, `v_admin_action_items`, `v_admin_whale_unconverted`, `v_admin_behavior_conversion_matrix`
- **접근**: `/admin` 에서 'Pulse v3' 탭 또는 `/admin/pulse_v3` 직접 URL
- **Caveats**: `get_admin_user_detail` 모달 연동은 이번 C5 범위 밖 — 고래 행 클릭은 단순 표시만.

## Commit 4 — `feat(blog): 50% scroll mid-gate with variants`
- **신규**: `src/components/blog/BlogMidGate.tsx` (client)
  - props: `{ blogId, isGatedPost?, isLoggedIn?, sentinelSelector?, className? }`
  - 세션당 1회 (`sessionStorage.blog_mid_gate_shown_${blogId}`)
  - variants DB: `cta_message_variants WHERE cta_name='blog_mid_gate' AND variant_key='default' AND is_active=true`
  - 폴백: `title="이 글 끝까지 보는 사람 8%뿐"` / `body="핵심 정보는 아래에..."`
  - sentinel `[data-mid-gate-sentinel]` IntersectionObserver 진입 시 노출. 없으면 window scroll 50% 폴백.
  - UI: indigo gradient card + dismiss(×) + 카카오 노란 버튼
  - 이벤트: `cta_view('blog_mid_gate')` / `cta_click('blog_mid_gate')` / `cta_click('blog_mid_gate_dismiss')`
- **수정**: `src/components/blog/BlogGatedRenderer.tsx` — classified.flatMap 으로 refactor, H2 섹션 중간(`midIdx = floor(length/2)`) 앞에 `<div data-mid-gate-sentinel />` inject
- **수정**: `src/app/(main)/blog/[slug]/page.tsx` — 비로그인 + `!has_gated_content` 인 경우만 `<BlogMidGate />` 마운트 (BlogGatedWall 과 중복 방지)
- **DB deps**: `cta_message_variants` (이미 존재, blog_mid_gate default row 필요)
- **Caveats**: BlogGatedRenderer 가 client-side 렌더이므로 gated 포스트에서는 sentinel 주입 가능. 단 BlogGatedWall 과 중복 노출 방지 위해 mid-gate 는 `has_gated_content=false` 인 블로그에만 노출.

## Commit 3 — `chore(cta): remove 5 dead CTAs + C1 unlock logs backfill`
- **삭제 파일**: `src/components/ActionBar.tsx`, `src/components/BlogFloatingBar.tsx`, `src/components/ContentLock.tsx`
- **수정**:
  - `src/app/(main)/layout.tsx` — ActionBar import + `<ActionBar />` 제거
  - `src/app/(main)/blog/[slug]/page.tsx` — BlogFloatingBar import + 렌더 제거, LoginGate blog_compare/blog_stock_ai/blog_finance 블록(996-1022) 제거
  - `src/app/(main)/apt/[id]/page.tsx` — ContentLock import + 2 wrapper(실입주/한줄평) 제거 (내부 컴포넌트만 노출)
- **유지**: action_bar_kakao / action_bar_comment / action_bar_bookmark (별개 액션 버튼), 기타 고CTR CTA 전부 보존
- **신규**: `src/app/api/events/apt-compare-unlock/route.ts` (fire-and-forget INSERT), `src/components/apt/SimilarAptsTracker.tsx` (client, mount=viewed_3rd_locked / 3rd card click=clicked_3rd_cta)
- **C1 보강**: `SimilarAptsSection` 에 `data-similar-apt-card` + `data-similar-idx` 속성 추가 + `<SimilarAptsTracker />` 마운트 → apt_compare_unlock_logs 기록
- **DB**: `apt_compare_unlock_logs` (기존) — rowsecurity=false 라 admin 경유 INSERT 필수
- **Caveats**: blog_finance feature 도 동일 LoginGate 블록에 포함되어 같이 제거됨 (별도 낮은 CTR). 복구 필요 시 별도 컴포넌트로 재도입.

## Commit 2 — `feat(blog): related blogs 3-card, 3rd = strategy badge`
- **신규**: `src/components/blog/RelatedBlogsSection.tsx` (server), `src/components/blog/RelatedBlogsTracker.tsx` (client)
- **수정**: `src/app/(main)/blog/[slug]/page.tsx` — BlogActions 직후, BlogEndCTA 앞에 `<RelatedBlogsSection blogId={post.id} />` 마운트. import 추가.
- **DB**: `match_related_blogs(p_blog_id bigint, p_limit int default 3)` → jsonb { id, title, slug, cover_image, reading_minutes, tldr, badge }
- **UI**: grid auto-fit minmax(220px,1fr), 16:9 cover, 제목 2-line clamp, tldr 2-line clamp, ⏱{min}분. badge='strategy' → amber gradient + ⚡전략 pill.
- **이벤트**: mount 시 cta_view `related_blog_section` (category=engagement). data-related-card 클릭 capture → cta_click `related_blog_strategy`/`_normal`.
- **섹션 헤더**: "이어서 읽을 만한 글" + 서브 "블로그 2글 이상 본 분들, 가입률 6.5배 (실측)"
- **Caveats**: isBot 체크 제외 (SSR 렌더 허용). RPC 0건 → 섹션 null.

## Commit 1 — `feat(apt): similar apts section (get_similar_apts RPC)`
- **파일**: `src/components/apt/SimilarAptsSection.tsx` (신규, 서버 컴포넌트), `src/app/(main)/apt/[id]/page.tsx` (import + 마운트 지점 추가)
- **동작**: `apt_sites.id` → `get_similar_apts(p_apt_site_id, p_limit=6)` RPC 호출 → 6개 카드 그리드
- **카드 구성**: satellite_image_url 우선, 없으면 og_image_url → 폴백 /api/og. 이름 + 지역(region sigungu).
- **위치**: `apt/[id]` 페이지 하단, `Disclaimer` 직전
- **링크**: `slug` 있으면 `/apt/{slug}`, 없으면 `/apt/{id}` (UUID)
- **스타일**: grid `auto-fit minmax(140px, 1fr)`, aspect 4/3, 모바일 1~2 col / 데스크탑 4~6 col 자동
- **안전**: RPC 실패 → 빈 배열 → 섹션 null (폴백 렌더 없음), 로그 없음

---

# 카더라 프로젝트 STATUS — 세션 52 (2026-03-29 KST)
> SEO 극대화 + UI 글래스모피즘 + 프리미엄 멤버십 풀스택 + 주식 카드뷰
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황

| 지표 | 수치 | 비고 |
|------|------|------|
| **유저** | 121명 | 실제 21명 + 시드 100명 |
| **프리미엄** | 0명 | 결제 시스템 구현 완료, Toss 키 설정 대기 |
| **게시글/댓글** | 4,195 / 2,115 | |
| **블로그** | 18,522편 | IndexNow 미전송 18,522편 (크론 대기) |
| **주식 종목** | 728개 | KOSPI 212/KOSDAQ 152/NYSE 222/NASDAQ 142 |
| **청약** | 2,692건 | |
| **apt_sites** | 5,512 (active) | |
| **재개발** | 202건 | |
| **완료 결제** | 0건 | Toss 키 미설정 |
| **크론 에러** | 0건 (24h) ✅ | 181회 정상 |

## 코드베이스

| 지표 | 수치 |
|------|------|
| 파일 수 | 544개 |
| API 라우트 | 180개 |
| 크론 | 79개 |
| DB 테이블 | 127개 |
| 최신 커밋 | `3350f00` |

---

## 🚨 즉시 실행 필요 (코드 외)

### [긴급] 3/31 마감
- [ ] **토스 정산 등록**

### [최우선] 검색 노출 (Google 인덱싱 0건!)
- [ ] **Google Search Console** → 사이트맵 `https://kadeora.app/sitemap.xml` 제출
- [ ] **Google URL 검사** → `/`, `/stock`, `/apt`, `/blog`, `/feed` 수동 인덱싱
- [ ] **네이버 서치어드바이저** → 사이트맵 + RSS 4개 제출
- [ ] **Bing 웹마스터** → 사이트맵 제출
- [ ] **Daum 검색등록** → 사이트 등록

### [중요] 결제 활성화
- [ ] **Toss 키 발급** (developers.tosspayments.com)
- [ ] **Vercel 환경변수**: `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- [ ] 테스트 결제 → DB 확인

### [중요] API 키
- [ ] **Anthropic 크레딧 충전** (블로그 크론 재가동)
- [ ] **KIS_APP_KEY** 발급 (주식 실시간)
- [ ] **FINNHUB_API_KEY** 발급

### [권장] 마케팅
- [ ] 네이버 블로그/카페 소개글 (백링크)
- [ ] 커뮤니티 소개글 (디시, 에펨코리아 등)
- [ ] Google Adsense 승인 대기 (코드 적용됨)

---

## 세션 52 완료 작업

### SEO 실전 강화
- IndexNow 배치 500개 + 3개 엔드포인트
- indexnow-mass 크론 (500편/6시간)
- indexed_at 마이그레이션 실행 완료
- 블로그 200편 + 주식 728종목 SSG
- preconnect + modifiedTime 수정
- Google deprecated ping 제거

### UI/UX 글래스모피즘
- CSS 8종: kd-glass/card-glow/btn-glow/counter/pulse-dot/shimmer/section-card/fade-in
- 헤더/탭바/랜딩/피드/블로그/EmptyState 전면 개선
- 주식 카드뷰 토글

### 프리미엄 멤버십 풀스택
- /premium 랜딩 + 결제 후처리 + 상태 API + 만료 크론
- AuthProvider isPremium + 배지 + 업셀 배너 3곳

---

## 크론 (79개)

| 카테고리 | 수 | 비고 |
|---------|-----|------|
| 블로그 | 37 | AI 크레딧 부족→생성 0건 |
| 주식 | 7 | 정상 |
| 부동산 | 14 | 정상 |
| SEO | 2 | indexnow, indexnow-mass |
| 결제 | 1 | premium-expire |
| 시스템 | 18 | 정상 |

## API 키 현황

| 키 | 상태 |
|----|------|
| ANTHROPIC_API_KEY | ⚠️ 크레딧 부족 |
| CRON_SECRET | ✅ |
| STOCK_DATA_API_KEY | ✅ |
| INDEXNOW_KEY | ✅ |
| TOSS_SECRET_KEY | ❌ 미설정 |
| NEXT_PUBLIC_TOSS_CLIENT_KEY | ❌ 미설정 |
| KIS_APP_KEY | ❌ 미발급 |
| FINNHUB_API_KEY | ❌ 미발급 |

## 아키텍처 규칙 (불변)

1. 블로그 데이터: 절대 삭제/수정 금지
2. stockcoin.net: 카더라와 연결 금지
3. 포인트: RPC로만 수정
4. CSP: middleware.ts 전용
5. 크론 에러: 항상 200 반환
6. OG 폰트: Node.js fs (Edge 금지)
