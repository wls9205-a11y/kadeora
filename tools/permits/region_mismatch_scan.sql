-- PV2 착수조건 ④ — region 오분류 검수 스캔 (2026-09-05)
--
-- ⛔ 자동 수정 없음. 이 쿼리는 «검수 큐» 를 만든다 — 고치는 것은 사람이고,
--    고칠 때는 H7-2 기록자 규약을 지킨다.
--
-- 발단: `명서1-재개발` 이 region 부산으로 앉아 있는데 명서동은 창원 의창구다.
--
-- 방법: 구역명 머리에서 「한글 2~4자 + 숫자」를 뽑아 «동» 을 붙이고(명서1 → 명서동),
--       그 법정동이 어느 시도에서 관측되는지 `apt_permits` 주소로 대조한다.
-- ⚠️ 사전은 우리가 실제로 본 인허가 주소다. 「그 시도에 그 동이 없다」가 아니라
--    «우리 표본에 없다» 는 뜻이다 — 그래서 판정이 아니라 큐다.
-- ⚠️ 실측 2건 중 1건이 오탐이었다: 「복산1 재개발」은 부산 동래구가 맞고(사업 위치는
--    칠산동), 우리 표본에 복산동이 울산에만 있어서 걸린 것이다. 구역명은 법정동명이
--    아닐 수 있다 — 그 사실 자체가 이 스캔을 «자동 수정» 으로 쓰면 안 되는 이유다.
with dong_sido as (
  select distinct sido, sigungu,
         (regexp_match(address, '([가-힣]+(?:동|리|가))(?=[ 0-9]|$)'))[1] as dong
  from apt_permits where address is not null
), d as (
  select dong,
         array_agg(distinct sido    order by sido)    as sidos,
         array_agg(distinct sigungu order by sigungu) as sigungus
  from dong_sido where dong is not null group by 1
), s as (
  select id, slug, name, region, sigungu,
         (regexp_match(replace(name,' ',''), '^([가-힣]{2,4})[0-9]'))[1] || '동' as guess_dong
  from apt_sites
  where is_active and region in ('부산','울산','경남')
    and lifecycle_stage in ('union_established','site_planning','plan_approved',
                            'mgmt_approved','constructor_selected','pre_announcement','construction')
)
select s.slug, s.name, s.region as 등록_시도, s.sigungu as 등록_시군구,
       s.guess_dong as 이름에서_추정한_동, d.sidos as 그_동이_관측된_시도, d.sigungus
from s join d on d.dong = s.guess_dong
where s.guess_dong is not null and not (s.region = any(d.sidos))
order by s.name;

-- 2026-09-05 실행 결과 (2행)
--   ⚠️ 명서1-재개발  · 등록 부산(시군구 NULL) · 명서동은 경남 창원시 → **오분류 유력. 검수 필요**
--   ✅ 복산1-재개발  · 등록 부산 동래구        · 복산동은 울산 중구      → **오탐**(구역명 ≠ 법정동명)
