-- s262 Phase A — Issue Engine v1 weights
-- IDEMPOTENT + REVERSIBLE. v1 가중치는 보수적 식 (가중치 합 = 1.0 on non-zero factors).
-- 비활성 factor 는 weight=0 으로 보존 → V2 에서 enable 시 INSERT 필요 없이 UPDATE 만.
-- DOWN: DROP TABLE IF EXISTS public.stock_issue_score_weights, public.apt_issue_score_weights;

BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_issue_score_weights (
  factor      TEXT PRIMARY KEY,
  weight      NUMERIC(5,3) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  version     TEXT NOT NULL DEFAULT 'v1',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.apt_issue_score_weights (
  factor      TEXT PRIMARY KEY,
  weight      NUMERIC(5,3) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  version     TEXT NOT NULL DEFAULT 'v1',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v1 stock weights (활성 3개 합 = 1.0, 나머지는 0 → reasons[] 자리만 잡음)
-- DATA SOURCE 매핑:
--   vol_z         → stock_price_history.volume (30d window per symbol)
--   abs_change_z  → stock_quotes.change_pct (abs + market-wide z)
--   recency_boost → stock_quotes.updated_at (exp decay 24h)
--   news_z        → stock_news (sparse 50/7d, v2 enable 대기)
--   sent_d        → stock_news.sentiment_score (sparse)
--   disc_w        → comments aggregate via entity_comment_stats (Phase B 후 enable)
--   flow_flip     → flow_signals (sparse 11/7d)
INSERT INTO public.stock_issue_score_weights (factor, weight, description) VALUES
  ('vol_z',         0.500, '거래량 30d z-score'),
  ('abs_change_z',  0.300, '등락폭 절대값 (시장 전체 z)'),
  ('recency_boost', 0.200, 'updated_at 신선도 (exp decay)'),
  ('news_z',        0.000, '뉴스 24h 카운트 (v1 비활성)'),
  ('sent_d',        0.000, '감성 점수 변화 (v1 비활성)'),
  ('disc_w',        0.000, '커뮤니티 토론량 (v1 비활성)'),
  ('flow_flip',     0.000, '수급 방향 전환 (v1 비활성)')
ON CONFLICT (factor) DO UPDATE
  SET weight=EXCLUDED.weight, description=EXCLUDED.description, updated_at=now();

-- v1 apt weights (활성 3개 합 = 1.0)
-- DATA SOURCE 매핑:
--   dday_proximity     → apt_subscriptions.rcept_endde (max(0, 1 - days/30))
--   listing_freshness  → apt_subscriptions.created_at (s259 컬럼, max(0, 1 - days/30))
--   region_match       → apt_subscriptions.region_nm IS NOT NULL (1.0 / 0.0)
--   sub_comp           → apt_subscriptions.competition_rate_1st OR expected_competition
--   policy             → apt_subscriptions.is_regulated_area OR is_speculative_zone
--   news               → 외부 news source 미연동 (v2)
--   price_anom         → apt_complex_profiles.price_change_1y (단지 단위, 청약과 scope 다름)
INSERT INTO public.apt_issue_score_weights (factor, weight, description) VALUES
  ('dday_proximity',     0.450, '청약 마감 D-day 근접도'),
  ('listing_freshness',  0.350, '신규 등재 신선도'),
  ('region_match',       0.200, '지역명 매칭 가능 (placeholder)'),
  ('sub_comp',           0.000, '경쟁률 (v1 비활성)'),
  ('policy',             0.000, '규제/투기 지역 (v1 비활성)'),
  ('news',               0.000, '뉴스 (v1 비활성)'),
  ('price_anom',         0.000, '가격 이상치 (v1 비활성)')
ON CONFLICT (factor) DO UPDATE
  SET weight=EXCLUDED.weight, description=EXCLUDED.description, updated_at=now();

REVOKE ALL ON public.stock_issue_score_weights, public.apt_issue_score_weights FROM anon, authenticated;
GRANT  SELECT ON public.stock_issue_score_weights, public.apt_issue_score_weights TO service_role;

COMMIT;
