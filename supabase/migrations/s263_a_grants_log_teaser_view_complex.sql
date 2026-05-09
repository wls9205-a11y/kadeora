-- s263 Phase 1.1 — production 클라이언트가 호출하는데 GRANT 누락된 4건 보충.
-- 증거: postgres 로그 매 분 "permission denied for ..." burst (적용 18:46:20 KST 까지 진행).
-- 원인: Supabase Phase 4 Track 4 보안 강화 후 PUBLIC default GRANT 무효 → authenticated/anon 명시 GRANT 누락.
-- IDEMPOTENT (GRANT 는 멱등) + REVERSIBLE (REVOKE 가능).
-- DOWN:
--   REVOKE EXECUTE ON FUNCTION public.get_my_access_level() FROM authenticated, anon;
--   REVOKE EXECUTE ON FUNCTION public.log_teaser_debug(text, text, jsonb) FROM authenticated, anon;
--   REVOKE SELECT  ON public.v_complex_region_stats FROM authenticated, anon;
--   REVOKE SELECT  ON public.v_complex_age_stats    FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION public.get_my_access_level() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_teaser_debug(text, text, jsonb) TO authenticated, anon;
GRANT SELECT  ON public.v_complex_region_stats TO authenticated, anon;
GRANT SELECT  ON public.v_complex_age_stats    TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
