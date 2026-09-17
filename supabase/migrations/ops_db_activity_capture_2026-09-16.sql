-- 실패 창 «동시 캡처» 계기 (2026-09-16 · 세션 A 지시)
--
-- 왜 오늘 밤인가: 클러스터가 오늘만 6회, 시간 단위 주기다. 훅이 오늘 밤 안에 깔려야
--   밤사이 클러스터가 «재료» 로 남고 내일 H 는 그걸 «읽는» 자리가 된다.
--   안 깔면 H 도 또 사후 측정이고, 「사후 잠금 0 은 무증거」는 오늘 이미 실증됐다.
--
-- ⚠️ 경로를 «함수(RPC)» 로 둔다. 막힌 표를 read 하는 경로로 캡처하면 캡처가 같이 죽는다.
--    16:35 창에서 SELECT 1 은 통과하는데 특정 표만 막혔다 — 함수 경로는 살아 있을 개연이 높다.
--    ⚠️ 다만 17:17 창은 SELECT 1 까지 막혔다 — «표 선택적» 창과 «전면» 창이 둘 다 있다.
--       전면 창에서는 이 캡처도 못 돈다. 그건 이 계기의 한계이고, 그 사실 자체가 판별 재료다
--       (스냅샷이 «비어 있는 분» 이 전면 창의 지문이 된다).
-- ⚠️ 캡처가 무거우면 안 된다. 비유휴 세션만·상한 40행·query 는 앞 160자만.

CREATE TABLE IF NOT EXISTS db_activity_snapshots (
  id                     bigserial PRIMARY KEY,
  captured_at            timestamptz NOT NULL DEFAULT now(),
  reason                 text,
  total_conn             int,
  active_count           int,
  idle_count             int,
  idle_in_tx_count       int,
  idle_in_tx_aborted     int,
  waiting_count          int,
  longest_active_sec     numeric,
  longest_idle_in_tx_sec numeric,
  blocked_count          int,
  sessions               jsonb,
  waiting_locks          jsonb
);

CREATE INDEX IF NOT EXISTS idx_db_act_snap_time ON db_activity_snapshots (captured_at DESC);
-- 「흥미로운 순간」만 빠르게 뽑는 부분 인덱스 — 이 표의 존재 이유가 그 질의다.
CREATE INDEX IF NOT EXISTS idx_db_act_snap_hot ON db_activity_snapshots (captured_at DESC)
  WHERE idle_in_tx_aborted > 0 OR blocked_count > 0 OR waiting_count > 0;

COMMENT ON TABLE db_activity_snapshots IS
  '실패 창 동시 캡처. pg_cron 1분 주기 + 필요 시 capture_db_activity() 수동 호출. 보존 3일.';

CREATE OR REPLACE FUNCTION capture_db_activity(p_reason text DEFAULT 'cron')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO db_activity_snapshots (
    reason, total_conn, active_count, idle_count, idle_in_tx_count, idle_in_tx_aborted,
    waiting_count, longest_active_sec, longest_idle_in_tx_sec, blocked_count,
    sessions, waiting_locks
  )
  SELECT
    p_reason,
    count(*),
    count(*) FILTER (WHERE state = 'active'),
    count(*) FILTER (WHERE state = 'idle'),
    count(*) FILTER (WHERE state LIKE 'idle in transaction%'),
    count(*) FILTER (WHERE state = 'idle in transaction (aborted)'),
    count(*) FILTER (WHERE wait_event_type IS NOT NULL AND state <> 'idle'),
    max(EXTRACT(epoch FROM now() - query_start)) FILTER (WHERE state = 'active'),
    max(EXTRACT(epoch FROM now() - xact_start)) FILTER (WHERE state LIKE 'idle in transaction%'),
    count(*) FILTER (WHERE cardinality(pg_blocking_pids(pid)) > 0),
    -- ⚠️ 비유휴·유휴트랜잭션만. 전량을 담으면 캡처가 로그 덤프가 된다.
    (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM (
       SELECT pid, state, wait_event_type, wait_event, application_name,
              round(EXTRACT(epoch FROM now() - xact_start)::numeric, 1) AS xact_sec,
              round(EXTRACT(epoch FROM now() - query_start)::numeric, 1) AS query_sec,
              pg_blocking_pids(pid) AS blocked_by,
              left(query, 160) AS q
       FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()
         AND (state <> 'idle' OR state IS NULL)
       ORDER BY xact_start NULLS LAST
       LIMIT 40) s),
    -- 대기 «중인» 잠금만. 획득된 잠금은 수천 행이라 담지 않는다.
    (SELECT coalesce(jsonb_agg(w), '[]'::jsonb) FROM (
       SELECT l.pid, l.mode, l.locktype, c.relname
       FROM pg_locks l LEFT JOIN pg_class c ON c.oid = l.relation
       WHERE NOT l.granted
       LIMIT 40) w)
  FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION capture_db_activity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_db_activity(text) TO service_role;

COMMENT ON FUNCTION capture_db_activity(text) IS
  '실패 창 동시 캡처. RPC 경유 — 막힌 표를 read 하는 경로로 캡처하면 캡처가 같이 죽는다.';

-- 1분 주기. 클러스터가 4~5분짜리라 5분 주기로는 창을 통째로 놓친다.
-- 보존 3일 — 계기지 로그 보관소가 아니다.
SELECT cron.schedule('db-activity-capture', '* * * * *',
  $$SELECT capture_db_activity('cron')$$);

SELECT cron.schedule('db-activity-capture-prune', '17 4 * * *',
  $$DELETE FROM db_activity_snapshots WHERE captured_at < now() - interval '3 days'$$);
