-- [P0-SAMIK-IMAGES] 세션 140 — 삼익비치 10편 이미지 긴급 백필
-- 본 마이그레이션은 DB에 이미 적용된 INSERT/UPDATE의 audit 기록.
-- 실제 apply는 MCP execute_sql 로 진행됨.
--
-- 내용:
--  1) blog_post_images: 삼익비치 10편 × 4장 (광안대교 2종 + 광안리 야경 + 카더라 OG 인포그래픽)
--     총 40 rows, image_type: stock_photo(3) + infographic(1)
--     출처: Wikimedia Commons (CC BY-SA 3.0/4.0) + 카더라 자체 OG
--  2) blog_posts.cover_image: OG 이미지 → 광안대교 Wikimedia 실사진 교체
--  3) blog_posts.content 앞부분에 광안대교 마크다운 이미지 삽입
--     (이미 포함된 글은 건너뛰도록 NOT LIKE 가드 적용)

-- 1. 이미지 INSERT (3장 스톡 포토)
INSERT INTO public.blog_post_images (post_id, image_url, alt_text, caption, image_type, position)
SELECT s.id, v.url, s.title || ' — ' || v.alt_suffix, v.caption, v.itype, v.pos
FROM (SELECT id, title FROM public.blog_posts WHERE slug LIKE 'samik-beach%') s
CROSS JOIN (VALUES
  ('https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Gwangandaegyo_Bridge.jpg/1280px-Gwangandaegyo_Bridge.jpg', '광안대교 전경', '출처: Wikimedia Commons (CC BY-SA 3.0)', 'stock_photo', 0),
  ('https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gwangalli_Beach_in_the_evening.jpg/1280px-Gwangalli_Beach_in_the_evening.jpg', '광안리해수욕장 야경', '출처: Wikimedia Commons (CC BY-SA 4.0)', 'stock_photo', 1),
  ('https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Gwangan_Bridge_Busan.jpg/1280px-Gwangan_Bridge_Busan.jpg', '부산 광안 전경', '출처: Wikimedia Commons', 'stock_photo', 2)
) AS v(url, alt_suffix, caption, itype, pos)
ON CONFLICT (post_id, image_url) DO NOTHING;

-- 2. 카더라 OG 인포그래픽 추가 (position=3)
INSERT INTO public.blog_post_images (post_id, image_url, alt_text, caption, image_type, position)
SELECT
  id,
  'https://kadeora.app/api/og?title=' || replace(replace(replace(title, '|', ''), '·', ' '), ' ', '%20') || '&category=apt&design=2&author=%EC%B9%B4%EB%8D%94%EB%9D%BC',
  title || ' — 카더라 분석 인포그래픽',
  '카더라 데이터 분석',
  'infographic',
  3
FROM public.blog_posts
WHERE slug LIKE 'samik-beach%'
ON CONFLICT (post_id, image_url) DO NOTHING;

-- 3. cover_image 광안대교 실사진으로 교체
UPDATE public.blog_posts
SET cover_image = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Gwangandaegyo_Bridge.jpg/1280px-Gwangandaegyo_Bridge.jpg',
    image_alt = title || ' — 광안대교·삼익비치 재건축',
    updated_at = NOW()
WHERE slug LIKE 'samik-beach%';

-- 4. 본문 상단 인라인 이미지 삽입 (멱등)
UPDATE public.blog_posts
SET content = '![광안대교 전경 — 삼익비치 광안리 오션프론트](https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Gwangandaegyo_Bridge.jpg/1280px-Gwangandaegyo_Bridge.jpg)' || E'\n' ||
              '*출처: Wikimedia Commons (CC BY-SA 3.0) · 삼익비치는 광안대교 정면에 위치.*' || E'\n\n' ||
              content,
    updated_at = NOW()
WHERE slug LIKE 'samik-beach%'
  AND content NOT LIKE '%Gwangandaegyo_Bridge%';
