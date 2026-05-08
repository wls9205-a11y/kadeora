-- s262 Phase B — get_entity_comment_counts batch RPC
-- IDEMPOTENT (CREATE OR REPLACE) + REVERSIBLE.
-- 카드 리스트 렌더 시 N+1 방지 — 한 번의 호출로 여러 entity_id 카운트 조회.
-- DATA SOURCES: entity_comment_stats (s262_b_entity_comment_stats.sql)
-- DOWN: DROP FUNCTION IF EXISTS public.get_entity_comment_counts(text, text[]);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_entity_comment_counts(
  p_entity_type TEXT,
  p_entity_ids  TEXT[]
)
RETURNS TABLE (
  entity_id  TEXT,
  count      INTEGER,
  last_at    TIMESTAMPTZ,
  hot_score  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    e.entity_id,
    e.count,
    e.last_at,
    e.hot_score
  FROM public.entity_comment_stats e
  WHERE e.entity_type = p_entity_type
    AND e.entity_id   = ANY(p_entity_ids);
$$;

REVOKE ALL ON FUNCTION public.get_entity_comment_counts(TEXT, TEXT[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_entity_comment_counts(TEXT, TEXT[]) TO anon, authenticated, service_role;

COMMIT;
