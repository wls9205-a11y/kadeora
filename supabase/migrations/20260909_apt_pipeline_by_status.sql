-- DS2 ⑤′ — get_apt_pipeline 이 «단계별 내역» 을 함께 낸다 (2026-09-09).
--
-- ── 왜 RPC 가 쪼개는가 ──────────────────────────────────────────────────────
-- 히어로에 「공고 전 N · 공사중 M」 2지표를 올리기로 했는데, 프론트에서 total 에서
-- 착공을 빼는 식으로 만들면 «두 숫자의 분모가 갈린다».
-- 실측이 그 위험을 이미 보여 줬다(2026-09-09):
--     부산 코드상수(게이트 없음) 405  ·  부산 RPC(게이트) 345  ·  부울경 RPC 374
--     전국 착공 742  ·  부산 착공 80
-- 「공고 전 374 · 공사중 742」로 짝지으려던 안은 부울경과 전국을 나란히 놓은 것이었고
-- 부산 히어로 기준 9.3배 과대였다. 게이트 있는 수와 없는 수를 빼는 것도 같은 병이다.
-- ⛔ 그래서 프론트는 산수하지 않는다. 두 숫자는 «같은 문» 에서 나온다.
--
-- ⚠️ by_status 는 scoped 위에서 센다 — 게이트를 통과했고 «페이지네이션 이전» 이다.
--    ranked 위에서 세면 한 쪽(최대 60건)만 세어 조용히 틀린다.
--    그래서 sum(by_status) = total 이 «항상» 성립한다. 이것이 검증 지점이다.
--
-- ⚠️ groups 는 by_status 에서 파생하되 «RPC 안에서» 만든다. 밖으로 내보내 더하게 하면
--    그 순간 분모가 둘이 된다.
--    pre_notice = total - construction (이 RPC 의 scoped 는 정의상 공고 전 7단계뿐이라
--    착공을 빼면 나머지가 전부 「아직 공고 전」이다).
--
-- ⛔ 게이트 조건·정렬 가중치는 «한 글자도» 바꾸지 않았다. 이 변경은 «더 내려보내는» 것뿐이다.
-- ⚠️ 곁가지 하나: 기존 본문에 jsonb_build_object 키 'hero_license_tier' 가 «두 번» 있었다
--    (앞은 미한정, 뒤는 r. 한정). 뒤가 이기므로 값은 같았고 무해했지만, 본문을 다시 쓰는 김에
--    중복만 걷었다. 값 변화 0.
CREATE OR REPLACE FUNCTION public.get_apt_pipeline(p_region text DEFAULT '부울경'::text, p_limit integer DEFAULT 30, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_region text := NULLIF(btrim(coalesce(p_region,'')),'');
  v_limit  int  := least(greatest(coalesce(p_limit,30),1),60);
  v_page   int  := greatest(coalesce(p_page,1),1);
  v_items jsonb; v_total int; v_by_status jsonb; v_construction int;
BEGIN
  IF v_region = '전국' THEN v_region := NULL; END IF;
  WITH scoped AS (
    SELECT s.* FROM apt_sites s
    WHERE s.is_active
      AND NOT EXISTS (SELECT 1 FROM apt_subscriptions x WHERE x.house_nm = s.name)
      AND ( v_region IS NULL
            OR (v_region = '부울경' AND s.region IN ('부산','울산','경남'))
            OR s.region = v_region )
      AND s.lifecycle_stage IN ('site_planning','pre_announcement','union_established',
                                'constructor_selected','plan_approved','mgmt_approved','construction')
      -- ⚠️ event_type 을 가린다. active_change(T2 2부)가 「진행 이력」으로 새면
      --    게이트가 조용히 헐거워진다.
      AND ( (EXISTS (SELECT 1 FROM apt_site_events e
                      WHERE e.site_id = s.id AND e.event_type = 'stage_change'))::int
          + (NULLIF(btrim(coalesce(s.builder,'')),'') IS NOT NULL)::int
          + (coalesce(s.supply_units, s.complex_units, s.total_units) IS NOT NULL)::int
          + (NULLIF(btrim(coalesce(s.sigungu,'')),'') IS NOT NULL)::int ) >= 2
  ),
  counted AS (SELECT count(*)::int AS n FROM scoped),
  -- 단계별 내역. scoped 위 = 게이트 통과 · 페이지 이전이라 합이 total 과 «반드시» 같다.
  by_stage AS (
    SELECT sc.lifecycle_stage AS stage, count(*)::int AS n
    FROM scoped sc GROUP BY sc.lifecycle_stage
  ),
  ranked AS (
    SELECT sc.*, CASE sc.lifecycle_stage
        WHEN 'construction' THEN 0 WHEN 'mgmt_approved' THEN 1 WHEN 'plan_approved' THEN 2
        WHEN 'constructor_selected' THEN 3 WHEN 'pre_announcement' THEN 4
        WHEN 'union_established' THEN 5 ELSE 6 END AS weight
    FROM scoped sc
    ORDER BY weight, sc.stage_updated_at DESC NULLS LAST, sc.content_score DESC NULLS LAST
    OFFSET (v_page - 1) * v_limit LIMIT v_limit
  )
  SELECT (SELECT n FROM counted),
         (SELECT coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) FROM by_stage),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'house_nm', r.name, 'site_slug', r.slug,
           'display_name', r.display_name,
           'region_nm', r.region, 'supply_addr', concat_ws(' ', r.region, r.sigungu, r.dong),
           'households', coalesce(r.supply_units, r.complex_units, r.total_units),
           'supply_units', r.supply_units, 'complex_units', r.complex_units,
           'builder', r.builder,
           -- hero → 카드 → 위성. 카드가 위성보다 앞선다.
           'hero_license_tier', r.hero_license_tier,
           'thumb_url', coalesce(r.hero_image_url, r.card_image_url, '/api/og-apt?slug=' || r.slug || '&ratio=1x1&card=1'),
           'satellite_url', r.satellite_image_url,   -- 지도용으로 따로 내려준다
           'status', r.lifecycle_stage, 'previous_stage', r.previous_stage,
           'stage_updated_at', r.stage_updated_at,
           'confidence', coalesce(r.confidence,'confirmed'), 'weight', r.weight,
           'dday', NULL, 'rcept_bgnde', NULL, 'rcept_endde', NULL,
           'price_per_pyeong', NULL, 'competition_rate', NULL, 'pblanc_url', NULL
         ) ORDER BY r.weight, r.stage_updated_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_total, v_by_status, v_items FROM ranked r;

  v_construction := coalesce((v_by_status->>'construction')::int, 0);

  RETURN jsonb_build_object('region', coalesce(v_region,'전국'),
    'page', v_page, 'page_size', v_limit, 'total', coalesce(v_total,0),
    'total_pages', CASE WHEN coalesce(v_total,0)=0 THEN 0 ELSE ceil(v_total::numeric/v_limit)::int END,
    'gated', true, 'thumb_mode', 'card_before_satellite',
    'by_status', coalesce(v_by_status, '{}'::jsonb),
    -- 히어로 2지표. ⛔ 프론트에서 빼지 말 것 — 그러면 분모가 둘이 된다.
    'groups', jsonb_build_object(
      'pre_notice', coalesce(v_total,0) - v_construction,
      'construction', v_construction),
    'items', v_items);
END;
$function$;
