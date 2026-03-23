-- 포트폴리오 일일 스냅샷 테이블
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_invested numeric NOT NULL DEFAULT 0,
  total_current numeric NOT NULL DEFAULT 0,
  total_pnl numeric NOT NULL DEFAULT 0,
  pnl_pct numeric NOT NULL DEFAULT 0,
  holding_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date
  ON portfolio_snapshots(user_id, snapshot_date DESC);

-- RLS
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own snapshots" ON portfolio_snapshots
  FOR SELECT USING (auth.uid() = user_id);
