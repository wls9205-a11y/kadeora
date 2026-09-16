-- K-1 ③ + SD-1 데이터 정리 (2026-09-16 · 세션 A 승인분)
--
-- 이 파일은 «이미 적용된» 것의 기록이다. 두 갈래가 한 몸이라 한 파일에 둔다:
--   ① SD-1 이 만든 오염을 «데이터에서» 걷어낸다 (코드 가드는 커밋 a9ce39a1 이 이미 막았다)
--   ② 그 표면(apt 상세)이 색인 큐에 «들어갈 길» 을 낸다

-- ─────────────────────────────────────────────────────────────
-- ① apt_complex_profiles.images 이중 인코딩 정리 — 9,699행
--
-- 정체: 원소가 이미지 객체의 «JSON 텍스트» 였다(jsonb_array_elements_text 가 객체를
--       텍스트로 뭉갠 결과). 그 문자열이 <img src> 로 나가 상대 URL 로 해석되면서
--       /apt/complex/{JSON} 쓰레기 URL 약 8,900개를 만들었다.
-- 무손실 확인: 48,640개 원소 전부 IS JSON OBJECT 통과(실패 0) — 변환 «전에» 쟀다.
-- 가역: images_backup_sd1 에 원본을 떠 두었다. 되돌리려면 images = images_backup_sd1.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE apt_complex_profiles ADD COLUMN IF NOT EXISTS images_backup_sd1 jsonb;

COMMENT ON COLUMN apt_complex_profiles.images_backup_sd1 IS
  'SD-1(2026-09-16) 이중 인코딩 정리 «이전» 원본. 이 열이 NULL 이 아닌 행만 정리 대상이었다.';

-- 1단: 되돌릴 자리를 «먼저» 만든다. (실행 결과: 9,699행 = 오염 9,699행, 정확히 일치)
UPDATE apt_complex_profiles
SET images_backup_sd1 = images
WHERE jsonb_typeof(images) = 'array'
  AND images_backup_sd1 IS NULL
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(images) e
              WHERE jsonb_typeof(e) = 'string' AND e #>> '{}' LIKE '{%');

-- 2단: 텍스트를 다시 객체로. ⚠️ WITH ORDINALITY 로 «원소 순서» 를 보존한다 —
--      이미지 순서가 대표 이미지(0번)를 정하므로 섞이면 커버가 바뀐다.
UPDATE apt_complex_profiles p
SET images = (
  SELECT jsonb_agg(
           CASE WHEN jsonb_typeof(t.e) = 'string' AND (t.e #>> '{}') IS JSON OBJECT
                THEN (t.e #>> '{}')::jsonb
                ELSE t.e END
           ORDER BY t.ord)
  FROM jsonb_array_elements(p.images) WITH ORDINALITY AS t(e, ord)
)
WHERE p.images_backup_sd1 IS NOT NULL
  AND jsonb_typeof(p.images) = 'array';

-- 검증(실행 결과): 남은 오염 0 · url 키를 가진 객체 보유 행 9,699 · 길이 불일치 0.
-- ⚠️ 「오염이 사라졌는가」만 보지 않고 「객체가 생겼는가」를 «긍정형» 으로 같이 셌다.

-- ─────────────────────────────────────────────────────────────
-- ② apt_sites → indexnow_queue 트리거 신설
--
-- 왜: 색인 큐의 원천이 blog 편향이었다. 실측 11,355행 중 /apt/ 는 318행(2.8%)이고
--     트리거는 blog_posts 에만 둘 있었다. 승부처 4현장의 상세 URL 은 큐에 들어간 적이 «없다».
-- ⛔ 전 UPDATE 발화 금지 — 크론이 만지는 열이 수십 개라 전건 발화면 큐가 노이즈로 넘치고,
--    그러면 진짜 신규가 뒤로 밀린다. 「색인 가치 필드」만 본다.
-- ⛔ 사이트맵에 오르지 않는 URL 은 제출하지 않는다. 사이트맵 컷과 «같은 값»(content_score>=25)이다 —
--    이 값이 바뀌면 여기도 같이 바꾼다(indexable.ts 가 금지한 「네 곳이 갈리면 클로킹」).
-- ⚠️ slug 에 한글이 있다. url_encode_korean 을 반드시 통과시킨다 — 빠뜨리면 IndexNow 가 받는
--    URL 과 사이트맵의 URL 이 «다른 문자열» 이 된다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_apt_site_enqueue_indexnow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_worthy boolean := false;
BEGIN
  IF NOT COALESCE(NEW.is_active, false)
     OR NEW.slug IS NULL OR NEW.slug = ''
     OR COALESCE(NEW.content_score, 0) < 25 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_worthy := true;
  ELSE
    v_worthy :=
         (OLD.name                  IS DISTINCT FROM NEW.name)
      OR (OLD.display_name          IS DISTINCT FROM NEW.display_name)
      OR (OLD.lifecycle_stage       IS DISTINCT FROM NEW.lifecycle_stage)
      OR (OLD.expected_sale_period  IS DISTINCT FROM NEW.expected_sale_period)
      OR (OLD.price_min             IS DISTINCT FROM NEW.price_min)
      OR (OLD.price_max             IS DISTINCT FROM NEW.price_max)
      OR (OLD.description           IS DISTINCT FROM NEW.description)
      OR (OLD.seo_title             IS DISTINCT FROM NEW.seo_title)
      OR (OLD.seo_description       IS DISTINCT FROM NEW.seo_description)
      OR (COALESCE(OLD.is_active, false) = false AND NEW.is_active = true);
  END IF;

  IF v_worthy THEN
    PERFORM enqueue_indexnow(
      'https://kadeora.app/apt/' || url_encode_korean(NEW.slug),
      false,
      CASE WHEN TG_OP = 'INSERT' THEN 'apt_site_create' ELSE 'apt_site_update' END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apt_site_indexnow_insert ON apt_sites;
CREATE TRIGGER trg_apt_site_indexnow_insert
  AFTER INSERT ON apt_sites
  FOR EACH ROW EXECUTE FUNCTION fn_apt_site_enqueue_indexnow();

DROP TRIGGER IF EXISTS trg_apt_site_indexnow_update ON apt_sites;
CREATE TRIGGER trg_apt_site_indexnow_update
  AFTER UPDATE ON apt_sites
  FOR EACH ROW EXECUTE FUNCTION fn_apt_site_enqueue_indexnow();

-- K-1 수집 요청 시드: 승부처 4현장(queue id 30381~30384로 적재됨).
--   SELECT enqueue_indexnow('https://kadeora.app/apt/' || url_encode_korean(slug), false, 'k1_seed')
--   FROM apt_sites WHERE slug IN ('해링턴-마레','연제-갤러리-자이','엄궁역-트라비스-하늘채','거제-옥포-공동주택');
