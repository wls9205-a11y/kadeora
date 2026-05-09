-- s263 Phase 2.3 — enqueue_indexnow RPC NULL safety.
-- IDEMPOTENT (CREATE OR REPLACE) + REVERSIBLE.
--
-- Root cause: trigger_enqueue_indexnow_on_publish 가
--   `(NEW.cron_type IN ('issue_preempt','big_event'))` 를 p_urgent 로 전달.
--   NEW.cron_type 이 NULL 이면 `NULL IN (...)` = NULL → p_urgent NULL → INSERT
--   indexnow_queue.is_urgent (NOT NULL) 제약 위반 → 매 시간 INSERT 실패.
--
-- Fix: RPC 안에서 COALESCE(p_urgent, false). 모든 호출자 영향 (단일 변경).
-- 다른 옵션 (trigger 자체 fix) 도 가능하지만 RPC 가 single source of truth.
--
-- DOWN:
--   ALTER FUNCTION public.enqueue_indexnow(text, boolean, text) RESET ALL;
--   (옛 정의 복원은 git 이력 참조)

CREATE OR REPLACE FUNCTION public.enqueue_indexnow(
  p_url text,
  p_urgent boolean DEFAULT false,
  p_source text DEFAULT 'manual'::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id BIGINT;
  v_urgent BOOLEAN := COALESCE(p_urgent, false);
BEGIN
  IF EXISTS (SELECT 1 FROM indexnow_queue WHERE url = p_url AND status = 'pending') THEN
    RETURN NULL;
  END IF;

  INSERT INTO indexnow_queue (url, priority, is_urgent, source)
  VALUES (p_url,
    CASE WHEN v_urgent THEN 1 ELSE 5 END,
    v_urgent,
    p_source)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
