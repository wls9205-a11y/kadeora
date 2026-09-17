-- B3 ⑴⑵ 기본권한 REVOKE (2026-09-17)
-- 배경: pg_default_acl(public · 함수)이 새 함수마다 anon·authenticated EXECUTE 를 자동 부여했다(실측).
--   적용 전: owner=postgres     public f {postgres=X, anon=X, authenticated=X, service_role=X}
--            owner=supabase_admin public f {postgres=X, anon=X, authenticated=X, service_role=X}
--   오늘 20260917034024(f743cad6) 에서 5종만 개별 revoke 했다 — 구조 원인은 이 기본값이다.
-- 이력: schema_migrations 에 ALTER DEFAULT PRIVILEGES 선례 없음(20260510081647 은 이름만 default_privileges, 개별 REVOKE).
--
-- ⚠️ PUBLIC 누락 금지 — anon·authenticated 는 PUBLIC 멤버라 PUBLIC 이 열려 있으면 그대로 실행된다.
-- ⚠️ service_role 기본 부여는 유지한다(서버 경로·크론 RPC 는 service_role).
-- ⚠️ 이후 공개 RPC 는 생성 커밋에 GRANT EXECUTE 를 동봉한다(docs/RULES.md).

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ⛔ 위 한 줄만으로는 닫히지 않는다(1차 적용 시 probe 단언이 잡아 전체 롤백됨 · 실측).
--    스키마별 기본권한은 «전역 기본값에 더해질 뿐» 이고, 함수의 전역 기본값은 PUBLIC=X 다.
--    그래서 새 함수 ACL 이 {=X/postgres, postgres=X, service_role=X} 로 태어나 anon 이 PUBLIC 경유로 실행했다.
--    전역(스키마 미지정) 기본값에서 PUBLIC 을 걷어야 닫힌다. 영향: postgres 가 이후 만드는 «모든 스키마» 함수가
--    PUBLIC 없이 태어난다 — 공개가 필요한 함수는 GRANT 를 동봉한다(RULES).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- supabase_admin 소유 기본값: 실행 역할(postgres)은 supabase_admin 멤버가 아니다 → 권한상 실패 예상.
-- 실패해도 이 마이그레이션 전체를 죽이지 않도록 서브트랜잭션으로 시도만 한다(결과는 적용 후 pg_default_acl 로 판독).
-- 사전 실측(롤백 트랜잭션): SQLSTATE 42501 «permission denied to change default privileges» — 바꿀 수 없다.
--   잔존 위험: supabase_admin 이 public 에 만드는 함수(확장 설치 등)는 계속 anon·authenticated 가 붙는다.
DO $$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
  RAISE NOTICE 'supabase_admin default privileges revoked';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'supabase_admin default privileges: insufficient_privilege (%)', SQLERRM;
END $$;

-- ⑵ 더미 함수로 «새 함수는 닫혀 태어난다» 를 긍정형으로 단언 후 삭제.
CREATE FUNCTION public._b3_default_acl_probe_20260917() RETURNS int LANGUAGE sql AS 'SELECT 1';

DO $$
DECLARE f constant text := 'public._b3_default_acl_probe_20260917()';
BEGIN
  IF has_function_privilege('anon', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'B3 probe: anon EXECUTE 가 여전히 자동 부여됨';
  END IF;
  IF has_function_privilege('authenticated', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'B3 probe: authenticated EXECUTE 가 여전히 자동 부여됨';
  END IF;
  IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'B3 probe: service_role EXECUTE 가 사라짐(의도 아님)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
             WHERE p.oid = f::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'B3 probe: PUBLIC EXECUTE 잔존';
  END IF;
  IF (SELECT count(*) FROM pg_default_acl d, aclexplode(d.defaclacl) a
      WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
        AND d.defaclobjtype = 'f' AND a.grantee IN (0, 'anon'::regrole, 'authenticated'::regrole)) <> 0 THEN
    RAISE EXCEPTION 'B3: postgres 기본권한에 PUBLIC/anon/authenticated 잔존';
  END IF;
END $$;

DROP FUNCTION public._b3_default_acl_probe_20260917();
