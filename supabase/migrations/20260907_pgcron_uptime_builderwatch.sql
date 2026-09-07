-- pg_cron 업타임 프로브 + builder-watch 이관 — 세션 A 직접 집행분 «사후 동봉» (2026-09-07)
--
-- ⛔ 이 파일은 «이미 프로덕션에 적용된» DDL 의 기록이다. 다시 실행하지 않는다.
--    DB 에만 있고 마이그레이션에 없는 변경은 다음 사람이 스키마를 재구성할 때
--    조용히 사라진다 — 그래서 남긴다.
-- ⚠️ 아래 본문은 «집행된 실물을 DB 에서 다시 읽어» 옮긴 것이다(pg_get_functiondef ·
--    information_schema · cron.job 조회). 기억이나 대화 인용이 아니다.
--
-- ── 왜 만들었나 ──────────────────────────────────────────────────────────────
-- ① 업타임: 기존 health-check 는 «Vercel 크론» 이라 사이트가 죽으면 관측도 같이 죽는다.
--    자기를 자기가 보는 관측은 전면 정지를 못 잡는다(8/21 결제 정지형).
--    Supabase 는 Vercel 과 «다른 장애 도메인» 이므로 여기서 5분마다 밖에서 친다.
--    ⚠️ 이건 «기록층» 이다. 경보(메일·푸시)는 여기 없다 — 정전 구간을 분 단위로 남길 뿐이다.
--       .github/workflows/uptime.yml 은 GitHub 스케줄이 이 리포에서 1~4시간씩 밀려
--       경보 목적을 못 이룬다(external-cron 실측). 경보층 선택은 Node 판정 대기 중.
-- ② builder-watch: .github/workflows/external-cron.yml 의 세 잡 중 «유일한 생존자» 였다.
--    나머지 둘(pr-monitor · alert-time-based)은 라우트가 이미 없어져 404 를 치고 있었고,
--    그 워크플로는 이 커밋에서 삭제된다. 살아 있는 잡만 pg_cron 으로 옮겼다.
--    ⛔ 스케줄을 «그대로» 옮겼다(0 21 * * *) — 이관은 시각을 바꾸는 자리가 아니다.
--    ⚠️ 호출은 _call_vercel_cron 을 쓴다. 리포 규약상 크론 호출은 이 헬퍼로 통일돼 있고
--       (Vault 시크릿·이중 헤더·쿼리스트링·290초) curl+CRON_SECRET 직타는 금지다.
--
-- ── 기록층의 수확 방식 (읽는 사람이 헷갈리는 자리) ───────────────────────────
-- net.http_get 은 «비동기» 다. 요청을 걸면 req_id 만 즉시 돌려주고 응답은 나중에
-- net._http_response 에 들어온다. 그래서 이 함수는 «먼저 직전 회차의 응답을 거두고»
-- 그다음에 새 요청을 건다. 즉 마지막 행의 status_code 는 항상 NULL 이고,
-- 다음 회전(5분 뒤)에 채워진다 — 그것이 결함이 아니라 설계다.
-- 실측(2026-09-07 07:15Z): 2행 중 1행 회수, status_code=200.

-- ── ① 기록 테이블 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_uptime_log (
  req_id       bigint                   NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  status_code  integer,
  timed_out    boolean,
  error_msg    text,
  checked_at   timestamp with time zone,
  CONSTRAINT site_uptime_log_pkey PRIMARY KEY (req_id)
);

-- ⛔ RLS 켜고 «정책은 만들지 않는다» — 서버(service_role) 전용 표다.
--    anon·authenticated 는 0행을 받고 service_role 은 우회한다. 그것이 맞는 상태다.
--    나중에 「0행이 나온다」고 허용 정책을 붙이지 말 것(20260907_rls_backup_tables.sql 과 같은 규율).
ALTER TABLE public.site_uptime_log ENABLE ROW LEVEL SECURITY;

-- ── ② 프로브 함수 ────────────────────────────────────────────────────────────
-- ⚠️ SET search_path = public 은 오늘 기준 규율이다(SECURITY DEFINER 미고정 감사 참조).
CREATE OR REPLACE FUNCTION public.site_uptime_probe()
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint;
BEGIN
  UPDATE public.site_uptime_log l SET status_code = r.status_code, timed_out = r.timed_out, error_msg = r.error_msg, checked_at = now()
  FROM net._http_response r WHERE l.req_id = r.id AND l.checked_at IS NULL;
  SELECT net.http_get(url := 'https://kadeora.app/', headers := jsonb_build_object('User-Agent','pg_cron/kadeora-uptime'), timeout_milliseconds := 15000) INTO v_id;
  INSERT INTO public.site_uptime_log (req_id) VALUES (v_id);
  RETURN v_id;
END; $function$;

-- ── ③ 스케줄 2건 ─────────────────────────────────────────────────────────────
-- 집행 결과(2026-09-07 실측): jobid 173 site-uptime-probe · jobid 174 builder-watch-hanwoong, 둘 다 active.
-- ⛔ 재실행하면 «중복 잡» 이 생긴다. cron.schedule 은 같은 이름이면 갱신하지만,
--    이 파일은 애초에 실행 대상이 아니다.
--
--   SELECT cron.schedule('site-uptime-probe', '*/5 * * * *',
--                        $$SELECT public.site_uptime_probe()$$);
--
--   SELECT cron.schedule('builder-watch-hanwoong', '0 21 * * *',
--                        $$SELECT public._call_vercel_cron('/api/admin/builder-watch?builder=hanwoong', 300000)$$);
