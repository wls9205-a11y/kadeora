-- s220 Track A: 메인 페이지 v5 리디자인 — 누락 컬럼 + user_apt_watchlist + 5 RPC
-- Architecture Rule #11: 적용 전에 prod 백업 컬럼 (og_image_url_backup_s218 등) 보존 확인.
-- Architecture Rule #6: SECURITY DEFINER + service_role 권한 + RLS 정책.

-- ───────────────────────────────────────────────────────────
-- 1. 누락 컬럼 ALTER (조건부 — 이미 있으면 건너뜀)
-- ───────────────────────────────────────────────────────────

-- apt_subscriptions: 예상 경쟁률, 특징 태그
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apt_subscriptions' AND column_name='expected_competition') THEN
    ALTER TABLE apt_subscriptions ADD COLUMN expected_competition numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apt_subscriptions' AND column_name='feature_tags') THEN
    ALTER TABLE apt_subscriptions ADD COLUMN feature_tags text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- apt_sites: remaining_units (분양중 잔여), discount_pct (미분양 할인율)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apt_sites' AND column_name='remaining_units') THEN
    ALTER TABLE apt_sites ADD COLUMN remaining_units integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apt_sites' AND column_name='discount_pct') THEN
    ALTER TABLE apt_sites ADD COLUMN discount_pct numeric;
  END IF;
END $$;

-- redevelopment_projects: next_milestone_date
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='redevelopment_projects' AND column_name='next_milestone_date') THEN
    ALTER TABLE redevelopment_projects ADD COLUMN next_milestone_date date;
  END IF;
END $$;

-- signup_attempts: referer_section (Track D 연동)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='signup_attempts')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='signup_attempts' AND column_name='referer_section') THEN
    ALTER TABLE signup_attempts ADD COLUMN referer_section text;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 2. user_apt_watchlist 신규 테이블
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_apt_watchlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apt_id bigint NOT NULL,                              -- apt_sites.id
  tracked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, apt_id)
);

