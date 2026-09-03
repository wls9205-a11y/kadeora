# 카더라 Architecture Rules — **단일 원장** (#11~#143)

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
- **#18** 라우트의 `export const maxDuration` 하나로 충분하다 — vercel.json 캐치올은 그것을 «덮지 않는다» (2026-08-27 실측 정정, 아래 「원장 통합」 참조) — 상세본은 아래 「원장 통합」 절의 `RULES#18`(같은 규칙의 요약·본문 한 쌍)
- **#49** dynamic page에서 `Promise.allSettled` 8개+ 동시 fetch 금지 (504 위험)
- **#51** ilike `%X%` 패턴 시 입력 string 길이 ≥ 3 검증 필수

## Schema / Data
- **#13** Supabase types에 없는 테이블은 `(sb as any).from()` 패턴
- **#15** `count: 'exact'`는 1,000행 미만 테이블만 (`count: 'estimated'` 기본)
- **#50** `apt_sites.region` vs `apt_subscriptions/transactions.region_nm` 컬럼명 일관성

## Cron
- **#19** cron 삭제 전 3종 검증: cron_logs 30d + pg_cron 등록 + src/ grep — 상세본은 아래 「원장 통합」 절의 `RULES#19`(같은 규칙의 요약·본문 한 쌍)
- **#45** AdSense Tier 1 (`/blog/[slug]`) 외 페이지에는 광고 슬롯 금지

## Supabase Security
- **#17** 36 RLS 정책 + 50+ service_role 전용 RPC + `is_current_user_admin()` 헬퍼
- **#20** Kakao Marketing 5중 send guard — 상세본은 아래 「원장 통합」 절의 `RULES#20`(같은 규칙의 요약·본문 한 쌍)
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
- **#11** `docs/STATUS.md`는 매 세션 prepend + commit/push 필수 — 상세본은 아래 「원장 통합」 절의 `RULES#11`(같은 규칙의 요약·본문 한 쌍)
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
- 단지/글 상세 페이지는 `force-static` (`RULES#132` / s238 적용).
- 더 짧은 revalidate (60s) 는 트래픽 적은 페이지 한정 — 봇 hit rate 가 cold start 비용 못 갚음.

### 결번 확정
- **#65** — 두 원장·코드·STATUS 어디에도 문안이 없다(2026-09-03 전수 0건). 등재하지 않고 결번으로 못 박는다.
- **#67** — 동번호 이의로 폐기. 두 문안은 위 #119·#120.
- **#21~#42** — RULES 아카이브 대역(#42 는 2026-09-03 정정으로 #122 재등재). `ARCHITECTURE_RULES.md` 가 이 대역을 재사용 중이니 **새 규칙에 쓰지 않는다**(다음 번호는 #121부터).

## ARCH 퇴역 이관 (2026-09-03 · G-4)

