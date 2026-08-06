-- s273 — /apt 청약 퍼스트 재설계
-- 단일 RPC get_apt_subscription_hub(p_region) 가 타임라인 + 카드리스트 + 금주 결과
-- 3블록을 하나의 jsonb 로 반환한다.
--
-- Architecture Rule #49: dynamic page 에서 다중 RPC 동시 호출 금지 (504 위험).
--   기존 /apt 는 get_apt_hero_pick + get_apt_recent_feed_v2 + get_apt_feed_stats
--   3개를 Promise.all 로 때렸다. 이 함수 하나로 대체한다.
-- Architecture Rule #56: SET search_path = public, pg_temp 필수.
-- Architecture Rule #63: REVOKE 는 anon/authenticated 만으로 부족 — PUBLIC 도 함께.
-- Architecture Rule #95: 클라이언트 호출 함수는 명시적 GRANT EXECUTE 필요.
-- Architecture Rule #97: region 결과가 0건이면 전국으로 cascade (region_fallback=true).
-- Architecture Rule #99: 3블록 전부 동일한 평탄 필드 시그니처.
-- Architecture Rule #73: idempotent + reversible.
--
-- 상태 판정 로직은 src/lib/apt/subscription-status.ts 의 getSubscriptionStatus 와
-- 1:1로 대응한다. 한쪽을 고치면 반드시 다른 쪽도 고칠 것.
--   leftover > open > upcoming > scheduled > announced_wait > contract > closed
-- 정렬 가중치: open(0) upcoming(1) announced_wait(2) contract(3) scheduled(4)
--              leftover(5) closed(6)
--
-- DOWN:
--   DROP FUNCTION IF EXISTS public.get_apt_subscription_hub(text);

DROP FUNCTION IF EXISTS public.get_apt_subscription_hub(text);

CREATE FUNCTION public.get_apt_subscription_hub(p_region text DEFAULT '전국')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_today       date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_region      text := NULLIF(btrim(coalesce(p_region, '')), '');
  v_scoped      boolean;
  v_fallback    boolean := false;
  v_timeline    jsonb;
  v_cards       jsonb;
  v_results     jsonb;
  v_open_count  integer := 0;
