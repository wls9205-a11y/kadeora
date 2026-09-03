# 카더라 Architecture Rules — **단일 원장** (#11~#120)

> 2026-09-03 G-4: 규칙 등재는 이 파일 하나로 모았다. 인용은 `RULES#N` 형식으로 쓴다(맨 번호 단독 인용 금지).
> `docs/ARCHITECTURE_RULES.md` 는 신규 등재 동결 — 겹치던 번호는 여기로 이관·재등재됐다.

`docs/STATUS.md`는 세션별 작업 기록, 이 파일은 최종 규칙 모음.

## OG / ImageResponse (next/og satori)
- **#43** ImageResponse 내 CSS variable (`var(--xxx)`) 금지 — satori 미지원
- **#44** ImageResponse `emoji: 'twemoji'` 옵션 금지 — fetch 차단
- **#46** ImageResponse string aspectRatio 금지 — 정수 width/height 사용
- **#47** ImageResponse JSX 내 emoji 직접 사용 금지
- **#48** OG_CAT/OG token 정의에 emoji 사용 금지 (한국어 1글자 또는 Unicode 도형)
- **#52** og 라우트 input string은 sanitize 통과 필수 (`sanitizeForOG`)
- **#53** og 라우트 sanitize 적용 위치는 fetch 결과 + safeStr 내부
- **#54** sanitize 정규식: 한자/일본어/CJK 호환/도형/전각/General Punctuation 모두 cover
- **#57** JS regex literal에 U+2028/U+2029 literal 금지 (반드시 `\u` escape)
- **#58** OG self-closing 장식 div에 음수% position + borderRadius:50% on absolute 금지
- **#59** satori `repeating-(linear|radial)-gradient` / `conic-gradient` 미지원
- **#60** OG ImageResponse React Fragment `<>...</>` 주의 (satori 일부 미지원, div wrap 권장)
- **#61** OG ImageResponse sub-pixel border (0.5px) 금지 — 1px 이상 사용
- **#62** `sanitizeRowForOG`는 string field 외 array element도 sanitize 필수

## Performance / Timeout
- **#16** 외부 fetch 라우트는 `export const maxDuration = 10`
- **#18** 라우트의 `export const maxDuration` 하나로 충분하다 — vercel.json 캐치올은 그것을 «덮지 않는다» (2026-08-27 실측 정정, 아래 「원장 통합」 참조)
- **#49** dynamic page에서 `Promise.allSettled` 8개+ 동시 fetch 금지 (504 위험)
- **#51** ilike `%X%` 패턴 시 입력 string 길이 ≥ 3 검증 필수

## Schema / Data
- **#13** Supabase types에 없는 테이블은 `(sb as any).from()` 패턴
- **#15** `count: 'exact'`는 1,000행 미만 테이블만 (`count: 'estimated'` 기본)
- **#50** `apt_sites.region` vs `apt_subscriptions/transactions.region_nm` 컬럼명 일관성

## Cron
- **#19** cron 삭제 전 3종 검증: cron_logs 30d + pg_cron 등록 + src/ grep
- **#45** AdSense Tier 1 (`/blog/[slug]`) 외 페이지에는 광고 슬롯 금지

## Supabase Security
- **#17** 36 RLS 정책 + 50+ service_role 전용 RPC + `is_current_user_admin()` 헬퍼
- **#20** Kakao Marketing 5중 send guard
- **#55** Supabase view에 `WITH (security_invoker = on)` 필수
- **#56** Supabase function에 `SET search_path = public, pg_temp` 필수
- **#63** Supabase function REVOKE는 anon/authenticated만으로는 부족 — `PUBLIC`도 함께 (default privilege)
- **#64** trigger function 식별은 `pg_trigger.tgfoid` join이 100% 안전

## Schema (s259 추가)
- **#68** 일괄 UPSERT 테이블의 `created_at` 정확성 — 외부 공공 API 를 매일 전수 UPSERT 하는 테이블 (apt_subscriptions 등) 은 `updated_at` 만으로 신규 검출 불가. `created_at` 컬럼 + DEFAULT now() + BEFORE UPDATE 트리거로 OLD.created_at 보존 패턴 필수.
  ```sql
  CREATE OR REPLACE FUNCTION fn_<table>_preserve_created_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF TG_OP = 'UPDATE' AND OLD.created_at IS NOT NULL THEN
      NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
  END $$;
  ```
- **#69** 카드 view 표준 컬럼 시그니처 — 정보 과다 테이블 (50+ 컬럼) 은 카드용 view 별도 정의. 표준 16 컬럼: `id / slug_id / name / region / builder / date_start / date_end / dday_end / status / price_per_pyeong / supply_min,max / households / area_lineup / cover_image_url / tags / created_at`. 모든 카테고리 view 동일 시그니처 → 단일 `AptCardCompact` 컴포넌트 재사용.