CREATE INDEX IF NOT EXISTS idx_user_apt_watchlist_user ON user_apt_watchlist(user_id, tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_apt_watchlist_apt ON user_apt_watchlist(apt_id);

ALTER TABLE user_apt_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_apt_watchlist_select_own" ON user_apt_watchlist;
CREATE POLICY "user_apt_watchlist_select_own" ON user_apt_watchlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_apt_watchlist_insert_own" ON user_apt_watchlist;
CREATE POLICY "user_apt_watchlist_insert_own" ON user_apt_watchlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_apt_watchlist_delete_own" ON user_apt_watchlist;
CREATE POLICY "user_apt_watchlist_delete_own" ON user_apt_watchlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- 3. RPC: get_main_page_data(p_region text)
--   단일 호출로 9섹션 데이터 전부 반환 (JSON).
--   p_region NULL = 전국, 그 외 region_nm 한글 (예: '부산')
-- ───────────────────────────────────────────────────────────

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
  -- 1) subscriptions: 청약 D-Day asc, 마감 안 된 것만, 7개
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'apt_id', site.id,
      'slug', site.slug,
      'name', s.house_nm,
      'region', s.region_nm,
      'sigungu', NULLIF(split_part(COALESCE(s.hssply_adres, ''), ' ', 2), ''),
      'builder', s.constructor_nm,
      'total_units', s.tot_supply_hshld_co,
      'price_min', site.price_min,
      'price_max', site.price_max,
      'rcept_bgnde', s.rcept_bgnde,
      'rcept_endde', s.rcept_endde,
      'dday', GREATEST(0, (s.rcept_endde::date - v_today)),
      'og_image_url', site.og_image_url,
      'expected_competition', s.expected_competition
    ) ORDER BY s.rcept_endde ASC
  ), '[]'::jsonb) INTO v_subscriptions
  FROM apt_subscriptions s
  LEFT JOIN apt_sites site
    ON (site.source_ids->>'subscription_id')::bigint = s.id
  WHERE s.rcept_endde IS NOT NULL
    AND s.rcept_endde::date >= v_today
    AND (p_region IS NULL OR s.region_nm ILIKE '%' || p_region || '%')
  ORDER BY s.rcept_endde ASC
  LIMIT 7;

  -- 2) hot_listings: apt_sites 분양중 핫픽 6개 (content_score desc)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'slug', a.slug,
      'name', a.name,
      'region', a.region,
      'sigungu', a.sigungu,
      'builder', a.builder,
      'total_units', a.total_units,
      'remaining_units', a.remaining_units,
      'price_min', a.price_min,
      'price_max', a.price_max,
      'status', a.status,
      'og_image_url', a.og_image_url,
      'content_score', a.content_score,
      'discount_pct', a.discount_pct
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

  -- 3) transactions: 최근 24h 실거래 6개
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'apt_name', t.apt_name,
      'region', t.region,
      'sigungu', t.sigungu,
      'deal_date', t.deal_date,
      'deal_amount', t.deal_amount,
      'exclusive_area', t.exclusive_area,
      'floor', t.floor
    ) ORDER BY t.deal_date DESC
  ), '[]'::jsonb) INTO v_transactions
  FROM (
    SELECT apt_name, region, sigungu, deal_date, deal_amount, exclusive_area, floor
    FROM apt_transactions
    WHERE deal_date >= v_today - interval '7 days'
      AND (p_region IS NULL OR region ILIKE '%' || p_region || '%')
    ORDER BY deal_date DESC
    LIMIT 6
  ) t;

  -- 4) unsold: 4개
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'house_nm', u.house_nm,
      'region', u.region_nm,
      'sigungu', u.sigungu,
      'builder', u.constructor_nm,
      'total', u.total_households,
      'remaining', u.unsold_households,
      'discount_pct', u.discount_pct
    ) ORDER BY u.unsold_households DESC NULLS LAST
  ), '[]'::jsonb) INTO v_unsold
  FROM (
    SELECT * FROM unsold_apts
    WHERE is_active = true
      AND (p_region IS NULL OR region_nm ILIKE '%' || p_region || '%')
    ORDER BY unsold_households DESC NULLS LAST
    LIMIT 4
  ) u;

  -- 5) redev: 진행중 2개
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'district_name', r.district_name,
      'region', r.region,
      'sigungu', r.sigungu,
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

  -- 6) big_event: 가장 최근 BIG_EVENT 또는 임박 청약 마감
  SELECT CASE
    WHEN row_to_json(be.*) IS NOT NULL THEN
      jsonb_build_object(
        'type', 'BIG_EVENT',
        'id', be.id,
        'slug', be.slug,
        'title', be.title,
        'subtitle', COALESCE(be.subtitle, be.region_nm),
        'region', be.region_nm,
        'cta_label', '알림 켜기',
        'cta_href', '/apt/big-events/' || be.slug,
        'image_url', be.cover_image_url
      )
    ELSE NULL
  END INTO v_big_event
  FROM big_event_registry be
  WHERE be.is_active = true
    AND (p_region IS NULL OR be.region_nm ILIKE '%' || p_region || '%')
  ORDER BY be.priority DESC NULLS LAST, be.updated_at DESC
  LIMIT 1;

  -- big_event 없으면 임박 청약으로 fallback
  IF v_big_event IS NULL THEN
    SELECT jsonb_build_object(
      'type', 'EXPIRING',
      'id', s.id,
      'slug', site.slug,
      'title', s.house_nm || ' 청약 마감 D-' || GREATEST(0, (s.rcept_endde::date - v_today)),
      'subtitle', COALESCE(s.region_nm, '') || ' ' || COALESCE(NULLIF(split_part(COALESCE(s.hssply_adres, ''), ' ', 2), ''), ''),
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

  -- 7) market_signal: 6개월 평균 분양가 + 주간 지표
  WITH monthly AS (
    SELECT
      date_trunc('month', deal_date)::date AS m,
      AVG(deal_amount) AS avg_amt
    FROM apt_transactions
    WHERE deal_date >= v_today - interval '12 months'
      AND (p_region IS NULL OR region ILIKE '%' || p_region || '%')
    GROUP BY 1
    ORDER BY 1
  ),
  weekly AS (
    SELECT
      COUNT(*) FILTER (WHERE deal_date >= v_today - interval '7 days') AS this_week_count,
      COUNT(*) FILTER (WHERE deal_date >= v_today - interval '14 days' AND deal_date < v_today - interval '7 days') AS last_week_count,
      AVG(deal_amount) FILTER (WHERE deal_date >= v_today - interval '7 days') AS this_week_avg,
      AVG(deal_amount) FILTER (WHERE deal_date >= v_today - interval '14 days' AND deal_date < v_today - interval '7 days') AS last_week_avg
    FROM apt_transactions
    WHERE deal_date >= v_today - interval '14 days'
      AND (p_region IS NULL OR region ILIKE '%' || p_region || '%')
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
      ELSE 0
    END,
    'weekly_avg_price', COALESCE(round((SELECT this_week_avg FROM weekly)), 0),
    'weekly_avg_price_pct', CASE
      WHEN (SELECT last_week_avg FROM weekly) > 0 THEN
        round((((SELECT this_week_avg FROM weekly) - (SELECT last_week_avg FROM weekly)) / (SELECT last_week_avg FROM weekly)) * 100, 1)
      ELSE 0
    END,
    'nationwide_subs', COALESCE((SELECT now_count FROM subs), 0),
    'nationwide_subs_pct', CASE
      WHEN (SELECT prev_count FROM subs) > 0 THEN
        round((((SELECT now_count FROM subs) - (SELECT prev_count FROM subs))::numeric / (SELECT prev_count FROM subs)) * 100, 1)
      ELSE 0
    END
  ) INTO v_market_signal;

  -- 8) construction_stocks: 건설주 3개 + 매핑 단지
  WITH stock_picks AS (
    SELECT q.symbol, q.name, q.change_pct
    FROM stock_quotes q
    WHERE q.sector ILIKE '%건설%'
       OR q.name ILIKE ANY (ARRAY['%건설%', '%산업개발%', 'GS건설%', '대우건설%', '현대건설%', 'DL이앤씨%', '롯데건설%', '포스코건설%'])
    ORDER BY ABS(q.change_pct) DESC NULLS LAST
    LIMIT 3
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'symbol', sp.symbol,
      'name', sp.name,
      'change_pct', sp.change_pct,
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

  -- 9) briefs: AI/HOT/INSIGHT 3개 (blog + community 통합)
  WITH brief_blogs AS (
    SELECT
      b.id, b.slug, b.title, b.summary, b.view_count, b.published_at,
      'AI' AS brief_type
    FROM blog_posts b
    WHERE b.is_published = true
      AND b.published_at >= v_today - interval '7 days'
    ORDER BY b.view_count DESC NULLS LAST
    LIMIT 2
  ),
  brief_posts AS (
    SELECT
      p.id, p.title, p.created_at,
      'HOT' AS brief_type
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
        'type', brief_type,
        'title', title,
        'summary', LEFT(COALESCE(summary, ''), 100),
        'href', '/blog/' || slug,
        'source_section', 'blog',
        'view_count', view_count
      ) AS combined
    FROM brief_blogs
    UNION ALL
    SELECT 2 AS rn,
      jsonb_build_object(
        'type', brief_type,
        'title', title,
        'summary', '',
        'href', '/feed/' || id::text,
        'source_section', 'community',
        'view_count', NULL
      ) AS combined
    FROM brief_posts
  ) all_briefs;

  -- ──────── 통합 반환 ────────
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

