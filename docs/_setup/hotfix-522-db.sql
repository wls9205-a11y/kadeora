-- ============================================================================
-- hotfix-522-db.sql  —  522/커넥션풀 포화 대응 중 "DB 접속 불가"로 앱 측에서
--                       적용하지 못한 DB 작업. claude.ai(DB 담당)가 검토 후 적용.
--
--   생성: 2026-07-18  (프로덕션 전면 522 대응 세션)
--   전제: max_connections = 90, PgBouncer(transaction pooling).
--   ⚠️ 아래 함수는 DB 접속 불가 상태에서 작성 → 미검증. 적용 전 반드시
--      실제 스키마(컬럼명/타입)와 대조하고 EXPLAIN 로 인덱스 확인할 것.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- [5] statement_timeout  <  함수 maxDuration  (orphan 커넥션 방지)
--
--   문제: SSR 라우트는 vercel maxDuration=30s 에 죽지만, 그 함수가 띄운 SQL 은
--         statement_timeout 이 없으면(또는 길면) 계속 살아 pooler 커넥션을 물어
--         orphan 이 됨 → 풀 잠식 → 522.
--   해결: request-path 롤(anon/authenticated)의 statement_timeout 을 함수
--         타임아웃(30s)보다 짧게. 크론/admin(service_role, maxDuration≤300)은 길게.
--   주의: ALTER ROLE 은 "새 세션"부터 적용. PgBouncer 풀의 기존 서버 커넥션은
--         재접속(또는 pool restart) 전까지 이전 값 유지.
-- ────────────────────────────────────────────────────────────────────────────
ALTER ROLE anon          SET statement_timeout = '12s';
ALTER ROLE authenticated SET statement_timeout = '12s';
ALTER ROLE service_role  SET statement_timeout = '120s';   -- 크론 롱쿼리 보존
-- 적용 확인:
--   SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
-- 기존 pooler 커넥션 즉시 반영이 필요하면 Supabase 대시보드에서 pooler restart.


