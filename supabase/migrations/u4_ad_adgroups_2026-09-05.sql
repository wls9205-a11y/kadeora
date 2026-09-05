-- PL C-2 — 광고그룹 스냅샷 + 「입찰가가 누구 것인가」 (2026-09-05)
--
-- ── 이 표가 없어서 생긴 모순 ────────────────────────────────────────────────
-- 9/5 스냅샷에서 E_대표 158키워드의 bid 가 «전량 70원» 으로 읽혔다. 그런데 PL-B 는
-- 「90 → 300 집행 완료」를 기록해 두었다. 둘 중 하나는 틀렸는데, 가를 자가 없었다.
--
-- 유력한 해석: 네이버 키워드는 `useGroupBidAmt=true` 면 «자기 bidAmt 를 쓰지 않고»
-- 광고그룹 기본입찰가를 따른다. 그때 키워드의 bidAmt 필드는 남아 있던 옛 값이거나
-- 그룹 최소값이고, 우리 스냅샷은 그것을 그대로 「입찰가」로 적재해 왔다.
-- 여러 그룹에서 min=70 이 반복되는 패턴이 그 지문이다.
--
-- ⛔ 그러나 이것은 아직 «해석» 이다. 9/6 첫 scan 이 use_group_bid 와 그룹 bid_amt 를
--    같이 실어 온 뒤에야 판정이다. 그전에 「그룹 위임이었다」로 결론 내지 않는다.
--
-- ⛔ 이 마이그레이션은 «읽기» 만 늘린다. 광고 계정에 쓰는 코드는 여기에 없다.

-- ── ① 광고그룹 일자별 스냅샷 ────────────────────────────────────────────────
-- 키를 (snapshot_date, adgroup_id) 로 둔다 — ad_keywords 와 같은 «일자별 이력» 설계다.
create table if not exists ad_adgroups (
  snapshot_date date not null,
  adgroup_id    text not null,
  campaign_id   text,
  adgroup_name  text,
  -- 그룹 기본입찰가. use_group_bid=true 인 키워드의 «실효» 입찰가가 이 값이다.
  bid_amt       integer,
  status        text,
  -- OFF(userLock) 는 status 와 다른 사실이다. 둘을 한 칸에 뭉개지 않는다.
  user_lock     boolean,
  -- 원문 보존(D1 관례). 정규화가 틀렸을 때 되돌릴 유일한 근거다.
  raw           jsonb,
  fetched_at    timestamptz not null default now(),
  primary key (snapshot_date, adgroup_id),
  constraint ad_adgroups_bid_nonneg_chk check (bid_amt is null or bid_amt >= 0)
);

create index if not exists idx_ad_adgroups_campaign
  on ad_adgroups (campaign_id, snapshot_date desc);

comment on table ad_adgroups is
  'PL C-2(2026-09-05): 광고그룹 일자별 스냅샷. use_group_bid 키워드의 실효 입찰가 출처.';

-- ── ② 키워드가 자기 입찰가를 쓰는가, 그룹에 위임하는가 ──────────────────────
alter table ad_keywords
  add column if not exists use_group_bid boolean;

comment on column ad_keywords.use_group_bid is
  '네이버 useGroupBidAmt. true 면 bid 열은 «실효 입찰가가 아니다» — ad_adgroups.bid_amt 를 봐야 한다. 9/5 이전 스냅샷은 null(백필 안 함).';

-- ── ③ 실효 입찰가 뷰 — 이 판독을 매번 손으로 조인하지 않도록 ────────────────
-- ⚠️ use_group_bid 가 null 인 «9/5 이전» 세대에서는 effective_bid 도 판정 불가(null)로
--    남긴다. 모르는 것을 아는 것처럼 적으면 그게 다음 모순의 씨앗이다.
create or replace view v_ad_effective_bid as
select
  k.snapshot_date,
  k.campaign_id,
  k.adgroup_id,
  k.adgroup_name,
  k.keyword_id,
  k.keyword,
  k.status,
  k.site_slug,
  k.bid                      as keyword_bid,
  k.use_group_bid,
  g.bid_amt                  as group_bid,
  case
    when k.use_group_bid is true  then g.bid_amt
    when k.use_group_bid is false then k.bid
    else null                                   -- 판정 불가: 수집 이전 세대
  end                        as effective_bid,
  case
    when k.use_group_bid is true  then 'group'
    when k.use_group_bid is false then 'keyword'
    else 'unknown'
  end                        as bid_source
from ad_keywords k
left join ad_adgroups g
  on g.adgroup_id = k.adgroup_id
 and g.snapshot_date = k.snapshot_date;

comment on view v_ad_effective_bid is
  'PL C-2: 키워드 입찰가의 «출처» 를 갈라 낸다. bid_source=unknown 은 9/5 이전 세대(수집 전)라는 뜻이지 결측이 아니다.';

-- ── 9/6 첫 scan 뒤 판독 (E_대표 70 vs 300 종결) ─────────────────────────────
-- select bid_source, count(*), min(effective_bid), max(effective_bid)
--   from v_ad_effective_bid
--  where snapshot_date = (select max(snapshot_date) from ad_keywords)
--    and adgroup_name like '%E_대표%'
--  group by 1;
