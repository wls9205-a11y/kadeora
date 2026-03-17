-- Posts 테이블 인덱스 최적화
-- 실행 방법: Supabase Dashboard > SQL Editor 에서 직접 실행
-- 또는 Supabase MCP apply_migration 으로 실행

-- 1. 기본 피드 쿼리: WHERE is_deleted = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_deleted_created
  ON posts(is_deleted, created_at DESC);

-- 2. 카테고리 필터: WHERE category = ? AND is_deleted = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_category_deleted_created
  ON posts(category, is_deleted, created_at DESC);

-- 3. 우리동네 지역 필터: WHERE region_id = ? AND category = 'local' AND is_deleted = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_region_category_deleted
  ON posts(region_id, category, is_deleted, created_at DESC);
