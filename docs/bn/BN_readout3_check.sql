-- BN 3차 판독 기계 점검 (다이어트 규격 3항 포함) — 세션 A 판독 입력
-- 분량은 blog_posts.content(보강 후) 기준 — 푸터·시각화 블록이 붙어 규격(3,000~4,500자)보다 수백 자 길 수 있다.
--   본문 순수 분량은 「## 관련 정보」 앞까지(body_len)로 본다.
WITH d AS (
  SELECT b.id, i.raw_data->>'slug' slug, b.title, b.auto_unpublished_reason r, b.hub_apt_slug, b.cover_image, b.content,
         i.raw_data->'scan2' s2
  FROM issue_alerts i JOIN blog_posts b ON b.id = i.blog_post_id
  WHERE i.source_type = 'bn_hub' AND i.raw_data->>'regen_after' = 'bn_b2_diet_20260919'
)
SELECT id, slug, left(title, 50) title, r,
  length(content) len,
  length(CASE WHEN strpos(content, E'\n## 관련 정보') > 0 THEN substring(content, 1, strpos(content, E'\n## 관련 정보')) ELSE content END) body_len,
  (SELECT count(*) FROM regexp_matches(content, '^## ', 'gm')) h2,
  (SELECT string_agg(m[1], ' / ') FROM regexp_matches(content, '^## ([^\n]*(청약 자격|가점|취득세|양도세|세액공제|LTV|DSR|대출|전매|재당첨|시나리오|전망)[^\n]*)', 'gm') m) forbidden_h2,
  (SELECT count(*) FROM regexp_matches(content, '^(?:#{2,4}\s*)?(?:\*\*)?Q[.0-9]', 'gm')) faq,
  (hub_apt_slug = slug) hub_ok,
  (cover_image ~ '^(/|https?://([a-z0-9-]+\.)*(kadeora\.app|supabase\.co))') own_cover,
  jsonb_array_length(coalesce(s2->'defects', '[]'::jsonb)) scan2_defects,
  (s2->>'edited')::boolean edited,
  jsonb_array_length(coalesce(s2->'edited_out', '[]'::jsonb)) edited_out
FROM d ORDER BY id;
