-- M2 B-1 — apt_sites 중복 후보 추출 (읽기 전용)
-- 2026-08-25 · 아무것도 바꾸지 않는다. SELECT 만 있다.
-- 백업: apt_sites_backup_20260825 (6,316행, apt_sites 와 id 전수 일치 확인)
--
-- 실행:  psql "$SUPABASE_DB_URL" -f docs/m2/B-1_중복후보_추출.sql
-- 또는 Supabase SQL Editor 에 쿼리별로 붙여넣기.
--
-- ⚠️ 여기의 시공사 정규화는 B-1 후보 추출용 인라인 사전이다.
--    확정 사전과 builder_normalized 컬럼은 B-2 에서 만든다. 두 곳이 갈라지지 않게
--    B-2 때 이 CASE 문을 그대로 옮겨 쓰고, 여기서는 지운다.


-- ────────────────────────────────────────────────────────────
-- 유형 ① 브랜드명 ↔ 구역명 분리  →  54개 구역행 / 110쌍
--   판정: 같은 region + sigungu · 정규화 시공사 **집합 전체** 일치
--         · 한쪽만 정비사업 접미어 보유
--   ⚠️ M2 는 "시공사 첫 토큰 일치"라고 적었지만 첫 토큰만 쓰면 125쌍으로 흩어진다.
--      M2 가 든 대연3 예시(롯데건설, 현대산업개발 ↔ 롯데건설, HDC현대산업개발)가
--      성립하는 이유가 바로 **집합 일치**라서, 집합 기준으로 잡았다.
--   ⚠️ 후보수 > 1 이면 시공사만 같고 사업은 다른 오탐이 대부분이다.
--      아래 정렬에서 후보수 1 + 세대수 일치/구역세대 null 인 것부터 본다.
-- ────────────────────────────────────────────────────────────
WITH tok AS (
  SELECT a.id,
         btrim(regexp_replace(regexp_replace(t, '\(주\)|（주）|주식회사', '', 'g'), '\s+', '', 'g')) AS raw
  FROM apt_sites a,
       unnest(string_to_array(regexp_replace(coalesce(a.builder, ''), '[/·]', ',', 'g'), ',')) AS t
), ntok AS (
  SELECT id, CASE
    WHEN raw IN ('현대산업개발','아이파크현대산업개발','HDC현대산업개발')     THEN 'HDC현대산업개발'
    WHEN raw IN ('포스코건설','포스코이앤씨')                                 THEN '포스코이앤씨'
    WHEN raw IN ('코오롱','코오롱글로벌')                                     THEN '코오롱글로벌'
    WHEN raw IN ('지에스건설','GS건설')                                       THEN 'GS건설'
    WHEN raw IN ('에스케이건설','SK건설','SK에코플랜트','에스케이에코플랜트') THEN 'SK에코플랜트'
    WHEN raw IN ('디엘이앤씨','DL이앤씨','대림산업')                          THEN 'DL이앤씨'
    WHEN raw IN ('한화건설','한화건설부문','한화')                            THEN '한화'
    ELSE raw END AS nrm
  FROM tok WHERE raw <> ''
), bs AS (
  SELECT id, array_agg(DISTINCT nrm ORDER BY nrm) AS bset FROM ntok GROUP BY id
), s AS (
  SELECT a.id, a.slug, a.name, a.region, a.sigungu, a.is_active,
         a.content_score, a.total_units, a.lifecycle_stage, bs.bset
  FROM apt_sites a JOIN bs ON bs.id = a.id
)
SELECT z.region, z.sigungu,
       z.slug AS 구역slug, z.name AS 구역명, z.content_score AS 구역cs,
       coalesce(z.total_units::text, '-') AS 구역세대,
       array_to_string(z.bset, '+') AS 시공사,
       count(*) AS 후보수,
       string_agg(r.slug || ' | ' || r.name || ' (cs' || r.content_score || '/'
                  || coalesce(r.total_units::text, '-') || '세대)',
                  '  ||  ' ORDER BY r.content_score DESC, r.total_units DESC NULLS LAST) AS 브랜드후보
FROM s z
JOIN s r
  ON z.region = r.region
 AND z.sigungu IS NOT NULL AND z.sigungu = r.sigungu
 AND z.bset = r.bset
 AND z.name ~ '(가로주택정비|소규모재건축|재개발|재건축)'
 AND r.name !~ '(가로주택정비|소규모재건축|재개발|재건축)'
GROUP BY z.region, z.sigungu, z.slug, z.name, z.content_score, z.total_units, z.bset
ORDER BY count(*), z.region, z.sigungu, z.name;


