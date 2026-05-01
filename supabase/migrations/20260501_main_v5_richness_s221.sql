-- s221: get_main_page_data RPC redefine — 카드 정보 풍부화 + s220 컬럼명 mismatch 일괄 fix
--
-- 변경 요약
--   - subscriptions: + feature_tags, move_in_ym (mvn_prearnge_ym), sizes (house_type_info jsonb 파싱)
--   - hot_listings: + move_in_ym (move_in_date), sizes (현재 ARRAY[] — 후속 cron backfill)
--   - subscriptions sub-query: ORDER BY + LIMIT 가 jsonb_agg 외부에 있어 GROUP BY 충돌 → CTE 로 분리
--   - apt_transactions: region → region_nm
--   - unsold_apts: sigungu → sigungu_nm, total_households → tot_supply_hshld_co,
--                  unsold_households → tot_unsold_hshld_co, discount_pct 컬럼 미존재 → null
--   - big_event_registry: region_nm/title/subtitle/cover_image_url/priority/is_active 모두 컬럼명 다름
--                         → big_event 절 비활성화 (NULL → EXPIRING fallback 으로 자동 연결)
--   - blog_posts.summary → excerpt
--   - stock_quotes: is_active 가드 추가
--
-- 채워지지 않은 데이터 (별 sprint cron backfill 대기):
--   - apt_subscriptions.expected_competition / feature_tags
--   - apt_sites.remaining_units / discount_pct
--   - apt_subscriptions.house_type_info 일부 단지 비어 sizes=[]
-- 비어있는 필드는 컴포넌트가 fallback 으로 hidden 처리.

