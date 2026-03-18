-- page_views 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS page_views (
  id bigserial PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "insert_all" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "select_all" ON page_views FOR SELECT USING (true);
