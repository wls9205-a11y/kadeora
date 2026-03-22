-- ============================================================
-- 카더라 블로그 스팸 방지 마이그레이션
-- 2026-03-22 세션 18
-- 
-- 목적:
-- 1. published_at 컬럼 추가 (created_at과 분리)
-- 2. 미래 날짜 글 수정
-- 3. 발행 큐 시스템 (is_published=false → 크론으로 순차 발행)
-- 4. 하루 발행량 제한 함수
-- 5. 유사도 체크 함수
-- ============================================================

-- 1. published_at 컬럼 추가
-- created_at = DB INSERT 시각 (내부 기록용)
-- published_at = 실제 발행 시각 (검색엔진/UI에 노출)
ALTER TABLE public.blog_posts 
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 기존 published 글에 대해 published_at 세팅
-- 미래 날짜인 경우 → 오늘 이전 날짜로 분산 배치
-- 과거 날짜인 경우 → created_at 그대로 유지
UPDATE public.blog_posts
SET published_at = CASE
  WHEN created_at > NOW() THEN
    -- 미래 날짜 글: 과거 12개월 내로 랜덤 분산
    NOW() - (random() * interval '365 days')
  ELSE
    created_at
  END
WHERE is_published = true AND published_at IS NULL;

-- 미발행 글은 published_at을 NULL로 유지
-- (크론이 순차 발행할 때 세팅)

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at 
  ON public.blog_posts(published_at DESC NULLS LAST)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_blog_posts_publish_queue
  ON public.blog_posts(created_at ASC)
  WHERE is_published = false AND published_at IS NULL;

-- 3. 하루 발행량 확인 함수
CREATE OR REPLACE FUNCTION public.get_today_blog_publish_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.blog_posts
    WHERE published_at >= CURRENT_DATE
      AND published_at < CURRENT_DATE + interval '1 day'
      AND is_published = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 안전한 블로그 발행 함수 (하루 최대 3개 제한)
CREATE OR REPLACE FUNCTION public.publish_blog_post(
  p_id BIGINT,
  p_daily_limit INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_today_count INTEGER;
  v_result JSONB;
BEGIN
  -- 오늘 발행 건수 확인
  SELECT public.get_today_blog_publish_count() INTO v_today_count;
  
  IF v_today_count >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'daily_limit_reached',
      'today_count', v_today_count,
      'limit', p_daily_limit
    );
  END IF;
  
  -- 발행 처리
  UPDATE public.blog_posts
  SET is_published = true,
      published_at = NOW(),
      updated_at = NOW()
  WHERE id = p_id
    AND (is_published = false OR published_at IS NULL);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not_found_or_already_published'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'published_at', NOW(),
    'today_count', v_today_count + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 제목 유사도 체크 함수 (pg_trgm 활용)
-- 새 글 INSERT 전에 중복/유사 글이 있는지 확인
CREATE OR REPLACE FUNCTION public.check_blog_similarity(
  p_title TEXT,
  p_threshold REAL DEFAULT 0.4
)
RETURNS TABLE(
  id BIGINT,
  title TEXT,
  slug TEXT,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    similarity(bp.title, p_title) AS similarity
  FROM public.blog_posts bp
  WHERE similarity(bp.title, p_title) > p_threshold
    AND bp.is_published = true
  ORDER BY similarity(bp.title, p_title) DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 발행 큐에서 다음 발행할 글 가져오기
CREATE OR REPLACE FUNCTION public.get_next_blog_to_publish(
  p_daily_limit INTEGER DEFAULT 3
)
RETURNS TABLE(
  id BIGINT,
  title TEXT,
  slug TEXT,
  category TEXT
) AS $$
DECLARE
  v_today_count INTEGER;
BEGIN
  SELECT public.get_today_blog_publish_count() INTO v_today_count;
  
  IF v_today_count >= p_daily_limit THEN
    RETURN; -- 빈 결과
  END IF;
  
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.category
  FROM public.blog_posts bp
  WHERE bp.is_published = false
    AND bp.published_at IS NULL
  ORDER BY bp.created_at ASC
  LIMIT (p_daily_limit - v_today_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 미래 날짜 created_at도 정리
-- created_at이 미래인 글은 Supabase가 자동 생성한 NOW()가 아닌
-- 수동으로 미래 날짜를 넣은 것이므로 과거로 분산
UPDATE public.blog_posts
SET created_at = NOW() - (random() * interval '180 days')
WHERE created_at > NOW();
