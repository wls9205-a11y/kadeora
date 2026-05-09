-- s262 Phase D — Issue Engine v1 pg_cron + cron_health + 4 schedules.
-- Vercel cron 100/100 가득 → mat view REFRESH 는 pg_cron 단독 (Architecture Rule #86).
-- IDEMPOTENT (IF NOT EXISTS / unschedule-then-schedule) + REVERSIBLE.
--
-- DOWN:
--   SELECT cron.unschedule('kadeora-refresh-stock-issue-scores-weekday');
--   SELECT cron.unschedule('kadeora-refresh-stock-issue-scores-weekend');
--   SELECT cron.unschedule('kadeora-refresh-apt-issue-scores');
--   SELECT cron.unschedule('kadeora-issue-scores-freshness-check');
--   DROP FUNCTION IF EXISTS public.refresh_stock_issue_scores_v1();
--   DROP FUNCTION IF EXISTS public.refresh_apt_issue_scores_v1();
--   DROP FUNCTION IF EXISTS public.check_issue_scores_freshness();
--   DROP TABLE IF EXISTS public.cron_health;

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- A) cron_health 테이블 (idempotent)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cron_health (
  cron_name        TEXT PRIMARY KEY,
  last_run_at      TIMESTAMPTZ,
  last_success_at  TIMESTAMPTZ,
  last_error       TEXT,
  last_duration_ms INTEGER,
  run_count_24h    INTEGER NOT NULL DEFAULT 0,
  alerting         BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cron_health_anon_select   ON public.cron_health;
DROP POLICY IF EXISTS cron_health_service_all  ON public.cron_health;

CREATE POLICY cron_health_anon_select ON public.cron_health
  FOR SELECT USING (true);  -- anon + authenticated 모두 read 가능 (admin/health 페이지)

CREATE POLICY cron_health_service_all ON public.cron_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.cron_health FROM PUBLIC;
GRANT SELECT ON public.cron_health TO anon, authenticated;
GRANT ALL    ON public.cron_health TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- B) refresh_*_v1() 함수 — REFRESH + cron_logs + cron_health 일체.
--    예외 발생 시 cron_health.last_error + alerting=true 세팅, 함수는 정상 RETURN.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_stock_issue_scores_v1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_started   TIMESTAMPTZ := clock_timestamp();
  v_finished  TIMESTAMPTZ;
  v_dur       INTEGER;
  v_count_24h INTEGER;
  v_err       TEXT;
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.stock_issue_scores;
  EXCEPTION WHEN OTHERS THEN
    -- CONCURRENTLY 실패 시 (락 / unique index 부재) 일반 REFRESH 폴백
    BEGIN
      REFRESH MATERIALIZED VIEW public.stock_issue_scores;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
    END;
  END;

  v_finished := clock_timestamp();
  v_dur := (extract(epoch FROM (v_finished - v_started)) * 1000)::int;

  -- cron_logs (idempotent — 테이블 존재 + 행 1건 INSERT)
  BEGIN
    INSERT INTO public.cron_logs (cron_name, status, started_at, finished_at, duration_ms, error_message)
    VALUES ('refresh_stock_issue_scores_v1',
            CASE WHEN v_err IS NULL THEN 'success' ELSE 'failed' END,
            v_started, v_finished, v_dur, v_err);
  EXCEPTION WHEN OTHERS THEN /* cron_logs 부재 / 권한 문제는 무시 */
  END;

  SELECT count(*)::int INTO v_count_24h
    FROM public.cron_logs
    WHERE cron_name = 'refresh_stock_issue_scores_v1'
      AND started_at > now() - interval '24 hours';

  INSERT INTO public.cron_health AS h
    (cron_name, last_run_at, last_success_at, last_error, last_duration_ms, run_count_24h, alerting, updated_at)
  VALUES ('refresh_stock_issue_scores_v1', v_started,
          CASE WHEN v_err IS NULL THEN v_finished ELSE NULL END,
          v_err, v_dur, coalesce(v_count_24h, 1),
          v_err IS NOT NULL, now())
  ON CONFLICT (cron_name) DO UPDATE
    SET last_run_at      = EXCLUDED.last_run_at,
        last_success_at  = COALESCE(EXCLUDED.last_success_at, h.last_success_at),
        last_error       = EXCLUDED.last_error,
        last_duration_ms = EXCLUDED.last_duration_ms,
        run_count_24h    = EXCLUDED.run_count_24h,
        alerting         = (EXCLUDED.last_error IS NOT NULL),
        updated_at       = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_apt_issue_scores_v1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_started   TIMESTAMPTZ := clock_timestamp();
  v_finished  TIMESTAMPTZ;
  v_dur       INTEGER;
  v_count_24h INTEGER;
  v_err       TEXT;
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.apt_issue_scores;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      REFRESH MATERIALIZED VIEW public.apt_issue_scores;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
    END;
  END;

  v_finished := clock_timestamp();
  v_dur := (extract(epoch FROM (v_finished - v_started)) * 1000)::int;

  BEGIN
    INSERT INTO public.cron_logs (cron_name, status, started_at, finished_at, duration_ms, error_message)
    VALUES ('refresh_apt_issue_scores_v1',
            CASE WHEN v_err IS NULL THEN 'success' ELSE 'failed' END,
            v_started, v_finished, v_dur, v_err);
  EXCEPTION WHEN OTHERS THEN /* ignore */
  END;

  SELECT count(*)::int INTO v_count_24h
    FROM public.cron_logs
    WHERE cron_name = 'refresh_apt_issue_scores_v1'
      AND started_at > now() - interval '24 hours';

  INSERT INTO public.cron_health AS h
    (cron_name, last_run_at, last_success_at, last_error, last_duration_ms, run_count_24h, alerting, updated_at)
  VALUES ('refresh_apt_issue_scores_v1', v_started,
          CASE WHEN v_err IS NULL THEN v_finished ELSE NULL END,
          v_err, v_dur, coalesce(v_count_24h, 1),
          v_err IS NOT NULL, now())
  ON CONFLICT (cron_name) DO UPDATE
    SET last_run_at      = EXCLUDED.last_run_at,
        last_success_at  = COALESCE(EXCLUDED.last_success_at, h.last_success_at),
        last_error       = EXCLUDED.last_error,
        last_duration_ms = EXCLUDED.last_duration_ms,
        run_count_24h    = EXCLUDED.run_count_24h,
        alerting         = (EXCLUDED.last_error IS NOT NULL),
        updated_at       = now();
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_stock_issue_scores_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_apt_issue_scores_v1()   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_stock_issue_scores_v1() TO service_role;
GRANT  EXECUTE ON FUNCTION public.refresh_apt_issue_scores_v1()   TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- C) freshness 체크 — alerting flag만 세팅. push 알림은 admin/health UI 책임.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_issue_scores_freshness()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_stock_age INTERVAL;
  v_apt_age   INTERVAL;
  v_stock_max TIMESTAMPTZ;
  v_apt_max   TIMESTAMPTZ;
