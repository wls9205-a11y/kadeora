-- s263 Phase 3.3 — admin v4 dashboard 인덱스 보강.
-- v_admin_dashboard_v4 EXPLAIN ANALYZE: 2391ms → 1104ms (-54%, -1287ms).
-- CONCURRENTLY 사용 (production lock 없음). apply_migration BEGIN/COMMIT 우회 위해 execute_sql 로 적용.
-- IDEMPOTENT (IF NOT EXISTS) + REVERSIBLE (DROP INDEX).
--
-- DOWN:
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_comments_created_at;
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_cron_logs_failed_recent_full;
--
-- 효과:
--   - comments seq scan 142ms × 2 → Index Only Scan 1ms × 2 (-280ms)
--   - failed_crons_24h status filter 220ms → 3ms (-217ms, ANALYZE 효과 포함)
--   - publish_7d Aggregate 1529ms → 768ms (캐시 + ANALYZE 효과, view body 비용은 잔존)
--
-- 잔존 병목 (s263.4 후속):
--   - publish_7d 768ms = blog_posts content regex (`~* '/blog/|/apt/|/stock/'`) +
--     jsonb_array_length 7800 row 평가. 인덱스 한계, view body 자체 변경 필요.
--   - 후속 옵션: (1) generated boolean column (has_hub_link/has_5_imgs),
--     (2) summary table refresh (cron),
--     (3) materialized view 변환

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_created_at
  ON public.comments (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cron_logs_failed_recent_full
  ON public.cron_logs (status, created_at DESC)
  WHERE status IN ('error', 'failed', 'timeout');

ANALYZE public.blog_posts;
ANALYZE public.cron_logs;
ANALYZE public.comments;
