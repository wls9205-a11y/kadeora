-- s262 Phase A — apt_issue_scores materialized view (v1)
-- IDEMPOTENT + REVERSIBLE. 청약 단위 (apt_subscriptions) 만 v1 — 재개발/미분양은 후속.
-- DATA SOURCES:
--   apt_subscriptions.{id,house_nm,region_nm,sigungu_nm:via mdatrgbn_nm,
--                      rcept_bgnde,rcept_endde,created_at(s259),status,
--                      competition_rate_1st,expected_competition,
--                      is_regulated_area,is_speculative_zone,price_per_pyeong}
--   apt_issue_score_weights — v1 dynamic
-- DOWN: DROP MATERIALIZED VIEW IF EXISTS public.apt_issue_scores CASCADE;

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.apt_issue_scores CASCADE;

CREATE MATERIALIZED VIEW public.apt_issue_scores AS
WITH
  w AS (
    SELECT factor, weight FROM public.apt_issue_score_weights WHERE version='v1'
  ),
  computed AS (
    SELECT
      s.id,
      s.house_nm,
      s.region_nm,
      s.mdatrgbn_nm,
      s.rcept_bgnde,
      s.rcept_endde,
      s.created_at,
      s.status,
      s.competition_rate_1st,
      s.expected_competition,
      s.price_per_pyeong,
      s.is_regulated_area,
      s.is_speculative_zone,
      -- dday_proximity: rcept_endde 까지 0~30일 → 1.0~0.0
      CASE
        WHEN s.rcept_endde IS NULL THEN 0.0
        WHEN s.rcept_endde < current_date THEN 0.0  -- 마감된 청약은 0
        ELSE greatest(0.0, least(1.0, 1.0 - (s.rcept_endde - current_date)::numeric / 30.0))
      END::numeric AS dday_norm,
      -- listing_freshness: created_at 0~30일 전 → 1.0~0.0
      CASE
        WHEN s.created_at IS NULL THEN 0.0
        ELSE greatest(0.0, least(1.0, 1.0 - extract(epoch FROM (now() - s.created_at)) / (30 * 86400.0)))
      END::numeric AS fresh_norm,
      -- region_match: region_nm 존재 여부 (v1 placeholder — v2 에서 사용자 region 필터)
      CASE WHEN s.region_nm IS NOT NULL AND length(trim(s.region_nm)) > 0 THEN 1.0 ELSE 0.0 END::numeric AS region_norm,
      -- bonus reasons (가중치 0): sub_comp, policy
      CASE
        WHEN s.competition_rate_1st IS NOT NULL THEN least(1.0, s.competition_rate_1st / 100.0)
        WHEN s.expected_competition IS NOT NULL THEN least(1.0, s.expected_competition / 100.0)
        ELSE 0.0
      END::numeric AS sub_comp_norm,
      CASE
        WHEN coalesce(s.is_regulated_area, false) OR coalesce(s.is_speculative_zone, false) THEN 1.0
        ELSE 0.0
      END::numeric AS policy_norm
    FROM public.apt_subscriptions s
    WHERE (s.rcept_endde IS NULL OR s.rcept_endde >= current_date - 7)  -- 마감 7일 이내까지
  )
SELECT
  c.id,
  c.house_nm,
  c.region_nm,
  c.mdatrgbn_nm,
  c.rcept_bgnde,
  c.rcept_endde,
  c.created_at,
  c.status,
  c.competition_rate_1st,
  c.price_per_pyeong,
  CASE
    WHEN c.rcept_endde IS NULL THEN NULL
    ELSE (c.rcept_endde - current_date)
  END AS dday,
  -- score: weights 테이블 dynamic read
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

COMMIT;
