-- ============================================
-- 세션 24: 카더라 10대 진화 DB 마이그레이션
-- ============================================

-- ① 블로그 시리즈 시스템
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS series_id TEXT DEFAULT NULL;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS series_order INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS blog_series (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_image TEXT,
  category TEXT DEFAULT 'guide',
  post_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_series ON blog_posts(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_series_slug ON blog_series(slug);

-- ② 가격 알림 시스템 (주식 + 부동산)
CREATE TABLE IF NOT EXISTS price_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('stock_price','stock_pct','apt_subscription','apt_price')),
  target_symbol TEXT,           -- 주식 심볼
  target_apt_id INT,            -- 부동산 ID
  condition TEXT NOT NULL CHECK (condition IN ('above','below','change_pct_up','change_pct_down','d_day')),
  threshold NUMERIC,            -- 목표가 or 변동률%
  is_triggered BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_stock ON price_alerts(target_symbol) WHERE alert_type LIKE 'stock%' AND is_active = true;

-- ③ 포트폴리오 시뮬레이터
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  buy_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  buy_date DATE DEFAULT CURRENT_DATE,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_holdings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_unique ON portfolio_holdings(user_id, symbol, buy_price);

-- ④ UGC 리뷰 시스템 (아파트/단지)
CREATE TABLE IF NOT EXISTS apt_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  apt_name TEXT NOT NULL,
  region_nm TEXT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  pros TEXT,
  cons TEXT,
  content TEXT NOT NULL,
  living_years INT,
  is_resident BOOLEAN DEFAULT false,
  likes_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apt_reviews_name ON apt_reviews(apt_name) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_apt_reviews_region ON apt_reviews(region_nm) WHERE is_deleted = false;

-- ⑤ 크론 로그 인덱스 보강 (테이블은 이미 존재)
CREATE INDEX IF NOT EXISTS idx_cron_logs_name_time ON cron_logs(cron_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_logs(status) WHERE status = 'failed';

-- ⑥ 블로그 시리즈 카운트 자동 갱신 RPC
CREATE OR REPLACE FUNCTION update_series_count(p_series_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE blog_series SET post_count = (
    SELECT count(*) FROM blog_posts 
    WHERE series_id = p_series_id AND is_published = true
  ) WHERE id = p_series_id;
END;
$$ LANGUAGE plpgsql;

-- ⑦ 포트폴리오 요약 RPC
CREATE OR REPLACE FUNCTION get_portfolio_summary(p_user_id UUID)
RETURNS TABLE(
  symbol TEXT, buy_price NUMERIC, quantity NUMERIC, buy_date DATE, memo TEXT,
  current_price NUMERIC, change_pct NUMERIC, name TEXT, market TEXT, currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.symbol, ph.buy_price, ph.quantity, ph.buy_date, ph.memo,
    sq.price AS current_price,
    CASE WHEN ph.buy_price > 0 THEN ROUND(((sq.price - ph.buy_price) / ph.buy_price * 100)::numeric, 2) ELSE 0 END AS change_pct,
    sq.name, sq.market, sq.currency
  FROM portfolio_holdings ph
  LEFT JOIN stock_quotes sq ON sq.symbol = ph.symbol
  WHERE ph.user_id = p_user_id
  ORDER BY ph.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ⑧ 크론 로그 요약 RPC (24시간)
CREATE OR REPLACE FUNCTION get_cron_summary(p_hours INT DEFAULT 24)
RETURNS TABLE(
  cron_name TEXT, total_runs BIGINT, success_count BIGINT, error_count BIGINT,
  avg_duration_ms NUMERIC, last_run TIMESTAMPTZ, last_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.cron_name,
    count(*)::BIGINT AS total_runs,
    count(*) FILTER (WHERE cl.status = 'success')::BIGINT AS success_count,
    count(*) FILTER (WHERE cl.status = 'failed')::BIGINT AS error_count,
    ROUND(avg(cl.duration_ms)::numeric, 0) AS avg_duration_ms,
    max(cl.created_at) AS last_run,
    (SELECT cl2.status FROM cron_logs cl2 WHERE cl2.cron_name = cl.cron_name ORDER BY cl2.created_at DESC LIMIT 1) AS last_status
  FROM cron_logs cl
  WHERE cl.created_at > now() - (p_hours || ' hours')::interval
  GROUP BY cl.cron_name
  ORDER BY error_count DESC, last_run DESC;
END;
$$ LANGUAGE plpgsql;

-- ⑨ 실거래가 추이 RPC (단지별)
CREATE OR REPLACE FUNCTION get_apt_price_trend(p_apt_name TEXT, p_region TEXT DEFAULT NULL)
RETURNS TABLE(
  deal_date TEXT, price INT, area NUMERIC, price_per_pyeong INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.deal_date::TEXT,
    t.deal_amount::INT AS price,
    t.exclusive_area::NUMERIC AS area,
    CASE WHEN t.exclusive_area > 0 
      THEN ROUND(t.deal_amount / (t.exclusive_area / 3.3058))::INT 
      ELSE 0 END AS price_per_pyeong
  FROM apt_transactions t
  WHERE t.apt_name ILIKE '%' || p_apt_name || '%'
    AND (p_region IS NULL OR t.region_nm ILIKE '%' || p_region || '%')
  ORDER BY t.deal_date DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- ⑩ 지역별 부동산 통계 RPC (랜딩페이지용)
CREATE OR REPLACE FUNCTION get_region_realestate_summary(p_region TEXT)
RETURNS TABLE(
  subscription_count BIGINT,
  ongoing_count BIGINT,
  redevelopment_count BIGINT,
  unsold_count BIGINT,
  transaction_count BIGINT,
  avg_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM apt_subscriptions WHERE region_nm ILIKE '%' || p_region || '%')::BIGINT,
    (SELECT count(*) FROM apt_ongoing WHERE region_nm ILIKE '%' || p_region || '%' AND is_active = true)::BIGINT,
    (SELECT count(*) FROM redevelopment_projects WHERE region ILIKE '%' || p_region || '%' AND is_active = true)::BIGINT,
    (SELECT count(*) FROM unsold_apts WHERE region ILIKE '%' || p_region || '%' AND is_active = true)::BIGINT,
    (SELECT count(*) FROM apt_transactions WHERE region_nm ILIKE '%' || p_region || '%')::BIGINT,
    (SELECT ROUND(avg(deal_amount)::numeric, 0) FROM apt_transactions WHERE region_nm ILIKE '%' || p_region || '%' AND deal_amount > 0)::NUMERIC;
END;
$$ LANGUAGE plpgsql;
