-- B5 등재 정합화 (2026-09-17)
-- schema_migrations 에 «정의» 가 없는 라이브 함수 2종을 현재 정의 그대로 등재한다.
--   · capture_db_activity(text)   — ops_db_activity_capture_2026-09-16.sql 은 execute_sql 로 적용돼 미등재.
--                                    (20260917034024 는 REVOKE 만 담았고 정의는 없다)
--   · get_social_proof_counts()   — ops_worker_starvation_fix_2026-09-17.sql 이후 라이브에서 주석 포함 형태로 재정의, 미등재.
--   · fn_llm_silence_watch()      — 20260908040119(lb2_llm_silence_watchdog)에 CREATE 있음 → skip.
-- ⛔ 본문을 바꾸지 않는다. 본문은 pg_get_functiondef 원문 전사이며, 말미에서 md5(prosrc) 를
--    적용 전 실측값과 대조해 하나라도 다르면 전체 롤백한다.
-- 권한은 «현재 ACL 그대로» 재선언한다(바꾸지 않는다).

CREATE OR REPLACE FUNCTION public.capture_db_activity(p_reason text DEFAULT 'cron'::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_id bigint;
BEGIN
  INSERT INTO db_activity_snapshots (
    reason, total_conn, active_count, idle_count, idle_in_tx_count, idle_in_tx_aborted,
    waiting_count, longest_active_sec, longest_idle_in_tx_sec, blocked_count, sessions, waiting_locks)
  SELECT p_reason,
    count(*),
    count(*) FILTER (WHERE state='active'),
    count(*) FILTER (WHERE state='idle'),
    count(*) FILTER (WHERE state LIKE 'idle in transaction%'),
    count(*) FILTER (WHERE state='idle in transaction (aborted)'),
    count(*) FILTER (WHERE wait_event_type IS NOT NULL AND state<>'idle'),
    max(EXTRACT(epoch FROM now()-query_start)) FILTER (WHERE state='active'),
    max(EXTRACT(epoch FROM now()-xact_start)) FILTER (WHERE state LIKE 'idle in transaction%'),
    count(*) FILTER (WHERE cardinality(pg_blocking_pids(pid))>0),
    (SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM (
       SELECT pid, state, wait_event_type, wait_event, application_name,
              round(EXTRACT(epoch FROM now()-xact_start)::numeric,1) AS xact_sec,
              round(EXTRACT(epoch FROM now()-query_start)::numeric,1) AS query_sec,
              pg_blocking_pids(pid) AS blocked_by, left(query,160) AS q
       FROM pg_stat_activity
       WHERE datname=current_database() AND pid<>pg_backend_pid() AND (state<>'idle' OR state IS NULL)
       ORDER BY xact_start NULLS LAST LIMIT 40) s),
    (SELECT coalesce(jsonb_agg(w),'[]'::jsonb) FROM (
       SELECT l.pid, l.mode, l.locktype, c.relname
       FROM pg_locks l LEFT JOIN pg_class c ON c.oid=l.relation
       WHERE NOT l.granted LIMIT 40) w)
  FROM pg_stat_activity
  WHERE datname=current_database() AND pid<>pg_backend_pid()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_db_activity(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_db_activity(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_social_proof_counts()
 RETURNS TABLE(stock_count bigint, complex_count bigint, subscription_count bigint, trade_count bigint, rent_count bigint, price_history_count bigint, user_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  -- K-10 ② — 소셜프루프 카운트를 «추정» 으로 (2026-09-17).
  --
  -- ⛔ 왜 바꾸나: 예전에는 요청마다 exact count 7발이 나갔고, 그중 apt_rent_transactions 는
  --    240만 행·apt_transactions 는 80만 행이었다. exact count 는 전체 스캔이라
  --    플래너가 «parallel worker 2개» 를 붙였고, max_worker_processes=6 인 인스턴스에서
  --    그 워커들이 슬롯을 먹어 pg_cron 이 background worker 를 fork 하지 못했다
  --    (job startup timeout 연쇄 → kill-slow-queries 붕괴 → statement timeout 폭증 → 504).
  --    2026-09-16 장애의 발화원이다.
  --
  -- ⚠️ 소셜프루프는 «정의상 정밀이 필요 없다». 「240만+」를 보여주는 자리에 240만 행을
  --    매번 정확히 세는 것은 근거가 없다. reltuples 추정으로 충분하다.
  -- ⚠️ reltuples 는 ANALYZE 이후 누적 변동을 반영하지 않아 «약간 과소» 할 수 있다.
  --    한 번도 분석되지 않은 표는 -1 을 주므로, 그때는 NULL 을 돌려준다 —
  --    0 으로 때우면 「데이터가 없다」는 전혀 다른 뜻이 된다.
  -- ⚠️ profiles(실유저)만 exact 로 남긴다. 작은 표이고 조건이 붙으며 의미상 정확해야 한다.
  SELECT
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.stock_quotes'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_complex_profiles'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_subscriptions'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_transactions'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_rent_transactions'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.stock_price_history'::regclass),
    (SELECT count(*) FROM profiles WHERE coalesce(is_seed,false) = false AND coalesce(is_deleted,false) = false);
$function$;

-- 현재 ACL 그대로: {=X, postgres=X, anon=X, authenticated=X, service_role=X} — 앱(anon)이 /api/stats/social-proof 로 호출.
GRANT EXECUTE ON FUNCTION public.get_social_proof_counts() TO PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE bad text := '';
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.capture_db_activity(text)'::regprocedure)
     <> 'ede33c3a877a80fa5f45132bc2f211eb' THEN bad := bad || ' capture_db_activity:body'; END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.get_social_proof_counts()'::regprocedure)
     <> 'c113a9f713a833cffb9e96617279d128' THEN bad := bad || ' get_social_proof_counts:body'; END IF;
  IF (SELECT proacl::text FROM pg_proc WHERE oid = 'public.capture_db_activity(text)'::regprocedure)
     <> '{postgres=X/postgres,service_role=X/postgres}' THEN bad := bad || ' capture_db_activity:acl'; END IF;
  IF (SELECT proacl::text FROM pg_proc WHERE oid = 'public.get_social_proof_counts()'::regprocedure)
     <> '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     THEN bad := bad || ' get_social_proof_counts:acl'; END IF;
  IF bad <> '' THEN RAISE EXCEPTION 'B5 등재 불일치:%', bad; END IF;
END $$;
