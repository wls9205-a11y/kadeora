-- 블로그 IndexNow 추적용 컬럼 추가
-- 언제 마지막으로 IndexNow에 전송했는지 기록하여 미전송 URL 순차 처리
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS indexed_at timestamptz DEFAULT NULL;

-- 미전송 URL 조회 성능을 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_blog_posts_not_indexed 
ON blog_posts (published_at ASC) 
WHERE is_published = true AND indexed_at IS NULL;

-- 30일 이상 지난 재전송 대상 인덱스
CREATE INDEX IF NOT EXISTS idx_blog_posts_reindex 
ON blog_posts (indexed_at ASC) 
WHERE is_published = true AND indexed_at IS NOT NULL;
