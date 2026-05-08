-- s262 Phase A — get_home_data RPC
-- 홈 페이지 단일 fetch: hero_issue + stock_top3 + apt_top3 + hot_blog
-- IDEMPOTENT (CREATE OR REPLACE) + REVERSIBLE.
-- DATA SOURCES:
--   issue_alerts.{title,summary,category,published_at,is_published}
--   stock_issue_scores  (s262_a_stock_issue_scores.sql)
--   apt_issue_scores    (s262_a_apt_issue_scores.sql)
--   blog_posts.{slug,title,excerpt,cover_image,view_count,priority_score,is_published}
-- DOWN: DROP FUNCTION IF EXISTS public.get_home_data();

BEGIN;

CREATE OR REPLACE FUNCTION public.get_home_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_hero       jsonb;
  v_stock_top  jsonb;
  v_apt_top    jsonb;
  v_hot_blog   jsonb;
BEGIN
  -- hero_issue: 1) 최근 24h 발행 issue_alerts 우선 → 2) stock top1 fallback
  SELECT jsonb_build_object(
    'kind',        'issue',
    'id',          ia.id::text,
    'title',       ia.title,
    'summary',     coalesce(ia.summary, ''),
    'category',    ia.category,
    'published_at', ia.published_at
  )
  INTO v_hero
  FROM public.issue_alerts ia
  WHERE ia.is_published = true
    AND ia.published_at > now() - interval '24 hours'
  ORDER BY ia.published_at DESC
  LIMIT 1;

  IF v_hero IS NULL THEN
    -- fallback: stock top1
    SELECT jsonb_build_object(
      'kind',        'stock',
      'id',          symbol,
      'title',       name,
      'summary',     coalesce('변동 ' || round(change_pct, 2)::text || '%', ''),
      'category',    'stock',
      'score',       score
    )
    INTO v_hero
    FROM public.stock_issue_scores
    WHERE warning IS NULL
    ORDER BY score DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- stock_top3
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'symbol',     symbol,
    'name',       name,
    'market',     market,
    'price',      price,
    'change_pct', change_pct,
    'volume',     volume,
    'sector',     sector,
    'score',      score,
    'reasons',    reasons,
    'warning',    warning
  ) ORDER BY score DESC NULLS LAST), '[]'::jsonb)
  INTO v_stock_top
  FROM (
    SELECT * FROM public.stock_issue_scores
    WHERE warning IS NULL
    ORDER BY score DESC NULLS LAST
    LIMIT 3
  ) s;

  -- apt_top3
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',                    id::text,
    'house_nm',              house_nm,
    'region_nm',             region_nm,
    'mdatrgbn_nm',           mdatrgbn_nm,
    'rcept_endde',           rcept_endde,
    'dday',                  dday,
    'price_per_pyeong',      price_per_pyeong,
    'competition_rate_1st',  competition_rate_1st,
    'score',                 score,
    'reasons',               reasons,
    'warning',               warning
  ) ORDER BY score DESC NULLS LAST), '[]'::jsonb)
  INTO v_apt_top
  FROM (
    SELECT * FROM public.apt_issue_scores
    WHERE warning IS NULL
    ORDER BY score DESC NULLS LAST
    LIMIT 3
  ) a;

  -- hot_blog: priority_score 우선, view_count 차선
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'slug',         slug,
    'title',        title,
    'excerpt',      excerpt,
    'cover_image',  cover_image,
    'view_count',   view_count,
    'category',     category,
    'published_at', published_at
  ) ORDER BY priority_score DESC NULLS LAST, view_count DESC NULLS LAST), '[]'::jsonb)
  INTO v_hot_blog
  FROM (
    SELECT slug, title, excerpt, cover_image, view_count, category, published_at,
           coalesce(priority_score, 0) AS priority_score
    FROM public.blog_posts
    WHERE is_published = true
    ORDER BY priority_score DESC NULLS LAST, view_count DESC NULLS LAST
    LIMIT 3
  ) b;

  RETURN jsonb_build_object(
    'hero_issue', v_hero,
    'stock_top3', coalesce(v_stock_top, '[]'::jsonb),
    'apt_top3',   coalesce(v_apt_top, '[]'::jsonb),
    'hot_blog',   coalesce(v_hot_blog, '[]'::jsonb),
    'computed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_data() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_home_data() TO service_role;

COMMIT;