BEGIN
  SELECT max(computed_at) INTO v_stock_max FROM public.stock_issue_scores;
  SELECT max(computed_at) INTO v_apt_max   FROM public.apt_issue_scores;

  v_stock_age := now() - coalesce(v_stock_max, now() - interval '99 hours');
  v_apt_age   := now() - coalesce(v_apt_max,   now() - interval '99 hours');

  -- stock: 25분 초과 stale 시 alerting=true
  INSERT INTO public.cron_health AS h
    (cron_name, last_run_at, last_success_at, last_duration_ms, run_count_24h, alerting, last_error, updated_at)
  VALUES ('issue_scores_freshness_stock', now(), v_stock_max, 0, 0,
          v_stock_age > interval '25 minutes',
          CASE WHEN v_stock_age > interval '25 minutes'
               THEN 'stale ' || extract(epoch FROM v_stock_age)::int || 's'
               ELSE NULL END,
          now())
  ON CONFLICT (cron_name) DO UPDATE
    SET last_run_at = EXCLUDED.last_run_at,
        last_success_at = EXCLUDED.last_success_at,
        alerting    = EXCLUDED.alerting,
        last_error  = EXCLUDED.last_error,
        updated_at  = now();

  -- apt: 90분 초과 stale (시간당 cron 이라 좀 여유)
  INSERT INTO public.cron_health AS h
    (cron_name, last_run_at, last_success_at, last_duration_ms, run_count_24h, alerting, last_error, updated_at)
  VALUES ('issue_scores_freshness_apt', now(), v_apt_max, 0, 0,
          v_apt_age > interval '90 minutes',
          CASE WHEN v_apt_age > interval '90 minutes'
               THEN 'stale ' || extract(epoch FROM v_apt_age)::int || 's'
               ELSE NULL END,
          now())
  ON CONFLICT (cron_name) DO UPDATE
    SET last_run_at = EXCLUDED.last_run_at,
        last_success_at = EXCLUDED.last_success_at,
        alerting    = EXCLUDED.alerting,
        last_error  = EXCLUDED.last_error,
        updated_at  = now();
