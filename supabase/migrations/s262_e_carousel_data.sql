-- s262 Phase E (CAROUSEL v1) — sparkline + apt thumbnail data layer.
-- IDEMPOTENT (DROP IF EXISTS + CREATE) + REVERSIBLE.
-- ISSUE ENGINE v1 mat view 재정의 — 컬럼만 추가, score/reasons/warning signature 보존.
-- pg_cron refresh 함수는 mat view 이름으로 참조 → 자동 호환.
--
-- DOWN:
--   DROP MATERIALIZED VIEW IF EXISTS public.stock_issue_scores CASCADE;
--   DROP MATERIALIZED VIEW IF EXISTS public.apt_issue_scores CASCADE;
--   (이전 s262_a_stock_issue_scores.sql / s262_a_apt_issue_scores.sql 재실행)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- A1. stock_issue_scores 재정의 — sparkline_5d numeric[] 컬럼 추가.
-- 21일 window 에서 가장 최근 5거래일 close_price array (공휴일/주말 보정).
-- ─────────────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS public.stock_issue_scores CASCADE;

CREATE MATERIALIZED VIEW public.stock_issue_scores AS
WITH
  w AS (SELECT factor, weight FROM public.stock_issue_score_weights WHERE version='v1'),
  vol_stats AS (
    SELECT symbol,
           avg(volume)::numeric    AS avg_30d,
           stddev(volume)::numeric AS sd_30d
    FROM public.stock_price_history
    WHERE date BETWEEN current_date - 31 AND current_date - 1
    GROUP BY symbol
    HAVING count(*) >= 5
  ),
  market_change AS (
    SELECT coalesce(stddev(abs(change_pct)), 1.0)::numeric AS sd_abs_pct
    FROM public.stock_quotes WHERE is_active = true AND change_pct IS NOT NULL
  ),
  -- s262-E: 21일 window 에서 가장 최근 5거래일 close_price 배열
  spark AS (
    SELECT symbol, array_agg(close_price ORDER BY date) AS prices_5d
    FROM (
      SELECT symbol, date, close_price,
             row_number() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
      FROM public.stock_price_history
      WHERE date BETWEEN current_date - 21 AND current_date - 1
        AND close_price IS NOT NULL
    ) t
    WHERE rn <= 5
    GROUP BY symbol
    HAVING count(*) >= 5
  ),
  computed AS (
    SELECT
      q.symbol, q.name, q.market, q.price, q.change_pct, q.volume, q.market_cap, q.sector, q.updated_at,
      sp.prices_5d,
      CASE
        WHEN v.sd_30d IS NULL OR v.sd_30d = 0 OR q.volume IS NULL THEN 0.0
        ELSE greatest(0.0, least(1.0,
          (least(3.0, greatest(-3.0, (q.volume - v.avg_30d) / v.sd_30d)) + 3.0) / 6.0
        ))
      END::numeric AS vol_z_norm,
      CASE
        WHEN q.change_pct IS NULL THEN 0.0
        ELSE least(1.0, abs(q.change_pct) / nullif(mc.sd_abs_pct * 3.0, 0))
      END::numeric AS abs_change_z_norm,
      CASE
        WHEN q.updated_at IS NULL THEN 0.0
        ELSE exp(-extract(epoch FROM (now() - q.updated_at)) / 86400.0)
      END::numeric AS recency_norm
    FROM public.stock_quotes q
    LEFT JOIN vol_stats v ON v.symbol = q.symbol
    LEFT JOIN spark     sp ON sp.symbol = q.symbol
    CROSS JOIN market_change mc
    WHERE q.is_active = true
  )
SELECT
  c.symbol, c.name, c.market, c.price, c.change_pct, c.volume, c.market_cap, c.sector,
  c.prices_5d AS sparkline_5d,  -- s262-E 신규
  (
    coalesce((SELECT weight FROM w WHERE factor='vol_z'), 0)         * c.vol_z_norm +
    coalesce((SELECT weight FROM w WHERE factor='abs_change_z'), 0)  * c.abs_change_z_norm +
    coalesce((SELECT weight FROM w WHERE factor='recency_boost'), 0) * c.recency_norm
  )::numeric(5,4) AS score,
  jsonb_build_array(
    jsonb_build_object('tag','vol', 'value', round(c.vol_z_norm::numeric, 3)),
    jsonb_build_object('tag','chg', 'value', round(c.abs_change_z_norm::numeric, 3)),
    jsonb_build_object('tag','new', 'value', round(c.recency_norm::numeric, 3))
  ) AS reasons,
  NULL::text AS warning,
  now() AS computed_at
FROM computed c;

CREATE UNIQUE INDEX idx_stock_issue_scores_symbol ON public.stock_issue_scores (symbol);
CREATE INDEX idx_stock_issue_scores_score
  ON public.stock_issue_scores (score DESC NULLS LAST)
  WHERE warning IS NULL;