CREATE OR REPLACE FUNCTION get_main_page_data(p_region text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_subscriptions jsonb;
  v_hot_listings jsonb;
  v_transactions jsonb;
  v_unsold jsonb;
  v_redev jsonb;
  v_big_event jsonb;
  v_market_signal jsonb;
  v_construction_stocks jsonb;
  v_briefs jsonb;
BEGIN
  -- 1) subscriptions (s221 enrich)
  WITH picked AS (
    SELECT s.*, site.id AS site_id, site.slug AS site_slug,
           site.price_min AS site_price_min, site.price_max AS site_price_max,
           site.og_image_url AS site_og_image_url
    FROM apt_subscriptions s
    LEFT JOIN apt_sites site
      ON (site.source_ids->>'subscription_id')::bigint = s.id
    WHERE s.rcept_endde IS NOT NULL
      AND s.rcept_endde::date >= v_today
      AND (p_region IS NULL OR s.region_nm ILIKE '%' || p_region || '%')
    ORDER BY s.rcept_endde ASC
    LIMIT 7
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'apt_id', p.site_id,
      'slug', p.site_slug,
      'name', p.house_nm,
      'region', p.region_nm,
      'sigungu', NULLIF(split_part(COALESCE(p.hssply_adres, ''), ' ', 2), ''),
      'builder', p.constructor_nm,
      'total_units', p.tot_supply_hshld_co,
      'price_min', p.site_price_min,
      'price_max', p.site_price_max,
      'rcept_bgnde', p.rcept_bgnde,
      'rcept_endde', p.rcept_endde,
      'dday', GREATEST(0, (p.rcept_endde::date - v_today)),
      'og_image_url', p.site_og_image_url,
      'expected_competition', p.expected_competition,
      'feature_tags', COALESCE(p.feature_tags, ARRAY[]::text[]),
      'move_in_ym', p.mvn_prearnge_ym,
      'sizes', COALESCE((
        SELECT array_agg(DISTINCT regexp_replace(trim(elem->>'type'), '^0*(\d+)\.\d+', '\1'))
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p.house_type_info) = 'array' THEN p.house_type_info ELSE '[]'::jsonb END
        ) elem
        WHERE elem ? 'type' AND trim(elem->>'type') <> ''
      ), ARRAY[]::text[])
    ) ORDER BY p.rcept_endde ASC
  ), '[]'::jsonb) INTO v_subscriptions
  FROM picked p;

  -- 2) hot_listings
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id, 'slug', a.slug, 'name', a.name,
      'region', a.region, 'sigungu', a.sigungu,
      'builder', a.builder, 'total_units', a.total_units,
      'remaining_units', a.remaining_units,
      'price_min', a.price_min, 'price_max', a.price_max,
      'status', a.status, 'og_image_url', a.og_image_url,
      'content_score', a.content_score, 'discount_pct', a.discount_pct,
      'move_in_ym', a.move_in_date, 'sizes', ARRAY[]::text[]
    ) ORDER BY a.content_score DESC NULLS LAST, a.interest_count DESC NULLS LAST
  ), '[]'::jsonb) INTO v_hot_listings
  FROM (
    SELECT * FROM apt_sites
    WHERE is_active = true
      AND COALESCE(status, 'active') IN ('active', 'open', 'subscription')
      AND (p_region IS NULL OR region ILIKE '%' || p_region || '%')
    ORDER BY content_score DESC NULLS LAST, interest_count DESC NULLS LAST
    LIMIT 6
  ) a;

  -- 3) transactions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'apt_name', t.apt_name, 'region', t.region_nm, 'sigungu', t.sigungu,
      'deal_date', t.deal_date, 'deal_amount', t.deal_amount,
      'exclusive_area', t.exclusive_area, 'floor', t.floor
    ) ORDER BY t.deal_date DESC
  ), '[]'::jsonb) INTO v_transactions
  FROM (
    SELECT apt_name, region_nm, sigungu, deal_date, deal_amount, exclusive_area, floor
    FROM apt_transactions
    WHERE deal_date >= v_today - interval '7 days'
      AND (p_region IS NULL OR region_nm ILIKE '%' || p_region || '%')
    ORDER BY deal_date DESC
    LIMIT 6
  ) t;

  -- 4) unsold
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', u.id, 'house_nm', u.house_nm,
      'region', u.region_nm, 'sigungu', u.sigungu_nm,
      'builder', u.constructor_nm,
      'total', u.tot_supply_hshld_co, 'remaining', u.tot_unsold_hshld_co,
      'discount_pct', NULL
    ) ORDER BY u.tot_unsold_hshld_co DESC NULLS LAST
  ), '[]'::jsonb) INTO v_unsold
  FROM (
    SELECT * FROM unsold_apts
    WHERE is_active = true
      AND (p_region IS NULL OR region_nm ILIKE '%' || p_region || '%')
    ORDER BY tot_unsold_hshld_co DESC NULLS LAST
    LIMIT 4
  ) u;

  -- 5) redev
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'district_name', r.district_name,
      'region', r.region, 'sigungu', r.sigungu,
      'stage', CASE
        WHEN r.stage ILIKE '%정비%' THEN 1
        WHEN r.stage ILIKE '%조합%' THEN 2
        WHEN r.stage ILIKE '%사업%' THEN 3
        WHEN r.stage ILIKE '%관리%' THEN 4
        WHEN r.stage ILIKE '%착공%' THEN 5
        WHEN r.stage ILIKE '%준공%' THEN 6
        ELSE NULL
      END,
      'total_households', r.total_households,
      'constructor', r.constructor,
      'next_milestone_date', r.next_milestone_date
    )
  ), '[]'::jsonb) INTO v_redev
  FROM (
    SELECT * FROM redevelopment_projects
    WHERE is_active = true
      AND (p_region IS NULL OR region ILIKE '%' || p_region || '%')
    ORDER BY last_stage_change DESC NULLS LAST
    LIMIT 2
  ) r;

  -- 6) big_event: NULL → EXPIRING fallback
  v_big_event := NULL;
  IF v_big_event IS NULL THEN
    SELECT jsonb_build_object(
      'type', 'EXPIRING',
      'id', s.id, 'slug', site.slug,
      'title', s.house_nm || ' 청약 마감 D-' || GREATEST(0, (s.rcept_endde::date - v_today)),
      'subtitle', COALESCE(s.region_nm, ''),
      'region', s.region_nm,
      'cta_label', '청약 알림 받기',
      'cta_href', '/apt/' || COALESCE(site.slug, s.id::text),
      'image_url', site.og_image_url
    ) INTO v_big_event
    FROM apt_subscriptions s
    LEFT JOIN apt_sites site ON (site.source_ids->>'subscription_id')::bigint = s.id
    WHERE s.rcept_endde IS NOT NULL
      AND s.rcept_endde::date >= v_today
      AND (p_region IS NULL OR s.region_nm ILIKE '%' || p_region || '%')
    ORDER BY s.rcept_endde ASC
    LIMIT 1;
  END IF;

  -- 7) market_signal
  WITH monthly AS (
    SELECT date_trunc('month', deal_date)::date AS m, AVG(deal_amount) AS avg_amt
    FROM apt_transactions
    WHERE deal_date >= v_today - interval '12 months'
      AND (p_region IS NULL OR region_nm ILIKE '%' || p_region || '%')
    GROUP BY 1 ORDER BY 1
  ),
  weekly AS (
    SELECT
      COUNT(*) FILTER (WHERE deal_date >= v_today - interval '7 days') AS this_week_count,
      COUNT(*) FILTER (WHERE deal_date >= v_today - interval '14 days' AND deal_date < v_today - interval '7 days') AS last_week_count,
      AVG(deal_amount) FILTER (WHERE deal_date >= v_today - interval '7 days') AS this_week_avg,
      AVG(deal_amount) FILTER (WHERE deal_date >= v_today - interval '14 days' AND deal_date < v_today - interval '7 days') AS last_week_avg
    FROM apt_transactions
    WHERE deal_date >= v_today - interval '14 days'
      AND (p_region IS NULL OR region_nm ILIKE '%' || p_region || '%')
  ),
  subs AS (
    SELECT
      COUNT(*) FILTER (WHERE rcept_endde::date >= v_today) AS now_count,
      COUNT(*) FILTER (WHERE rcept_endde::date >= v_today - interval '7 days' AND rcept_endde::date < v_today) AS prev_count
    FROM apt_subscriptions
    WHERE (p_region IS NULL OR region_nm ILIKE '%' || p_region || '%')
  )
  SELECT jsonb_build_object(
    'avg_price_6m', COALESCE((SELECT array_agg(round(avg_amt)::numeric) FROM monthly), ARRAY[]::numeric[]),
    'weekly_volume', COALESCE((SELECT this_week_count FROM weekly), 0),
    'weekly_volume_pct', CASE
      WHEN (SELECT last_week_count FROM weekly) > 0 THEN
        round((((SELECT this_week_count FROM weekly) - (SELECT last_week_count FROM weekly))::numeric / (SELECT last_week_count FROM weekly)) * 100, 1)
      ELSE 0 END,
    'weekly_avg_price', COALESCE(round((SELECT this_week_avg FROM weekly)), 0),
    'weekly_avg_price_pct', CASE
      WHEN (SELECT last_week_avg FROM weekly) > 0 THEN
        round((((SELECT this_week_avg FROM weekly) - (SELECT last_week_avg FROM weekly)) / (SELECT last_week_avg FROM weekly)) * 100, 1)
      ELSE 0 END,
    'nationwide_subs', COALESCE((SELECT now_count FROM subs), 0),
    'nationwide_subs_pct', CASE
      WHEN (SELECT prev_count FROM subs) > 0 THEN
        round((((SELECT now_count FROM subs) - (SELECT prev_count FROM subs))::numeric / (SELECT prev_count FROM subs)) * 100, 1)
      ELSE 0 END
  ) INTO v_market_signal;

  -- 8) construction_stocks
  WITH stock_picks AS (
    SELECT q.symbol, q.name, q.change_pct
    FROM stock_quotes q
    WHERE q.is_active = true
      AND (q.sector ILIKE '%건설%'
       OR q.name ILIKE ANY (ARRAY['%건설%', '%산업개발%', 'GS건설%', '대우건설%', '현대건설%', 'DL이앤씨%', '롯데건설%', '포스코건설%']))
    ORDER BY ABS(COALESCE(q.change_pct,0)) DESC NULLS LAST
    LIMIT 3
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'symbol', sp.symbol, 'name', sp.name,
      'change_pct', COALESCE(sp.change_pct,0),
      'sparkline', '[]'::jsonb,
      'related_apts', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', site.id, 'name', site.name, 'slug', site.slug))
        FROM (
          SELECT id, name, slug FROM apt_sites
          WHERE is_active = true
            AND builder ILIKE '%' || regexp_replace(sp.name, '\(주\)|주식회사|건설|산업개발|이앤씨', '', 'g') || '%'
          ORDER BY content_score DESC NULLS LAST
          LIMIT 2
        ) site
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb) INTO v_construction_stocks
  FROM stock_picks sp;

  -- 9) briefs (blog_posts.excerpt 사용)
  WITH brief_blogs AS (
    SELECT b.id, b.slug, b.title, b.excerpt, b.view_count, b.published_at, 'AI'::text AS brief_type
    FROM blog_posts b
    WHERE b.is_published = true
      AND b.published_at >= v_today - interval '7 days'
    ORDER BY b.view_count DESC NULLS LAST
    LIMIT 2
  ),
  brief_posts AS (
    SELECT p.id, p.title, p.created_at, 'HOT'::text AS brief_type
    FROM posts p
    WHERE p.is_deleted = false
      AND p.created_at >= v_today - interval '3 days'
    ORDER BY p.likes_count DESC NULLS LAST, p.comments_count DESC NULLS LAST
    LIMIT 1
  )
  SELECT COALESCE(jsonb_agg(combined ORDER BY rn), '[]'::jsonb) INTO v_briefs
  FROM (
    SELECT 1 AS rn,
      jsonb_build_object(
        'type', brief_type, 'title', title,
        'summary', LEFT(COALESCE(excerpt, ''), 100),
        'href', '/blog/' || slug,
        'source_section', 'blog', 'view_count', view_count
      ) AS combined
    FROM brief_blogs
    UNION ALL
    SELECT 2 AS rn,
      jsonb_build_object(
        'type', brief_type, 'title', title, 'summary', '',
        'href', '/feed/' || id::text,
        'source_section', 'community', 'view_count', NULL
      ) AS combined
    FROM brief_posts
  ) all_briefs;

  RETURN jsonb_build_object(
    'subscriptions', COALESCE(v_subscriptions, '[]'::jsonb),
    'hot_listings', COALESCE(v_hot_listings, '[]'::jsonb),
    'transactions', COALESCE(v_transactions, '[]'::jsonb),
    'unsold', COALESCE(v_unsold, '[]'::jsonb),
    'redev', COALESCE(v_redev, '[]'::jsonb),
    'big_event', v_big_event,
    'market_signal', COALESCE(v_market_signal, '{}'::jsonb),
    'construction_stocks', COALESCE(v_construction_stocks, '[]'::jsonb),
    'briefs', COALESCE(v_briefs, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_main_page_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_main_page_data(text) TO anon, authenticated, service_role;
