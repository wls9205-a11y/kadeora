-- KADEORA v4.0 — 이미 적용된 마이그레이션 (참고용)
-- 이 SQL은 Supabase에 직접 적용 완료됨

-- 신규 테이블: search_logs, view_logs, trending_keywords, user_streaks,
--             content_reports, payments, invite_codes
-- profiles 확장: consent_analytics, consent_updated_at, birth_date,
--                is_ghost, deleted_at, is_deleted, last_active_at
-- RLS: 전체 활성화 + 정책 적용

-- 전체 SQL은 Supabase 마이그레이션 히스토리 참조
