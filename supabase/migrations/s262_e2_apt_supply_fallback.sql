-- s262 Phase E2 hotfix — apt_issue_scores 에 households_count 추가.
-- 활성 청약 40개의 sale_price_min 채움률 0% (apt_sites.price_min, supply_min_amt
-- 모두 NULL) — Phase E carousel 카드 가격 영역 비어있음 회귀 위험.
-- 검증된 100% 채움 신호인 tot_supply_hshld_co 를 fallback 으로 추가.
--
-- IDEMPOTENT (DROP+CREATE) + REVERSIBLE.
-- DOWN: s262_e_carousel_data.sql 재실행 (households_count 컬럼 제거).

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.apt_issue_scores CASCADE;

CREATE MATERIALIZED VIEW public.apt_issue_scores AS
WITH
  w AS (SELECT factor, weight FROM public.apt_issue_score_weights WHERE version='v1'),
  unit_summary AS (
    SELECT s.id,
           min((u.value ->> 'lttot_min_amount')::numeric) AS supply_min_amt,
           array_agg((u.value ->> 'type') ORDER BY (u.value ->> 'type'))
             FILTER (WHERE (u.value ->> 'type') ~ '^[0-9.]+') AS type_list
    FROM apt_subscriptions s
    LEFT JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(s.house_type_info)='array' THEN s.house_type_info ELSE '[]'::jsonb END
    ) u(value) ON true
    GROUP BY s.id
  ),
  computed AS (
    SELECT
      s.id, s.house_nm, s.region_nm, s.mdatrgbn_nm, s.rcept_bgnde, s.rcept_endde,
      s.created_at, s.status, s.competition_rate_1st, s.expected_competition,
      s.price_per_pyeong, s.is_regulated_area, s.is_speculative_zone,
      s.tot_supply_hshld_co AS households_count, -- s262-E2: 100% 채움 fallback
      us.supply_min_amt,
      coalesce(us.type_list[1], '아파트')::text AS house_ty,
      coalesce(a.cover_image_url, a.og_image_url, cp.cover_image_url, cp.og_image_url) AS thumbnail_url,
      CASE WHEN s.rcept_endde IS NULL THEN 0.0
           WHEN s.rcept_endde < current_date THEN 0.0
           ELSE greatest(0.0, least(1.0, 1.0 - (s.rcept_endde - current_date)::numeric / 30.0))
      END::numeric AS dday_norm,
      CASE WHEN s.created_at IS NULL THEN 0.0
           ELSE greatest(0.0, least(1.0, 1.0 - extract(epoch FROM (now() - s.created_at)) / (30 * 86400.0)))
      END::numeric AS fresh_norm,
      CASE WHEN s.region_nm IS NOT NULL AND length(trim(s.region_nm)) > 0 THEN 1.0 ELSE 0.0 END::numeric AS region_norm,
      CASE WHEN s.competition_rate_1st IS NOT NULL THEN least(1.0, s.competition_rate_1st / 100.0)
           WHEN s.expected_competition IS NOT NULL THEN least(1.0, s.expected_competition / 100.0)
           ELSE 0.0 END::numeric AS sub_comp_norm,
      CASE WHEN coalesce(s.is_regulated_area, false) OR coalesce(s.is_speculative_zone, false) THEN 1.0 ELSE 0.0 END::numeric AS policy_norm
    FROM apt_subscriptions s
    LEFT JOIN unit_summary us ON us.id = s.id
    LEFT JOIN LATERAL (
      SELECT cover_image_url, og_image_url FROM apt_sites
       WHERE replace(name, ' ', '') = replace(s.house_nm, ' ', '') AND region = s.region_nm LIMIT 1
    ) a ON true
    LEFT JOIN LATERAL (
      SELECT cover_image_url, og_image_url FROM apt_complex_profiles
       WHERE replace(apt_name, ' ', '') = replace(s.house_nm, ' ', '') AND region_nm = s.region_nm LIMIT 1
    ) cp ON true
    WHERE (s.rcept_endde IS NULL OR s.rcept_endde >= current_date - 7)
  )
SELECT
  c.id, c.house_nm, c.region_nm, c.mdatrgbn_nm, c.rcept_bgnde, c.rcept_endde,
  c.created_at, c.status, c.competition_rate_1st, c.price_per_pyeong,
  c.supply_min_amt AS sale_price_min,
  c.households_count,                  -- s262-E2 신규
  c.house_ty,
  c.thumbnail_url,
  CASE WHEN c.rcept_endde IS NULL THEN NULL ELSE (c.rcept_endde - current_date) END AS dday,
  (
    coalesce((SELECT weight FROM w WHERE factor='dday_proximity'), 0)    * c.dday_norm +
    coalesce((SELECT weight FROM w WHERE factor='listing_freshness'), 0) * c.fresh_norm +
    coalesce((SELECT weight FROM w WHERE factor='region_match'), 0)      * c.region_norm
  )::numeric(5,4) AS score,
  jsonb_build_array(
    jsonb_build_object('tag','dday', 'value', round(c.dday_norm::numeric, 3)),
    jsonb_build_object('tag','new',  'value', round(c.fresh_norm::numeric, 3)),
    jsonb_build_object('tag','reg',  'value', round(c.region_norm::numeric, 3)),
    jsonb_build_object('tag','sub',  'value', round(c.sub_comp_norm::numeric, 3)),
    jsonb_build_object('tag','pol',  'value', round(c.policy_norm::numeric, 3))
  ) AS reasons,
  NULL::text AS warning,
  now() AS computed_at
FROM computed c;

CREATE UNIQUE INDEX idx_apt_issue_scores_id ON public.apt_issue_scores (id);
CREATE INDEX idx_apt_issue_scores_score ON public.apt_issue_scores (score DESC NULLS LAST) WHERE warning IS NULL;
REVOKE ALL ON public.apt_issue_scores FROM anon, authenticated;
GRANT  SELECT ON public.apt_issue_scores TO service_role;

DO $$
DECLARE
  v_total INT; v_house INT; v_price INT;
BEGIN
  SELECT count(*) INTO v_total FROM apt_issue_scores;
  SELECT count(*) INTO v_house FROM apt_issue_scores WHERE households_count IS NOT NULL AND households_count > 0;
  SELECT count(*) INTO v_price FROM apt_issue_scores WHERE sale_price_min IS NOT NULL AND sale_price_min > 0;
  RAISE NOTICE 's262-E2 households: %/% (target 25+)', v_house, v_total;
  RAISE NOTICE 's262-E2 price (existing): %/% (still expected 0)', v_price, v_total;
  IF v_house < v_total / 2 THEN
    RAISE WARNING 's262-E2: households_count fallback < 50%% (got %/%)', v_house, v_total;
  END IF;
END $$;

COMMIT;
