-- [PG-CRON] Session C 파이프라인 등록 + big_event_fact_refresh active 전환
--
-- 등록:
--   issue_fact_check             : */15 * * * *   (15m)
--   issue_image_attach           : */15 * * * *   (15m; 7m 오프셋)
--   issue_seo_enrich             : */15 * * * *   (15m; 10m 오프셋)
--   issue_publish                : */15 * * * *   (15m; 13m 오프셋)
--   issue_alerts_backfill        : 0 */6 * * *    (6h)
--   big_event_bootstrap_process  : */30 * * * *   (30m)
--
-- 활성화:
--   big_event_fact_refresh       : DISABLED → active (라우트 withCronAuthFlex 패치 완료)
--
-- Idempotent: 동일 jobname 이 존재하면 unschedule 후 재등록.
-- 오프셋은 pg_cron 이 "분" 단위라 표현 불가 → 단일 15분 주기로 통일하되 경쟁 최소화를 위해
-- route 내부 withCronLogging Redis lock 으로 중복 차단 유지.

DO $$
DECLARE
  j RECORD;
  jobs text[] := ARRAY[
    'issue_fact_check',
    'issue_image_attach',
    'issue_seo_enrich',
    'issue_publish',
    'issue_alerts_backfill',
    'big_event_bootstrap_process'
  ];
  jobname text;
BEGIN
  FOREACH jobname IN ARRAY jobs LOOP
    FOR j IN SELECT jobid FROM cron.job WHERE cron.job.jobname = jobname LOOP
      PERFORM cron.unschedule(j.jobid);
    END LOOP;
  END LOOP;
END $$;

SELECT cron.schedule(
  'issue_fact_check',
  '*/15 * * * *',
  $$SELECT public._call_vercel_cron('/api/cron/issue-fact-check')$$
);

SELECT cron.schedule(
  'issue_image_attach',
  '*/15 * * * *',
  $$SELECT public._call_vercel_cron('/api/cron/issue-image-attach')$$
);

SELECT cron.schedule(
  'issue_seo_enrich',
  '*/15 * * * *',
  $$SELECT public._call_vercel_cron('/api/cron/issue-seo-enrich')$$
);

SELECT cron.schedule(
  'issue_publish',
  '*/15 * * * *',
  $$SELECT public._call_vercel_cron('/api/cron/issue-publish')$$
);

SELECT cron.schedule(
  'issue_alerts_backfill',
  '0 */6 * * *',
  $$SELECT public._call_vercel_cron('/api/admin/issue-alerts/backfill')$$
);

SELECT cron.schedule(
  'big_event_bootstrap_process',
  '*/30 * * * *',
  $$SELECT public._call_vercel_cron('/api/cron/big-event-bootstrap-process')$$
);

-- big_event_fact_refresh 활성화 (withCronAuthFlex 패치 배포 이후)
UPDATE cron.job
SET active = true
WHERE jobname = 'big_event_fact_refresh';
