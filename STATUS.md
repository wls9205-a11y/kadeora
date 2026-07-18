## [P0 indexnow + P1 banner-D] 2026-07-18 — 전수조사 후 유일 미해결(IndexNow) 수정

### P0 — IndexNow 71일 조용한 실패 수정 (commit 003a3924)
증상: indexnow-urgent 가 9ms 에 `submitted:100` 반환하는데 실제 제출 0, urgent pending
154건 attempt_count=0. 앱 코드 근본원인 2개 (DB 결백 — claude.ai 실측):
1. `lib/indexnow.ts` 가 `INDEXNOW_KEY || ''` (fallback 없음) → env 미설정 시 submitIndexNow
   가 no-op(9ms). **호스팅 키 `3a23def313e1b1283822c54a0f9a5675`**(public/*.txt=200,
   indexnow-full-sweep/mass 가 쓰는 키)를 fallback 으로. 라이브 포털 실측: api.indexnow.org
   200 / bing 200 / naver 422(포털측). → 이 lib 를 쓰는 모든 호출부(blog-publish-queue,
   issue-draft, api/indexnow, indexnow-backfill, issues/publish)도 동시 복구.
2. 라우트가 `status:'sent'` 기록 — CHECK(pending/submitted/success/failed/skipped)에 없어
   UPDATE 가 조용히 실패 → 행이 pending/attempt_count=0 에 영구 고착, 그런데도 라우트는
   submitted:urls.length(가짜 성공) 반환. (s258 회귀: 주석에 'submitted'→'sent' 로 바꿨다고
   명시돼 있음.) → 되돌려 `submitted`, 실제 포털 결과로 `submitted`/`failed` 확정.
- submitIndexNow 가 `{ok,accepted,attempted}` 반환하도록 변경(하위호환, 기존 호출부 영향 0).
- 검증: 키·포털 수락 curl 실측(indexnow.org/bing 200, naver 422) + type-check/build.
  **큐 status 전이 + net._http_response 는 claude.ai 가 프로덕션에서 검증**(로컬 env 없음).
- env `INDEXNOW_KEY`: **미설정 확정**(9ms no-op = 빈 키 early-return 근거). fallback(호스팅 키)로
  해소. 유지보수 위해 Vercel env 등록 권장(선택). 검증파일 public/3a23…675.txt=200.
- **staged 롤아웃**(commit 49e58ba7): urgent/batch `BATCH_SIZE` 100/500→**10**. 포털 응답
  확인 후 100/500 복원 예정. 3,726건 한 번에 안 푼다.
- **같은 근본원인 추가 수정**(commit 26d705c4): `indexnow-new-content`(5a7b…→404) +
  `blog-auto-publish`(kadeora-indexnow-key→404) 키를 호스팅 키로 교정. (큐와 무관·bounded.)
- ⚠️ 남은 같은 패턴(플래그): `search-engine-ping` `INDEXNOW_KEY||''` 빈 키(저가치·homepage ping).
- ⚠️ failed 7,927 리셋은 이 수정 동작 확인 후 (claude.ai, 500건씩).

### P1 — 배너 최종본 (design D, 이미 라이브 fe7324c1)
플랜의 "현재 prod=88861795"는 stale. design D(항상 고정 + "부동산 정보 공유방" +
MEMBER_COUNT=1240 + 라이브 점)는 이미 fe7324c1 로 배포됨. banner-z.mjs 재실측 결과
**z-30 은 여전히 겹침**(헤더가 배너 덮음, scrollY 20/40, 모바일+데스크톱) — 원인은 배너
숨김이 아니라 헤더(sticky 깨져 흐름 안)가 fixed 배너를 뚫고 올라오는 것. → **z-[110] 유지**.
인라인 배너 blog/apt/complex 기존 삽입 유지. MEMBER_COUNT 는 사용자가 실값 교체 예정.

### P2 — 손대지 않음 (근거: 트래픽 적어 실익 없음)
커넥션 31/90, auth_rls_initplan 114, blog_no_cover 17 — 트래픽 회복 후로 미룸.

---

## [banner v2] 2026-07-18 — sticky 배너 디자인 B(순수 CSS) + position:fixed 로 스크롤 동작 살림

디자인 B 확정(카카오 노랑, 52px, 순수 CSS — 이미지 폐기). `files (56)` 신규 컴포넌트로
`StickyTalkBanner.tsx` 덮어씀. `STICKY_BANNER_HEIGHT=52` export.

**핵심 판단(사용자 "기존 구조 보고 판단해라" 위임)**: 델리버된 컴포넌트는 `position:sticky`
지만, `globals.css` 의 `html,body{overflow-x:hidden}` 가 sticky 를 앱 전역에서 깨뜨려
(기존 Navigation 헤더도 pin 안 됨 — 이전 프로덕션 실측) sticky 로는 "스크롤 다운 숨김/업
복귀" 가 동작 안 함. → **`position:fixed` + 동일 높이 spacer** 로 구현(디자인/카피/높이/
export 는 그대로). fixed 는 overflow 영향 없어 pin·hide·show 정상. spacer 가 콘텐츠를
밀어 겹침 방지 → **Navigation top 조정 불필요, 이전 var(--talk-banner-h) 변경은 되돌려
Navigation 원복**(top:0).

- 트래킹: sticky `handleClick` → `track('banner_click','bujeonggong_talk',{slot:'sticky',page_path})`.
- 인라인(blog/apt/complex)·InlineTalkBanner·webp 원본은 이전 커밋 그대로 유지.
- sticky-slim*.webp 없음(삭제 불필요).

검증: type-check clean, build 성공. 스크롤 hide/show·375px 는 배포 후 프로덕션 스모크.

---

## [banner] 2026-07-18 — 부정공 TALK 배너 통합 (claude.ai 에셋/컴포넌트 → 레포 연결)

에셋 4개 복사: `public/banners/bujeonggong-talk{,-mobile}.webp`,
`src/components/banner/{Sticky,Inline}TalkBanner.tsx`. (원본은 로컬 Downloads —
`/mnt/user-data/outputs/` 는 claude.ai 샌드박스 경로라 이 머신엔 없음.)

연결 3곳:
1. 상단 sticky — `ClientShell.tsx` 의 `<Navigation/>` 바로 위에 `<StickyTalkBanner/>`.
   **z-index 충돌 해결**: 헤더(`Navigation` <header>)가 `sticky top:0 z:100` 이라
   배너(z-30)와 top:0 에서 겹침. 헤더 `top` 을 `var(--talk-banner-h, 0px)` 로 바꾸고
   배너가 자기 높이를 이 변수에 발행(보이면 헤더가 그만큼 내려가 나란히 stack,
   숨으면 0 복귀). 배너 없는 라우트/미마운트 시 기본값 0px → 기존과 동일(blast radius 0).
2. 인라인 — `apt/[id]`(AptBlogStack↔AptCompareTable 사이), `apt/complex/[name]`
   (설명 섹션↔AptLocationMini 사이), `blog/[slug]`.
3. 트래킹 — 두 컴포넌트 `handleClick` 에서 `track('banner_click','bujeonggong_talk',
   {slot, page_path})` (`@/lib/analytics`). InlineTalkBanner 는 이를 위해 'use client' 전환.

중복 방지: StickyTalkBanner `INLINE_ROUTES` 정규식이 blog/apt/complex 에서 상단 배너를
렌더 안 함(그대로 사용).

⚠️ 미완/판단 필요 — **blog 인라인은 "본문 중간" 이 아니라 "본문 진입부(TOC/차트 직후)"**.
본문은 4개 렌더 경로(isBot / BlogGatedRenderer / BlogTossGate / SmartSectionGate)로
갈리는데 실사용자 경로는 gate 컴포넌트 내부에서 HTML 을 렌더 → 진짜 중간 분할은 그 3개
전환율-critical 컴포넌트를 수정해야 함. 장애 직후 blast radius 고려해 보류하고 안전한
진입부에 배치(하단 AdSlot 과 250px+ 이격, isBot 제외). 진짜 중간이 필요하면 gate 수정 필요.

검증: type-check clean, build 성공. 스크롤 숨김/복귀·375px 는 로컬 env(Supabase 키) 없어
프로덕션/프리뷰 스모크 필요.

---

## [hotfix-522 r2] 2026-07-18 — DB 진단 정정 후 앱 코드 후속 + IndexNow

DB 진단 정정 (claude.ai 실측):
- 504 원인 = **쿼리 속도가 아니라 동시 커넥션 개수**. 개별 쿼리는 빠름
  (apt_subscriptions ILIKE 8.2ms, apt_sites region 0.8ms). max_connections=90.
- 진짜 근본: statement_timeout=120s(함수는 30~60s) + idle timeout 0 + kill_slow_queries()
  가 authenticator(=PostgREST 전 트래픽)를 보호목록에 넣어 좀비를 못 죽임 → 단방향 누적.
- DB 핫픽스는 claude.ai 가 **검증본(hotfix-522-db-VERIFIED.sql)** 으로 처리:
  kill_slow_queries authenticator 보호 제거 + role statement_timeout(anon/auth 8s,
  service_role 55s) + kill cron 1분. → 내가 넘긴 미검증 `docs/_setup/hotfix-522-db.sql`
  은 **폐기(삭제)**. RPC 통합 함수도 폐기(개별 쿼리 빠르므로 불필요).

앱 코드 (요청당 동시 커넥션 수 축소 — 개수 목표):
1. `apt/[id]/page.tsx` — fan-out 8-wide → **2-wide 4웨이브**, 렌더당 peak 동시 커넥션 8→2.
2. `apt/complex/[name]/page.tsx` — 4-wide → **2-wide 2웨이브**, peak 4→2.
3. `indexnow-new-content` 504 — 엔드포인트 fetch 에 timeout 부재 → 포털 hang 시 60s 블록.
   per-fetch `AbortSignal.timeout(8000)` + 3개 병렬(최악 24s→8s). `lib/indexnow.ts`
   submitIndexNow 에도 동일 timeout(urgent/batch 크론 hang 방지).
4. cron_logs id=undefined 고아 — 이전 커밋 `27fe862f` 의 cron-logger.ts 수정이 유일 경로.
   (blog-generate-images/cron-lock/cron-log 는 이미 `if(!logId) return` 가드). 배포 대기.

▶ Item: indexnow 71일 조용한 실패 — **진범 = DB 트리거 (claude.ai 처리, 앱 무관)**:
- (내 앞선 진단 3개 오진 정정) 154 stuck 은 진짜 urgent(is_urgent=true/priority=1),
  pg_cron 살아있음(indexnow_urgent job#87 / indexnow_batch job#88 등록+active),
  드레인도 이미 돎(02:19·02:24 submitted:100 2회). vercel.json cron 만석은 무관.
- **진짜 원인**: 트리거 `fn_indexnow_queue_status_safety` 가 `status:='sent'` 를 쓰는데
  CHECK 제약은 'sent' 를 안 받아(pending/submitted/success/failed/skipped) UPDATE 가
  통째로 롤백. 포털 제출은 성공하는데 큐 기록만 안 됨 → 같은 URL 무한 재제출.
  증거: failed 7,927건 attempt_count=99, pending 오히려 증가, last_submit 5/08 고정.
- 수정: 트리거 'sent'→'submitted' (CHECK 정합). DB 영역이라 **claude.ai 가 처리**
  (hotfix-522-db-VERIFIED.sql STEP 4). **앱 코드는 IndexNow 로직 건드리지 않음** —
  유지하는 건 오직 504 방어용 AbortSignal.timeout(위 3번)뿐.

검증: type-check clean, build 컴파일 성공(559 pages, placeholder env). push 대기.

---

## [hotfix-522] 2026-07-18 — 프로덕션 전면 522 (DB 커넥션풀 포화) 코드레벨 대응

배경:
- 프로덕션 전면 522 (Cloudflare→origin 커넥션 타임아웃). 원인 = 애플리케이션 코드에
  의한 DB 커넥션풀 포화. `max_connections = 90`. **pg_cron 은 5/28 부터 사망 상태라 무관.**
- 제약: DB 접속 불가 → 코드레벨만 수정. 새 마이그레이션/RPC 생성 불가(claude.ai 담당).

수정 (앱 코드 4건 — 커넥션 압력 즉시 완화):
1. `src/lib/cron-logger.ts` — `withCronLogging` insert 응답에서 id 를 못 받으면
   후속 UPDATE 를 **스킵**. 기존엔 `.eq('id', log?.id as string)` 가 `?id=eq.undefined`
   로 나가 풀 포화 시 커넥션을 추가 소비하는 피드백 루프였음 (로그의 `?id=eq.undefined` 정체).
2. `src/app/(main)/apt/[id]/page.tsx` — 8-wide `Promise.allSettled`(Rule #49 위반)를
   **4+4 두 웨이브로 분할** → 렌더당 peak 동시 커넥션 8→4. 출력 불변.
3. `src/lib/daily-report-data.ts` — 구별 시세 `apt_complex_profiles` 조회 `limit(10000)`→
   `limit(2000)`. SSR request-path 커넥션 홀드 시간 단축.
4. `src/lib/apt-fetcher.ts` — `fetchPriceBands` 5000→2000, `fetchBuildersHub` 8000→3000
   (JS 집계 샘플 축소, 커넥션 홀드 단축).

DB 필요 → 적용 대기 (`docs/_setup/hotfix-522-db.sql`, claude.ai 검토 후 적용):
5. `statement_timeout` < 함수 maxDuration — anon/authenticated 12s, service_role 120s.
   maxDuration 30s 에 함수는 죽지만 SQL 은 계속 살아 orphan 커넥션 되는 문제 차단.
   (⚠️ 앱 코드로는 세션 statement_timeout 설정 불가 → DB 롤 설정 필수)
6. `get_apt_detail_bundle` RPC — apt/[id] fan-out 을 1회 왕복으로 근본 통합(위 2번의 후속).
7. `get_daily_gu_prices` RPC — daily 구별 시세를 DB-side GROUP BY 로(위 3번의 후속, 선택).

미해결 finding (scope 밖 — 추가 지시 대기):
- `daily-report-data.ts fetchDailyReportData` 는 30-wide `Promise.all` + 순차 10쿼리.
  daily/[region] SSR(ISR 60s)에서 콜드 스톰 시 렌더당 최대 40 커넥션 스파이크.
  → 웨이브 분할 또는 snapshot(daily-report-snapshot cron) read 전환 권장.
- `vercel.json` catch-all `api/**:30` 이 코드 `export const maxDuration` 를 override
  (analysis-refresh 300, apt-crawl-pricing 300, admin/batch-ops 300 등 → 30 으로 cap).
  Rule #18. 5번 statement_timeout 과 함께 orphan 커넥션 유발.

검증: `npm run type-check` clean. `npm run build` 컴파일 성공(559 pages) — 로컬 env 없어
prerender 는 placeholder env 로 통과 확인. 스모크는 배포 후 프로덕션에서.

---

## [s260] 2026-05-08 — 회원가입 funnel + 전방위 stabilize 일괄 적용 (production main)

브랜치: `main` · commit `1d528d51`

배경:
- s258 plan 을 처음에 사용자 지시(feat/main-redesign-v5 유지)로 feat 브랜치에 적용했으나,
  feat 브랜치에는 plan 이 가정한 인프라(useInAppBrowser hook, x-kd-region 헤더,
  cta-navigate.ts, ResidenceNudgeModal) 가 삭제되어 있어 6건만 적용 가능.
- 이후 production = main 확정. main 에는 plan 의 모든 인프라 코드 존재.
- main 에 9건 전체 적용한 것이 본 s260 entry.

코드 수정 (9건):
1. WelcomeReward localStorage race fix — kd_welcomed mark 를 fetch 성공 후로 이동
   (100P 미지급 dead loop 종결)
2. LoginClient track-attempt keepalive + catch 블록 error_message capture (250자)
3. LoginClient 카카오/구글 disabled 조건에 `|| !inApp.resolved` — 인앱 브라우저 SSR race 보강
4. callback IP hash sha256/16 hex 통일 — track-attempt 와 매칭 (base64/24 mismatch 로
   existingAttempt 룩업 0건 → INSERT 분기 누적되던 문제 해소)
5. callback redirect 에 `?welcome=1` 부착 — WelcomeToast 활성화
6. middleware `regionHeaderValue` encodeURIComponent — Edge 24h Invalid header warning 종결
   (소비측 SSR 사용처 0건 — 추후 구독자 추가 시 decodeURIComponent)
7. cta-navigate `trackCtaClick` 중복 호출 제거 + `setTimeout` 80→50ms (navigation 지연 단축)
8. SmartSectionGate hydration placeholder — visibleSection 만 노출 (기존 전체 htmlContent
   노출 시 게이트 판정 후 사라지는 시각적 결함 + content gate 우회 차단)
9. Marketing/KakaoChannel/ResidenceNudge 모달 3종 `/onboarding` pathname 가드
   (다중 모달 충돌 방지)

Supabase (feat 작업 시 이미 적용 완료, DB 공유):
- migration `cron_logs_30d_purge` — `purge_old_cron_logs()` + 매일 04:15 UTC 스케줄
- migration `v_signup_funnel_daily_redefine` — login_visits 정의 변경:
  `conversion_events.cta_click + (category='signup' OR cta_name LIKE '%login%' OR ...)`.
  page_view 트래커가 OAuth 즉시 redirect 로 drop 되던 측정 누락 해소.

Architecture Rules:
- #63 신설: 응답 헤더 값 ASCII 강제 (Latin-1 외 문자 encodeURIComponent)
- #64 신설: 가입 보너스 mark 는 외부 호출 성공 응답 확인 후 (race 방지)

Pending next:
1. `complete_profile_and_reward` RPC 통합 (welcome-bonus + signup_attempts UPDATE 단일화)
2. `auth_rls_initplan` 108건 일괄 fix (Supabase advisor)
3. pg_cron startup timeout 진단
4. OG `og-apt` / `og-stock` / `og-blog` 잔여 TypeError

---

# Session 205 — Oneshot Batch (2026-05-02 KST)

브랜치: `main` · 한 commit / 한 deploy. session-205-oneshot-batch tag.

## 변경 요약 (work order 9건)

- **W1 (P0)**: `/apt` SSR 복구 — `next/headers` 의존 server-side region detection 분리. `searchParams.region ?? '전국'` 으로 default SSR + `RegionAutoSelect` (client) 가 브라우저 IP/저장값 기반 `?region=` 으로 replace. 봇 HTML 에 단지 카드 0건 → 50+ 회복 목표.
- **W2 (P1)**: 오늘의 종목/현장/블로그 hero 3종 제거. `/stock` HeroCard + StockHeroCarousel, `/blog` blogHero HeroCard 삭제. 14일 클릭 0~1건 확정. `vercel.json` 의 `stock-hero-refresh` cron 도 정리.
- **W3 (P1)**: `lib/apt/imagePriority.ts` 신설. `pickPrimaryImage()` 가 우선순위 정렬 후 1장 추출 — satellite=90 (강등), 시공사 도메인=5 (우대). `thumbnail-fallback.ts` 의 `firstImageUrl` 이 새 헬퍼 사용. 카드 썸네일에서 satellite 비율 < 5% 목표.
- **W4 (P2)**: BlogCard 정보 디자인 — SKIP (별도 컴포넌트 없이 인라인이라 디자인 변경 폭 큼, 다음 세션에서 별도 PR).
- **W5 (P0)**: `blog-meta-rewrite-poll` — batch select 에 `'completed'` status 포함 (results_processed=false 인 stuck 케이스). 404/410 = batch 만료 분기 추가, batch 자체만 expired 마킹하고 큐는 pending 유지 (재제출용).
- **W6 (P0)**: `blog-image-supplement` — errors 를 `{post_id, msg, stack}` 객체 배열로. cron_logs.metadata 에 첫 5개 보존. 24h 440/440 fail 의 진짜 원인을 다음 1회 실행 후 파악.
- **W7 (P1)**: `stock-logo-fetch` — KOSPI/KOSDAQ 6자리 심볼용 fallback chain 보강. `/imgstock/icons/` + `/imgstock/item/logo/` + Google/DuckDuckGo favicon. 1,317건 모두 NULL → 1h 후 30%+ 회복 목표. push 직후 `reset_kr_stock_logo_queue()` 호출 필요.
- **W8 (P0)**: STATUS.md 본 섹션 + Architecture Rule #17 추가.
- **W9 (P0)**: `/api/og-blog`, `/api/og-apt` catch 로깅 prefix 통일 (`[og-blog] FULL:` / `[og-apt] FULL:`). og-apt 는 fetchSite 도 try 로 감싸 ImageResponse 영역과 분리. TypeError 24h 의 진짜 message+stack 노출.

## DB 측 사전 적용

- `get_image_priority` RPC + `get_apt_site_images_sorted` RPC
- `app_config WHERE namespace=ui_hero` 토글 3종 false (hero 제거 안전 가드)
- `trg_stock_hero_toggle` 트리거
- `blog_meta_rewrite_queue` 4,780건 in_progress→pending reset (batch_id 보존)
- `reset_kr_stock_logo_queue()` 헬퍼
- `v_image_quality_summary`, `image_quality_daily` 뷰

## 검증 (배포 후)

- `/apt` 봇 뷰: `curl -A Googlebot https://kadeora.app/apt` HTML 에 "분양"/"청약" 50회+
- `blog_meta_rewrite_queue.status='completed'` 15분 내 진행 (poll 워커 동작)
- `apt_sites` 카드 첫 이미지 satellite 비율 < 5%
- `stock_quotes` market IN (KOSPI/KOSDAQ) logo_url 1h 후 30%+
- Vercel runtime logs 에서 `[og-blog] FULL:` / `[og-apt] FULL:` prefix 로 진짜 에러 캡처

---

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