END;
$$;

REVOKE ALL ON FUNCTION public.check_issue_scores_freshness() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_issue_scores_freshness() TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- D) pg_cron schedule 4건 (idempotent: 같은 이름 unschedule 후 schedule)
-- ─────────────────────────────────────────────────────────────────────
-- 평일 KST 09:00~24:00 = UTC 00:00~15:00 매 5분
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'kadeora-refresh-stock-issue-scores-weekday';
SELECT cron.schedule(
  'kadeora-refresh-stock-issue-scores-weekday',
  '*/5 0-15 * * 1-5',
  $cron$ SELECT public.refresh_stock_issue_scores_v1(); $cron$
);

-- 주말 매시 정각
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'kadeora-refresh-stock-issue-scores-weekend';
SELECT cron.schedule(
  'kadeora-refresh-stock-issue-scores-weekend',
  '0 * * * 0,6',
  $cron$ SELECT public.refresh_stock_issue_scores_v1(); $cron$
);

-- apt 매시 정각 (KST 무관, 시간당 1회)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'kadeora-refresh-apt-issue-scores';
SELECT cron.schedule(
  'kadeora-refresh-apt-issue-scores',
  '0 * * * *',
  $cron$ SELECT public.refresh_apt_issue_scores_v1(); $cron$
);

-- freshness check 10분마다
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'kadeora-issue-scores-freshness-check';
SELECT cron.schedule(
  'kadeora-issue-scores-freshness-check',
  '*/10 * * * *',
  $cron$ SELECT public.check_issue_scores_freshness(); $cron$
);

-- ─────────────────────────────────────────────────────────────────────
-- E) 검증 — 마이그레이션 안에서 한 번 실행해 sanity check
-- ─────────────────────────────────────────────────────────────────────
SELECT public.refresh_stock_issue_scores_v1();
SELECT public.refresh_apt_issue_scores_v1();
SELECT public.check_issue_scores_freshness();

DO $$
DECLARE
  v_jobs INT;
  v_health INT;
BEGIN
  SELECT count(*) INTO v_jobs FROM cron.job WHERE jobname LIKE 'kadeora-%issue-scores%' OR jobname = 'kadeora-issue-scores-freshness-check';
  IF v_jobs <> 4 THEN RAISE EXCEPTION 's262-D: cron jobs (got %)', v_jobs; END IF;
  SELECT count(*) INTO v_health FROM public.cron_health;
  IF v_health < 4 THEN RAISE EXCEPTION 's262-D: cron_health rows (got %)', v_health; END IF;
END $$;

COMMIT;
