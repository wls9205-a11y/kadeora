-- U-3층 ⑥ — 리드 단가 뷰 (2026-08-29 · Node 판정 ② 채택 · 세대 조인 수정 반영)
--
-- ⛔ `from ad_keywords` 로 시작하지 «않는다». 그 표는 부분 스냅샷이라 기준으로 삼으면
--    나머지 캠페인의 지출이 «수집됐는데 표에서 사라진다». 실증: 첫 적재의 지출 1위가
--    바로 그 미동기 키워드였다(10,286원 = 전체 19,611원의 절반 이상).
--
-- ⛔ 그리고 keyword_id 만으로 조인하지 «않는다». ad_keywords 의 유니크 키는
--    (snapshot_date, keyword_id) — «일자별 스냅샷 이력» 이다. 세대가 둘 이상이면
--    한 키워드가 세대 수만큼 곱해져 «지출이 배로 뻥튀기» 된다.
--    → distinct on 으로 키워드마다 «최신 세대 한 줄» 만 고른다.
--
-- ⚠️ 리드 집계는 «키워드 ID 축» 으로만. 문자열(n_keyword) 로 붙이면 동명 키워드가
--    캠페인마다 다른 값을 갖는 탓에 남의 지출이 섞인다(지시서_U3 §6).
drop view if exists v_lead_unit_economics;
create view v_lead_unit_economics as
with spend as (
  select keyword_id,
         sum(sales_amt)::bigint as spend,
         sum(clk_cnt)::bigint   as clicks,
         sum(imp_cnt)::bigint   as imps,
         min(stat_date) as since_date,
         max(stat_date) as until_date
  from ad_stats_daily group by 1
),
kw_latest as (
  select distinct on (keyword_id)
         keyword_id, keyword, site_slug, adgroup_name, snapshot_date
  from ad_keywords
  order by keyword_id, snapshot_date desc
),
lead_cnt as (
  select utm->>'n_keyword_id' as kid, count(*)::bigint as leads
  from leads where utm->>'n_keyword_id' is not null group by 1
)
select
  s.keyword_id,
  k.keyword,
  k.site_slug,
  k.adgroup_name,
  k.snapshot_date as name_snapshot,
  (k.keyword_id is null) as unsynced,
  s.spend, s.clicks, s.imps, s.since_date, s.until_date,
  coalesce(l.leads, 0) as leads,
  case when coalesce(l.leads,0) > 0 then round(s.spend::numeric / l.leads) end as cost_per_lead,
  case when s.clicks > 0 then round(s.spend::numeric / s.clicks) end as cpc_actual,
  -- ⚠️ n<5 의 단가는 «통계적 의미가 없다». 확정처럼 보이게 하지 않는다(§7-1 의 내부판).
  (coalesce(l.leads,0) < 5) as low_sample
from spend s
left join kw_latest k on k.keyword_id = s.keyword_id
left join lead_cnt  l on l.kid        = s.keyword_id;

grant select on v_lead_unit_economics to service_role;

comment on view v_lead_unit_economics is
  'U-3층 리드 단가. ad_stats_daily 기준 + ad_keywords 는 이름 보강용(키워드별 최신 스냅샷 1행만 - 세대 조인은 지출을 배로 뻥튀기한다). unsynced=미동기, low_sample=리드 n<5.';
