-- ═══════════════════════════════════════════════
-- 리텐션 시스템 Phase 2 DB 마이그레이션
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 실행 시점: Phase 2 배포 전
-- ═══════════════════════════════════════════════

-- 1. notification_settings 확장
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS kakao_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS streak_alert boolean DEFAULT true;

-- 2. Quiet Hours 기본값 (NULL → 23:00~07:00)
-- 주의: 기존 NULL인 유저만 업데이트 (이미 설정한 유저는 건드리지 않음)
-- UPDATE notification_settings
-- SET quiet_start = '23:00', quiet_end = '07:00'
-- WHERE quiet_start IS NULL;
-- ↑ 선택사항: 주석 해제하면 전체 유저에게 기본 Quiet Hours 적용

-- 3. push_logs.click_count 증가 RPC
CREATE OR REPLACE FUNCTION increment_push_click(p_log_id bigint)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE push_logs
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = p_log_id;
$$;

-- 4. 확인 쿼리
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'notification_settings'
ORDER BY ordinal_position;
