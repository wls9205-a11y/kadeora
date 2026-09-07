-- RLS 미적용 9개 테이블 — 세션 A 직접 집행분 «사후 동봉» (2026-09-07)
--
-- ⛔ 이 파일은 «이미 프로덕션에 적용된» DDL 의 기록이다. 다시 실행하지 않는다.
--    (ENABLE ROW LEVEL SECURITY 는 멱등이라 재실행해도 무해하지만, 실행할 이유가 없다.)
--    리포 동봉 의무 때문에 남긴다 — DB 에만 있고 마이그레이션에 없는 변경은
--    다음 사람이 스키마를 재구성할 때 «조용히 사라진다».
--
-- ── 왜 켰나 ──────────────────────────────────────────────────────────────────
-- 세션 A 실측: public 스키마에 rowsecurity=false 인 표가 9개 있었고, 그 상태에서는
-- anon 키로 PostgREST 를 직접 두드리면 «읽혔다»(true 실측). 백업 스냅샷과 광고 미러라
-- 개인정보는 아니지만, 공개할 이유도 없는 내부 데이터다.
-- ✅ leads · profiles 는 «무결» 이었다 — 이 9개에 들어 있지 않다.
--
-- ── 정책을 «같이» 만들지 않은 것은 의도다 ────────────────────────────────────
-- RLS 만 켜고 정책이 없으면 anon·authenticated 는 0행을 받고, service_role 은
-- RLS 를 우회하므로 그대로 읽고 쓴다. 이 9개는 전부 서버(service_role) 전용이라
-- 그것이 맞는 상태다.
-- ⛔ 나중에 「0행이 나온다」고 허용 정책을 붙이지 말 것 — 그러면 켠 의미가 없어진다.
--    필요한 것은 정책이 아니라 «그 경로가 service_role 인지» 확인이다.
--
-- ── 부수 피해 없음 — 주장이 아니라 두 방향으로 셌다 ──────────────────────────
-- ① 런타임(세션 A): 집행 후 service 경로 정상 — ad_adgroups 44행 그대로 조회됨.
-- ② 코드(2026-09-07 실측): 9개 중 src 에서 참조되는 것은 ad_adgroups 하나뿐이고,
--    그 한 곳(src/app/api/cron/ad-stats-sync/route.ts:183)은 getSupabaseAdmin,
--    즉 service_role 이다. 나머지 8개는 src 참조 0.
--
-- ⚠️ 파일 이름이 backup_tables 지만 9개가 전부 백업은 아니다:
--    · 백업·스냅샷 7 — _s10_fn/_s10_view · apt_cover_backup_h7 ·
--      apt_hero_tier_backup_20260825 · apt_sites_backup_20260825 ·
--      apt_variants_cleanup_backup_20260902 · blog_body_backup_r1
--    · ad_adgroups — 광고그룹 일자별 «미러»(PL C-2)
--    · apt_name_alias_manual — 수기 별칭 1행
--    셋 다 서버 전용이라는 성격은 같다.

ALTER TABLE public._s10_fn_backup_20260823 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._s10_view_backup_20260823 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_adgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apt_cover_backup_h7 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apt_hero_tier_backup_20260825 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apt_name_alias_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apt_sites_backup_20260825 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apt_variants_cleanup_backup_20260902 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_body_backup_r1 ENABLE ROW LEVEL SECURITY;