BEGIN
  -- '전국' / 빈 문자열은 지역 필터 없음
  IF v_region IS NULL OR v_region = '전국' THEN
    v_region := NULL;
  END IF;
  v_scoped := v_region IS NOT NULL;

  -- 지역 필터를 걸었을 때 "앞으로 볼 것"(open/upcoming/scheduled)이 한 건도 없으면
  -- 전국으로 확장한다. 빈 페이지를 보여주는 것보다 낫다 (Rule #97).
  IF v_scoped THEN
    SELECT count(*) INTO v_open_count
    FROM apt_subscriptions s
    WHERE s.region_nm = v_region
      AND coalesce(s.rcept_endde, s.rcept_bgnde) >= v_today;

    IF v_open_count = 0 THEN
      v_region  := NULL;
      v_fallback := true;
    END IF;
  END IF;

  WITH base AS (
    SELECT
      s.id,
      s.house_manage_no,
      s.house_nm,
      s.region_nm,
      s.supply_addr,
      s.pblanc_url,
      s.tot_supply_hshld_co                                        AS households,
      -- 평당 분양가: 채워지는 컬럼이 소스마다 달라 순서대로 fallback.
      -- 2026-08 기준 최근 90일 공고는 셋 다 NULL 이라 UI 폴백 텍스트가 필수다 (Rule #93).
      coalesce(s.price_per_pyeong, s.price_per_pyeong_avg, s.price_per_pyeong_min) AS price_per_pyeong,
      s.rcept_bgnde,
      s.rcept_endde,
      s.spsply_rcept_bgnde,
      s.przwner_presnatn_de,
      s.cntrct_cncls_bgnde,
      s.cntrct_cncls_endde,
      s.competition_rate_1st,
      s.total_apply_count,
      -- 실질 접수 개시일 — 특별공급이 1순위보다 먼저 열리면 그쪽.
      -- LEAST 는 NULL 을 무시하므로 한쪽만 있어도 안전하다.
      LEAST(s.spsply_rcept_bgnde, s.rcept_bgnde)                   AS start_de
    FROM apt_subscriptions s
    WHERE (v_region IS NULL OR s.region_nm = v_region)
      -- 과거 데이터 2,800건 전수 스캔 방지. 계약까지 끝난 지 60일 넘은 건 볼 일이 없다.
      AND coalesce(s.cntrct_cncls_endde, s.przwner_presnatn_de, s.rcept_endde, s.rcept_bgnde)
          >= v_today - 60
  ),
  typed AS (
    SELECT
      b.*,
      st.status,
      CASE st.status
        WHEN 'open'           THEN 0
        WHEN 'upcoming'       THEN 1
        WHEN 'announced_wait' THEN 2
        WHEN 'contract'       THEN 3
        WHEN 'scheduled'      THEN 4
        WHEN 'leftover'       THEN 5
        ELSE 6
      END AS weight,
      CASE st.status
        WHEN 'open'           THEN b.rcept_endde          - v_today
        WHEN 'upcoming'       THEN b.start_de             - v_today
        WHEN 'scheduled'      THEN b.start_de             - v_today
        WHEN 'announced_wait' THEN b.przwner_presnatn_de  - v_today
        WHEN 'contract'       THEN b.cntrct_cncls_endde   - v_today
        ELSE NULL
      END AS dday
    FROM base b
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN b.house_nm ~ '(무순위|잔여세대|선착순|임의공급)'                    THEN 'leftover'
        WHEN b.rcept_endde >= v_today
             AND (b.start_de IS NULL OR b.start_de <= v_today)                   THEN 'open'
        WHEN b.start_de > v_today AND b.start_de <= v_today + 7                  THEN 'upcoming'
        WHEN b.start_de > v_today                                                THEN 'scheduled'
        WHEN b.przwner_presnatn_de >= v_today                                    THEN 'announced_wait'
        WHEN b.cntrct_cncls_endde  >= v_today                                    THEN 'contract'
        ELSE 'closed'
      END AS status
    ) st
  ),
  -- 경쟁률 상세. apt_competition_rates 는 2026-08 현재 0행이지만,
  -- 수집이 재개되면 코드 변경 없이 채워지도록 join 을 미리 걸어둔다.
  enriched AS (
    SELECT
      t.*,
      cr.best_rate,
      cr.total_applicants,
      cr.min_score
    FROM typed t
    LEFT JOIN LATERAL (
      SELECT
        max(c.competition_rate)                              AS best_rate,
        sum(c.applicant_count)                               AS total_applicants,
        min((c.metadata->>'min_score')::numeric)             AS min_score
      FROM apt_competition_rates c
      WHERE c.subscription_id = t.id
    ) cr ON true
  ),
  shaped AS (
    SELECT
      e.id,
      jsonb_build_object(
        'id',                   e.id,
        'house_manage_no',      e.house_manage_no,
        'house_nm',             e.house_nm,
        'region_nm',            e.region_nm,
        'supply_addr',          e.supply_addr,
        'households',           e.households,
        'price_per_pyeong',     e.price_per_pyeong,
        'rcept_bgnde',          e.rcept_bgnde,
        'rcept_endde',          e.rcept_endde,
        'spsply_rcept_bgnde',   e.spsply_rcept_bgnde,
        'przwner_presnatn_de',  e.przwner_presnatn_de,
        'cntrct_cncls_bgnde',   e.cntrct_cncls_bgnde,
        'cntrct_cncls_endde',   e.cntrct_cncls_endde,
        'status',               e.status,
        'weight',               e.weight,
        'dday',                 e.dday,
        -- 경쟁률은 상세 테이블 우선, 없으면 공고 테이블의 1순위 경쟁률
        'competition_rate',     coalesce(e.best_rate, e.competition_rate_1st),
        'total_applicants',     coalesce(e.total_applicants, e.total_apply_count),
        'min_score',            e.min_score,
        'pblanc_url',           e.pblanc_url
      ) AS item,
      e.status,
      e.weight,
      e.dday,
      e.rcept_endde
    FROM enriched e
  )
  SELECT
    -- ① 타임라인 히어로 — 지금 볼 가치가 있는 것만. 가로 스크롤 12칸.
    coalesce((
      SELECT jsonb_agg(item ORDER BY weight, dday NULLS LAST, rcept_endde)
      FROM (
        SELECT * FROM shaped
        WHERE status IN ('open', 'upcoming', 'scheduled', 'announced_wait')
        ORDER BY weight, dday NULLS LAST, rcept_endde
        LIMIT 12
      ) q
    ), '[]'::jsonb),

    -- ② 청약 카드 리스트 — 상태 → D-day 정렬. 마감 건은 제외.
    coalesce((
      SELECT jsonb_agg(item ORDER BY weight, dday NULLS LAST, rcept_endde)
      FROM (
        SELECT * FROM shaped
        WHERE status <> 'closed'
        ORDER BY weight, dday NULLS LAST, rcept_endde
        LIMIT 30
      ) q
    ), '[]'::jsonb),

    -- ③ 이번 주 청약 결과 — 최근 7일 안에 접수 마감된 단지.
    coalesce((
      SELECT jsonb_agg(item ORDER BY rcept_endde DESC, weight)
      FROM (
        SELECT * FROM shaped
        WHERE rcept_endde >= v_today - 7
          AND rcept_endde <  v_today
        ORDER BY rcept_endde DESC, weight
        LIMIT 20
      ) q
    ), '[]'::jsonb)
  INTO v_timeline, v_cards, v_results;

  RETURN jsonb_build_object(
    'region',          coalesce(v_region, '전국'),
    'requested_region', coalesce(NULLIF(btrim(coalesce(p_region, '')), ''), '전국'),
    'region_fallback', v_fallback,
    'today',           v_today,
    'timeline',        v_timeline,
    'cards',           v_cards,
    'results',         v_results,
    'counts',          jsonb_build_object(
                         'timeline', jsonb_array_length(v_timeline),
                         'cards',    jsonb_array_length(v_cards),
                         'results',  jsonb_array_length(v_results)
                       )
  );
END;
$fn$;

COMMENT ON FUNCTION public.get_apt_subscription_hub(text) IS
  's273 /apt 청약 허브 단일 진입 RPC. 타임라인+카드리스트+금주결과 3블록 jsonb. '
  '상태 판정은 src/lib/apt/subscription-status.ts 와 1:1 대응 — 한쪽 수정 시 양쪽 동기화 필수.';

-- Rule #63: anon/authenticated 만 REVOKE 하면 PUBLIC default privilege 가 남는다.
REVOKE ALL ON FUNCTION public.get_apt_subscription_hub(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_apt_subscription_hub(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_apt_subscription_hub(text) FROM authenticated;

-- Rule #95: 클라이언트가 호출하는 SECURITY INVOKER 함수는 명시적 GRANT 필요.
-- apt_subscriptions / apt_competition_rates 는 anon SELECT 정책이 열려 있어
-- SECURITY INVOKER 로도 anon 이 읽을 수 있다.
GRANT EXECUTE ON FUNCTION public.get_apt_subscription_hub(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_apt_subscription_hub(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_apt_subscription_hub(text) TO service_role;

-- Rule #69: PostgREST schema cache invalidation
NOTIFY pgrst, 'reload schema';
