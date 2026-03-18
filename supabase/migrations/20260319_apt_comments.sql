CREATE TABLE IF NOT EXISTS apt_comments (
  id bigserial PRIMARY KEY,
  house_key TEXT NOT NULL,
  house_nm TEXT NOT NULL,
  house_type TEXT NOT NULL CHECK (house_type IN ('sub','unsold')),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 200),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON apt_comments(house_key);
ALTER TABLE apt_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON apt_comments FOR SELECT USING (true);
CREATE POLICY "insert_auth" ON apt_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "delete_own" ON apt_comments FOR DELETE USING (auth.uid() = author_id);