-- ────────────────────────────────────────────────────────────────────────────
-- [1] apt/[id] 상세 페이지 fan-out 통합 RPC
--
--   현재 src/app/(main)/apt/[id]/page.tsx 는 렌더당 최대 11+ 쿼리(8-wide allSettled
--   포함)를 발사. 앱 측에서 4+4 웨이브로 peak 를 절반으로 낮춰 두었으나(핫픽스),
--   근본 해결은 단일 RPC 1회 왕복으로 통합하는 것.
--
--   적용 후 page.tsx 의 2개 allSettled 웨이브를:
--     const { data: bundle } = await (sb as any).rpc('get_apt_detail_bundle', {
--       p_name, p_region, p_slug, p_sigungu, p_builder, p_term_blog, p_term_post, p_r_short
--     });
--   1회 호출로 대체. (bundle.trades / .related_blogs / .related_posts / .nearby_sites
--    / .same_builder / .region_prices / .region_trades / .complex_profiles)
--
--   ⚠️ 파라미터 sanitize(길이≥3 등)는 앱에서 이미 수행 → 여기선 빈 문자열 = 스킵.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_apt_detail_bundle(
  p_name       text,
  p_region     text,
  p_slug       text,
  p_sigungu    text,           -- '' 이면 시군구 기반 쿼리 스킵
  p_builder    text,           -- '' 이면 시공사 기반 쿼리 스킵
  p_term_blog  text,           -- '' 이면 블로그 쿼리 스킵
  p_term_post  text,           -- '' 이면 커뮤니티 쿼리 스킵
  p_r_short    text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'trades', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT id, apt_name, deal_date, deal_amount, exclusive_area, floor, built_year
        FROM apt_transactions
        WHERE apt_name = p_name
        ORDER BY deal_date DESC
        LIMIT 30
      ) t), '[]'::jsonb),

    'related_blogs', CASE WHEN p_term_blog = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(b) FROM (
        SELECT slug, title, view_count, published_at
        FROM blog_posts
        WHERE is_published = true
          AND (title ILIKE '%'||p_term_blog||'%'
            OR title ILIKE '%'||p_r_short||' 청약%'
            OR title ILIKE '%'||p_r_short||' 부동산%')
        ORDER BY view_count DESC
        LIMIT 5
      ) b), '[]'::jsonb) END,

    'related_posts', CASE WHEN p_term_post = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(p) FROM (
        SELECT id, title, created_at, comments_count
        FROM posts
        WHERE is_deleted = false AND title ILIKE '%'||p_term_post||'%'
        ORDER BY created_at DESC
        LIMIT 3
      ) p), '[]'::jsonb) END,

    'nearby_sites', CASE WHEN p_region = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(n) FROM (
        SELECT slug, name, site_type, region, sigungu, total_units, status
        FROM apt_sites
        WHERE is_active = true AND region = p_region AND slug <> p_slug
          AND content_score >= 25
        ORDER BY interest_count DESC
        LIMIT 4
      ) n), '[]'::jsonb) END,

    'same_builder', CASE WHEN p_builder = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(s) FROM (
        SELECT id, house_nm, region_nm, tot_supply_hshld_co, rcept_bgnde, house_type_info
        FROM apt_subscriptions
        WHERE constructor_nm ILIKE '%'||p_builder||'%' AND house_nm <> p_name
        ORDER BY rcept_bgnde DESC
        LIMIT 5
      ) s), '[]'::jsonb) END,

    'region_prices', CASE WHEN p_region = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(r) FROM (
        SELECT price_min, price_max
        FROM apt_sites
        WHERE region = p_region AND is_active = true AND price_min > 0 AND price_max > 0
        LIMIT 100
      ) r), '[]'::jsonb) END,

    'region_trades', CASE WHEN p_sigungu = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(rt) FROM (
        SELECT apt_name, deal_date, deal_amount, exclusive_area, floor
        FROM apt_transactions
        WHERE sigungu ILIKE '%'||p_sigungu||'%' AND apt_name <> p_name
        ORDER BY deal_date DESC
        LIMIT 10
      ) rt), '[]'::jsonb) END,

    'complex_profiles', CASE WHEN p_sigungu = '' THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(c) FROM (
        SELECT apt_name, built_year, latest_sale_price, avg_sale_price_pyeong,
               latest_jeonse_price, jeonse_ratio, total_households, price_change_1y, sale_count_1y
        FROM apt_complex_profiles
        WHERE sigungu ILIKE '%'||p_sigungu||'%' AND latest_sale_price > 0
        ORDER BY latest_sale_price DESC
        LIMIT 10
      ) c), '[]'::jsonb) END
  );
$$;

GRANT EXECUTE ON FUNCTION get_apt_detail_bundle(text,text,text,text,text,text,text,text)
  TO anon, authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- [2 보강] daily-report 구별 시세 — JS 집계(limit 2000, 핫픽스로 축소) 대신
--          DB-side GROUP BY 로 전환하면 request-path 전송량/커넥션 홀드를 최소화.
--          (선택 사항 — 앱은 limit(2000) 로 이미 완화됨)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_daily_gu_prices(p_region text)
RETURNS TABLE(sigungu text, sale numeric, jeonse numeric, jeonse_ratio int, cnt bigint, max_sale numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sigungu,
    round(avg(latest_sale_price))                                          AS sale,
    round(avg(COALESCE(latest_jeonse_price, 0)))                           AS jeonse,
    CASE WHEN avg(latest_sale_price) > 0
         THEN round(avg(COALESCE(latest_jeonse_price,0)) * 100 / avg(latest_sale_price))::int
         ELSE 0 END                                                        AS jeonse_ratio,
    count(*)                                                               AS cnt,
    max(latest_sale_price)                                                 AS max_sale
  FROM apt_complex_profiles
  WHERE region_nm = p_region AND latest_sale_price > 0 AND sigungu IS NOT NULL
  GROUP BY sigungu
  ORDER BY sale DESC;
$$;

GRANT EXECUTE ON FUNCTION get_daily_gu_prices(text) TO anon, authenticated, service_role;
