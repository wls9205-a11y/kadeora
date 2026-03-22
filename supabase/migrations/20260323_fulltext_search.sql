-- Full-Text Search: posts + blog_posts tsvector + GIN 인덱스
-- 한국어는 'simple' 사전 (공백 기반 토큰화)

-- 1. posts tsvector
ALTER TABLE posts ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_fts ON posts USING GIN (fts);

-- 2. blog_posts tsvector
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_blog_posts_fts ON blog_posts USING GIN (fts);

-- 3. search_posts_fts RPC
CREATE OR REPLACE FUNCTION search_posts_fts(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  title text,
  content text,
  created_at timestamptz,
  category text,
  likes_count int,
  comments_count int,
  author_id uuid,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tsq tsquery;
BEGIN
  tsq := plainto_tsquery('simple', p_query);
  RETURN QUERY
  SELECT
    p.id, p.title, p.content, p.created_at, p.category,
    p.likes_count, p.comments_count, p.author_id,
    ts_rank(p.fts, tsq) AS rank
  FROM posts p
  WHERE p.is_deleted = false
    AND p.fts @@ tsq
  ORDER BY rank DESC, p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4. search_blogs_fts RPC
CREATE OR REPLACE FUNCTION search_blogs_fts(
  p_query text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  slug text,
  title text,
  excerpt text,
  category text,
  created_at timestamptz,
  view_count int,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id, b.slug, b.title, b.excerpt, b.category,
    b.created_at, b.view_count,
    ts_rank(b.fts, plainto_tsquery('simple', p_query)) AS rank
  FROM blog_posts b
  WHERE b.is_published = true
    AND b.fts @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC, b.view_count DESC
  LIMIT p_limit;
END;
$$;