## Search (s260 추가)
- **#70** 검색은 통합 RPC 단일 진입 — 검색 페이지에서 `.from().ilike().or()` 직접 사용 금지. 반드시 `search_kadeora_unified_vN` RPC 호출. 이유: (1) ILIKE leading wildcard 는 trgm gin 인덱스 활용 못 함 (lower() 호출 시 더 안 됨), (2) 여러 도메인 검색 시 N+1 query 누적으로 maxDuration 초과, (3) RPC 안에서 pgroonga `&@~`, name_variants, scoring CASE 활용 가능. 신규 도메인 추가 시 RPC 보강(v4, v5 ...) — 페이지 코드 변경 없이 즉시 반영. 기존 v2/v3 는 deprecation 후 30일 유지.
- **#71** `search_logs.results_count` + `clicked_rank` 항상 채움 — `/api/search` 응답 시 `log_search(query, results_count)` 호출 필수, 클릭 시 `log_search_click(id, rank)` POST. NULL 채움 안 하면 zero-result 키워드 발굴 불가(SEO 손실), CTR 측정 불가, 트렌드 분석 부정확.
- **#72** 검색창은 단 하나, ⌘K/Ctrl+K + 헤더 — 페이지별 별도 검색창(AptSearchBar, StockSearchBox 등) 금지. 모든 페이지가 동일한 `UniversalSearchBar`(헤더 또는 layout). 이유: (1) 사용자 학습 비용 0(어디서든 ⌘K), (2) 검색 컴포넌트 분기 = 검색 분석 분기 = 데이터 손실, (3) 도메인별 검색 카테고리는 RPC 가 처리(페이지 측 별도 구현 X). 별도 카테고리 검색은 결과 페이지 탭으로 처리(`/search?tab=apt_sites`).

## Issue Engine + Project invariants (s262 추가)
- **#73** 마이그레이션은 idempotent + reversible — `CREATE TABLE IF NOT EXISTS`, `DROP MATERIALIZED VIEW IF EXISTS`, `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`. 파일 헤더에 `-- DOWN:` 주석으로 롤백 SQL 명시. mat view 는 `CREATE OR REPLACE` 불가 → `DROP IF EXISTS CASCADE` 후 재생성.
- **#74** 포인트 변동은 `award_points` / `deduct_points` RPC 만 — `point_history` 직접 INSERT 또는 `profiles.points` 직접 UPDATE 금지. 트랜잭션·중복 차단·history 기록이 RPC 안에 묶여 있음.
- **#75** CSP 는 `src/middleware.ts` 의 `CSP_DIRECTIVES` 단일 정의만 사용. 페이지/컴포넌트별 meta CSP, vercel.json `headers` 의 CSP 추가 금지 (s260 #63 보강).
- **#76** 블로그 데이터 (`blog_posts`) DELETE 금지 — `is_published = false`, `auto_unpublished_at`, `expires_at` 으로만 비활성화. 삭제는 SEO/링크 수명 손상 + GSC 색인 실종.
- **#77** `PostWithProfile` / `CommentWithProfile` 타입 export 보존 — `src/types/community.ts` 안의 두 타입은 12+ 컴포넌트가 import. signature 변경 시 cascade 영향. ADD field 만 OK, REMOVE 금지.
- **#78** Cron route 는 에러 시 항상 200 반환 — Vercel cron 은 5xx 시 자동 재시도, 같은 작업 중복 실행 위험. `try/catch` 후 error JSON + 200 (또는 cron-logger 기록 후 200).
- **#79** Issue score 가중치는 `*_issue_score_weights` 테이블만 변경 — mat view 는 weights subquery 로 dynamic read. 코드 / SQL / 환경변수에 가중치 하드코딩 금지.
- **#80** mat view REFRESH 로 가중치 즉시 반영 — `REFRESH MATERIALIZED VIEW [CONCURRENTLY] *_issue_scores` 만 호출하면 weights 테이블 변경이 적용. CREATE/DROP 불필요.
- **#81** Issue score v1 은 보수적 — 24h 모니터링 후 튜닝. 백테스트 없이 weight 큰 변경 금지. UPDATE 시 1 factor 당 ≤ 0.10 변경 + 1주 관찰.
- **#82** Comments polymorphic — `comments` row 는 `(entity_type IS NOT NULL AND entity_id IS NOT NULL) OR post_id IS NOT NULL` CHECK 만족 필수. 신규 댓글은 가능하면 entity_type/entity_id 사용 (post_id 는 legacy + blog_posts 댓글에만).
- **#83** 카드 색상은 헬퍼 함수 통과 — `stockChipStyle` / `stockBarColor` / `getStockTone` 등. 컴포넌트 안에 hex (`#DC2626` 등) 직접 사용 금지. 디자인 토큰 변경이 한 곳에서 끝나야 함.
- **#84** `entity_comment_stats` 는 트리거로 즉시 동기화 — INSERT / UPDATE OF is_deleted 트리거가 count 즉시 갱신. 배치 cron / manual reconcile 금지 (drift 위험).
- **#85** 단일 commit production flip 회피 — DB / lib·components / 페이지 / cron 4단계 분리, 각 phase 독립 revert 가능. 3 high-traffic 페이지 동시 rewrite 는 90초 롤백 약속 못 지킴.
- **#86** mat view REFRESH 는 pg_cron 우선 — Vercel cron 100/100 한도 가득. `REFRESH MATERIALIZED VIEW` 같은 DB-bound 작업은 Vercel HTTP route 만들지 말고 pg_cron 으로 직접 등록. HTTP roundtrip / cold start / Bearer ${CRON_SECRET} 보일러플레이트 모두 불필요. Vercel cron 은 외부 API fetch / Node-bound 작업에만. 신규 cron 작성 전 vercel.json 한도 확인 + 한도 초과 시 STOP + 옵션 제시 (기존 정리 / pg_cron 이전 / plan 상향).

