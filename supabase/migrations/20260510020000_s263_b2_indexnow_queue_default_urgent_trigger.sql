-- s263 Phase 2.3.b — indexnow_queue BEFORE INSERT default urgent trigger.
-- Defense in depth: RPC level NULL safety (17f917b5) + DB level trigger.
-- IDEMPOTENT (DROP IF EXISTS) + REVERSIBLE.
--
-- 증거: postgres 로그 매 시간 "null value in column is_urgent of relation
-- indexnow_queue violates not-null constraint"
-- 원인: enqueue_indexnow(p_url, p_urgent DEFAULT false) caller 가 NULL 명시
--       전달 시 DEFAULT 무효 (trigger 가 (NEW.cron_type IN (...)) 결과를
--       p_urgent 로 전달 → cron_type NULL 시 NULL IN (...) = NULL boolean 아님).
-- 해결: BEFORE INSERT trigger 가 NEW.is_urgent IS NULL → false 보정.
--       RPC 우회 INSERT 경로 (직접 SQL, 외부 client, 미래 RPC 등) 모두 cover.
--
-- DOWN:
--   DROP TRIGGER IF EXISTS trg_indexnow_queue_default_urgent ON public.indexnow_queue;
--   DROP FUNCTION IF EXISTS public.fn_indexnow_queue_default_urgent();

DROP TRIGGER IF EXISTS trg_indexnow_queue_default_urgent ON public.indexnow_queue;

CREATE OR REPLACE FUNCTION public.fn_indexnow_queue_default_urgent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.is_urgent IS NULL THEN
    NEW.is_urgent := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_indexnow_queue_default_urgent
BEFORE INSERT ON public.indexnow_queue
FOR EACH ROW
EXECUTE FUNCTION public.fn_indexnow_queue_default_urgent();
