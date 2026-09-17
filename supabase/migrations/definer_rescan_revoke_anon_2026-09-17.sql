-- definer × (anon·authenticated EXECUTE) 재스캔 1발 (세션 A 판정 2026-09-17 — 9/7 이후 구멍 생존이 재스캔 사유)
-- 적용: MCP apply_migration definer_rescan_revoke_anon_2026_09_17
--
-- 실측 1: 9/7 감사(최종지시서_AD §9)의 범위는 «search_path 미고정 definer» 였다. EXECUTE 노출은 그 감사 밖이었다.
-- 실측 2: 구조 원인 — pg_default_acl(public, 함수, owner postgres·supabase_admin)이 새 함수마다
--          anon·authenticated EXECUTE 를 자동 부여한다. 감사 이후 태어난 함수는 감사 결론을 상속하지 않는다.
-- 실측 3: promote_* 는 8/24 첫 생성 때 revoke 가 있었으나 같은 날 재생성(034500)으로 다시 열렸다.
-- 실측 4: capture_db_activity · get_social_proof_counts 는 schema_migrations 에 없다 — 원장 밖 DDL.
--
-- 이번에 닫은 5종 = 앱 호출자 0(git grep) · 호출자는 pg_cron(postgres) 뿐 · 쓰기 또는 중작업:
--   capture_db_activity(text)            9/16 · 동시 캡처 표에 anon 이 무한 적재 가능
--   promote_busan_redev_to_sites(bool)   8/24 · apt_sites 승격 — anon 이 현장 행을 만들 수 있었다
--   promote_redev_to_sites(text,text,bool) 8/24 · 동상(소스 일반화판)
--   sync_complex_profiles_guarded()      8/31 · 중작업 — 어제 워커 슬롯 기아와 같은 경로의 외부 발화점
--   fn_llm_silence_watch()               9/8  · 경보 적재
-- 남긴 것(설계상 anon 공개): increment_* 카운터 · log_search* · fn_insert_lead · get_* 읽기 RPC ·
--   트리거 함수(RETURNS trigger 라 /rpc 호출 불가) · auth.uid() 가드 보유 함수.
REVOKE ALL ON FUNCTION public.capture_db_activity(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_busan_redev_to_sites(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_redev_to_sites(text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_complex_profiles_guarded() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_llm_silence_watch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_db_activity(text), public.promote_busan_redev_to_sites(boolean),
  public.promote_redev_to_sites(text, text, boolean), public.sync_complex_profiles_guarded(), public.fn_llm_silence_watch()
  TO service_role;