## Carousel + flag-gated rollout (s262 Phase E)
- **#87** Carousel URL sync 는 `history.replaceState` 만 — `pushState` / `router.push` 금지. Embla 의 `select` 이벤트마다 push 하면 backstack 이 swipe 횟수만큼 누적되어 사용자가 뒤로 가기 한 번에 carousel 한 칸만 되돌아가는 끔찍한 UX 발생. replaceState 는 history entry 추가 없이 query 만 갱신.
- **#88** Sparkline 은 mat view 에 캐시 — 페이지/카드 렌더 시 `stock_price_history` 직접 SELECT 금지. `stock_issue_scores.sparkline_5d` 컬럼에서 numeric[] 으로 사전 집계. mat view REFRESH cron 안에서만 재계산. 실시간 N+1 query 가능성 차단.
- **#89** Thumbnail Image 는 lazy default — `priority={true}` 는 첫 2장만 (LCP 후보). 나머지는 `loading="lazy"`. 가로 스크롤 carousel 에서 보이지 않는 카드를 priority 로 깔면 Vercel Image Optimization 경유 cold fetch 가 LCP 직격탄.
- **#90** Carousel 라이브러리는 `embla-carousel-react` 단일 — swiper / react-slick / framer 등 다른 라이브러리 추가 금지. 디자인 토큰처럼 단일 진입점 유지 → bundle 중복 + UX 분기 막음.
- **#91** 큰 UI 변경은 flag + 측정완료 후 flip — `process.env.NEXT_PUBLIC_<FEATURE>_ENABLED === 'true'` 패턴. 코드는 main 에 들어가지만 default false. T+24h 이상 baseline 측정 + pre-flip gate 통과 후 ENV 변경 + redeploy. legacy 분기 코드 절대 삭제 금지 (롤백 = ENV false 1줄).
- **#92** Per-tab/per-block SSR metadata 필수 — `?tab=` / `?block=` 같은 query 분기 페이지는 `generateMetadata({ searchParams })` 에서 tab 별 title/description/canonical 분기 + ItemList JSON-LD. 동일 path 가 여러 콘텐츠 variant 를 표시하면 GSC 가 단일 페이지로 처리 → 키워드 충돌. canonical 을 variant 마다 다르게 두면 separate 색인.
- **#93** Mat view 컬럼 추가 시 source 데이터 실제 채움률 사전 측정 필수 — 컬럼 정의가 정확해도 source 가 비면 mat view row 가 NULL. apt_sites 같은 dimension 테이블이 전체 99% 채움이지만 매칭되는 부분집합은 0% 가능 (s262 Phase E 회고 — 신규 분양 단지는 apt_sites.price_min 미입력). 작성 전 (1) source 컬럼 grep, (2) WHERE 조건 적용된 부분집합 채움률, (3) LATERAL JOIN 의 LIMIT 1 정렬 우선순위 검증. 50% 미만이면 fallback 컬럼 추가 또는 UI 폴백 텍스트 (예: '분양가 미공개') 같이 디자인.
- **#94** Inline hex 사용 시 항상 소문자 + var() 호출 우선 — 카드/배지의 `style={{ background: '#FFFFFF' }}` 같은 inline hex 가 dark mode catch-all selector 와 미스매치되면 가독성 회귀. 새 컴포넌트 작성 시 (1) 디자인 토큰 var() 우선 (`var(--bg-surface)`, `var(--text-primary)` 등), (2) hex 불가피한 경우 소문자 + 스페이스 syntax (`background: #ffffff`) 로 globals.css 의 catch-all selector 와 매칭 보장. 이미 적용된 inline hex 는 globals.css 끝의 catch-all 확장으로 cover (Phase F-lite 패턴) — 다만 본질 fix 는 inline hex 자체를 var() 로 전환 (Phase F real migration 은 별도 세션).
- **#95** GRANT 누락 점검은 새 함수/view 추가 시 필수 — production 클라이언트(authenticated/anon)가 호출하는 모든 SECURITY INVOKER 함수와 RLS 적용 view 는 명시적 `GRANT EXECUTE`/`GRANT SELECT TO authenticated, anon` 필요. Supabase Phase 4 Track 4 보안 강화 이후 PUBLIC default GRANT 무효. 마이그 작성 시 (1) 클라이언트 호출 여부 확인, (2) GRANT 명시 추가, (3) 적용 직후 `NOTIFY pgrst, 'reload schema'`, (4) 5분 후 postgres 로그에서 `permission denied` 0건 검증. 증거 기록: s263_a (log_teaser_debug, get_my_access_level, v_complex_region_stats, v_complex_age_stats 4건 회귀 ERROR 매 분 burst — postgres 로그 18:46:20 이후 0건 회복).
- **#96** sendBeacon + navigation 패턴 — sendBeacon 단독으로 `window.location.href` 즉시 unload 금지. 모바일(iOS Safari) sendBeacon flush abort 회귀 (mobile 24h CTR 0% vs desktop 1.5% — 분명한 race). 패턴: (1) Next `<Link>` + onClick sendBeacon (검증된 popup_signup_modal/nav_login_button 방식, client-side route, no unload), (2) `router.push()` (App Router) 사용 후 navigate (s266_c 채택 — page 살아있어 sendBeacon 안전 flush), (3) 불가피한 full nav 은 emergency-only `setTimeout(50)` fallback. **trackCtaAndNavigate 호출 시 useRouter() router 인자 필수** — client-side router.push 가 sendBeacon flush 보장. window.location.href fallback 은 desktop 빠른 네트워크에서만 작동, 모바일 race. 회귀 이력: s230 P1 80→50ms, s263 Phase 2.2 50→200ms (둘 다 setTimeout 의존), s264-b sendBeacon 단독 + 즉시 window.location (8 silent CTA 회귀), s266_b router.push 우선 + setTimeout 50ms fallback + trackCTA 위임, **s266_c 8 callers router 전달 의무화**. 영향: 8 silent CTA (sticky_signup_bar, blog_early_teaser, related_blog_section, login_gate_apt_analysis, login_gate_apt_trade_alert, blog_gated_login, apt_alert_cta, kakao_hero/sheet) 회복.
- **#97** 빈 상태는 cascade fallback + EmptyState 의무 — raw query 단독 + 빈 메시지 노출 금지. 지역 필터 query 가 빈 결과 시 cascade RPC 사용 (s265_a 의 `get_apt_imminent_cascade` / `get_apt_fresh_cascade` / `get_apt_redev_cascade` / `get_apt_unified_carousel`). cascade 4단계: L1=region 매칭 → L2=시간 확장 (D-30) → L3=인접 지역 (`ADJACENT_REGIONS` from `lib/regions.ts`) → L4=전국. L4 까지 거의 항상 5장 보장. 그래도 0 이면 `<EmptyState>` 컴포넌트로 fallback (icon + title + description + 선택 CTA). 단순 회색 박스 + "데이터 없음" 텍스트 금지.
- **#98** Region 필터 일관성 — middleware `x-kd-region` 헤더와 page-level `region` 항상 sync. cookie/localStorage/query param 우선순위 명시. cross-region carousel (예: 통합 carousel) 은 RPC 의 `p_region` 인자 명시 필수. 미명시 시 fallback default ('전국') 가 적용되어 사용자 선택 region 외 단지 노출 버그 발생 (s265 발견 — 부산 선택 시 경기 단지 carousel 노출).
- **#99** Cross-section unified carousel RPC 응답 schema 통일 의무 — 여러 도메인 섹션 (미분양/청약/재개발/Fresh/Score 등) 을 하나의 carousel 에 합치는 RPC 는 모든 섹션이 공통 평탄 필드를 갖도록 통일 (`id`, `section`, `title`, `region`, `sigungu`, `meta`, `image_url`, `href`, `badge_label`, `badge_color`, `tier`, optional `empty`). data wrapper / nested object / per-section 다른 컬럼명 금지. 클라이언트가 section 별 분기 없이 단일 카드 컴포넌트로 렌더 가능해야 함. DISTINCT id 보장 (cross-section 중복 방지). placeholder 가 필요한 슬롯은 `empty: true` 로 표시.
- **#100** 청약 데이터 fetch 시 `rcept_endde >= CURRENT_DATE` active filter 필수 — 마감된 청약을 "신규" 라벨로 노출하면 사용자 신뢰도 회복 불가. RPC / view / page-level fetch 모두 active 필터 적용 (`get_apt_fresh_cascade` 는 s265_a2 에서 보강). 6년 전 (예: 2020) 청약이 신규 carousel 에 떠 있는 회귀가 발견되면 신뢰성 P0 — 즉시 RPC 수정 + filter 적용.

