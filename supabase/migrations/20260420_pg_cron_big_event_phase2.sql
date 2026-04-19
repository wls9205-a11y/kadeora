-- [PG-CRON-REGISTER] 세션 138 Big Event Phase 2 크론 5건 등록
--
-- 사용 헬퍼: public._call_vercel_cron(path) — Vault에서 CRON_SECRET 읽어 Bearer 인증 + x-pg-cron-secret 헤더 포함
-- 패턴: _call_vercel_cron 반환 request_id는 cron_logs(pg_cron_<route>, running)에 자동 로깅됨
--
-- 등록 5건:
--   big_event_news_detect               : */30 * * * *  (30분)
--   big_event_fact_refresh              : 0 3 * * *     (일 1회 03:00 UTC)
--   subscription_big_event_bridge       : 0 5 * * 1     (월 05:00 UTC)
--   subscription_prebrief_generator     : 0 8 * * *     (일 08:00 UTC)
--   big_event_auto_pillar_draft         : 0 9 * * 2,5   (화/금 09:00 UTC)
--
-- 안전장치: 기존 동일 jobname 있으면 unschedule 먼저 (idempotent)

DO $$
DECLARE
  j RECORD;
  jobs text[] := ARRAY[
    'big_event_news_detect',
    'big_event_fact_refresh',
    'subscription_big_event_bridge',
    'subscription_prebrief_generator',
    'big_event_auto_pillar_draft'
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
  'big_event_news_detect',
  '*/30 * * * *',
  $$SELECT public._call_vercel_cron('/api/cron/big-event-news-detect')$$
);

SELECT cron.schedule(
  'big_event_fact_refresh',
  '0 3 * * *',
  $$SELECT public._call_vercel_cron('/api/cron/big-event-fact-refresh')$$
);

SELECT cron.schedule(
  'subscription_big_event_bridge',
  '0 5 * * 1',
  $$SELECT public._call_vercel_cron('/api/cron/subscription-big-event-bridge')$$
);

SELECT cron.schedule(
  'subscription_prebrief_generator',
  '0 8 * * *',
  $$SELECT public._call_vercel_cron('/api/cron/subscription-prebrief-generator')$$
);

SELECT cron.schedule(
  'big_event_auto_pillar_draft',
  '0 9 * * 2,5',
  $$SELECT public._call_vercel_cron('/api/cron/big-event-auto-pillar-draft')$$
);