`docs/ARCHITECTURE_RULES.md` 의 실규칙 21건을 여기로 옮기고 그 파일을 퇴역시켰다. 문안·의미 변경 없음 — 번호만 폐대역(#21~#42)·중복 위험 대역에서 빠져나왔다. 구↔신 매핑은 `docs/RULES_LEDGER_대사_20260903.md`.

### RULES#123 — /apt region resolution = Edge → SSR → Client 단일 흐름 (s229 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #21.

**Symptom**: `/apt` 진입 시 region picker flash, localStorage 가 redirect 직후 다시 덮어씀, server/client region 가 다르게 계산되어 hydration mismatch.

**Cause**: 이전 흐름은 client-only — server 는 region 모르고 RegionAutoSelect 가 mount 후 redirect 시도. timezone 강제 매핑 + 'apt:lastRegion' 자체 키 사용으로 다른 페이지(`region-storage.ts`의 `kd:region`) 와 mismatch. 결과: SSR 가 '전국' 으로 한 번 렌더 → client 가 다른 값으로 재요청 → 깜빡임.

**Rule**:

`/apt` 의 region 결정 흐름은 단일:

1. **Edge middleware** (`src/middleware.ts`) — `kd_region` 쿠키 → Vercel `x-vercel-ip-country-region` (`isoToKrRegion`) → `null`. 결과를 `request.headers.set('x-kd-region', resolved || '전국')` 로 downstream SSR 에 전달.
2. **SSR page.tsx** — `region = sp.region?.trim() || (await headers()).get('x-kd-region') || '전국'`. 첫 페인트 시점에 정답 region 으로 SSR.
3. **fetcher 전국 처리** — `region === '전국'` 일 때 `.eq()`/`.contains()` 안 걸어 전국 합계 반환 (V_apt_region_summary 등).
4. **Client RegionAutoSelect** — `useSearchParams().get('region')` 있으면 no-op. 없으면 `getStoredRegion()` (`@/lib/region-storage`) → `isValidKrRegion()` 통과 시만 `router.replace`. timezone 매핑/자체 키 금지 — single source `kd:region`.
5. **RegionPicker choose()** — region 선택 시 `kd_region` 쿠키 set (max-age 1y, samesite=lax). 다음 방문에서 middleware 가 즉시 SSR 단계에 region 주입.

**How to apply**:
- 새 region-aware 페이지 (예: `/stock/region/[region]`) 도 동일 패턴 — Edge → SSR header → fetcher 전국 처리.
- 좌표 → region 변환은 `/api/region/from-coords` (Edge runtime, Kakao reverse geocoding) 사용. KAKAO_REST_API_KEY 미설정 시 503 반환 — middleware 흐름은 영향 없음.
- localStorage 키는 `kd:region` 으로 통일. `apt:lastRegion` 등 자체 키 추가 금지.

**Discovered**: s229 (2026-05-04) — /apt picker flash + localStorage 키 mismatch + middleware geo 미사용 합계 10 bugs 추적 중 발견. 단일 source-of-truth 흐름으로 정리.

### RULES#124 — CTA click 트래킹: navigation 일으키는 onClick 은 helper 통과 (s230 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #22.

**Symptom**: cta_view 1,121 / cta_click 18 / 24h. desktop CTR 1.5% / mobile 1.6% — 모든 device 공통. 18 click 은 모두 modal/in-page/logged-in (navigation 없는 케이스). anchor / Link / `window.location.href` 로 navigation 일으키는 click 은 0건 기록됨.

**Cause**: `<a href="...">` / `<Link href="...">` / `window.location.href = ...` 가 onClick handler 의 `trackCTA(...)` 호출보다 먼저 실행 — sendBeacon 큐가 enqueue 되기 전 navigation 시작 → 브라우저가 unload 시 in-flight 큐 drop → 이벤트 silent fail. SW 무관, endpoint 정상, hook 정상. 패턴 자체가 race.

**Rule**:

navigation 일으키는 모든 CTA click 은 `src/lib/cta-navigate.ts` 의 `trackCtaAndNavigate(...)` helper 통과 필수:

```ts
trackCtaAndNavigate({
  href: '/login?...',
  ctaName: 'sticky_signup_bar',
  pagePath: pathname,
  category: 'signup',
});
```

helper 가 (1) `trackCTA('click', ...)` (2) `trackCtaClick(...)` 둘 다 호출 (이중 안전망) 후 (3) 80ms `setTimeout` 으로 sendBeacon 큐잉 보장 후 navigate. modal/in-page click (navigation 없음) 은 `trackCTA('click', ...)` 직접 호출 OK.

**How to apply**:
- 새 CTA 추가 시 anchor/Link 직접 navigation 금지. `<button type="button" onClick={...}>` + helper 사용.
- 기존 anchor/Link 의 visual style (border-radius, padding 등) 은 button 으로 옮길 때 100% 보존 — 추가만 (border:'none', background:'none', cursor:'pointer').
- helper 는 fire-and-forget. caller 가 await 하면 navigation 80ms delay 가 의미 없어짐 — 절대 await 금지.
- sendBeacon 실패 시 keepalive fetch fallback 은 `cta-track.ts` send 함수가 처리.

**Discovered**: s230 (2026-05-04) — 12+ BROKEN CTA (sticky_signup_bar 312 view 0 click, login_gate_apt_analysis 423 view 0 click, blog_early_teaser 146 view 0 click 등) 일제히 navigation race 패턴. 8 컴포넌트 button + helper 로 통일.

### RULES#125 — signup flow: frictionless → /onboarding → 거주지+관심사 (s231 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #23.

**Symptom**: 신규 가입 30일간 거주지 등록률 21% → 1.3% (16배 추락). 4/14 frictionless RPC 변경 시점과 일치.

**Cause**: `complete_signup_frictionless` RPC 가 신규 사용자를 `onboarded=true` 로 강제 INSERT — 이후 `/onboarding` 페이지에 진입할 path 가 없어 91% skip. 거주지·관심사 등 필수 메타데이터 미수집.

**Rule**:

DB 측 frictionless RPC 는 신규 사용자를 `onboarded=FALSE` 로 INSERT. `auth/callback/route.ts` 가 redirect 직전 profiles 조회 → `onboarded=false` 면 `/onboarding?return=<safeRedirect>` 로 redirect. 사용자가 `/onboarding` 에서 거주지/관심사/마케팅 동의 manual 등록 → `onboarded=TRUE` 마침.

**How to apply**:
- 새 OAuth provider 추가 시 같은 callback 패턴 — onboarded 조회 → 미완료면 /onboarding 으로.
- `/onboarding` 페이지가 fallback 으로 작동해야 하므로 항상 reachable. middleware 의 인증 가드가 차단하지 않도록 주의.
- onboarded=false + residence_city=null 사용자에게는 백업으로 ResidenceNudgeModal (5초 delay, 7일 cooldown) 도 함께 mount — onboarding 직접 접근 못 한 케이스 회수.

**Discovered**: s231 (2026-05-04) — 거주지 등록률 회귀 30일 추적 중 발견. DB W1 (frictionless onboarded=FALSE) + 코드 callback redirect + ResidenceNudgeModal 3종 동시 적용으로 path 복구.

### RULES#126 — 모달 cooldown = localStorage 7일 timestamp (s231 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #24.

**Symptom**: 사용자가 dismiss 한 모달 (KakaoChannelAddModal, SignupPopupModal, MarketingConsentModal) 이 새 탭/세션마다 다시 노출 → 짜증 + dismiss 율 ↑.

**Cause**: 기존 cooldown 이 sessionStorage 에 단순 flag (`'1'`) 저장. 새 탭/창 = 새 세션 → flag 사라짐 → 다시 노출.

**Rule**:

모든 client-side 모달의 cooldown 은 `localStorage` + timestamp 패턴:

```ts
const STORAGE_KEY = 'kd_<modal>_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// skip check
const ts = localStorage.getItem(STORAGE_KEY);
if (ts && Date.now() - Number(ts) < COOLDOWN_MS) return;

// dismiss write
localStorage.setItem(STORAGE_KEY, String(Date.now()));
```

**How to apply**:
- 신규 모달 추가 시 sessionStorage 사용 금지. 키는 `kd_` prefix + 모달 식별자 + `_dismissed_at` suffix.
- COOLDOWN_MS 는 default 7일. 더 짧은 cooldown 이 비즈니스 요구일 때만 override.
- localStorage 접근은 try/catch 로 감쌈 (Safari private 모드 등 차단 케이스).

**Discovered**: s231 (2026-05-04) — KakaoChannelAddModal / SignupPopupModal / MarketingConsentModalMount 3 모달이 sessionStorage 사용해 새 탭마다 부활. 일괄 localStorage 7일 timestamp 로 통일.

### RULES#127 — blog 작성 cron 은 freshness-context inject + auto-unpublish (s232 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #25.

**Symptom**: 8,574 published 중 391개 (2024 title) + 9개 (2025 stale 시즌성) 검색 노출 중. LLM 이 학습 cutoff 기준으로 "2024년" 같은 과거 연도를 미래/현재형으로 작성.

**Cause**: blog 작성 cron 의 LLM prompt 에 "현재 시점" 컨텍스트 부재. INSERT 시 freshness 메타데이터 (target_year/expires_at/is_seasonal) 미기록 → stale 자동 정리 불가.

**Rule**:

blog 작성용 LLM 호출은 모두 `getFreshnessContext()` (`src/lib/blog/freshness-context.ts`) 를 system prompt 에 inject 필수:

```ts
const systemPrompt = `${baseSystemPrompt}\n\n${getFreshnessContext()}`;
```

context 에는 오늘 날짜 (KST), 현재 연도/분기, "과거 연도 미래형 금지", target_year/expires_at/is_seasonal 메타 가이드 포함.

INSERT 시 `deriveFreshnessFields({ isSeasonal, targetYear })` 로 freshness 컬럼 채움. seasonal=true 면 `expires_at = now + 90d` 자동 계산.

매일 KST 02:00 `blog-stale-unpublish` cron 이 (1) `expires_at < now` (2) `target_year < current_year` (3) `is_seasonal=true AND published_at < now-180d` 조건의 글을 `is_published=false` + `auto_unpublished_reason` 마킹.

**How to apply**:
- 새 blog 작성 cron 추가 시 freshness-context import 필수. system prompt + INSERT 양쪽 적용.
- `is_seasonal` 휴리스틱: 청약일정/공고/D-day/분기실적 = true; 영구 가이드/단지소개 = false. 애매하면 false (보수).
- `safeBlogInsert` helper 사용 시 freshness 필드가 payload 에 포함되도록 helper 도 forward 하게 업데이트 (s232 follow-up TODO).

**Discovered**: s232 (2026-05-04) — blog_posts 391+9 stale 노출 추적 중 발견. 9 작성 cron + freshness-context lib + 자동 unpublish cron 3종 동시 적용.

### RULES#128 — /apt 하위 컨텐츠 배치 표준 (s235 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #27.

**Symptom**: /apt/[id] 사용자 알고싶은 정보 (위치 / 단지스펙) 가 15번째 / 7번째에 배치 → 모바일 스크롤 피로 + bounce.

**Cause**: 섹션 추가 history 가 누적되며 비즈니스 로직 (분양 일정/실거래/사업일정) 이 위에 쌓여 결정 정보 (위치/스펙) 가 뒤로 밀림.

**Rule**:

`/apt/[id]` 와 `/apt/complex/[name]` 등 단지 상세 페이지의 섹션 배치 순서는 다음을 따른다:

1. **Hero** (이름/카테고리/대표 이미지)
2. **KPI cards** (분양가/세대수/입주일 등 요약)
3. **📍 위치 정보** (지도/주소/교통/학군 — 결정 요소)
4. **📅 분양 일정** (D-day, 청약접수 일정)
5. **🏗️ 단지 스펙** (세대수/면적별 구성)
6. **💰 가격 정보** (분양가 vs 실거래가 / 분양가 비교 / 실거래 이력)
7. **📊 분석 섹션** (종합 분석 / 시세 비교 / 최근 실거래 비교)
8. **조건부 섹션** (경쟁률 / 미분양 / 재개발 — 데이터 있는 경우만)
9. **🏪 주변 시설**
10. **❓ FAQ**
11. **footer 그룹** (커뮤니티 / 블로그 / 다른 현장)
12. **Disclaimer**

**How to apply**:
- 새 섹션 추가 시 위 12개 슬롯에 매핑. 슬롯 사이에 끼우면 안 됨.
- 데스크톱 1024+ 는 2-column grid (1.5fr / 1fr) 권장. 분석/추천 섹션을 aside 로.
- 조건부 섹션은 `{data && <section>...}` 패턴 — 데이터 없으면 렌더 X.

**Discovered**: s235 (2026-05-06) — /apt/[id] 14 section 분석 중 위치=15번째, 단지스펙=7번째 발견. 표준 배치로 재정렬.

### RULES#129 — inline raw fontSize/padding 금지, CSS var + class 통일 (s235 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #28.

**Symptom**: 컴포넌트마다 `fontSize: 14`, `padding: 14` 같은 raw 숫자 분산. 디자인 토큰 변경 시 일괄 수정 불가 + 데스크톱 layout 미고려.

**Cause**: 빠른 prototyping 으로 `style={{...}}` inline value 채택. 누적되며 디자인 일관성 깨짐.

**Rule**:

`/apt`, `/apt/complex` 등 핵심 페이지의 섹션 타이틀/카드/wrapper 는 다음 클래스 사용:

```css
.apt-page-container { max-width: 720px; padding: var(--sp-md); }
@media (min-width: 1024px) { .apt-page-container { max-width: 900px; padding: var(--sp-lg); } }

.apt-section-title { font-size: var(--fs-md); font-weight: 800; ... }
@media (min-width: 768px) { .apt-section-title { font-size: var(--fs-lg); } }

.apt-card-v2 { background: var(--bg-surface); border-radius: var(--radius-md); padding: var(--sp-md) var(--card-p); }
@media (min-width: 768px) { .apt-card-v2 { padding: var(--sp-lg) var(--card-p); } }
```

raw 숫자 (예: `fontSize: 14`, `padding: 16`) → CSS var (`var(--fs-sm)`, `var(--sp-md)`) 만 사용.

**How to apply**:
- 새 섹션 타이틀 = `<h2 className="apt-section-title">`. 인라인 style 금지.
- 카드 wrapper = `<section className="apt-card-v2">`. inline padding/border 금지.
- 1024+ layout 의무 — sticky aside (`position: sticky; top: 80px`) 패턴 권장.
- 예외: 동적 값 (e.g. `style={{ width: progressPct + '%' }}`) 만 inline 허용.

**Discovered**: s235 (2026-05-06) — /apt/[id] 14 곳 + /apt/complex/[name] 5 곳 inline `style={ct}` 사용 중. 일괄 className 으로 통일 + globals.css 클래스 신설.

### RULES#130 — /apt cover image 우선순위 + 위성/OG fallback 차단 (s236 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #30.

**Symptom**: /apt 페이지 카드에 위성사진 / `/api/og` placeholder 가 진짜 사진보다 먼저 노출. 사용자가 "이게 실제 단지 사진이야?" 의심 → 신뢰도 ↓.

**Cause**: `apt_sites.images` jsonb 가 mixed type (string + object) 이고 caption/source 필드 미통일. cover image 정렬 기준이 단순 array index 였음.

**Rule**:

`/apt` 하위 페이지의 cover image priority (낮은 score = 우선):

| score | 종류 | 패턴 |
|---|---|---|
| 1 | 조감도/투시도 | caption: 조감도/투시도/rendering/birdseye |
| 2 | 모델하우스/배치도/평면도 | caption: 모델하우스/견본/평면도/배치도 |
| 3 | 현장 사진 | caption: 현장/건설/공사/시공 |
| 4 | naver/kakao 외부 출처 | url: imgnews.naver/pstatic/kakaocdn/daumcdn |
| 5 | 일반 외부 | (그 외) |
| 8 | 위성 | url: maps.googleapis/staticmap/openstreetmap/aerial.view/satellite.image, caption: 위성사진 |
| 9 | kadeora OG fallback | url: kadeora.app/api/og |

**서버**: DB `pick_apt_cover_image(p_site_id uuid)` RPC 호출 — `apt_sites.cover_image_url` 자동 갱신. 매일 KST 03:30 `cover-image-backfill` cron 이 NULL 또는 OG fallback 인 단지에 카카오 이미지 검색으로 조감도 추가 후 RPC 재호출.

**클라이언트**: `AptImageGallery.tsx` 의 `normalized` 단계에서 satellite filter + priority sort 한 번 더 (RPC 결과 보강). `AptHeroLarge.tsx` / `AptCardV5.tsx` 등 카드는 `isSatellite()` + `isOgFallback()` 헬퍼로 cover 검증 후 `AptImagePlaceholder` (SVG building skyline) fallback.

**Schema**: `src/lib/schema/apt.ts` 의 `buildSchemaImages()` 가 RealEstateListing.image 에 `ImageObject[]` (contentUrl + caption) 로 emit, 위성 차단 + priority sort 적용.

**How to apply**:
- 새 apt 카드 컴포넌트 만들 때 `pickBestAptImage(site)` + `isSatellite()` 가드 + `AptImagePlaceholder` fallback 패턴 의무.
- 새 image 쓰는 cron 은 caption 필드에 출처/종류 명시 (조감도/모델하우스/뉴스 등) — pickRealImage 정렬 보장.
- OG fallback 사용 시 작은 watermark "사진 준비중" 추가 (사용자 신뢰도).

**Discovered**: s236 (2026-05-07) — 4,887 apt_sites 중 진짜 사진 47%, OG fallback 31%, NULL 19%. apt_complex_profiles 34,544 중 cover 재계산 후 위성 거의 사라짐. cover-image-backfill cron 으로 점진 회복.

### RULES#131 — 메인/상세 페이지 og:image 6장 패턴 (s238 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #31.

**Symptom**: 네이버/구글 search snippet 에 단일 이미지만 노출. 카루셀 안 잡힘. 캐러셀 보유한 블로그 글 (6장 이상) 만 search rich result 노출.

**Cause**: 메인 페이지 (/apt, /blog, /stock) 의 `openGraph.images` 가 1-2장. 단일 hero/og-square 만으로는 네이버/구글이 캐러셀 못 만듦.

**Rule**:

모든 메인/상세 페이지의 generateMetadata 는 `openGraph.images` 와 `twitter.images` 에 6장 emit 의무:

- 1: `card=hero` (메인 hero)
- 2: `card=stats` (통계 그리드)
- 3: `card=imminent` (D-7 / 임박 / 추천 — amber theme)
- 4: `card=ranking` (TOP 3 또는 ranking list)
- 5: `card=region` (지역 / 카테고리 grid)
- 6: og-square 630×630 (네이버 모바일 1:1 크롭)

`/api/og?card=...&category=...&title=...` 로 단일 라우트가 5개 layout 생성 (DB-free, 빠른 generation). 종목 detail 은 `/api/og-stock?symbol=...&card=price|chart|financial|flow|ai`.

**How to apply**:
- 새 메인/상세 페이지 추가 시 6장 패턴 의무. `og-square` 는 항상 6번째.
- `card` 값은 카테고리별로 어울리게 — 종목은 price/chart/financial, 부동산은 imminent/region.
- 1200×630 + 630×630 ratio 두 종 함께 (구글 carousel + 네이버 1:1 크롭 동시 대응).

**Discovered**: s238 (2026-05-07) — 메인 페이지 og:image 1-2장 vs 블로그 글 6장 격차로 네이버 캐러셀 누락. /apt/complex/[name] 등은 BAILOUT_TO_CSR 로 인덱싱 0%.

### RULES#132 — Server Component BAILOUT_TO_CSR 즉시 fix (s238 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #32.

**Symptom**: 페이지가 SSR 안 되고 CSR fallback. Vercel dev 콘솔에 `BAILOUT_TO_CLIENT_SIDE_RENDERING`. Google bot 이 컨텐츠 못 봄 → 자동 noindex.

**Cause**: Next.js 15 의 `dynamic = 'auto'` 가 ambiguous 한 server component (cookies 사용 + ISR + 'use client' 혼합) 를 만나면 BAILOUT 으로 fallback. 흔한 트리거:
- `createSupabaseServer()` 가 `next/headers` 의 cookies 사용 — Dynamic API
- 자식 컴포넌트가 `'use client'` 인데 SSR-critical (h1/h2) 포함
- error.tsx 가 무거운 client-only 작업 수행
- generateMetadata 또는 fetchData 가 throw 시 catch 안 됨

**Rule**:

Server Component 페이지의 BAILOUT 진단 + fix 순서:

1. `export const dynamic = 'force-static' | 'force-dynamic'` 명시 (auto 금지)
2. `export const revalidate = N` ISR 명시
3. `createSupabaseServer()` (cookies 의존) 대신 `getSupabaseAdmin()` (service role, cookie-free) 사용 — 단지 상세/공개 페이지에 한해
4. SSR-critical 자식 컴포넌트 (h1/h2/p) 는 server component 만. `'use client'` 자식은 dynamic import + ssr:false 로 격리
5. 모든 fetch 에 try/catch + fallback null. 절대 throw 금지 (error.tsx 가 client 면 BAILOUT)
6. `generateMetadata` 의 `robots.index: false` 는 명시적 사유 (data_quality_score 등) 만. ambiguous noindex 금지

**Discovered**: s238 (2026-05-07) — /apt/complex/[name] 34,544 단지 BAILOUT_TO_CSR + 자동 noindex. createSupabaseServer→getSupabaseAdmin 전환 + dynamic=force-static + 명시적 robots 가드로 복구.

### RULES#133 — image-sitemap 단지/글당 4-7 이미지 entry (s238 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #33.

**Symptom**: image-sitemap 단지/글당 1 entry → 네이버 이미지 검색 노출 절반 이하.

**Rule**:

`src/app/sitemap-image/[page]/route.ts` 가 각 row 의 `images` jsonb 모든 element 를 `<image:image>` entry 로 emit (단지/글당 cap 7):
- cover_image_url 우선
- images jsonb 의 모든 element (string + object)
- satellite/og fallback 필터 (RULES#130 패턴)
- caption 필드 명시 (image:title + image:caption)

**How to apply**:
- 새 image-bearing 컬럼 추가 시 sitemap 에 emit. 신규 페이지 (apt/region/* 등) 도 동일.
- cap 7 은 네이버 권장. 더 많이 노출하려면 페이지 자체에 schema:ImageObject 로 추가.

**Discovered**: s238 (2026-05-07) — apt_sites 5천 + apt_complex_profiles 3.4만 = 약 30,869 entries → 4-7배 = 100,000+ entries.

### RULES#134 — news-sitemap 48h 신선도 + 카테고리 우선순위 (s238 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #34.

**Symptom**: news-sitemap 100건 중 60건이 7일+ 이전 글. 네이버 뉴스 search 는 48h 신선도 절대 우선.

**Rule**:

`src/app/news-sitemap.xml/route.ts`:
- WHERE `published_at > NOW() - INTERVAL '48 hours'`
- 카테고리 우선순위 sort: finance(1) > unsold(2) > redev(3) > apt(4) > 기타(9). 같은 우선순위 내 published_at DESC.
- LIMIT 50 (네이버 권장 cap)

**How to apply**:
- 카테고리별 평균 view 데이터 변경 시 우선순위 재조정 (현재 finance=180, unsold=172).
- PostgREST CASE 정렬 불가 → JS 측 post-sort 사용.

**Discovered**: s238 (2026-05-07) — finance/unsold 카테고리가 view 평균 높지만 sitemap order 무차별 → 신선도 낮은 일반 글이 위로 와서 네이버 색인 누락.

### RULES#135 — SITE_URL 사용 의무 (s239 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #36.

**Symptom**: `https://kadeora.app/...` 직접 박힌 코드 17 파일. 도메인 변경 시 일괄 수정 불가, 환경별 staging URL 차별화 불가.

**Rule**:
- 코드 안 `https://kadeora.app/...` 직접 박지 말 것.
- `import { SITE_URL } from '@/lib/constants'` 후 `${SITE_URL}/...` 사용.
- 예외: User-Agent header 의 `(+https://kadeora.app)` 는 브랜딩 식별자 — keep.
- 검증: `grep -rn "'https://kadeora.app/" src/` 결과 = User-Agent 만.

**Discovered**: s239 (2026-05-07) — 17 파일 + 33 occurrences 통일.

### RULES#136 — NEXT_PUBLIC_SUPABASE_URL env var 사용 (s239 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #37.

**Rule**:
- layout.tsx 등에 supabase URL 직접 박지 말 것.
- `process.env.NEXT_PUBLIC_SUPABASE_URL ?? '<hardcoded fallback>'` 패턴.
- 빌드 타임 치환 + env 미설정 시 안전 fallback.

### RULES#137 — OG 토큰 단일 source `src/lib/og-tokens.ts` (s239 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #38.

**Rule**:
- 6 OG route (og/og-apt/og-blog/og-square/og-image/og-stock) 모두 `OG_CAT` import.
- 색상/라벨/아이콘 변경 시 이 파일만 수정.
- 새 OG route 추가 시 반드시 OG_CAT import + `getOgCat(key)` fallback.

**`OgCategoryToken` 필드**: color / dim / bg [3-stop] / label / code / icon.

### RULES#138 — console.error 분할 출력 (s239 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #39.

**Symptom**: Vercel runtime log 1 row 길이 제한 (~250 chars). 단일 호출로 message + stack + input 묶어 보내면 stack/input 부분 truncated.

**Rule**:
- 패턴: 한 줄에 한 정보만.
  ```ts
  console.error('[name] message=', e?.message);
  console.error('[name] stack=', e?.stack);
  console.error('[name] class=', e?.constructor?.name);
  console.error('[name] input=', JSON.stringify({...}));
  ```
- prefix `[route-name]` 통일 (grep 용이).
- 단일 console.error 에 `stack=`, `class=` 등 함께 넣지 말 것.

**Discovered**: s239 (2026-05-07) — /api/og + /api/og-blog throw 메시지 진단 시 단일 console.error 가 30자 자르고 stack/input 모두 사라짐 발견.

### RULES#139 — light mode `!important` body/html 만 제거 (s239 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #40.

**Symptom**: light mode 의 background/color !important 가 component override 차단 (specificity 깨짐).

**Rule**:
- `html.theme-light body` 의 `!important` 제거. 다른 component 가 override 가능.
- 단, `input/textarea/select` 의 `!important` 는 keep — third-party form widget (kakao/google/toss) 호환.
- font-size adjust (`html.font-large` 등) 의 `!important` 도 keep — 사용자 접근성 우선.

### RULES#140 — onboarded 컬럼 변경 권한 (s239 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #41.

**Symptom**: 카카오 24h 가입자 100% onboarded=TRUE / residence=NULL — ResidenceNudgeModal 작동 0건. /onboarding 페이지 redirect path 무용.

**Cause**: `auto_rescue_stuck_users` RPC 가 가입 5분 후 모든 사용자 강제 onboarded=TRUE. + MarketingConsentModal/profile/consent route 가 동의 시 onboarded:true 함께 update.

**Rule**:

`onboarded=TRUE` 설정 권한은 **단 두 곳**:
1. `complete_onboarding` RPC — 사용자가 `/onboarding` 페이지 완료 시 (거주지 + 관심사 + 마케팅 동의 manual)
2. `auto_rescue_stuck_users` RPC — 가입 24h 후 fallback (조건: residence_city OR interests >= 1)

**금지 위치** (s239 적용):
- `handle_new_user_autoprofile` trigger — `onboarded=FALSE` 로 INSERT (이미 OK)
- `complete_signup_frictionless` RPC — onboarded 변경 금지 (이미 OK)
- `MarketingConsentModal.tsx` — 동의/거부 모두 onboarded 변경 금지 (s239 W1.A fix)
- `profile/consent/route.ts` — onboarded body 무시 (s239 W1.D fix)
- 기타 client/server 코드 일체 — 직접 update 금지

**How to apply**:
- 새 trigger/RPC 추가 시 onboarded 변경 코드 review 필수.
- ResidenceNudgeModal 등 onboarded=FALSE + residence=NULL 조건 사용하는 컴포넌트는 path 보존 검증.

**Discovered**: s239 (2026-05-07) — auto_rescue 5분 → 24h + 조건 추가, 2 client + 1 server route fix.

### RULES#141 — `apt_sites.page_views` 를 사용자 노출 순위에 쓰지 말 것 (H4-1 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #107.

> 번호 근거: 착수 시 리포지터리 전수 `grep -rno "Rule #[0-9]\+"` 로 최대값이 #106
> (`STATUS.md:1852`)임을 확인하고 #107 을 부여했다. 채팅이 미리 적은 번호가 아니다.

**Symptom**: 홈 「많이 보는 현장」 9위가 `2020.2.7. LH 국민임대 예비입주자 모집공고` 였다.
현장이 아니라 6년 전 공고문이다.

**Cause**: `apt_sites.page_views` 는 실제 조회수가 «아니다». 합성값이다.

| 확인 | 값 |
|---|---|
| `apt_sites.page_views` 컬럼 총합 | 200,655 |
| `page_views` **테이블** 3개월 apt 경로 | 1,941 |
| 부울경 PV 상위 12곳의 실제 사람 조회 | **전부 0** |

100배 괴리 + 상위권 전부 실조회 0. 순위를 만들 근거가 아니다.

**Rule**:

- `page_views` 컬럼으로 «사용자에게 보이는» 목록을 정렬하지 않는다.
  홈 칩·홈 섹션·목록 정렬 어디에도 금지.
- 같은 이유로 「인기」·「많이 보는」·popular·hot 류의 **순위를 주장하는 라벨을 쓰지 않는다.**
  부울경에서 30일간 사람이 3회 이상 본 현장이 **0곳**이다(235곳에 858건 흩어짐).
  순위 신호 자체가 없다.
- 기존 크론이 «배치 대상 선정»에 쓰는 건 그대로 둔다 — 그건 순위 노출이 아니다.
  컬럼을 지우면 그것들이 깨진다.
- 대신 계측을 먼저 붙인다(H4-3). 봇 제외 집계가 **현장당 3회 이상 · 5곳 이상** 나오면
  그때 라벨을 승격한다. 기준 미달이면 승격하지 않는다.

**같이 걸러야 하는 소스** — 전부 실측으로 탈락했다.

| 소스 | 실측 | 판정 |
|---|---|---|
| `content_score` | 은퇴 행에도 남는 잔여값 | RULES#118 |
| `trending_keywords` | heat_score 전부 100 · `2026` `아파트` 혼입 · 경기·서울 혼입 | H3-3 |
| `search_logs` (42,576) | 30일 클릭 0 · 로그인 0 · 새벽 4~5시 최고치 | 크롤러 |
| `gsc_search_analytics` | 마지막 적재 2026-04-22 · 상위 20개 전부 주식 종목 | 낡음 |

**How to apply**:
- 홈·목록에 새 「무엇무엇 순」 섹션을 붙이기 전에 «그 순서의 근거 컬럼이 사람의 흔적인지»
  먼저 캔다. `select sum(page_views) from apt_sites` 와 실제 로그 테이블 집계를 나란히 놓는다.
- 칩·섹션의 **라벨과 소스를 한 함수에서 같이** 낸다 (`src/lib/home/chips.ts`).
  둘을 따로 두면 소스만 바뀌고 라벨이 남아 조용히 거짓말이 된다.
- 소스가 둘 이상이면 **섞지 않는다.** 소스를 통째로 고르고 라벨을 거기 맞춘다.

**Discovered**: H4-1 (2026-08-26) — 홈 「많이 보는 현장」 섹션 제거.
`lib/home/sections.ts` 의 popular 계산은 판정 기록과 함께 남겨 뒀다.

### RULES#142 — 값이 이상하면 «함수를 고치기 전에» 그 컬럼의 기록자를 전부 나열한다 (H7-2 신설)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #115.

**Symptom**: 어떤 컬럼의 값이 틀렸다. 그 값을 만드는 함수를 찾아 고친다. 그런데 다음 날 또 틀려 있다.

**Cause**: 그 컬럼에 «쓰는 곳이 하나가 아니다». 뒤에 도는 쪽이 앞의 결과를 덮는다.
고친 함수는 애초에 옳은 값을 내고 있었고, 바꾼 것은 «맞는 로직» 이다.

**실제 사례 2건**

| 컬럼 | 고치려던 것 | 실제로 덮던 것 |
|---|---|---|
| `apt_sites.lifecycle_stage` | `derive_subscription_stage` (05:00) | `fn_refresh_lifecycle_stage` (06:23, 전진 전용) |
| `blog_posts.content` | R1 외부 이미지 제거 | pg_cron `replace_blog_body_og` (OG→실사 역방향) |

**Rule** — 값이 틀렸을 때 «순서»:

1. 그 컬럼에 쓰는 것을 **쿼리로 뽑는다**. «기억으로 나열하지 말 것» —
   이 규칙을 세운 다음 날 내가 트리거를 빠뜨려 같은 실수를 3회째 냈다.
   아래 한 문장이 함수·트리거를 «같이» 낸다. 이걸 돌리지 않고 진단을 시작하지 않는다.

   ```sql
   -- 「이 컬럼에 쓰는 객체」 전수 — 함수 + 트리거(+ 트리거가 부르는 함수)
   -- 사용법: <표>·<컬럼> 두 곳만 바꾼다.
   with tgt as (select '<표>'::text tbl, '<컬럼>'::text col)
   select 'function' kind, p.proname obj, null::text on_table
     from pg_proc p, tgt
    where p.pronamespace = 'public'::regnamespace
      and p.prosrc ~* ('(update\s+' || tgt.tbl || '|set\s+' || tgt.col || '|new\.' || tgt.col || ')')
   union all
   select 'trigger', t.tgname, c.relname
     from pg_trigger t join pg_class c on c.oid = t.tgrelid, tgt
    where not t.tgisinternal and c.relname = tgt.tbl
   union all
   select 'trigger_fn', p.proname, c.relname
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_proc  p on p.oid = t.tgfoid, tgt
    where not t.tgisinternal and c.relname = tgt.tbl
      and p.prosrc ~* ('(new\.' || tgt.col || '|insert into apt_site_events)')
   order by 1, 2;
   ```

   ⚠️ **트리거를 빼먹지 않게 쿼리에 넣은 이유**: `apt_sites_stage_change` 는
      함수가 `stage_updated_at` 을 «안 써도» `NEW.stage_updated_at := now()` 로 덮는다.
      「내 함수는 그 컬럼을 안 쓴다」는 「그 컬럼이 안 바뀐다」가 아니다.

   ② 스케줄: `select jobname, schedule, active, command from cron.job where active;`
   ③ 앱 코드: `grep -rn "<컬럼>" src/ | grep -iE "update|upsert|insert"`.

2. **저장값과 재계산값을 대조**한다. 둘이 다르면 「함수가 틀렸다」가 아니라
   「누가 덮었다」다. 함수에 «그 값을 낼 경로가 있는지» 부터 본다 —
   없으면 그 함수는 범인이 아니다.

3. 기록자를 줄일 때는 **끄기 전에 커버리지를 잰다**. 잃는 행이 몇 개인지 모르고
   끄면 조용한 결손이 된다. 실측 예: 이름 조인 2,758 vs source_ids 조인 2,755 → 1곳.

4. ⛔ **삭제하지 않는다.** 스케줄만 내리고(`cron.alter_job(active := false)`) 함수는 남긴다.
   주석으로 「되살리지 말 것」과 이유를 박는다.

⚠️ 남는 1곳처럼 «자동에서 빠지는 것» 은 반드시 검수 큐에 올린다. 알고 빠뜨리는 것과
   모르고 빠뜨리는 것은 다르다.

### RULES#143 — `scripts/` 의 판정·변환 로직은 lib 으로 꺼낸다 (PV-2 신설 · 전 트랙 공통)  
> 2026-09-03 G-4 재등재 — 구 `ARCHITECTURE_RULES.md` #116.

**`scripts/` 는 tsconfig 의 `exclude` 다. `npm run type-check` 가 «검사하지 않는다».**

### 어떻게 드러났나 (2026-08-29 · 실측)

PV-2 표본 게이트(`scripts/permits-gate.ts`)를 고치다 문자열 리터럴이 깨졌는데
`npm run type-check` 가 **그대로 통과**했다. 깨진 것은 실행 시점에 esbuild 가 잡았다.

```
tsconfig.json  exclude: [node_modules, supabase/functions, appintoss-build, scripts]
```

⚠️ 위험이 큰 이유는 «언제 실행되는가» 다. 게이트 스크립트는 **키가 들어온 뒤에야
   처음 돌아간다**. 그대로 뒀으면 사람이 키를 넣은 «바로 그 순간» 깨진 스크립트를
   만났을 것이다. 사각지대는 「늦게 처음 실행되는 코드」에서 가장 비싸다.

### 규칙

- 스크립트의 **판정·변환 로직은 `src/lib/` 로 꺼내고 테스트를 붙인다.**
  스크립트 본체는 «호출과 출력만» 한다.
- 판정에 관여하는 것 = 무엇을 후보로 볼지 · 어떻게 정규화할지 · 무엇을 성공으로 셀지.
  이런 것이 스크립트 안에 있으면 틀려도 아무도 모른다.
- ⛔ `tsconfig` 의 exclude 를 푸는 것으로 «대신하지 않는다». scripts 는 Next 빌드
  대상이 아니고, 넣으면 빌드가 느려지고 별개 문제(dotenv·top-level await)가 딸려온다.
  꺼내는 쪽이 싸다.

### 소급 적용은 하지 않는다

⚠️ 이미 «실행으로 검증된» 스크립트를 이 규칙 때문에 되짚어 고치지 않는다
   (실행이 곧 검증이었고, 손대는 것이 오히려 위험하다).
   새로 쓰거나 손대는 스크립트부터 적용한다.

### 적용 사례

- `permits-gate.ts` → `permitHaystack` · `sampleVerdict` 를 `src/lib/permits/hub.ts` 로.
  스크립트는 호출만. 테스트 5검사.
- 전파 대상: 세션 B `token-snapshot.ts` (판정부 lib 화는 B 재량 — 위 소급 조항 적용).

---
