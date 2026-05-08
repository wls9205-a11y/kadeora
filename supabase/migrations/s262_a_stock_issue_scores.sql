-- s262 Phase A — stock_issue_scores materialized view (v1)
-- IDEMPOTENT (DROP IF EXISTS) + REVERSIBLE.
-- DATA SOURCES:
--   stock_quotes.{symbol,name,market,price,change_pct,volume,market_cap,sector,is_active,updated_at}
--   stock_price_history.{symbol,date,volume}  (30d window for vol_z)
--   stock_issue_score_weights (factor, weight) — v1 dynamic 가중치
-- DOWN: DROP MATERIALIZED VIEW IF EXISTS public.stock_issue_scores CASCADE;

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.stock_issue_scores CASCADE;

CREATE MATERIALIZED VIEW public.stock_issue_scores AS
WITH
  w AS (
    SELECT factor, weight FROM public.stock_issue_score_weights WHERE version='v1'
  ),
  vol_stats AS (
    -- 심볼별 30일 평균/표준편차 (current_date 제외 — 당일 변동성 영향 차단)
    SELECT
      symbol,
      avg(volume)::numeric    AS avg_30d,
      stddev(volume)::numeric AS sd_30d
    FROM public.stock_price_history
    WHERE date BETWEEN current_date - 31 AND current_date - 1
    GROUP BY symbol
    HAVING count(*) >= 5  -- 최소 5일 데이터
  ),
  market_change AS (
    -- 시장 전체 abs_change_pct stddev (z-score 정규화 분모)
    SELECT
      coalesce(stddev(abs(change_pct)), 1.0)::numeric AS sd_abs_pct
    FROM public.stock_quotes
    WHERE is_active = true AND change_pct IS NOT NULL
  ),
  computed AS (
    SELECT
      q.symbol,
      q.name,
      q.market,
      q.price,
      q.change_pct,
      q.volume,
      q.market_cap,
      q.sector,
      q.updated_at,
      -- vol_z: clip [-3, 3] → normalize [0, 1]
      CASE
        WHEN v.sd_30d IS NULL OR v.sd_30d = 0 OR q.volume IS NULL THEN 0.0
        ELSE greatest(0.0, least(1.0,
          (least(3.0, greatest(-3.0, (q.volume - v.avg_30d) / v.sd_30d)) + 3.0) / 6.0
        ))
      END::numeric AS vol_z_norm,
      -- abs_change_z: abs(pct) / market_sd, clip [0, 3] → normalize [0, 1]
      CASE
        WHEN q.change_pct IS NULL THEN 0.0
        ELSE least(1.0, abs(q.change_pct) / nullif(mc.sd_abs_pct * 3.0, 0))
      END::numeric AS abs_change_z_norm,
      -- recency_boost: exp(-hours_since / 24)
      CASE
        WHEN q.updated_at IS NULL THEN 0.0
        ELSE exp(-extract(epoch FROM (now() - q.updated_at)) / 86400.0)
      END::numeric AS recency_norm
    FROM public.stock_quotes q
    LEFT JOIN vol_stats v ON v.symbol = q.symbol
    CROSS JOIN market_change mc
    WHERE q.is_active = true
  )
SELECT
  c.symbol,
  c.name,
  c.market,
  c.price,
  c.change_pct,
  c.volume,
  c.market_cap,
  c.sector,
  -- score: weights 테이블 dynamic read
  (
    coalesce((SELECT weight FROM w WHERE factor='vol_z'), 0)         * c.vol_z_norm +
    coalesce((SELECT weight FROM w WHERE factor='abs_change_z'), 0)  * c.abs_change_z_norm +
    coalesce((SELECT weight FROM w WHERE factor='recency_boost'), 0) * c.recency_norm
  )::numeric(5,4) AS score,
  -- reasons[]: 모든 factor 기록 (가중치 0 인 것도 reasons 에는 자리만 잡고 score=0)
  jsonb_build_array(
    jsonb_build_object('tag','vol',  'value', round(c.vol_z_norm::numeric, 3)),
    jsonb_build_object('tag','chg',  'value', round(c.abs_change_z_norm::numeric, 3)),
    jsonb_build_object('tag','new',  'value', round(c.recency_norm::numeric, 3))
  ) AS reasons,
  -- warning: v1 비어있음. v2 에서 volatility_high / managed_stock 등 채움.
  NULL::text AS warning,
  now() AS computed_at
FROM computed c;

CREATE UNIQUE INDEX idx_stock_issue_scores_symbol ON public.stock_issue_scores (symbol);
CREATE INDEX idx_stock_issue_scores_score
  ON public.stock_issue_scores (score DESC NULLS LAST)
  WHERE warning IS NULL;

REVOKE ALL ON public.stock_issue_scores FROM anon, authenticated;
GRANT  SELECT ON public.stock_issue_scores TO service_role;

COMMIT;
