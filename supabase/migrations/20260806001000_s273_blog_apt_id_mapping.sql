-- s273 — blog_posts.metadata.apt_id 매핑 규약
--
-- 규약:
--   blog_posts.metadata.apt_id (number) = apt_subscriptions.id
--   청약 공고 1건에 대응하는 분석글을 가리킨다. /apt 하단 '관련 청약 분석' 이 이 키로 조회.
--
-- 기입 주체:
--   (1) pg_cron 'kadeora-series-autopublish' (job 160) 가 발행 시점에 자동 기입
--   (2) scripts/backfill-blog-apt-id.mjs 가 기발행분을 소급 기입
--
-- 매칭은 "제목이 공고명을 통째로 포함" 하는 strict 매칭만 인정한다.
-- 느슨한 매칭(첫 단어 ILIKE 등)은 '힐스테이트 아이코닉' → 무관한 힐스테이트 140건 처럼
-- 확실히 틀린 링크를 만든다. 못 찾으면 NULL 로 두는 편이 낫다.
--
-- Architecture Rule #76: blog_posts 는 DELETE 금지. 여기서도 metadata 키 추가만 하고
--   content/title/slug/is_published/published_at 은 일절 건드리지 않는다.
-- Architecture Rule #56: SET search_path 필수.
-- Architecture Rule #63: REVOKE 는 PUBLIC 까지.
-- Architecture Rule #73: idempotent + reversible.
--
-- DOWN:
--   SELECT cron.schedule('kadeora-series-autopublish', '0 22 * * *', $old$
--     WITH pub AS (
--       UPDATE blog_posts SET is_published = true, published_at = now()
--       WHERE is_published = false AND cron_type = 'series-scheduled'
--         AND (metadata->>'publish_on')::date <= (now() AT TIME ZONE 'Asia/Seoul')::date
--       RETURNING slug
--     )
--     INSERT INTO indexnow_queue (url, priority, is_urgent, source, status, queued_at)
--     SELECT 'https://kadeora.app/blog/' || slug, 100, true, 'series-auto', 'pending', now()
--     FROM pub $old$);
--   DROP FUNCTION IF EXISTS public.fn_series_autopublish_tick();
--   DROP FUNCTION IF EXISTS public.fn_blog_assign_apt_id(bigint);
--   DROP FUNCTION IF EXISTS public.fn_blog_match_apt_id(text);
--   DROP INDEX IF EXISTS public.idx_blog_posts_metadata_apt_id;

-- ---------------------------------------------------------------------------
-- 1. 제목 → apt_subscriptions.id strict 매처
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_blog_match_apt_id(p_title text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT s.id
  FROM apt_subscriptions s
  WHERE p_title IS NOT NULL
    AND s.house_nm IS NOT NULL
    -- 5자 미만 공고명은 우연 일치가 너무 잦다
    AND length(s.house_nm) >= 5
    AND position(replace(s.house_nm, ' ', '') IN replace(p_title, ' ', '')) > 0
  -- 가장 긴(=가장 구체적인) 공고명 우선, 동률이면 최신 접수건
  ORDER BY length(s.house_nm) DESC, s.rcept_endde DESC NULLS LAST, s.id DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.fn_blog_match_apt_id(text) IS
  's273 블로그 제목 → apt_subscriptions.id strict 매칭. 못 찾으면 NULL.';

-- ---------------------------------------------------------------------------
-- 2. 한 글에 apt_id 기입 (metadata 병합 — 기존 키 보존)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_blog_assign_apt_id(p_post_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title  text;
  v_meta   jsonb;
  v_apt_id bigint;
BEGIN
  SELECT title, coalesce(metadata, '{}'::jsonb) INTO v_title, v_meta
  FROM blog_posts WHERE id = p_post_id;

  IF v_title IS NULL THEN
    RETURN NULL;
  END IF;

  -- 이미 기입돼 있으면 덮어쓰지 않는다 (수동 교정 보호)
  IF v_meta ? 'apt_id' AND v_meta->>'apt_id' IS NOT NULL THEN
    RETURN (v_meta->>'apt_id')::bigint;
  END IF;

  v_apt_id := public.fn_blog_match_apt_id(v_title);
  IF v_apt_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- metadata 병합만. 본문/발행상태는 건드리지 않는다 (Rule #76).
  UPDATE blog_posts
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('apt_id', v_apt_id)
  WHERE id = p_post_id;

  RETURN v_apt_id;
END;
$$;

COMMENT ON FUNCTION public.fn_blog_assign_apt_id(bigint) IS
  's273 blog_posts.metadata.apt_id 기입. 기존 값이 있으면 보존. content 는 불변.';

-- ---------------------------------------------------------------------------
-- 3. series-autopublish 한 틱 — 발행 + indexnow + apt_id 기입
--    기존 job 160 의 인라인 SQL 을 함수로 옮겨 버전 관리 대상으로 만든다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_series_autopublish_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids    bigint[];
  v_slugs  text[];
  v_id     bigint;
  v_mapped integer := 0;
BEGIN
  WITH pub AS (
    UPDATE blog_posts
    SET is_published = true, published_at = now()
    WHERE is_published = false
      AND cron_type = 'series-scheduled'
      AND (metadata->>'publish_on')::date <= (now() AT TIME ZONE 'Asia/Seoul')::date
    RETURNING id, slug
  )
  SELECT array_agg(id), array_agg(slug) INTO v_ids, v_slugs FROM pub;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('published', 0, 'mapped', 0);
  END IF;

  INSERT INTO indexnow_queue (url, priority, is_urgent, source, status, queued_at)
  SELECT 'https://kadeora.app/blog/' || s, 100, true, 'series-auto', 'pending', now()
  FROM unnest(v_slugs) AS s;

  -- apt_id 기입은 발행 UPDATE 와 같은 statement 안에서 하면 CTE 스냅샷과 충돌한다.
  -- 별도 루프로 분리.
  FOREACH v_id IN ARRAY v_ids LOOP
    IF public.fn_blog_assign_apt_id(v_id) IS NOT NULL THEN
      v_mapped := v_mapped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('published', array_length(v_ids, 1), 'mapped', v_mapped);
END;
$$;

COMMENT ON FUNCTION public.fn_series_autopublish_tick() IS
  's273 series-scheduled 자동 발행 1틱. 발행 + indexnow 큐잉 + metadata.apt_id 자동 기입.';

-- ---------------------------------------------------------------------------
-- 4. 권한 — cron(postgres) / service_role 만
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_blog_assign_apt_id(bigint)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_series_autopublish_tick()    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_blog_assign_apt_id(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_series_autopublish_tick()  TO service_role;

-- 매처는 읽기 전용이라 조회용으로 열어둔다
REVOKE ALL ON FUNCTION public.fn_blog_match_apt_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_blog_match_apt_id(text) TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- 5. /apt 관련글 조회용 인덱스
--    쿼리 형태: is_published = true AND metadata->>'apt_id' IN (...)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_blog_posts_metadata_apt_id
  ON blog_posts ((metadata->>'apt_id'))
  WHERE is_published = true AND metadata ? 'apt_id';

-- ---------------------------------------------------------------------------
-- 6. pg_cron job 160 을 함수 호출로 교체 (동일 jobname → upsert)
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'kadeora-series-autopublish',
  '0 22 * * *',
  $cron$SELECT public.fn_series_autopublish_tick();$cron$
);

NOTIFY pgrst, 'reload schema';
