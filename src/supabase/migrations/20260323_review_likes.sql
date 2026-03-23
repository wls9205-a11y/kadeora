-- 리뷰 좋아요 테이블
CREATE TABLE IF NOT EXISTS apt_review_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES apt_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_apt_review_likes_review ON apt_review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_apt_review_likes_user ON apt_review_likes(user_id);

-- RLS
ALTER TABLE apt_review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own likes" ON apt_review_likes
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read likes" ON apt_review_likes
  FOR SELECT USING (true);

-- reports 테이블에 review_id 컬럼 추가 (없는 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'review_id'
  ) THEN
    ALTER TABLE reports ADD COLUMN review_id uuid REFERENCES apt_reviews(id) ON DELETE CASCADE;
    CREATE INDEX idx_reports_review ON reports(review_id);
  END IF;
END $$;
