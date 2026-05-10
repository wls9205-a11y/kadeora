-- s263 Phase C — check_issue_scores_freshness weekend hourly mode threshold 분기.
-- 증거: cron_health.issue_scores_freshness_stock alerting=true, last_error="stale 3300s"
-- 원인: weekday(5min REFRESH) 25min threshold 고정. weekend stock 은 hourly REFRESH
--       (cron '0 * * * 0,6') 라 25-55min stale 정상인데 false positive alert.
-- 해결: KST 요일 기준 weekend 분기. weekend 90min / weekday 25min.
-- IDEMPOTENT (CREATE OR REPLACE) + REVERSIBLE.
--
-- DOWN: 이전 정의 복원은 git 이력 참조 (s262_d_issue_scores_pg_cron.sql)

CREATE OR REPLACE FUNCTION public.check_issue_scores_freshness()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_stock_age INTERVAL;
  v_apt_age   INTERVAL;
  v_stock_max TIMESTAMPTZ;
  v_apt_max   TIMESTAMPTZ;
  v_is_weekend BOOLEAN;
  v_stock_threshold INTERVAL;
BEGIN
  v_is_weekend := EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Seoul'))::int IN (0, 6);
  v_stock_threshold := CASE WHEN v_is_weekend
                            THEN interval '90 minutes'
                            ELSE interval '25 minutes'
                       END;

  SELECT max(computed_at) INTO v_stock_max FROM public.stock_issue_scores;
  SELECT max(computed_at) INTO v_apt_max   FROM public.apt_issue_scores;
  v_stock_age := now() - coalesce(v_stock_max, now() - interval '99 hours');
  v_apt_age   := now() - coalesce(v_apt_max,   now() - interval '99 hours');

  INSERT INTO public.cron_health AS h
    (cron_name, last_run_at, last_success_at, last_duration_ms, run_count_24h, alerting, last_error, updated_at)
  VALUES ('issue_scores_freshness_stock', now(), v_stock_max, 0, 0,
          v_stock_age > v_stock_threshold,
          CASE WHEN v_stock_age > v_stock_threshold
               THEN 'stale ' || extract(epoch FROM v_stock_age)::int || 's (th ' ||
                    extract(epoch FROM v_stock_threshold)::int || 's, weekend=' || v_is_weekend || ')' END,
          now())
  ON CONFLICT (cron_name) DO UPDATE
    SET last_run_at = EXCLUDED.last_run_at,
        last_success_at = EXCLUDED.last_success_at,
        alerting    = EXCLUDED.alerting,
        last_error  = EXCLUDED.last_error,
        updated_at  = now();

  INSERT INTO public.cron_health AS h
    (cron_name, last_run_at, last_success_at, last_duration_ms, run_count_24h, alerting, last_error, updated_at)
  VALUES ('issue_scores_freshness_apt', now(), v_apt_max, 0, 0,
          v_apt_age > interval '90 minutes',
          CASE WHEN v_apt_age > interval '90 minutes'
               THEN 'stale ' || extract(epoch FROM v_apt_age)::int || 's' END,
          now())
  ON CONFLICT (cron_name) DO UPDATE
    SET last_run_at = EXCLUDED.last_run_at,
        last_success_at = EXCLUDED.last_success_at,
        alerting    = EXCLUDED.alerting,
        last_error  = EXCLUDED.last_error,
        updated_at  = now();
END;
$$;
