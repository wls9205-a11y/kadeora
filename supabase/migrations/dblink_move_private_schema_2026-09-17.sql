-- dblink 임시 완화(티켓 전) — 적용: MCP apply_migration dblink_move_private_schema_attempt_2026_09_17
-- 배경: dblink 41종(확장 소유 supabase_admin) 중 39종이 public 스키마에서 anon·authenticated EXECUTE 개방 — DB발 아웃바운드 시도 경로.
-- 1차 시도(객체 REVOKE): 39발 «무오류» 였지만 grantor 가 supabase_admin 이라 postgres 의 REVOKE 는 무효 — 말미 단언(open_after=39)이 잡아 전체 롤백.
-- ⚠️ usage 레벨 차단(anon 의 public USAGE 회수)은 PostgREST anon 전체를 죽이므로 기각.
-- 2차(이 파일): anon·authenticated USAGE 없는 전용 스키마로 확장 이동 — 성공. 사용처 0(앱·함수·cron) 실측 후.
-- 결과(적용 후 조회): public 0 · ext_private 41 · anon/authenticated/service_role USAGE false. 라이브 / · dsr-calc · /apt 200.
-- 티켓: 객체 권한 자체는 남아 있다(스키마 USAGE 로 막힘). 정석 회수(grantor=supabase_admin)는 지원 요청.
CREATE SCHEMA IF NOT EXISTS ext_private;
REVOKE ALL ON SCHEMA ext_private FROM PUBLIC, anon, authenticated;
ALTER EXTENSION dblink SET SCHEMA ext_private;
