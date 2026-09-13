-- FINAL_HC_20260913 A-1 — get_apt_archive 42703 수리 (2026-09-13).
--
-- ── 증상 ────────────────────────────────────────────────────────────────────
-- Vercel 48h `[apt/archive] rpc error … column "hero_license_tier" does not exist` 228회
-- (first 8/25). archive.ts 가 EMPTY_ARCHIVE 로 폴백해 /apt/archive 가 «빈 200» 으로 렌더됐다.
--
-- ── 원인 (실물 기준 — 지시서 정정 포함) ───────────────────────────────────────
-- jsonb_build_object 안에 'hero_license_tier' 키가 두 번 있었다:
--     'hero_license_tier', hero_license_tier,        ← 미한정 참조 (스코프에 없음 → 42703)
--     'hero_license_tier', site.hero_license_tier,   ← 한정본
-- ⚠️ 그런데 한정본도 그대로는 산다가 아니다. LATERAL site 서브쿼리의 SELECT 목록에
--    hero_license_tier 가 없었다. 미한정 줄만 지우면 다음 실행에서 site.hero_license_tier 가
--    같은 42703 을 낸다. 그래서 수리는 두 줄이다:
--     ① 미한정 키 제거 (키 1회만)
--     ② LATERAL SELECT 에 a.hero_license_tier 추가
-- 19272038(9/9) 이 get_apt_pipeline 에서 같은 모양을 걷었으나 archive 는 누락이었다.
--
-- 이 파일 이전에는 get_apt_archive 정의가 리포에 없었다(대시보드 직접 적용분).
-- 본문 전체를 동봉해 정본으로 삼는다. 위 두 줄 외 로직 무접촉 — pg_get_functiondef 원문 그대로.

CREATE OR REPLACE FUNCTION public.get_apt_archive(p_region text DEFAULT '전국'::text, p_year integer DEFAULT NULL::integer, p_sort text DEFAULT 'recent'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_region text := NULLIF(btrim(coalesce(p_region,'')),'');
  v_size int := least(greatest(coalesce(p_page_size,20),1),50);
  v_page int := greatest(coalesce(p_page,1),1);
  v_sort text := lower(coalesce(p_sort,'recent'));
  v_total int; v_items jsonb; v_years jsonb;
BEGIN
  IF v_region IS NULL OR v_region = '전국' THEN v_region := NULL; END IF;
  IF v_sort NOT IN ('recent','competition','households') THEN v_sort := 'recent'; END IF;

  SELECT jsonb_agg(jsonb_build_object('year', y, 'cnt', n) ORDER BY y DESC) INTO v_years
  FROM (SELECT extract(year FROM s.rcept_endde)::int AS y, count(*) AS n
        FROM apt_subscriptions s
        WHERE s.rcept_endde IS NOT NULL AND s.rcept_endde < v_today
          AND (v_region IS NULL OR s.region_nm = v_region)
        GROUP BY 1) t;

  SELECT count(*)::int INTO v_total
  FROM apt_subscriptions s
  WHERE s.rcept_endde IS NOT NULL AND s.rcept_endde < v_today
    AND (v_region IS NULL OR s.region_nm = v_region)
    AND (p_year IS NULL OR extract(year FROM s.rcept_endde)::int = p_year);

  WITH page_rows AS (
    SELECT s.id, s.house_manage_no, s.house_nm, s.region_nm, s.supply_addr,
           s.tot_supply_hshld_co, s.price_per_pyeong, s.price_per_pyeong_avg, s.price_per_pyeong_min,
           s.rcept_bgnde, s.rcept_endde, s.przwner_presnatn_de,
           s.competition_rate_1st, s.total_apply_count, s.pblanc_url, s.constructor_nm
    FROM apt_subscriptions s
    WHERE s.rcept_endde IS NOT NULL AND s.rcept_endde < v_today
      AND (v_region IS NULL OR s.region_nm = v_region)
      AND (p_year IS NULL OR extract(year FROM s.rcept_endde)::int = p_year)
    ORDER BY
      CASE WHEN v_sort='recent'      THEN s.rcept_endde END DESC NULLS LAST,
      CASE WHEN v_sort='competition' THEN s.competition_rate_1st END DESC NULLS LAST,
      CASE WHEN v_sort='households'  THEN s.tot_supply_hshld_co END DESC NULLS LAST,
      s.rcept_endde DESC NULLS LAST, s.id
    OFFSET (v_page - 1) * v_size LIMIT v_size
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'house_manage_no', r.house_manage_no, 'house_nm', r.house_nm,
      'region_nm', r.region_nm, 'supply_addr', r.supply_addr,
      'households', r.tot_supply_hshld_co,
      'price_per_pyeong', coalesce(r.price_per_pyeong, r.price_per_pyeong_avg, r.price_per_pyeong_min),
      'rcept_bgnde', r.rcept_bgnde, 'rcept_endde', r.rcept_endde,
      'przwner_presnatn_de', r.przwner_presnatn_de,
      'competition_rate', r.competition_rate_1st, 'total_applicants', r.total_apply_count,
      'pblanc_url', r.pblanc_url,
      'site_slug', site.slug,
      'hero_license_tier', site.hero_license_tier, 'thumb_url', coalesce(site.hero_image_url, case when site.lifecycle_stage in ('post_move_in','landmark_active') then site.satellite_image_url else null end, site.card_image_url, '/api/og-apt?slug=' || site.slug || '&ratio=1x1&card=1'),
      'builder', coalesce(NULLIF(btrim(coalesce(r.constructor_nm,'')),''), site.builder),
      'status', 'closed')), '[]'::jsonb)
  INTO v_items
  FROM page_rows r
  LEFT JOIN LATERAL (
    SELECT a.slug, a.hero_image_url, a.card_image_url, a.satellite_image_url, a.lifecycle_stage, a.builder, a.hero_license_tier
    FROM apt_sites a WHERE a.name = r.house_nm
    ORDER BY a.content_score DESC NULLS LAST LIMIT 1
  ) site ON true;

  RETURN jsonb_build_object(
    'region', coalesce(v_region,'전국'), 'year', p_year, 'sort', v_sort,
    'page', v_page, 'page_size', v_size, 'total', coalesce(v_total,0),
    'total_pages', CASE WHEN coalesce(v_total,0)=0 THEN 0 ELSE ceil(v_total::numeric/v_size)::int END,
    'years', coalesce(v_years,'[]'::jsonb), 'items', v_items);
END;
$function$;