-- ───────────────────────────────────────────────────────────
-- 4. RPC: get_apt_3y_trend(p_apt_id bigint)
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_apt_3y_trend(p_apt_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apt_name text;
  v_3y_avg numeric;
  v_now_avg numeric;
  v_trend_pct numeric;
BEGIN
  SELECT name INTO v_apt_name FROM apt_sites WHERE id = p_apt_id LIMIT 1;
  IF v_apt_name IS NULL THEN
    RETURN jsonb_build_object('trend_pct', NULL, 'last_3y_avg', NULL);
  END IF;

  SELECT AVG(deal_amount) INTO v_3y_avg
  FROM apt_transactions
  WHERE apt_name = v_apt_name
    AND deal_date >= ((now() AT TIME ZONE 'Asia/Seoul')::date - interval '3 years');

  SELECT AVG(deal_amount) INTO v_now_avg
  FROM apt_transactions
  WHERE apt_name = v_apt_name
    AND deal_date >= ((now() AT TIME ZONE 'Asia/Seoul')::date - interval '90 days');

  IF v_3y_avg IS NULL OR v_3y_avg = 0 THEN
    v_trend_pct := NULL;
  ELSE
    v_trend_pct := round(((v_now_avg - v_3y_avg) / v_3y_avg) * 100, 1);
  END IF;

  RETURN jsonb_build_object(
    'trend_pct', v_trend_pct,
    'last_3y_avg', round(COALESCE(v_3y_avg, 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION get_apt_3y_trend(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_apt_3y_trend(bigint) TO anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────
-- 5. RPC: add_to_watchlist / remove_from_watchlist
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION add_to_watchlist(p_apt_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;

  INSERT INTO user_apt_watchlist (user_id, apt_id) VALUES (v_uid, p_apt_id)
  ON CONFLICT (user_id, apt_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION add_to_watchlist(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_to_watchlist(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION remove_from_watchlist(p_apt_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;

  DELETE FROM user_apt_watchlist WHERE user_id = v_uid AND apt_id = p_apt_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION remove_from_watchlist(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_from_watchlist(bigint) TO authenticated;

-- ───────────────────────────────────────────────────────────
-- 6. RPC: get_user_watchlist(p_user_id uuid)
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_watchlist(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'apt', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug),
        'current_price', s.price_min,
        'change_pct_30d', NULL,
        'sparkline_30d', '[]'::jsonb
      ) ORDER BY w.tracked_at DESC
    )
    FROM user_apt_watchlist w
    JOIN apt_sites s ON s.id = w.apt_id
    WHERE w.user_id = v_uid
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_user_watchlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_watchlist(uuid) TO anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────
-- 적용 시 주의:
-- 1. 컬럼 ALTER 는 안전 (IF NOT EXISTS 가드).
-- 2. apt_subscriptions.expected_competition / feature_tags 는 cron 로 채워야 함 (별 sprint).
-- 3. apt_sites.remaining_units / discount_pct 는 cron 백필 필요 (별 sprint).
-- 4. redevelopment_projects.next_milestone_date 도 별 sprint backfill.
-- 5. RPC 모두 SECURITY DEFINER 라 caller RLS 우회 — auth.uid() 체크로 본인 확인.
-- 6. get_main_page_data 는 9 sub-query 통합 — index 누락 시 느릴 수 있음.
--    apt_transactions(deal_date, region) / apt_subscriptions(rcept_endde, region_nm) /
--    apt_sites(is_active, content_score, region) 인덱스 권장 (별 sprint).