## 청약 퍼스트 (s273 추가)
- **#101** 청약 상태 판정은 `src/lib/apt/subscription-status.ts` 단일 정의 — 페이지/컴포넌트에서 `rcept_endde >= today` 같은 날짜 비교 직접 작성 금지. 상태 7종(`open`/`upcoming`/`scheduled`/`announced_wait`/`contract`/`leftover`/`closed`)과 정렬 가중치(open 0 → upcoming 1 → announced_wait 2 → contract 3 → scheduled 4 → leftover 5 → closed 6)를 함수로만 얻을 것. **SQL 쪽 미러**는 `get_apt_subscription_hub` 안의 CASE — 한쪽을 고치면 반드시 양쪽 동기화. 날짜 비교는 `Date` 객체가 아니라 `'YYYY-MM-DD'` 문자열 사전순으로 (Vercel UTC / 로컬 KST 하루 밀림 방지).
- **#102** 단지명 표시는 `formatComplexName(region, name)` 경유 — `` `${region} ${name}` `` 직접 조합 금지. `region_nm='세종'` + `house_nm='세종 우미 린 …'` 이 "세종 세종 우미 린" 으로 찍히던 회귀(s273). 광역시/도 풀네임↔축약 별칭까지 양방향 비교한다 ('경상남도'의 축약은 '경상'이 아니라 '경남').
- **#103** `blog_posts.metadata.apt_id` = `apt_subscriptions.id` 규약. /apt '관련 청약 분석'이 이 키로 조회. 기입은 pg_cron `kadeora-series-autopublish`(job 160 → `fn_series_autopublish_tick()`)가 발행 시점에 자동, 소급은 `scripts/backfill-blog-apt-id.mjs`. 매칭은 **제목이 공고명을 통째로 포함**하는 strict 매칭만 — 느슨한 매칭은 '힐스테이트 아이코닉' → 무관한 힐스테이트 140건 오매핑을 만든다. 못 찾으면 NULL 로 둔다. 기입은 `metadata` 병합만, 본문/발행상태 불변 (Rule #76).
- **#105** `var(--x, fallback)` 의 변수명은 **globals.css 에 실재하는지 확인 후 사용**. 오타/추측 이름은 에러 없이 fallback 으로 조용히 넘어가는데, 이 프로젝트의 fallback 은 대부분 라이트 테마 값(`#e5e7eb`, `rgba(255,255,255,.92)`)이라 **다크 기본 테마에서 그대로 사고**가 난다. s273 에서 두 번 당함 — `--bg-surface-translucent`(미정의 → 흰 배경 + 흰 글씨), `--border-base`(미정의 → 다크 배경에 밝은 회색 테두리 9곳). 실재하는 이름은 `--border` / `--bg-surface` / `--bg-elevated` / `--bg-base` / `--text-primary|secondary|tertiary|disabled`. 신규 컴포넌트 작성 후 검증:
  ```bash
  grep -oh -- "--[a-z0-9-]*" <파일들> | sort -u | while read v; do
    grep -q -- "  $v:" src/app/globals.css || echo "UNDEFINED $v"; done
  ```
  더 확실한 검증은 배포 후 `getComputedStyle(el).borderColor` 실측 (Rule #94 보강).
- **#104** `export const revalidate` 는 리터럴만 — import 한 상수를 쓰면 Next segment config 정적 분석이 `Unknown identifier` 로 빌드를 깬다. `searchParams` 를 읽는 라우트는 dynamic 으로 강등돼 page-level revalidate 가 무력화되므로, 실제 ISR 은 데이터 레이어의 `unstable_cache({ revalidate })` 로 건다 (s273 /apt 패턴).

## 워크플로
- **#11** `docs/STATUS.md`는 매 세션 prepend + commit/push 필수
- 두 PC 동시 작업: `git stash && git pull --rebase origin main && git stash pop` 의무
- DB 마이그레이션은 한 PC만, `IF NOT EXISTS` 강제

## 추가 (이전 #1~#10, #12, #21~#42 등 예전 규칙)
세부 항목은 git log + docs/STATUS.md 이력 참조.

## 원장 통합 (2026-09-03 · G-4)

대사표: `docs/RULES_LEDGER_대사_20260903.md`. 여기부터는 **이 파일이 단일 원장**이다 — 인용은 `RULES#N` 형식으로 쓰고, `ARCHITECTURE_RULES.md` 에는 새 규칙을 등재하지 않는다.

### RULES#18 정정 (2026-08-27)  
> 위 불릿의 「catch-all 이 per-route 를 덮는다」는 **뒤집혔다**. 아래가 정본이다.

> 2026-09-03 G-4 이관 — 구 `ARCHITECTURE_RULES.md` 동번호 상세본. 의미 변경 없음.

**⚠️ 이 규칙은 2026-05-04(s223)에 세워졌고 2026-08-27 실측에서 «성립하지 않았다». 아래가 현행이다.**

### 오늘의 실측 (2026-08-27 · 최근 14일 cron_logs 전수)

캐치올 `src/app/api/**/*.ts → maxDuration 30` 은 «지금도 그대로 있다». 그런데:

- **functions 항목이 «없는»** 라우트 **14개** 가 30초를 넘겨 «성공» 했다.
  전부 라우트에 `export const maxDuration` 만 있다:

  | 라우트 | 최대 실행 | functions | 라우트 export |
  |---|---|---|---|
  | issue-draft | 281.2s | 없음 | 300 |
  | stock-analysis-gen | 218.0s | 없음 | 300 |
  | issue-image-attach | 151.7s | 없음 | 300 |
  | apt-enrich-location | 142.8s | 없음 | 300 |
  | apt-analysis-gen | 128.2s | 없음 | 300 |
  | batch-cluster-submit | 104.0s | 없음 | 300 |

  `apt-enrich-location` 은 **6일 연속 매일 136~143초로 전부 성공** 했다. 우연이 아니다.

- **functions 도 없고 라우트 export 도 «없는» 채 30초를 넘긴 것: 0개.**
  즉 둘 다 없을 때 30초가 걸리는 것 자체는 반증되지 않았다.

### 그래서 무엇이 참인가

> **라우트의 `export const maxDuration` 하나로 «충분하다».**
> 캐치올은 그것을 덮지 않는다.

⚠️ 둘 «다» 있고 값이 다를 때 어느 쪽이 이기는지는 **아직 모른다**. 관측된 실행 중
   더 작은 값을 넘긴 사례가 없어 가려지지 않았다(blog-quality-score functions 300 /
   export 120 / 최대 116.9s 등). 모르는 것을 안다고 적지 않는다.

⚠️ s223 당시(stock-fundamentals-kr · data-quality-fix 가 export 60 인데 30초에 죽음)의
   관측이 틀렸는지, 그 사이 Vercel 동작이 «바뀐» 것인지는 가릴 수 없다. 어느 쪽이든
   **현행 판단 근거는 오늘의 실측** 이다.

### 운용 지침 (개정)

- 30초를 넘는 라우트는 **라우트에 `export const maxDuration` 을 적는다.** 이것이 1순위다.
- `functions` 항목은 «라우트가 스스로 선언할 수 없을 때» 만 추가한다.
  ⚠️ `functions` 는 **50개가 스키마 상한** 이다(Rule #112). 「Rule #18 때문에 항목을 늘 같이
     넣는다」는 옛 지침이 항목을 51개까지 밀어올려 **배포 3건을 연속으로 죽였다**(2026-08-27).
     그 지침이 이 규칙의 가장 비싼 부작용이었다.
- 새 cron 추가 시 라우트 export 를 «반드시» 적고, functions 는 손대지 않는다.

### observe 504 사후 정정 (2026-08-27)

⚠️ `2c0d9a07` 커밋은 observe 504 의 원인을 「캐치올이 덮었다」로 적었다. **그 진단은 틀렸다.**
observe 는 당시 `export const maxDuration = 60` 이었으므로 한도는 60초였고, 실행이 그것을
넘긴 것이다. 같은 커밋이 `apt_transactions(region_nm, deal_date)` 복합 인덱스도 함께
넣었는데 — **고친 것은 그 인덱스다**. functions 항목 추가는 효과가 없었을 가능성이 크다.
두 변경을 한 커밋에 넣어 원인이 가려졌다.

### RULES#11 — STATUS.md 갱신 (existing)  
> 2026-09-03 G-4 이관 — 구 `ARCHITECTURE_RULES.md` 동번호 상세본. 의미 변경 없음.

코드 변경 commit 마다 `STATUS.md` head 에 세션/변경 요약을 추가한다. 변경 이유와 검증 방법까지 포함. (DB 측 변경은 supabase mcp 마이그레이션으로 별도 관리.)


### RULES#19 — cron route 삭제 전 3종 검증 (s223 신설)  
> 2026-09-03 G-4 이관 — 구 `ARCHITECTURE_RULES.md` 동번호 상세본. 의미 변경 없음.

cron route 를 dead 로 판정하고 삭제하기 전에 반드시 다음 3가지를 모두 확인:

1. **cron_logs 30일 실행 기록**: 최근 30일간 한 번도 실행되지 않았는지

```sql
SELECT route, COUNT(*) FROM cron_logs
 WHERE route = '<route>' AND created_at > now() - interval '30 days';
```

2. **Supabase pg_cron job 등록 여부**: cron.job 테이블에 _call_vercel_cron 패턴으로 외부 호출되는지 — vercel.json 에 없어도 pg_cron 이 호출하는 케이스 다수 존재

```sql
SELECT * FROM cron.job WHERE command LIKE '%<route>%';
```

3. **src/ fetch/import grep**: 다른 코드가 fetch 하거나 import 하는지

```bash
grep -r "<route>" src/
```

세 검증 모두 통과 시에만 삭제 가능. vercel.json crons 등록 여부만으로 활성/dead 판단 금지 — s223 Phase 0 검증에서 "dead 추정 30개" 중 27개가 실제 pg_cron 으로 활성 상태였음 (3개만 진짜 dead).

**Discovered**: s223 Big Cleanup (2026-05-04) — vercel.json crons 에서 빠진 cron 들도 pg_cron `_call_vercel_cron` 으로 외부 호출되는 사례 21건 발견. 검증 없이 30개 모두 삭제했으면 production 즉시 손상.


### RULES#20 — 광고성 메시지 발송 5중 가드 (s227 신설)  
> 2026-09-03 G-4 이관 — 구 `ARCHITECTURE_RULES.md` 동번호 상세본. 의미 변경 없음.

**Symptom**: 광고성('ad') 카카오 메시지를 발송했는데 정보통신망법 위반 (야간 발송, 동의 만료, 채널 친구 아님 등) 사후 적발 — 감사 증거가 없어 면책 불가.

**Cause**: 발송 직전 가드 체크가 분산되어 있거나 특정 경로에서 누락. 가드 통과 여부와 무관하게 발송 시도 자체가 로그로 남지 않으면 정보통신망법 50조 (광고성 정보 전송 제한) + 62조의3 (자료 보관) 감사 시 면책 근거가 사라진다.

**Rule**:

모든 광고성('ad') 카카오 메시지는 발송 직전 RPC `kakao_send_guard_check` 통과 필수: (1) 활성 사용자, (2) 마케팅 수신 동의, (3) 동의 2년 미만 또는 재확인, (4) 카카오 채널 친구, (5) 발송 시각 KST 08-21시 또는 야간 동의. 가드 통과 여부와 무관하게 모든 시도는 `kakao_message_send_logs` 기록 (정보통신망법 50조 + 62조의3 감사 증거).

**How to apply**:
- 광고성 메시지 발송 코드는 단일 진입점 (예: `src/lib/kakao-send.ts` 또는 admin/marketing 라우트) 으로 통합. 가드 체크 우회 경로 금지.
- RPC 호출: `kakao_send_guard_check(p_user_id, p_message_type, p_send_at)`. `message_type='ad'` 외에도 'info' 등 광고성 외 메시지에도 적용 가능 (야간 발송 가드는 'info' 에도 권장).
- 가드 차단 케이스도 반드시 `kakao_message_send_logs` 에 `delivery_status='blocked'` + `metadata.reason` 기록 — "가드가 막아서 안 보냄" 이력 자체가 감사 증거.
- 가드 통과 시 실제 발송 결과 (`delivered` / `failed`) 도 동일 테이블에 기록. 모킹 환경은 `delivery_status='mock'`.
- consent 만료 (Rule #20 항목 3) 검증은 `consent-renewal-check` (T-14d 알림) + `consent-expiry-revoke` (T+0 자동 철회) 두 cron 으로 보장.

**Discovered**: s227 (2026-05-03) — 마케팅 카카오 채널 발송 파이프라인 신설 시 정보통신망법 50조/62조의3 감사 요건 정식화. cron `kakao-channel-sync` / `consent-renewal-check` / `consent-expiry-revoke` 와 admin route `marketing/kakao/send` 가 모두 동일 가드 + 동일 로그 테이블 사용해야 함.


### RULES#117 — Anthropic Batch API polling 워커는 결과를 한 번에 적용한다 (s205 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #17. 의미 변경 없음.

**Rule**: Batch API polling 워커는 `batch.processing_status === 'ended'` 분기에서 다음 세 단계를 한 번에 (또는 graceful fallback 가능한 형태로) 처리한다:

1. `client.messages.batches.results(batch.id)` 또는 results URL fetch 로 JSONL 스트림 수신
2. `custom_id` 매핑 으로 도메인 테이블 (예: `blog_posts.meta_description`) UPDATE
3. 큐 entry 의 `status='completed'`, `completed_at=now()` 마킹 + batch row 의 `results_processed=true` 마킹

**Why**: 한 번 ended 된 batch 의 results URL 은 Anthropic 쪽에서 ~29일 내에 만료된다. ended 시점에 결과를 안 적용하면 이미 지불된 비용 (succeeded 5,504건/$수십) 이 회수 불가능해질 수 있다. s205 사례: 11개 batch ended, 큐 4,780 건이 13일째 in_progress 로 stuck.

**How to apply**:
- 워커 SELECT 시 `status IN ('submitted','in_progress','completed')` + `results_processed=false` 둘 다 조건. status 마킹은 됐는데 결과 적용 안 된 케이스를 다시 잡기 위함.
- results URL 또는 status fetch 가 404/410 반환 시 (=만료) `batch.status='expired'` + `results_processed=true` 만 마킹. 큐 entry 는 `pending` 으로 유지 → 다음 submit 워커가 재제출.
- 중간 단계 실패 (DB UPDATE) 시 batch 마킹은 보류 → 다음 polling tick 에 재시도. `batch_id` 는 큐 entry 에 보존되어야 한다.
- 비슷한 구조의 다른 큐 (예: `blog_image_batch` purpose=image, `apt_ai_batch`) 도 동일 패턴 적용.

**참고**: 직접 영향 워커 — `app/api/cron/blog-meta-rewrite-poll/route.ts`. 동일 패턴 워커 — `app/api/cron/blog-image-batch-poll/*`, `app/api/cron/apt-ai-batch-poll/*`.


### RULES#118 — 중복 생존자를 `content_score` 로 고르지 말 것 (M2 B-4 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #43. 의미 변경 없음.

**Rule**:
같은 현장의 중복 행 중 무엇을 남길지(생존자) 정할 때 **`content_score` 를 판정 축으로 쓰지 않는다.**
판정 축은 **슬러그 품질**이다 — 영문·블록 토큰이 온전한 쪽이 생존자다.

```
꺼짐  ---아이파크포레                 cs100   ← 점수가 높다
살음  dmc-sk-view-아이파크포레         cs94    ← 이쪽이 생존자다
```

**왜**:
`content_score` 는 은퇴한 행에도 그대로 남는다. 페이지 품질이 아니라 잔여값이다.
점수로 고르면 **깨진 슬러그가 이긴다** — 토큰이 빠진 쪽이 먼저 만들어져 데이터가 더 쌓여
있는 경우가 많기 때문이다.

**이미 두 번 사고가 났다**:
1. V15 A-1 병합 — 생존자 선정에 슬러그 품질 기준이 빠져 **23쌍이 거꾸로** 잡혔다.
   DB 담당이 방향을 뒤집었고 `src/lib/apt/merged-slugs.ts` 헤더에 기록이 남아 있다.
2. 지시서 M2 B-4 — "비활성인데 content_score 80+ 30건을 되살려라"로 **같은 기준이 다시 적혔다.**
   실측하니 219건이었고 그중 210건이 `apt_site_merges.dead_slug` 였다. 그대로 켰다면
   middleware 가 301 로 넘기고 있는 URL 이 통째로 되살아났다.

**How to apply**:
- 중복 판정 쿼리를 쓸 때 `ORDER BY content_score DESC` 로 생존자를 고르지 않는다.
- 생존자 후보가 갈리면 슬러그를 본다. `--` 나 앞뒤 하이픈으로 토큰이 빠진 쪽이 은퇴 대상이다.
- 이미 `apt_site_merges` 에 등재된 쌍은 **다시 판정하지 않는다.** 그 표가 유일한 근거다.
- 비활성 행을 되살리기 전에 반드시 확인:
  `SELECT 1 FROM apt_site_merges WHERE dead_slug = :slug` — 있으면 켜지 않는다.
- 중복을 정리할 때 순서는 **① 생존자 `name_variants` 에 은퇴자 이름 편입 → ② 은퇴자
  `is_active=false` → ③ `apt_site_merges` 등록 → ④ `node scripts/gen-merged-slugs.mjs`** 다.
  ①을 빠뜨리면 구역명 검색어가 사라진다 (`sa.py` 가 `name_variants` 를 키워드로 확장한다).
- `apt_sites` 에서 `DELETE` 금지. `is_active=false` 로만 은퇴시킨다.

**Discovered**: M2 B-4 (2026-08-25) — 219건 중 조치 대상 0건. 병합표 미등재 9건만
등록해 404 → 301 로 복구했다. `is_active` 는 한 행도 켜지 않았다.


### RULES#66 — 빈·실패 응답을 캐시에 굳히지 않는다  
> 2026-09-03 G-4 **전승 등재**(신설 아님). 원장에 없던 번호인데 코드·문서 13곳이 이미 이 번호로 부르고 있었다 — 문안이 실재하므로 번호를 살려 인용을 유효하게 만든다.

**Rule**: `unstable_cache`·SSG 로 감싼 조회가 «빈 결과» 나 «실패» 를 돌려주면 그 값을 캐시에 굳히지 않는다. 비면 캐시를 건너뛰고 그 자리에서 한 번 더 직접 조회한다.

**Why**: s269c 회귀 — 빈 페이지가 캐시에 영구화돼 살아 있는 데이터가 안 보였다. 「없다」와 「못 읽었다」는 다른 상태이고, 후자를 캐시에 굳히면 스스로 회복하지 못한다.

**적용 실례**: `src/lib/apt/hub.ts` · `src/lib/apt/archive.ts` · `src/lib/apt/pipeline.ts` · `src/app/(main)/apt/unsold/[id]/page.tsx`.

### RULES#119 — Claude Code git push 표준 패턴  
> 2026-09-03 G-4 **전승 등재**. `docs/STATUS.md` 가 「#67」로 부르던 문안. #67 은 아래 #120 과 충돌해 폐기됐다.

원문 위치: `docs/STATUS.md` §「Rule #67: Claude Code git push 표준 패턴」.

### RULES#120 — 가드와 대상 배열은 같은 상수를 본다  
> 2026-09-03 G-4 **전승 등재**. 루트 `STATUS.md` 가 「#67」로 부르던 문안.

**Rule**: 동적 라우트에서 `generateStaticParams` 가 만드는 대상 배열과, 페이지·레이아웃의 존재 가드가 **같은 상수**를 본다. 목록을 두 벌로 적으면 한쪽만 늘어난 날 조용히 404 나 빈 화면이 생긴다.

**적용 실례**: `src/app/(main)/apt/unsold/[id]/page.tsx`(`REGIONS`) · `src/app/(main)/apt/region/[region]/{layout,page}.tsx`.

### RULES#122 — 메인 페이지 ISR `revalidate=600` (s239 신설)  
> 2026-09-03 G-4 정정 재등재 — 구 `ARCHITECTURE_RULES.md` #42. 의미 변경 없음.

**Rule**:
- `/apt`, `/blog`, `/stock` 메인 페이지: `export const revalidate = 600` (10분 ISR).
- cold start 감소 + 봇 캐시 hit rate 향상.
- 단지/글 상세 페이지는 `force-static` (Rule #32 / s238 적용).
- 더 짧은 revalidate (60s) 는 트래픽 적은 페이지 한정 — 봇 hit rate 가 cold start 비용 못 갚음.

### 결번 확정
- **#65** — 두 원장·코드·STATUS 어디에도 문안이 없다(2026-09-03 전수 0건). 등재하지 않고 결번으로 못 박는다.
- **#67** — 동번호 이의로 폐기. 두 문안은 위 #119·#120.
- **#21~#42** — RULES 아카이브 대역(#42 는 2026-09-03 정정으로 #122 재등재). `ARCHITECTURE_RULES.md` 가 이 대역을 재사용 중이니 **새 규칙에 쓰지 않는다**(다음 번호는 #121부터).
