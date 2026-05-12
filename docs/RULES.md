# 카더라 Architecture Rules (#1~#100)

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
- **#18** vercel.json catch-all maxDuration이 per-route export를 silently override
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

## 워크플로
- **#11** `docs/STATUS.md`는 매 세션 prepend + commit/push 필수
- 두 PC 동시 작업: `git stash && git pull --rebase origin main && git stash pop` 의무
- DB 마이그레이션은 한 PC만, `IF NOT EXISTS` 강제

## 추가 (이전 #1~#10, #12, #21~#42 등 예전 규칙)
세부 항목은 git log + docs/STATUS.md 이력 참조.
