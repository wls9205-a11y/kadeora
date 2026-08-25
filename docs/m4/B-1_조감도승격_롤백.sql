-- M4 B-1 — 조감도 라이선스 등급 승격 · 백업과 롤백
-- 2026-08-25
--
-- ⚠️ 이 작업은 «사용자가 위험을 인지하고 지시한» 항목이다 (M4 §B-1).
--    공공누리 유형을 확인하지 못했다 — 공공데이터포털이 자동 접근을 막아
--    이용허락범위를 읽지 못했다. 확인된 것은 데이터셋 설명에 조감도·전경 이미지
--    경로가 «개방 항목으로 명시» 돼 있다는 것뿐이다.
--
--    게이트가 만들어진 이유가 코드에 남아 있다 (src/lib/apt/hero-license.ts):
--      "네이버 심사 반려 한 번이면 광고 계정 전체가 묶인다. 조감도 174장보다 계정이 크다."
--
--    지금은 광고를 실제로 태운 상태다(부울경 2,318키워드). 반려 시 손실이 더 크다.
--    문제가 생기면 아래 롤백을 «즉시» 실행할 것.


-- ────────────────────────────────────────────────────────────
-- 1. 백업 (이미 생성됨 — 재실행 금지)
-- ────────────────────────────────────────────────────────────
-- CREATE TABLE public.apt_hero_tier_backup_20260825 AS
-- SELECT id, slug, hero_license_tier, hero_image_source, hero_image_credit
-- FROM public.apt_sites WHERE hero_image_url IS NOT NULL;
--
-- 생성 시점 분포: 총 182행 · confirmed 4 · review 172 · tier없음 6 · blocked 0


-- ────────────────────────────────────────────────────────────
-- 2. 승격 (실행한 것)
-- ────────────────────────────────────────────────────────────
-- ⚠️ 조건 셋이 전부 안전장치다. 하나라도 빼지 말 것.
--    hero_image_source='developer'  → 위성(satellite) 2건을 조감도 자리에 넣지 않는다
--    hero_image_credit <> ''        → 출처를 못 밝히는 이미지는 올리지 않는다
--    tier <> 'blocked'              → blocked 는 출처 불명. 절대 승격 금지
--
-- UPDATE public.apt_sites
-- SET hero_license_tier = 'confirmed'
-- WHERE hero_license_tier IS DISTINCT FROM 'confirmed'
--   AND coalesce(hero_license_tier, '') <> 'blocked'
--   AND hero_image_source = 'developer'
--   AND coalesce(hero_image_url, '') <> ''
--   AND coalesce(hero_image_credit, '') <> '';


-- ────────────────────────────────────────────────────────────
-- 3. 롤백 — 문제가 생기면 이것만 실행하면 된다
-- ────────────────────────────────────────────────────────────
UPDATE public.apt_sites a
SET hero_license_tier = b.hero_license_tier
FROM public.apt_hero_tier_backup_20260825 b
WHERE a.id = b.id
  AND a.hero_license_tier IS DISTINCT FROM b.hero_license_tier;

-- 롤백 확인 — 셋 다 0이어야 한다
SELECT count(*) AS 아직_다른_행
FROM public.apt_sites a
JOIN public.apt_hero_tier_backup_20260825 b ON b.id = a.id
WHERE a.hero_license_tier IS DISTINCT FROM b.hero_license_tier;


-- ────────────────────────────────────────────────────────────
-- 4. 특정 현장만 되돌리기 (한 건이 문제일 때)
-- ────────────────────────────────────────────────────────────
-- UPDATE public.apt_sites a
-- SET hero_license_tier = b.hero_license_tier
-- FROM public.apt_hero_tier_backup_20260825 b
-- WHERE a.id = b.id AND a.slug = '여기에-슬러그';

-- 아예 못 쓰게 막으려면 (되돌리는 게 아니라 차단):
-- UPDATE public.apt_sites SET hero_license_tier = 'blocked' WHERE slug = '여기에-슬러그';
