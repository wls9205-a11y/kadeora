-- ============================================================
-- 카더라 주식 마스터플랜 DB 마이그레이션
-- 2026-04-17 — STOCK_MASTER_PLAN.md 기반
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

-- ==================================
-- 1. 국내주식 수급 데이터
-- ==================================

CREATE TABLE IF NOT EXISTS flow_snapshots_krx (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  foreign_net BIGINT DEFAULT 0,
  institution_net BIGINT DEFAULT 0,
  individual_net BIGINT DEFAULT 0,
  pension_net BIGINT DEFAULT 0,
  insurance_net BIGINT DEFAULT 0,
  investment_trust_net BIGINT DEFAULT 0,
  foreign_ownership_ratio NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_flow_symbol_date ON flow_snapshots_krx(symbol, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_flow_date ON flow_snapshots_krx(trade_date DESC);

-- ==================================
-- 2. 공매도·대차잔고
-- ==================================

CREATE TABLE IF NOT EXISTS short_selling_krx (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  short_volume BIGINT DEFAULT 0,
  short_amount BIGINT DEFAULT 0,
  short_ratio NUMERIC(6,2) DEFAULT 0,
  is_overheat BOOLEAN DEFAULT FALSE,
  overheat_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_short_symbol_date ON short_selling_krx(symbol, trade_date DESC);

CREATE TABLE IF NOT EXISTS lending_balance_krx (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  balance_shares BIGINT DEFAULT 0,
  balance_amount BIGINT DEFAULT 0,
  change_1d NUMERIC DEFAULT 0,
  change_5d NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_lending_symbol_date ON lending_balance_krx(symbol, trade_date DESC);

-- ==================================
-- 3. 수급 시그널 (AI 해석 포함)
-- ==================================

CREATE TABLE IF NOT EXISTS flow_signals (
  id BIGSERIAL PRIMARY KEY,
  signal_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  signal_date DATE NOT NULL,
  strength NUMERIC DEFAULT 0,
  interpretation_ko TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signal_type_date ON flow_signals(signal_type, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signal_symbol ON flow_signals(symbol, signal_date DESC);

-- ==================================
-- 4. DART 공시
-- ==================================

CREATE TABLE IF NOT EXISTS dart_filings (
  id BIGSERIAL PRIMARY KEY,
  rcept_no TEXT UNIQUE NOT NULL,
  corp_code TEXT,
  corp_name TEXT,
  symbol TEXT,
  report_nm TEXT,
  category TEXT,
  importance_score INTEGER DEFAULT 5,
  summary_ko TEXT,
  original_url TEXT,
  filed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dart_symbol_date ON dart_filings(symbol, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dart_category ON dart_filings(category, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dart_rcept ON dart_filings(rcept_no);

-- ==================================
-- 5. 재무제표 (XBRL 파싱 결과)
-- ==================================

CREATE TABLE IF NOT EXISTS financial_statements_xbrl (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  market TEXT DEFAULT 'KRX',
  period TEXT NOT NULL,
  report_type TEXT DEFAULT 'quarterly',
  revenue BIGINT,
  operating_income BIGINT,
  net_income BIGINT,
  total_assets BIGINT,
  total_equity BIGINT,
  total_debt BIGINT,
  eps NUMERIC,
  bps NUMERIC,
  roe NUMERIC,
  roa NUMERIC,
  debt_ratio NUMERIC,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, period, market)
);
CREATE INDEX IF NOT EXISTS idx_financial_symbol ON financial_statements_xbrl(symbol, period);

-- ==================================
-- 6. 애널리스트 컨센서스
-- ==================================

CREATE TABLE IF NOT EXISTS analyst_consensus (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  target_date DATE NOT NULL,
  target_period TEXT,
  revenue_consensus BIGINT,
  operating_income_consensus BIGINT,
  eps_consensus NUMERIC,
  target_price_avg NUMERIC,
  target_price_high NUMERIC,
  target_price_low NUMERIC,
  num_analysts INTEGER DEFAULT 0,
  buy_ratio NUMERIC DEFAULT 0,
  hold_ratio NUMERIC DEFAULT 0,
  sell_ratio NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, target_date, target_period)
);

-- ==================================
-- 7. 실적 이벤트 (국내 + 해외)
-- ==================================

CREATE TABLE IF NOT EXISTS earnings_events (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL,
  period TEXT,
  scheduled_at TIMESTAMPTZ,
  actual_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  revenue_actual BIGINT,
  revenue_consensus BIGINT,
  eps_actual NUMERIC,
  eps_consensus NUMERIC,
  surprise_pct NUMERIC,
  category TEXT,
  summary_ko TEXT,
  blog_post_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earnings_symbol ON earnings_events(symbol, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_market ON earnings_events(market, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings_events(status);

-- ==================================
-- 8. IPO/공모주
-- ==================================

CREATE TABLE IF NOT EXISTS ipo_events (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  symbol TEXT,
  subscription_start DATE,
  subscription_end DATE,
  demand_forecast_result JSONB DEFAULT '{}',
  final_price INTEGER,
  band_low INTEGER,
  band_high INTEGER,
  competition_ratio NUMERIC,
  lockup_info JSONB DEFAULT '{}',
  listing_date DATE,
  first_day_close INTEGER,
  first_day_change NUMERIC,
  status TEXT DEFAULT 'upcoming',
  dart_filing_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ipo_status ON ipo_events(status);
CREATE INDEX IF NOT EXISTS idx_ipo_listing ON ipo_events(listing_date DESC);

-- ==================================
-- 9. 코퍼레이트 액션
-- ==================================

CREATE TABLE IF NOT EXISTS corporate_actions (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  action_type TEXT,
  action_date DATE,
  ex_date DATE,
  record_date DATE,
  details JSONB DEFAULT '{}',
  description_ko TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_corp_action_symbol ON corporate_actions(symbol, action_date DESC);
CREATE INDEX IF NOT EXISTS idx_corp_action_type ON corporate_actions(action_type, action_date DESC);

-- ==================================
-- 10. 카더라 자체 지수
-- ==================================

CREATE TABLE IF NOT EXISTS kadeora_indices (
  id BIGSERIAL PRIMARY KEY,
  index_code TEXT NOT NULL,
  index_name TEXT,
  calc_date DATE NOT NULL,
  value NUMERIC DEFAULT 1000,
  change_pct NUMERIC DEFAULT 0,
  constituents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(index_code, calc_date)
);
CREATE INDEX IF NOT EXISTS idx_kd_index_code ON kadeora_indices(index_code, calc_date DESC);

-- ==================================
-- 11. 해외주식 상세
-- ==================================

CREATE TABLE IF NOT EXISTS stocks_us_details (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  exchange TEXT,
  company_name TEXT,
  company_name_ko TEXT,
  sector TEXT,
  industry TEXT,
  ir_youtube_channel_id TEXT,
  is_adr BOOLEAN DEFAULT FALSE,
  adr_underlying_symbol TEXT,
  adr_ratio NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================================
-- 12. SEC Filing
-- ==================================

CREATE TABLE IF NOT EXISTS sec_filings (
  id BIGSERIAL PRIMARY KEY,
  accession_number TEXT UNIQUE NOT NULL,
  symbol TEXT,
  form_type TEXT,
  filed_at TIMESTAMPTZ,
  period_of_report DATE,
  summary_ko TEXT,
  risk_factors_new TEXT[] DEFAULT '{}',
  risk_factors_removed TEXT[] DEFAULT '{}',
  xbrl_data JSONB DEFAULT '{}',
  original_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_symbol ON sec_filings(symbol, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_form ON sec_filings(form_type, filed_at DESC);

-- ==================================
-- 13. IR 자막 DB
-- ==================================

CREATE TABLE IF NOT EXISTS ir_transcripts (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  video_id TEXT UNIQUE,
  video_title TEXT,
  published_at TIMESTAMPTZ,
  transcript_raw TEXT,
  transcript_segments JSONB DEFAULT '[]',
  summary_ko TEXT,
  key_quotes_ko JSONB DEFAULT '[]',
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ir_symbol ON ir_transcripts(symbol, published_at DESC);

-- ==================================
-- 14. 매크로 이벤트
-- ==================================

CREATE TABLE IF NOT EXISTS macro_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  scheduled_at TIMESTAMPTZ,
  actual_value NUMERIC,
  consensus_value NUMERIC,
  previous_value NUMERIC,
  surprise_magnitude NUMERIC,
  description_ko TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_macro_type ON macro_events(event_type, scheduled_at DESC);

-- ==================================
-- 15. 매크로 × 종목 영향 매트릭스
-- ==================================

CREATE TABLE IF NOT EXISTS macro_stock_impact (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  surprise_direction TEXT,
  target_entity_type TEXT DEFAULT 'sector',
  target_entity TEXT,
  impact_direction TEXT,
  impact_magnitude TEXT DEFAULT 'moderate',
  rationale_ko TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_macro_impact_event ON macro_stock_impact(event_type);

-- ==================================
-- 16. ETF 보유 종목
-- ==================================

CREATE TABLE IF NOT EXISTS etf_holdings (
  id BIGSERIAL PRIMARY KEY,
  etf_symbol TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  holding_symbol TEXT,
  holding_name TEXT,
  weight_pct NUMERIC DEFAULT 0,
  shares BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(etf_symbol, as_of_date, holding_symbol)
);
CREATE INDEX IF NOT EXISTS idx_etf_holdings_symbol ON etf_holdings(etf_symbol, as_of_date DESC);

-- ==================================
-- 17. ETF 리밸런싱 이벤트
-- ==================================

CREATE TABLE IF NOT EXISTS etf_rebalancing_events (
  id BIGSERIAL PRIMARY KEY,
  etf_symbol TEXT NOT NULL,
  event_date DATE,
  symbols_added TEXT[] DEFAULT '{}',
  symbols_removed TEXT[] DEFAULT '{}',
  weight_changes JSONB DEFAULT '{}',
  description_ko TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================================
-- 18. 히어로 슬라이드
-- ==================================

CREATE TABLE IF NOT EXISTS stock_hero_slides (
  id BIGSERIAL PRIMARY KEY,
  slide_order INTEGER DEFAULT 0,
  title_ko TEXT,
  subtitle_ko TEXT,
  slide_type TEXT DEFAULT 'gainers',
  image_url TEXT,
  link_url TEXT,
  data JSONB DEFAULT '{}',
  active_from TIMESTAMPTZ DEFAULT now(),
  active_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================================
-- 19. 종목 Q&A 로그
-- ==================================

CREATE TABLE IF NOT EXISTS stock_qa_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  symbol TEXT,
  question TEXT,
  answer TEXT,
  sources JSONB DEFAULT '[]',
  feedback INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_qa_symbol ON stock_qa_logs(symbol, created_at DESC);

-- ==================================
-- 20. 프로그래매틱 SEO 페이지 트래킹
-- ==================================

CREATE TABLE IF NOT EXISTS programmatic_seo_pages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  page_type TEXT,
  metadata JSONB DEFAULT '{}',
  last_generated_at TIMESTAMPTZ DEFAULT now(),
  pageview_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_page_type ON programmatic_seo_pages(page_type);

-- ==================================
-- 21. 투자 의견 투표
-- ==================================

CREATE TABLE IF NOT EXISTS user_stock_opinions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  opinion TEXT NOT NULL,
  horizon TEXT DEFAULT 'mid',
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_opinion_symbol ON user_stock_opinions(symbol, created_at DESC);

-- ==================================
-- 22. 용어사전
-- ==================================

CREATE TABLE IF NOT EXISTS stock_glossary (
  id BIGSERIAL PRIMARY KEY,
  term TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  definition_ko TEXT NOT NULL,
  definition_detail TEXT,
  related_terms TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'general',
  example TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_glossary_slug ON stock_glossary(slug);

-- ==================================
-- RLS 정책 (기본 — 공개 읽기, 인증 쓰기)
-- ==================================

-- 공개 읽기 가능 테이블
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'flow_snapshots_krx', 'short_selling_krx', 'lending_balance_krx',
      'flow_signals', 'dart_filings', 'financial_statements_xbrl',
      'analyst_consensus', 'earnings_events', 'ipo_events',
      'corporate_actions', 'kadeora_indices', 'stocks_us_details',
      'sec_filings', 'ir_transcripts', 'macro_events',
      'macro_stock_impact', 'etf_holdings', 'etf_rebalancing_events',
      'stock_hero_slides', 'programmatic_seo_pages',
      'user_stock_opinions', 'stock_glossary'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_public_read" ON %I FOR SELECT USING (true)',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- stock_qa_logs: 본인만 읽기
ALTER TABLE stock_qa_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "qa_logs_own_read" ON stock_qa_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "qa_logs_insert" ON stock_qa_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_stock_opinions: 공개 읽기, 본인만 쓰기
CREATE POLICY IF NOT EXISTS "opinions_public_read" ON user_stock_opinions
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "opinions_own_write" ON user_stock_opinions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "opinions_own_update" ON user_stock_opinions
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 완료. 총 22개 테이블 + 인덱스 + RLS 정책
-- ============================================================
