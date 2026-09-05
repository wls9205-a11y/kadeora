-- R3-5 · 배포 후 자동 검증
--
-- 사람이 눈으로 볼 것을 쿼리로 대신한다. Supabase SQL Editor 에 통째로 붙여 넣으면
-- 한 번에 다섯 줄이 나온다.
--
--   psql "$SUPABASE_DB_URL" -f tools/naver-sa/verify.sql
--
-- ⚠️ 기대값은 «2026-08-26 R3 직후» 기준이다. 데이터가 늘면 당연히 달라진다.
--    중요한 것은 절대값이 아니라 «0 이 나오면 안 되는 자리에 0 이 아닌가» 다.
--
-- ── 광고 «상시» 감사는 여기가 아니다 (2026-09-05 · SUPL §C-3) ───────────────
--    이 파일은 R3 배포 직후 검증이고, 파워링크 6축 정례 감사는 별도다:
--        python tools/naver-sa/pl_audit6.py --csv
--    ⛔ 6축을 여기에 «다시» 쓰지 말 것. 특히 법인명·조각 판정은 sa.py 의
--       keyword_flags() 그 함수를 불러야 scan 과 두 판정이 갈리지 않는다.
--       SQL 로 옮겨 적는 순간 그 규율이 깨진다.

\echo '=== ① 지오코딩 필터가 살아 있나 (0 이면 아직 깨진 것) ==='
-- ⚠️ `.not(col,'eq',v)` 로 쓰면 NOT (NULL = v) = NULL 이라 전부 걸러진다.
--    R2 에서 실제로 그렇게 죽어 있었다. 아래가 살아 있어야 크론이 볼 행이 있다.
select count(*) as 크론이_보는_행_기대137
from apt_sites
where is_active is not false
  and latitude is null
  and source_ids->>'address_source' is distinct from 'redev';

\echo '=== ② 조합 주소 차단이 유지되나 ==='
-- 정비사업 주소는 상당수가 조합 사무실이라 지오코딩하면 «좌표 없는 것보다 나쁘다».
select count(*) as 차단표식_기대136
from apt_sites
where source_ids->>'address_source' = 'redev';

\echo '=== ③ 광고 랜딩 품질 ==='
-- cs<40 은 /apt/[id] 가 스스로 noindex 를 선언하는 구간이다(page.tsx:720).
-- cs<25 는 사이트맵에도 못 든다(sitemap/[id]/route.ts:195).
select count(distinct s.slug) filter (where coalesce(s.content_score,0) < 40) as cs40미만,
       count(distinct s.slug) filter (where coalesce(s.content_score,0) < 25) as cs25미만,
       round(avg(s.content_score), 1)                                          as 평균
from ad_keywords k
join apt_sites s on s.slug = k.site_slug
where k.snapshot_date = (select max(snapshot_date) from ad_keywords);

\echo '=== ④ 고아 랜딩 — 랜딩이 가리키는데 apt_sites 에 없는 slug (기대 0행) ==='
-- ⚠️ v_ad_coverage 는 apt_sites 기준 LEFT JOIN 이라 «뷰에는 안 나타난다».
--    첫 적재 때 /apt/busan 같은 단일 세그먼트 허브 21행이 여기로 새어 들어갔다.
select k.site_slug, count(*) as 키워드행
from ad_keywords k
left join apt_sites s on s.slug = k.site_slug
where k.site_slug is not null and s.slug is null
group by 1 order by 2 desc;

\echo '=== ⑤ 비활성 현장에 붙은 광고 — 돈이 새는 자리 (R3-1 업로드 후 기대 0행) ==='
-- ⚠️ v_ad_coverage 는 is_active is not false 만 보므로 여기에도 안 나타난다.
select s.slug, s.name, count(*) as 키워드행
from ad_keywords k
join apt_sites s on s.slug = k.site_slug
where s.is_active is false
group by 1, 2 order by 3 desc;

\echo '=== ⑥ 참고 — 커버리지 요약 ==='
select count(*)                                    as 활성현장,
       count(*) filter (where 키워드수 > 0)          as 광고있음,
       count(*) filter (where 키워드수 = 0)          as 미등록,
       count(*) filter (where 그룹수 > 1)            as 이중등록
from v_ad_coverage;
