-- ================================================================
-- 카더라 피드 리뉴얼 마이그레이션
-- 2026-04-13
-- ================================================================

-- 1. posts 테이블에 post_type 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'post';
COMMENT ON COLUMN posts.post_type IS 'post | short | poll | vs | predict';

-- post_type 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);

-- region_id 인덱스 (우리동네 쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_posts_region_id ON posts(region_id) WHERE region_id IS NOT NULL AND region_id != '';

-- 2. 투표 시스템
CREATE TABLE IF NOT EXISTS post_polls (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id)
);

CREATE TABLE IF NOT EXISTS poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INT NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INT NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  option_id INT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);

-- 3. VS 대결
CREATE TABLE IF NOT EXISTS vs_battles (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id)
);

CREATE TABLE IF NOT EXISTS vs_votes (
  id SERIAL PRIMARY KEY,
  battle_id INT NOT NULL REFERENCES vs_battles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  choice TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(battle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vs_votes_battle ON vs_votes(battle_id);

-- 4. 예측
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  deadline DATE NOT NULL,
  resolved BOOLEAN DEFAULT false,
  result BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id)
);

CREATE TABLE IF NOT EXISTS prediction_votes (
  id SERIAL PRIMARY KEY,
  prediction_id INT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agree BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prediction_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_votes_pred ON prediction_votes(prediction_id);

-- 5. point_reason enum 확장
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'poll_create';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'poll_vote';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'vs_create';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'vs_vote';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'predict_create';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'predict_vote';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'predict_hit';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'short_create';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. notification_settings 확장 (새 알림 유형)
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_poll_result BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_predict_result BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_local_new BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_grade_up BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_point BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS push_marketing BOOLEAN DEFAULT false;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS kakao_enabled BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT false;

-- 7. profiles 확장 (구/군 단위 지역)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS residence_district TEXT;

-- 8. RPC: 투표 결과 집계
CREATE OR REPLACE FUNCTION get_poll_results(p_poll_id INT)
RETURNS TABLE(option_id INT, label TEXT, vote_count BIGINT) AS $$
  SELECT po.id AS option_id, po.label, COALESCE(COUNT(pv.id), 0) AS vote_count
  FROM poll_options po
  LEFT JOIN poll_votes pv ON pv.option_id = po.id
  WHERE po.poll_id = p_poll_id
  GROUP BY po.id, po.label, po.sort_order
  ORDER BY po.sort_order;
$$ LANGUAGE sql STABLE;

-- 9. RPC: VS 결과 집계
CREATE OR REPLACE FUNCTION get_vs_results(p_battle_id INT)
RETURNS TABLE(choice TEXT, vote_count BIGINT) AS $$
  SELECT v.choice, COUNT(*) AS vote_count
  FROM vs_votes v
  WHERE v.battle_id = p_battle_id
  GROUP BY v.choice;
$$ LANGUAGE sql STABLE;

-- 10. RPC: 예측 결과 집계
CREATE OR REPLACE FUNCTION get_prediction_results(p_prediction_id INT)
RETURNS TABLE(agree_count BIGINT, disagree_count BIGINT) AS $$
  SELECT
    COUNT(*) FILTER (WHERE agree = true) AS agree_count,
    COUNT(*) FILTER (WHERE agree = false) AS disagree_count
  FROM prediction_votes
  WHERE prediction_id = p_prediction_id;
$$ LANGUAGE sql STABLE;

-- 11. RPC: 핫토픽 (최근 6시간 내 댓글+좋아요 급상승 글)
CREATE OR REPLACE FUNCTION get_hot_topics(p_limit INT DEFAULT 8)
RETURNS TABLE(id INT, title TEXT, comments_count INT, likes_count INT, category TEXT, post_type TEXT) AS $$
  SELECT p.id, p.title, p.comments_count, p.likes_count, p.category, p.post_type
  FROM posts p
  WHERE p.is_deleted = false
    AND p.created_at > now() - interval '24 hours'
    AND p.title IS NOT NULL AND p.title != ''
  ORDER BY (p.comments_count + p.likes_count) DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- 12. RLS 정책
ALTER TABLE post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vs_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vs_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_votes ENABLE ROW LEVEL SECURITY;

-- 읽기: 모두 허용
CREATE POLICY "polls_read" ON post_polls FOR SELECT USING (true);
CREATE POLICY "poll_options_read" ON poll_options FOR SELECT USING (true);
CREATE POLICY "poll_votes_read" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "vs_battles_read" ON vs_battles FOR SELECT USING (true);
CREATE POLICY "vs_votes_read" ON vs_votes FOR SELECT USING (true);
CREATE POLICY "predictions_read" ON predictions FOR SELECT USING (true);
CREATE POLICY "prediction_votes_read" ON prediction_votes FOR SELECT USING (true);

-- 쓰기: 로그인 유저만
CREATE POLICY "poll_votes_insert" ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vs_votes_insert" ON vs_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prediction_votes_insert" ON prediction_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