-- ────────────────────────────────────────────────────────────
-- 유형 ② 같은 구역이 정비사업 유형만 바꿔 여러 번 등록  →  42구역 / 87행
--   M2 의 "42건"과 정확히 일치한다.
--   ⚠️ M2 는 재개발/재건축 두 축으로만 적었지만, 실제로는 가로주택정비 ·
--      소규모재건축 · '구역' 표기 · 시·도 접두사까지 섞여 있다.
--      재개발/재건축만 보면 14쌍밖에 안 잡힌다 (괴정3·낙민1·명장2 를 놓친다).
--   ⚠️ 3행짜리 구역이 3개 있다: 거제3 · 괴정3 · 당리2.
--   ⚠️ 남천2-3(삼익비치) 은 **이름이 완전히 같은 2행**(슬러그만 다름)이다.
--      M2 의 "남천2 시리즈 병합 금지"는 삼익비치/삼익타워/삼익빌라를 서로
--      합치지 말라는 뜻이므로 이 건과는 별개다. 그래도 사람이 확인할 것.
-- ────────────────────────────────────────────────────────────
WITH j AS (
  SELECT id, slug, name, region, sigungu, is_active, content_score, total_units,
         builder, lifecycle_stage,
         btrim(regexp_replace(regexp_replace(regexp_replace(name,
           '(가로주택정비사업|가로주택정비|소규모재건축|소규모재개발|재개발정비사업|재건축정비사업|재개발|재건축)', '', 'g'),
           '구역', '', 'g'), '\s+', ' ', 'g')) AS b1
  FROM apt_sites
  WHERE name ~ '(가로주택정비|소규모재건축|소규모재개발|재개발|재건축)'
), k AS (
  SELECT *, btrim(regexp_replace(b1,
    '^(부산|울산|경남|서울|경기|인천|대구|경북|대전|충남|충북|세종|광주|전남|전북|강원|제주)\s+', '')) AS base
  FROM j
), g AS (
  SELECT region, base FROM k WHERE base <> '' GROUP BY region, base HAVING count(*) > 1
)
SELECT k.region, k.base AS 구역, count(*) AS 행수,
       string_agg(k.slug, '  ||  ' ORDER BY k.content_score DESC, k.name) AS slugs,
       string_agg(k.name || ' [cs' || k.content_score || '/'
         || coalesce(k.total_units::text, '-') || '세대/'
         || CASE WHEN k.is_active THEN 'ON' ELSE 'OFF' END || '/'
         || coalesce(nullif(k.builder, ''), '-') || '/'
         || coalesce(k.lifecycle_stage, '-') || ']',
         '  ||  ' ORDER BY k.content_score DESC, k.name) AS 구성행
FROM k JOIN g ON g.region = k.region AND g.base = k.base
GROUP BY k.region, k.base
ORDER BY count(*) DESC, k.region, k.base;


-- ────────────────────────────────────────────────────────────
-- B-4 후보  비활성 content_score 80+ 이면서, 더 낮은 점수의 활성 쌍둥이가 있는 행
--            →  46행
--   ⚠️ 단순 "비활성 + cs80+" 는 219행이다. M2 의 30건과는 어느 쪽도 맞지 않는다.
--      B-4 의 취지("좋은 페이지가 꺼지고 얇은 중복본이 살아 있다")를 그대로
--      조건으로 옮기면 46행이 된다.
--   ⚠️ 그런데 이 46행은 정비사업 중복이 아니라 **슬러그 규칙 교체 잔재**로 보인다.
--      OFF 쪽 슬러그에서 영문/블록 토큰이 빠져 있고(예: EBC-1BL → '--1'),
--      ON 쪽 슬러그가 '--' 를 가진 경우는 46행 중 0건이다(OFF 는 9건).
--      27/46 은 ON 행이 더 나중에 만들어졌다.
--      → **그대로 뒤집으면 깨진 슬러그의 중복 페이지가 되살아난다.** 사람이 확인할 것.
--   ⚠️ apt_site_events 에는 event_type='stage_change' 429행뿐이고
--      is_active 변경 이력은 남아 있지 않다. "누가 언제 왜 껐는지"는 이 테이블로 알 수 없다.
-- ────────────────────────────────────────────────────────────
WITH n AS (
  SELECT id, slug, name, region, is_active, content_score, total_units, created_at, updated_at,
         lower(regexp_replace(regexp_replace(regexp_replace(name,
           '^(부산|울산|경남|서울|경기|인천|대구|경북|대전|충남|충북|세종|광주|전남|전북|강원|제주)\s+', ''),
           '구역', '', 'g'), '\s+', '', 'g')) AS key
  FROM apt_sites
)
SELECT off.region,
       off.slug AS off_slug, off.name AS off_name, off.content_score AS off_cs,
       coalesce(off.total_units::text, '-') AS off_세대,
       off.slug ~ '--' AS off_슬러그깨짐,
       off.created_at::date AS off_생성,
       string_agg(on2.slug || ' (cs' || on2.content_score || ', 생성 '
                  || on2.created_at::date || ')',
                  '  ||  ' ORDER BY on2.content_score DESC) AS 활성쌍둥이
FROM n off
JOIN n on2
  ON off.key = on2.key AND off.region = on2.region AND off.id <> on2.id
WHERE NOT off.is_active AND off.content_score >= 80
  AND on2.is_active AND on2.content_score < off.content_score
GROUP BY off.region, off.slug, off.name, off.content_score, off.total_units, off.created_at
ORDER BY off.content_score DESC, off.region, off.name;


-- ────────────────────────────────────────────────────────────
-- 참고 — B-2 시공사 정규화가 실제로 붙을 대상 규모
-- ────────────────────────────────────────────────────────────
SELECT count(*) FILTER (WHERE builder IS NULL OR btrim(builder) = '') AS 시공사없음,
       count(*) FILTER (WHERE builder LIKE '%,%')                     AS 컨소시엄_쉼표,
       count(*) FILTER (WHERE builder LIKE '%(주)%')                  AS 괄호주,
       count(*) FILTER (WHERE builder LIKE '%주식회사%')              AS 주식회사,
       count(*)                                                        AS 전체
FROM apt_sites;
