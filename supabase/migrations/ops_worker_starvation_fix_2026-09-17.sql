-- 2026-09-16 장애 근본 수리 — 워커 슬롯 기아 (2026-09-17)
--
-- ── 인과 사슬 (전부 실측) ───────────────────────────────────────────────
--   /api/stats/social-proof 가 요청마다 exact count 7발을 쐈다.
--     그중 apt_rent_transactions 240만 행 · apt_transactions 80만 행.
--   exact count 는 전체 스캔이라 플래너가 「Workers Planned: 2」를 붙인다.
--   max_worker_processes = 6 인 인스턴스에서 그 워커들이 슬롯을 먹자
--     → pg_cron 이 background worker 를 fork 하지 못함 ("job startup timeout")
--     → job 47 = kill-slow-queries «도» 못 뜸 (방어 장치 붕괴·루프 폐쇄)
--     → 느린 질의 누적 → statement timeout 폭증 → 프로덕션 504
--   ⚠️ 실패는 전부 «시작조차 못 함» 이었다. 단 한 건도 「실행 후 실패」가 아니다 — 잡은 피해자다.
--   ⚠️ 커넥션은 무죄였다(19~40 / max 90 · long_active 0). 고갈된 것은 «워커 슬롯» 이다.
--
-- ── 역할 판별 (표적을 틀릴 뻔한 자리) ──────────────────────────────────
--   로그의 parsed.user_name 은 «로그인 역할»(authenticator)만 보여 준다.
--   실제 실행 역할은 위임된 service_role 이었고, 그 증거가 «지속시간» 이다:
--     authenticator/anon/authenticated statement_timeout = 8s
--     service_role                     statement_timeout = 25s
--     로그의 최대 지속시간 = 24.6s  ← 25초 컷 «바로 아래»
--   authenticator 단독 ALTER 였으면 범인을 못 건드렸다. 네 역할 전부에 건다.
--
-- ⛔ max_worker_processes 증설은 오답이다 — 2GB 인스턴스에서 워커를 늘리면
--    메모리 커밋 벽과 맞교환이 된다. 슬롯을 늘리지 말고 «쓰지 않게» 한다.
ALTER ROLE service_role  SET max_parallel_workers_per_gather = 0;
ALTER ROLE authenticator SET max_parallel_workers_per_gather = 0;
ALTER ROLE authenticated SET max_parallel_workers_per_gather = 0;
ALTER ROLE anon          SET max_parallel_workers_per_gather = 0;

-- ── 부하원 제거 (진짜 종결) ────────────────────────────────────────────
-- 위 ALTER 는 지혈이다. 단일 스레드가 되면 카운트 «하나» 는 오히려 느려지고 점유가 길어진다.
-- 재발 경로를 닫는 것은 「대형 표를 핫패스에서 세지 않는 것」이다.
--
-- ⚠️ 소셜프루프는 «정의상 정밀이 필요 없다». 「240만+」를 보여주는 자리에 240만 행을
--    매 요청 정확히 세는 것은 근거가 없다.
-- ⚠️ reltuples 는 ANALYZE 이후 변동을 반영하지 않아 약간 과소할 수 있다(실측 −1.7%).
--    한 번도 분석되지 않은 표는 -1 을 주므로 그때는 NULL 을 돌려준다 —
--    0 으로 때우면 「데이터가 없다」는 전혀 다른 뜻이 된다.
-- ⚠️ profiles(실유저)만 exact 로 남긴다. 작은 표이고 조건이 붙으며 의미상 정확해야 한다.
CREATE OR REPLACE FUNCTION get_social_proof_counts()
RETURNS TABLE (
  stock_count bigint, complex_count bigint, subscription_count bigint,
  trade_count bigint, rent_count bigint, price_history_count bigint, user_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  SELECT
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.stock_quotes'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_complex_profiles'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_subscriptions'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_transactions'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.apt_rent_transactions'::regclass),
    (SELECT nullif(reltuples, -1)::bigint FROM pg_class WHERE oid = 'public.stock_price_history'::regclass),
    (SELECT count(*) FROM profiles WHERE coalesce(is_seed,false) = false AND coalesce(is_deleted,false) = false);
$fn$;

GRANT EXECUTE ON FUNCTION get_social_proof_counts() TO service_role, authenticated, anon;
