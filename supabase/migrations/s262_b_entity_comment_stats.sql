-- s262 Phase B — entity_comment_stats: polymorphic 댓글 카운트 캐시
-- IDEMPOTENT + REVERSIBLE. INSERT/DELETE 트리거로 즉시 동기화.
-- DATA SOURCES:
--   comments.{entity_type, entity_id, is_deleted, created_at}
-- DOWN:
--   DROP TRIGGER IF EXISTS trg_comments_stats_ins ON comments;
--   DROP TRIGGER IF EXISTS trg_comments_stats_del ON comments;
--   DROP FUNCTION IF EXISTS public.fn_comments_stats_ins();
--   DROP FUNCTION IF EXISTS public.fn_comments_stats_del();
--   DROP TABLE IF EXISTS public.entity_comment_stats;

BEGIN;

CREATE TABLE IF NOT EXISTS public.entity_comment_stats (
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  last_at      TIMESTAMPTZ,
  hot_score    NUMERIC(5,3) DEFAULT 0,  -- 향후 hot 라벨 (24h 댓글 수 z-score 등)
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ecs_count
  ON public.entity_comment_stats (entity_type, count DESC)
  WHERE count > 0;

-- 백필: 기존 comments 에서 집계
INSERT INTO public.entity_comment_stats (entity_type, entity_id, count, last_at)
SELECT entity_type, entity_id, count(*)::int, max(created_at)
FROM public.comments
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL
  AND NOT is_deleted
GROUP BY entity_type, entity_id
ON CONFLICT (entity_type, entity_id) DO UPDATE
  SET count = EXCLUDED.count,
      last_at = EXCLUDED.last_at;

-- INSERT 트리거: 새 댓글 시 카운트 증가
CREATE OR REPLACE FUNCTION public.fn_comments_stats_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.entity_type IS NULL OR NEW.entity_id IS NULL OR NEW.is_deleted THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.entity_comment_stats (entity_type, entity_id, count, last_at)
  VALUES (NEW.entity_type, NEW.entity_id, 1, NEW.created_at)
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET count = entity_comment_stats.count + 1,
        last_at = greatest(entity_comment_stats.last_at, NEW.created_at);
  RETURN NEW;
END;
$$;

-- UPDATE 트리거: is_deleted 변경 시 카운트 조정
CREATE OR REPLACE FUNCTION public.fn_comments_stats_del()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.entity_type IS NULL OR NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- 삭제 (false → true)
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    UPDATE public.entity_comment_stats
       SET count = greatest(0, count - 1)
     WHERE entity_type = NEW.entity_type AND entity_id = NEW.entity_id;
  -- 복구 (true → false)
  ELSIF OLD.is_deleted = true AND NEW.is_deleted = false THEN
    UPDATE public.entity_comment_stats
       SET count = count + 1,
           last_at = greatest(last_at, NEW.created_at)
     WHERE entity_type = NEW.entity_type AND entity_id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_stats_ins ON public.comments;
CREATE TRIGGER trg_comments_stats_ins
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_comments_stats_ins();

DROP TRIGGER IF EXISTS trg_comments_stats_del ON public.comments;
CREATE TRIGGER trg_comments_stats_del
  AFTER UPDATE OF is_deleted ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_comments_stats_del();

REVOKE ALL ON public.entity_comment_stats FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.entity_comment_stats TO service_role;
REVOKE ALL ON FUNCTION public.fn_comments_stats_ins(), public.fn_comments_stats_del() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_comments_stats_ins(), public.fn_comments_stats_del() TO service_role;

COMMIT;
