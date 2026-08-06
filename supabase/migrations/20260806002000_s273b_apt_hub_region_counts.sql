-- s273b — get_apt_subscription_hub 에 regions 집계 블록 추가.
--
-- /apt 인라인 지역 칩이 "이 지역에 청약이 몇 건 있는지" 를 보여줘야
-- 허탕(0건 지역 선택 → 전국 폴백으로 튕김)을 막을 수 있다.
-- 2026-08-06 기준 17개 시·도 중 접수중 물량이 있는 곳은 경기/부산/세종 3곳뿐.
--
-- 별도 RPC 를 파면 Rule #49(다중 RPC 동시호출 금지) 위반이라 기존 허브에 합친다.
-- 인자/반환 시그니처 불변 (text → jsonb) 이므로 CREATE OR REPLACE 안전 —
-- jsonb 안의 키 추가는 PostgREST schema cache 와 무관하다 (Rule #69 대상 아님).
--
-- regions[] = { region, live, recent }
--   live   = 아직 접수가 안 끝난 공고 수 (칩에 붉은 배지)
--   recent = 최근 60일 내 활동 물량 (live=0 지역의 보조 지표)
--   정렬  = live DESC, recent DESC, region — 볼 게 있는 지역이 앞으로
--
-- 현재 선택 지역과 무관하게 항상 전국 기준으로 집계한다.
-- (부산을 보는 중에도 다른 지역 건수가 보여야 이동 판단이 선다)
--
-- 20260806000000 대비 차이: v_regions 선언 + 집계 SELECT + RETURN 의 regions 키.
--
-- DOWN:
--   20260806000000_s273_apt_subscription_hub.sql 의 CREATE FUNCTION 을 재실행.
--   (regions 키가 없으면 RegionChips 가 KR_REGIONS_17 로 0 채움 폴백하므로 화면은 유지)

CREATE OR REPLACE FUNCTION public.get_apt_subscription_hub(p_region text DEFAULT '전국')
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
  v_regions     jsonb;
  v_open_count  integer := 0;
BEGIN
  IF v_region IS NULL OR v_region = '전국' THEN
    v_region := NULL;
  END IF;
  v_scoped := v_region IS NOT NULL;

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

  -- 지역 칩용 집계 — 항상 전국 기준(현재 선택 지역과 무관하게 17개 시·도 전부).
  -- live = 아직 안 끝난 접수, recent = 최근 60일 내 활동(카드에 뜰 수 있는 물량).
  SELECT jsonb_agg(
           jsonb_build_object('region', r.region, 'live', r.live, 'recent', r.recent)
           ORDER BY r.live DESC, r.recent DESC, r.region
         )
    INTO v_regions
  FROM (
    SELECT s.region_nm AS region,
           count(*) FILTER (WHERE coalesce(s.rcept_endde, s.rcept_bgnde) >= v_today) AS live,
           count(*) FILTER (
             WHERE coalesce(s.cntrct_cncls_endde, s.przwner_presnatn_de, s.rcept_endde, s.rcept_bgnde)
                   >= v_today - 60
           ) AS recent
    FROM apt_subscriptions s
    WHERE s.region_nm IS NOT NULL
    GROUP BY s.region_nm
  ) r;

  WITH base AS (
    SELECT
      s.id, s.house_manage_no, s.house_nm, s.region_nm, s.supply_addr, s.pblanc_url,
      s.tot_supply_hshld_co AS households,
      coalesce(s.price_per_pyeong, s.price_per_pyeong_avg, s.price_per_pyeong_min) AS price_per_pyeong,
      s.rcept_bgnde, s.rcept_endde, s.spsply_rcept_bgnde, s.przwner_presnatn_de,
      s.cntrct_cncls_bgnde, s.cntrct_cncls_endde, s.competition_rate_1st, s.total_apply_count,
      LEAST(s.spsply_rcept_bgnde, s.rcept_bgnde) AS start_de
    FROM apt_subscriptions s
    WHERE (v_region IS NULL OR s.region_nm = v_region)
      AND coalesce(s.cntrct_cncls_endde, s.przwner_presnatn_de, s.rcept_endde, s.rcept_bgnde)
          >= v_today - 60
  ),
  typed AS (
    SELECT b.*, st.status,
      CASE st.status
        WHEN 'open' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'announced_wait' THEN 2
        WHEN 'contract' THEN 3 WHEN 'scheduled' THEN 4 WHEN 'leftover' THEN 5 ELSE 6
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
        WHEN b.house_nm ~ '(무순위|잔여세대|선착순|임의공급)' THEN 'leftover'
        WHEN b.rcept_endde >= v_today AND (b.start_de IS NULL OR b.start_de <= v_today) THEN 'open'
        WHEN b.start_de > v_today AND b.start_de <= v_today + 7 THEN 'upcoming'
        WHEN b.start_de > v_today THEN 'scheduled'
        WHEN b.przwner_presnatn_de >= v_today THEN 'announced_wait'
        WHEN b.cntrct_cncls_endde  >= v_today THEN 'contract'
        ELSE 'closed'
      END AS status
    ) st
  ),
  enriched AS (
    SELECT t.*, cr.best_rate, cr.total_applicants, cr.min_score
    FROM typed t
    LEFT JOIN LATERAL (
      SELECT max(c.competition_rate) AS best_rate,
             sum(c.applicant_count) AS total_applicants,
             min((c.metadata->>'min_score')::numeric) AS min_score
      FROM apt_competition_rates c WHERE c.subscription_id = t.id
    ) cr ON true
  ),
  shaped AS (
    SELECT e.id,
      jsonb_build_object(
        'id', e.id, 'house_manage_no', e.house_manage_no, 'house_nm', e.house_nm,
        'region_nm', e.region_nm, 'supply_addr', e.supply_addr, 'households', e.households,
        'price_per_pyeong', e.price_per_pyeong, 'rcept_bgnde', e.rcept_bgnde,
        'rcept_endde', e.rcept_endde, 'spsply_rcept_bgnde', e.spsply_rcept_bgnde,
        'przwner_presnatn_de', e.przwner_presnatn_de, 'cntrct_cncls_bgnde', e.cntrct_cncls_bgnde,
        'cntrct_cncls_endde', e.cntrct_cncls_endde, 'status', e.status, 'weight', e.weight,
        'dday', e.dday,
        'competition_rate', coalesce(e.best_rate, e.competition_rate_1st),
        'total_applicants', coalesce(e.total_applicants, e.total_apply_count),
        'min_score', e.min_score, 'pblanc_url', e.pblanc_url
      ) AS item,
      e.status, e.weight, e.dday, e.rcept_endde
    FROM enriched e
  )
  SELECT
    coalesce((SELECT jsonb_agg(item ORDER BY weight, dday NULLS LAST, rcept_endde)
      FROM (SELECT * FROM shaped WHERE status IN ('open','upcoming','scheduled','announced_wait')
            ORDER BY weight, dday NULLS LAST, rcept_endde LIMIT 12) q), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(item ORDER BY weight, dday NULLS LAST, rcept_endde)
      FROM (SELECT * FROM shaped WHERE status <> 'closed'
            ORDER BY weight, dday NULLS LAST, rcept_endde LIMIT 30) q), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(item ORDER BY rcept_endde DESC, weight)
      FROM (SELECT * FROM shaped WHERE rcept_endde >= v_today - 7 AND rcept_endde < v_today
            ORDER BY rcept_endde DESC, weight LIMIT 20) q), '[]'::jsonb)
  INTO v_timeline, v_cards, v_results;

  RETURN jsonb_build_object(
    'region',           coalesce(v_region, '전국'),
    'requested_region', coalesce(NULLIF(btrim(coalesce(p_region, '')), ''), '전국'),
    'region_fallback',  v_fallback,
    'today',            v_today,
    'timeline',         v_timeline,
    'cards',            v_cards,
    'results',          v_results,
    'regions',          coalesce(v_regions, '[]'::jsonb),
    'counts',           jsonb_build_object(
                          'timeline', jsonb_array_length(v_timeline),
                          'cards',    jsonb_array_length(v_cards),
                          'results',  jsonb_array_length(v_results)
                        )
  );
END;
$fn$;

NOTIFY pgrst, 'reload schema';
