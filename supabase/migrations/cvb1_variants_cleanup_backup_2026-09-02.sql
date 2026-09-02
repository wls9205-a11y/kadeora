-- CV-B ① — 별칭 조각 정리(355건)의 되돌림 스냅샷 (2026-09-02, 프로덕션 적용 완료)
--
-- 삭제 «전» 에 지울 원소를 통째로 떠 둔다. 정리는 패턴 일괄이 아니라 이 표의 목록으로만 한다
-- (패턴 `^[가-힣] ` 이면 「더 팰리스트 데시앙」·「라 아르티엠 테라스」 같은 정식명 45건을
--  함께 지운다 — Node 독립 검증에서도 같은 결론).
--
--   tag a = 「<한 글자> + 대표명 그대로」          344건 / 339현장
--   tag b = 「<한 글자> + 브랜드」                   9건 (「중 데시앙」·「남 포레나」·「중 더샵」…)
--   tag c = 수기 2건 (「남 감만1 재개발」·「남 우동2재개발 재개발」)
--
-- 되돌림:
--   UPDATE apt_sites s SET name_variants = s.name_variants || to_jsonb(b.removed_variant)
--   FROM apt_variants_cleanup_backup_20260902 b WHERE b.site_id = s.id;

CREATE TABLE IF NOT EXISTS public.apt_variants_cleanup_backup_20260902 (
  id              bigserial primary key,
  site_id         uuid not null,
  slug            text not null,
  site_name       text not null,
  removed_variant text not null,
  tag             text not null,
  removed_at      timestamptz not null default now()
);

COMMENT ON TABLE public.apt_variants_cleanup_backup_20260902 IS
  'CV-B ① 별칭 조각 정리(2026-09-02)의 되돌림 스냅샷. tag: a=<한글자>+대표명 / b=<한글자>+브랜드 / c=수기.';

INSERT INTO public.apt_variants_cleanup_backup_20260902 (site_id, slug, site_name, removed_variant, tag)
SELECT id, slug, name, val, tag FROM (
  SELECT s.id, s.slug, s.name, v.val,
         CASE
           WHEN char_length(split_part(v.val,' ',1)) = 1
            AND split_part(v.val,' ',1) ~ '[가-힣]'
            AND replace(substr(v.val,3),' ','') = replace(s.name,' ','')          THEN 'a'
           WHEN char_length(split_part(v.val,' ',1)) = 1
            AND split_part(v.val,' ',1) ~ '[가-힣]'
            AND array_length(string_to_array(v.val,' '),1) = 2
            AND split_part(v.val,' ',2) IN ('래미안','자이','힐스테이트','푸르지오','아크로',
                 '더샵','롯데캐슬','포레나','호반써밋','아이파크','두산위브','데시앙','비스타') THEN 'b'
           WHEN (s.slug, v.val) IN (('부산-감만1-재개발','남 감만1 재개발'),
                                    ('우동2재개발-재개발','남 우동2재개발 재개발'))          THEN 'c'
         END AS tag
  FROM apt_sites s,
       LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(s.name_variants)='array' THEN s.name_variants ELSE '[]'::jsonb END
       ) v(val)
  WHERE s.is_active
) t
WHERE tag IS NOT NULL;

-- 집행(2026-09-02): 백업 355 = 삭제 355 · 342현장.
-- UPDATE apt_sites s SET name_variants = (
--   SELECT coalesce(jsonb_agg(v.val ORDER BY v.ord), '[]'::jsonb)
--   FROM jsonb_array_elements_text(s.name_variants) WITH ORDINALITY AS v(val, ord)
--   WHERE NOT EXISTS (SELECT 1 FROM apt_variants_cleanup_backup_20260902 b
--                     WHERE b.site_id = s.id AND b.removed_variant = v.val))
-- WHERE s.id IN (SELECT site_id FROM apt_variants_cleanup_backup_20260902);