REVOKE ALL ON public.stock_issue_scores FROM anon, authenticated;
GRANT  SELECT ON public.stock_issue_scores TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- A2. apt_issue_scores 재정의 — thumbnail_url + sale_price_min + house_ty 추가.
-- 썸네일 매핑은 s259 v_apt_card_subscription view 와 동일 패턴 (LATERAL JOIN).
-- 99.4% 커버리지 확인됨 (40중 40 매칭 — 0/40 직접 JOIN 대비).
-- ─────────────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS public.apt_issue_scores CASCADE;

CREATE MATERIALIZED VIEW public.apt_issue_scores AS
WITH
  w AS (SELECT factor, weight FROM public.apt_issue_score_weights WHERE version='v1'),
  -- s262-E: house_ty 첫 element type 가져옴 (jsonb array 일 때만)
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
      us.supply_min_amt,
      coalesce(us.type_list[1], '아파트')::text AS house_ty,
      -- s262-E: 썸네일 LATERAL JOIN (s259 view 와 동일 패턴)
      coalesce(a.cover_image_url, a.og_image_url, cp.cover_image_url, cp.og_image_url) AS thumbnail_url,
      CASE
        WHEN s.rcept_endde IS NULL THEN 0.0
        WHEN s.rcept_endde < current_date THEN 0.0
        ELSE greatest(0.0, least(1.0, 1.0 - (s.rcept_endde - current_date)::numeric / 30.0))
      END::numeric AS dday_norm,
      CASE
        WHEN s.created_at IS NULL THEN 0.0
        ELSE greatest(0.0, least(1.0, 1.0 - extract(epoch FROM (now() - s.created_at)) / (30 * 86400.0)))
      END::numeric AS fresh_norm,
      CASE WHEN s.region_nm IS NOT NULL AND length(trim(s.region_nm)) > 0 THEN 1.0 ELSE 0.0 END::numeric AS region_norm,
      CASE
        WHEN s.competition_rate_1st IS NOT NULL THEN least(1.0, s.competition_rate_1st / 100.0)
        WHEN s.expected_competition IS NOT NULL THEN least(1.0, s.expected_competition / 100.0)
        ELSE 0.0
      END::numeric AS sub_comp_norm,
      CASE
        WHEN coalesce(s.is_regulated_area, false) OR coalesce(s.is_speculative_zone, false) THEN 1.0
        ELSE 0.0
      END::numeric AS policy_norm
    FROM apt_subscriptions s
    LEFT JOIN unit_summary us ON us.id = s.id
    LEFT JOIN LATERAL (
      SELECT cover_image_url, og_image_url FROM apt_sites
       WHERE replace(name, ' ', '') = replace(s.house_nm, ' ', '')
         AND region = s.region_nm
       LIMIT 1
    ) a ON true
    LEFT JOIN LATERAL (
      SELECT cover_image_url, og_image_url FROM apt_complex_profiles
       WHERE replace(apt_name, ' ', '') = replace(s.house_nm, ' ', '')
         AND region_nm = s.region_nm
       LIMIT 1
    ) cp ON true
    WHERE (s.rcept_endde IS NULL OR s.rcept_endde >= current_date - 7)
  )
SELECT
  c.id, c.house_nm, c.region_nm, c.mdatrgbn_nm, c.rcept_bgnde, c.rcept_endde,
  c.created_at, c.status, c.competition_rate_1st, c.price_per_pyeong,
  c.supply_min_amt AS sale_price_min,  -- s262-E 신규
  c.house_ty,                            -- s262-E 신규
  c.thumbnail_url,                       -- s262-E 신규
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
CREATE INDEX idx_apt_issue_scores_score
  ON public.apt_issue_scores (score DESC NULLS LAST)
  WHERE warning IS NULL;

REVOKE ALL ON public.apt_issue_scores FROM anon, authenticated;
GRANT  SELECT ON public.apt_issue_scores TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 검증
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_stock_total INT; v_stock_spark INT;
  v_apt_total INT;   v_apt_thumb INT;
  v_pct NUMERIC;
BEGIN
  SELECT count(*) INTO v_stock_total FROM stock_issue_scores;
  SELECT count(*) INTO v_stock_spark FROM stock_issue_scores WHERE sparkline_5d IS NOT NULL AND array_length(sparkline_5d, 1) = 5;
  SELECT count(*) INTO v_apt_total FROM apt_issue_scores;
  SELECT count(*) INTO v_apt_thumb FROM apt_issue_scores WHERE thumbnail_url IS NOT NULL;

  RAISE NOTICE 's262-E stock: %/% with sparkline (target ≥ 1500)', v_stock_spark, v_stock_total;
  RAISE NOTICE 's262-E apt: %/% with thumbnail (target ≥ 0.70)', v_apt_thumb, v_apt_total;

  IF v_stock_total = 0 THEN RAISE EXCEPTION 's262-E: stock_issue_scores empty'; END IF;
  IF v_apt_total = 0   THEN RAISE EXCEPTION 's262-E: apt_issue_scores empty'; END IF;

  v_pct := 100.0 * v_apt_thumb / nullif(v_apt_total, 0);
  IF v_pct < 50 THEN
    RAISE WARNING 's262-E: apt thumbnail coverage %.1f%% (below 70%% target)', v_pct;
  END IF;
END $$;

COMMIT;
