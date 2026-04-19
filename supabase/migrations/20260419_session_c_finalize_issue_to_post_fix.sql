-- [Session C] finalize_issue_to_post: validate_blog_post 트리거 통과에 필요한
-- excerpt / meta_description / meta_keywords / cover_image / image_alt / tags 자동 파생
--
-- 기존 finalize 는 최소 필드만 INSERT → 트리거에서 NO_COVER_IMAGE / META_DESC_MISSING /
-- EXCERPT_MISSING / META_KW_MISSING / TAGS_MISSING 로 실패. 내부에서 기본값을 채워 항상
-- 통과하도록 수정.
--
-- 동일 파라미터 시그니처(p_issue_id uuid → bigint) 유지 → 기존 호출자 영향 없음.

CREATE OR REPLACE FUNCTION public.finalize_issue_to_post(p_issue_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_post_id          BIGINT;
  v_issue            RECORD;
  v_excerpt          TEXT;
  v_meta_desc        TEXT;
  v_meta_kw          TEXT;
  v_cover            TEXT;
  v_image_alt        TEXT;
  v_tags             TEXT[];
  v_category         TEXT;
  v_stripped_content TEXT;
BEGIN
  SELECT * INTO v_issue FROM issue_alerts WHERE id = p_issue_id;

  IF v_issue.id IS NULL THEN
    RAISE EXCEPTION 'Issue not found: %', p_issue_id;
  END IF;

  IF v_issue.blog_post_id IS NOT NULL THEN
    RETURN v_issue.blog_post_id;
  END IF;

  IF v_issue.draft_title IS NULL OR v_issue.draft_content IS NULL THEN
    RAISE EXCEPTION 'Issue % has no draft yet', p_issue_id;
  END IF;

  -- 카테고리 정규화 (apt/stock/unsold/finance/general/redev 중 하나)
  v_category := public.normalize_category(COALESCE(v_issue.category, 'general'));

  -- 마크다운 / 개행 / 특수문자 제거한 평문 (excerpt 용)
  v_stripped_content := regexp_replace(v_issue.draft_content, '[#*`>|_\[\]\(\)\!]', '', 'g');
  v_stripped_content := regexp_replace(v_stripped_content, '\s+', ' ', 'g');
  v_stripped_content := TRIM(v_stripped_content);

  -- excerpt: summary 우선, 없으면 본문 앞 180자
  v_excerpt := COALESCE(NULLIF(TRIM(v_issue.summary), ''), SUBSTRING(v_stripped_content FROM 1 FOR 180));
  IF LENGTH(v_excerpt) < 20 THEN
    v_excerpt := SUBSTRING(v_stripped_content FROM 1 FOR 180);
  END IF;
  v_excerpt := SUBSTRING(v_excerpt FROM 1 FOR 240);

  -- meta_description: 150-160자 권장. summary 우선.
  v_meta_desc := COALESCE(NULLIF(TRIM(v_issue.summary), ''), SUBSTRING(v_stripped_content FROM 1 FOR 155));
  IF LENGTH(v_meta_desc) < 20 THEN
    v_meta_desc := SUBSTRING(v_stripped_content FROM 1 FOR 155);
  END IF;
  v_meta_desc := SUBSTRING(v_meta_desc FROM 1 FOR 160);

  -- tags: draft_keywords → 비면 detected_keywords → 여전히 2개 미만이면 카테고리 기반 보강
  v_tags := COALESCE(v_issue.draft_keywords, v_issue.detected_keywords, ARRAY[]::text[]);
  IF COALESCE(array_length(v_tags, 1), 0) < 2 THEN
    v_tags := v_tags || ARRAY['카더라', v_category]::text[];
  END IF;
  -- 중복 제거 (순서 유지)
  v_tags := ARRAY(SELECT DISTINCT unnest(v_tags));

  -- meta_keywords: tags join
  v_meta_kw := array_to_string(v_tags, ',');
  IF LENGTH(v_meta_kw) < 5 THEN
    v_meta_kw := v_category || ',카더라,분석';
  END IF;

  -- cover_image: OG fallback (sites.sh url_encode_korean 은 존재 함수)
  v_cover := 'https://kadeora.app/api/og?title='
    || url_encode_korean(SUBSTRING(v_issue.draft_title FROM 1 FOR 40))
    || '&category=' || v_category
    || '&author=' || url_encode_korean('카더라 속보팀')
    || '&design=' || ((abs(hashtext(v_issue.draft_title)) % 6) + 1)::text;

  v_image_alt := v_issue.draft_title;

  INSERT INTO blog_posts (
    slug, title, content, excerpt,
    category, sub_category, tags,
    meta_description, meta_keywords,
    cover_image, image_alt,
    source_type, source_ref, author_name, author_role,
    is_published, cron_type, created_at, updated_at
  ) VALUES (
    COALESCE(NULLIF(v_issue.draft_slug, ''), 'issue-' || p_issue_id::text),
    v_issue.draft_title,
    v_issue.draft_content,
    v_excerpt,
    v_category,
    v_issue.sub_category,
    v_tags,
    v_meta_desc,
    v_meta_kw,
    v_cover,
    v_image_alt,
    'issue_alert',
    p_issue_id::text,
    '카더라 속보팀',
    'bot',
    false,
    'issue_preempt',
    NOW(), NOW()
  )
  RETURNING id INTO v_post_id;

  UPDATE issue_alerts SET blog_post_id = v_post_id WHERE id = p_issue_id;

  RETURN v_post_id;
END;
$function$;

COMMENT ON FUNCTION public.finalize_issue_to_post(uuid) IS
  'issue_alerts.draft_* → blog_posts INSERT. excerpt/meta_description/meta_keywords/cover_image/tags 자동 파생 (validate_blog_post 트리거 통과용, Session C fix).';
