-- B4 네이버 오픈API 쿼터 원장 + 순위 배치 캡 자동 상향 (2026-09-17)
--
-- 결함형: 「관측자 없는 공유 자원」. NAVER_CLIENT_ID 를 쓰는 라우트가 18곳인데 라우트별·일별
--   호출 원장이 없어 일일 쿼터 사용률을 아무도 몰랐다. get_rank_targets_due 의 80 캡은
--   API 쿼터가 아니라 자율값이었고, 올릴 근거도 내릴 근거도 없었다.
--
-- 구성
--   ① naver_openapi_usage_daily  — (KST 날짜, 라우트, 엔드포인트) 일별 원장. 적재는 src/lib/naver/openapi.ts 만.
--   ② naver_openapi_usage_incr() — 원자적 증분(배열 1회 = 라우트 종료 시 집계 1회).
--   ③ app_config('naver_openapi', …) — rank_batch_cap(80) · daily_quota(null = 미확정).
--   ④ get_rank_targets_due        — rank_targets_restore_gate_2026_09_17 본문 그대로, 80 만 설정값으로.
--   ⑤ naver_rank_cap_decisions + naver_rank_cap_evaluate() — 판정·사유 기록.
--   ⑥ pg_cron naver-rank-cap-evaluate `15 17 * * *` = 02:15 KST (naver-sc-sync 02:30 KST 이전).
--
-- ⛔ 쿼터(daily_quota)는 «미확정» 으로 들어간다. developers.naver.com 공식 문서를 이 세션에서 열지 못했다
--    (도구 차단). 2차 출처의 25,000/일은 근거로 쓰지 않았다. 값이 null 이면 평가 함수는 «절대» 올리지 않는다.
--    사람이 공식 문서로 확인해 값을 넣으면(description 에 출처·기준일) 그날부터 판정이 살아난다.
-- ⛔ 자동 «하향» 은 없다 — 판정 범위는 80→92 상향뿐. 상향 후 조건이 깨지면 decision='hold' 에
--    사유가 남는다(cap_before=92). 되돌림은 사람이 한다.

BEGIN;

-- ① 원장 ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.naver_openapi_usage_daily (
  date            date        NOT NULL,          -- KST
  route           text        NOT NULL,          -- 예: cron/naver-sc-sync
  endpoint        text        NOT NULL,          -- 예: search/webkr · datalab/search
  calls           integer     NOT NULL DEFAULT 0 CHECK (calls >= 0),
  http_429        integer     NOT NULL DEFAULT 0 CHECK (http_429 >= 0),
  http_other_err  integer     NOT NULL DEFAULT 0 CHECK (http_other_err >= 0), -- 429 외 비-2xx + 네트워크/타임아웃
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, route, endpoint)
);
ALTER TABLE public.naver_openapi_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.naver_openapi_usage_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.naver_openapi_usage_daily TO service_role;
COMMENT ON TABLE public.naver_openapi_usage_daily IS
  '네이버 오픈API(openapi.naver.com, Client-Id 헤더) 호출 원장. KST 일별×라우트×엔드포인트. 적재는 src/lib/naver/openapi.ts 의 naverOpenApiFetch 만(라우트 종료 시 집계 1회). 검색광고 API·Search Advisor 는 대상 아님.';

