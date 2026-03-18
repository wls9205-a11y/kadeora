-- 시드 데이터: 댓글 + 좋아요 + 팔로우
-- Supabase Dashboard > SQL Editor에서 실행
-- 주의: 트리거 비활성화 → 데이터 삽입 → 카운트 업데이트 → 트리거 재활성화

-- pwa_installs 테이블 생성
CREATE TABLE IF NOT EXISTS pwa_installs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  platform TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  region_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_pwa_installs_installed_at ON pwa_installs(installed_at DESC);

-- likes_count, comments_count 갱신
-- UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = posts.id);
-- UPDATE posts SET comments_count = (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND is_deleted = false);