-- ② 원자적 증분 --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.naver_openapi_usage_incr(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'naver_openapi_usage_incr: p_rows must be a jsonb array';
  END IF;

  INSERT INTO naver_openapi_usage_daily AS u (date, route, endpoint, calls, http_429, http_other_err, updated_at)
  SELECT (r->>'date')::date,
         left(r->>'route', 120),
         left(r->>'endpoint', 60),
         greatest(coalesce((r->>'calls')::int, 0), 0),
         greatest(coalesce((r->>'http_429')::int, 0), 0),
         greatest(coalesce((r->>'http_other_err')::int, 0), 0),
         now()
  FROM jsonb_array_elements(p_rows) r
  WHERE r->>'date' IS NOT NULL AND r->>'route' IS NOT NULL AND r->>'endpoint' IS NOT NULL
  ON CONFLICT (date, route, endpoint) DO UPDATE
    SET calls          = u.calls + EXCLUDED.calls,
        http_429       = u.http_429 + EXCLUDED.http_429,
        http_other_err = u.http_other_err + EXCLUDED.http_other_err,
        updated_at     = now();

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.naver_openapi_usage_incr(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.naver_openapi_usage_incr(jsonb) TO service_role;

-- ③ 설정 행 (기존 설정 표 app_config 재사용) ----------------------------------
INSERT INTO public.app_config (namespace, key, value, description)
VALUES
  ('naver_openapi', 'rank_batch_cap', '80'::jsonb,
   '순위 수집 배치 캡(get_rank_targets_due). 80=자율값 기본. 상향은 naver_rank_cap_evaluate() 만(80→92). 행이 없거나 숫자가 아니면 80 폴백.'),
  ('naver_openapi', 'daily_quota', 'null'::jsonb,
   '미확정(2026-09-17): developers.naver.com 공식 문서 미확인. null 이면 자동 상향 비활성. 값을 넣을 때 description 에 출처 URL·기준일을 적을 것.')
ON CONFLICT (namespace, key) DO NOTHING;

-- ④ 게이트 함수 — rank_targets_restore_gate_2026_09_17 본문 유지, 캡만 교체 ----------
CREATE OR REPLACE FUNCTION public.get_rank_targets_due(p_limit integer DEFAULT 60)
 RETURNS TABLE(keyword text, priority integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- ⚠️ active 는 «검수 통과» 다. 비활성 복귀 트리거는 없다 — 비활성으로 내리는 건 곧 수집 중단이다.
  -- 캡: app_config('naver_openapi','rank_batch_cap') (B4 2026-09-17). 없거나 숫자가 아니면 80.
  select t.keyword, t.priority
  from keyword_rank_targets t
  where t.tracked and t.active
  order by
    t.priority,
    t.last_checked_at nulls first,
    t.keyword
  limit greatest(least(coalesce(p_limit, 60), coalesce((
    select case when jsonb_typeof(c.value) = 'number' then (c.value #>> '{}')::numeric::int end
    from app_config c
    where c.namespace = 'naver_openapi' and c.key = 'rank_batch_cap'
  ), 80)), 1);
$function$;

-- ⑤ 판정 기록 + 평가 함수 ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.naver_rank_cap_decisions (
  id            bigserial   PRIMARY KEY,
  evaluated_at  timestamptz NOT NULL DEFAULT now(),
  window_start  date        NOT NULL,   -- KST, 포함
  window_end    date        NOT NULL,   -- KST, 포함(=어제)
  days_covered  integer     NOT NULL,
  daily_quota   integer,                -- null = 미확정
  p95_calls     numeric,
  p95_ratio     numeric,
  sum_429       integer,
  cap_before    integer     NOT NULL,
  cap_after     integer     NOT NULL,
  decision      text        NOT NULL CHECK (decision IN ('raise', 'hold')),
  reason        text        NOT NULL
);
ALTER TABLE public.naver_rank_cap_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.naver_rank_cap_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.naver_rank_cap_decisions TO service_role;
COMMENT ON TABLE public.naver_rank_cap_decisions IS
  'naver_rank_cap_evaluate() 판정 원장. 매일 1행(raise|hold + 사유).';

CREATE OR REPLACE FUNCTION public.naver_rank_cap_evaluate()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_base   constant int := 80;
  c_raised constant int := 92;
  c_ratio  constant numeric := 0.60;
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_start  date := v_today - 7;
  v_end    date := v_today - 1;
  v_days   int;
  v_quota  int;
  v_p95    numeric;
  v_ratio  numeric;
  v_429    int;
  v_cap    int;
  v_after  int;
  v_dec    text := 'hold';
  v_reason text;
BEGIN
  SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric::int END
    INTO v_cap FROM app_config WHERE namespace = 'naver_openapi' AND key = 'rank_batch_cap';
  v_cap := coalesce(v_cap, c_base);
  v_after := v_cap;

  SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric::int END
    INTO v_quota FROM app_config WHERE namespace = 'naver_openapi' AND key = 'daily_quota';

  -- 일별 전 라우트 합계 (완결된 KST 7일: 오늘 제외)
  SELECT count(*), percentile_cont(0.95) WITHIN GROUP (ORDER BY d.total), coalesce(sum(d.n429), 0)
    INTO v_days, v_p95, v_429
  FROM (
    SELECT date, sum(calls)::numeric AS total, sum(http_429) AS n429
    FROM naver_openapi_usage_daily
    WHERE date BETWEEN v_start AND v_end
    GROUP BY date
  ) d;

  IF v_quota IS NOT NULL AND v_quota > 0 AND v_p95 IS NOT NULL THEN
    v_ratio := round(v_p95 / v_quota, 4);
  END IF;

  IF v_days < 7 THEN
    v_reason := format('ledger_days_%s_lt_7', v_days);
  ELSIF v_quota IS NULL OR v_quota <= 0 THEN
    v_reason := 'quota_unconfirmed';
  ELSIF v_429 > 0 THEN
    v_reason := format('http_429_%s_in_window', v_429);
  ELSIF v_ratio >= c_ratio THEN
    v_reason := format('p95_ratio_%s_ge_0.60', v_ratio);
  ELSIF v_cap >= c_raised THEN
    v_reason := 'already_raised';
  ELSE
    v_dec := 'raise';
    v_after := c_raised;
    v_reason := format('p95_ratio_%s_lt_0.60_and_429_zero', v_ratio);
    UPDATE app_config
       SET value = to_jsonb(c_raised), updated_at = now(),
           description = format('순위 수집 배치 캡. %s 자동 상향 80→92 (p95 %s / quota %s, 429=0, 창 %s~%s). 상향은 naver_rank_cap_evaluate() 만.',
                                v_today, v_p95, v_quota, v_start, v_end)
     WHERE namespace = 'naver_openapi' AND key = 'rank_batch_cap';
    IF NOT FOUND THEN
      INSERT INTO app_config (namespace, key, value, description)
      VALUES ('naver_openapi', 'rank_batch_cap', to_jsonb(c_raised),
              format('%s 자동 상향 80→92 (naver_rank_cap_evaluate)', v_today));
    END IF;
  END IF;

  INSERT INTO naver_rank_cap_decisions
    (window_start, window_end, days_covered, daily_quota, p95_calls, p95_ratio, sum_429,
     cap_before, cap_after, decision, reason)
  VALUES (v_start, v_end, v_days, v_quota, v_p95, v_ratio, v_429, v_cap, v_after, v_dec, v_reason);

  RETURN v_dec || ':' || v_reason;
END;
$$;
REVOKE ALL ON FUNCTION public.naver_rank_cap_evaluate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.naver_rank_cap_evaluate() TO service_role;

-- ⑥ 크론 — 02:15 KST (naver-sc-sync 02:30 KST 이전)
SELECT cron.schedule('naver-rank-cap-evaluate', '15 17 * * *',
  $cmd$SELECT public.naver_rank_cap_evaluate() -- 02:15 KST · B4 · naver-sc-sync(02:30 KST) 이전$cmd$);

-- 긍정형 단언 — 하나라도 어긋나면 전체 롤백
DO $$
DECLARE v_due int; v_cap jsonb; v_job int; v_tbl int;
BEGIN
  SELECT count(*) INTO v_due FROM get_rank_targets_due(200);
  SELECT value INTO v_cap FROM app_config WHERE namespace = 'naver_openapi' AND key = 'rank_batch_cap';
  SELECT count(*) INTO v_job FROM cron.job WHERE jobname = 'naver-rank-cap-evaluate' AND schedule = '15 17 * * *';
  SELECT count(*) INTO v_tbl FROM pg_tables
   WHERE schemaname = 'public' AND tablename IN ('naver_openapi_usage_daily', 'naver_rank_cap_decisions');
  IF v_due <> 80 OR v_cap IS DISTINCT FROM '80'::jsonb OR v_job <> 1 OR v_tbl <> 2 THEN
    RAISE EXCEPTION 'B4 단언 불일치: due200=% cap=% job=% tables=%', v_due, v_cap, v_job, v_tbl;
  END IF;
END $$;

COMMIT;
