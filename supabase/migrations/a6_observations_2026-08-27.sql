-- A6 — 관측 (2026-08-27)
--
-- ── 무엇인가 ────────────────────────────────────────────────────────────────
-- 「우리가 본 것」을 사실 그대로 한 줄로 쌓는다. 해석도 예측도 없다.
-- 이슈 파이프라인이 AI 로 «글» 을 만드는 것과 다르다 — 여기는 숫자와 날짜뿐이다.
--
-- ⛔ 「오늘·어제」를 쓰지 않는다. 실거래는 신고 지연이 있어 「오늘」이 오늘이 아니다.
-- ⛔ 주식 관측 없음.

create table if not exists apt_observations (
  id            bigserial primary key,
  apt_site_id   uuid references apt_sites(id),
  region        text,
  sigungu       text,
  kind          text not null check (kind in ('trade','schedule','stage','unsold','digest','issue')),
  title         text not null,
  body          text,
  link_path     text not null,
  -- ⚠️ 멱등의 핵심. 같은 사실을 두 번 쌓지 않는다.
  --    `apt_transactions:{id}` · `apt_subscriptions:{id}:{field}` · `apt_sites:{id}:{stage}`
  source_ref    text not null unique,
  observed_at   date not null,
  created_at    timestamptz default now()
);

create index if not exists idx_apt_obs_site   on apt_observations (apt_site_id, created_at desc);
create index if not exists idx_apt_obs_region on apt_observations (region, sigungu, created_at desc);
create index if not exists idx_apt_obs_kind   on apt_observations (kind, observed_at desc);

alter table apt_observations enable row level security;

drop policy if exists apt_observations_read on apt_observations;
create policy apt_observations_read on apt_observations for select to anon, authenticated using (true);
-- ⚠️ INSERT 정책을 만들지 «않는다». service_role 은 RLS 를 우회하므로 크론만 쓸 수 있다.
--    정책을 열어 두면 누구든 관측을 만들 수 있고, 그러면 「우리가 본 것」이 아니게 된다.

grant select on apt_observations to anon, authenticated;
grant all on apt_observations to service_role;
grant usage, select on sequence apt_observations_id_seq to service_role;

-- ══ 주간 실거래 — 지역 인자화 + 구군별 ═══════════════════════════════════════
--
-- get_bugyeong_weekly_trades 는 «지역이 박혀 있고» 요약 한 줄만 낸다.
-- 관측은 구군 단위로 「몇 건 · 최고가 단지」를 말해야 해서 모양이 다르다.
--
-- ⚠️ 완성구간(p_settle_days)을 쓴다. 실거래 신고는 지연이 있어 «최근 며칠» 을 그대로
--    세면 매일 숫자가 뒤로 늘어난다. 잘라 놓고 세야 「이번 주」가 고정된다.
create or replace function public.get_weekly_trades(
  p_region      text,
  p_days        int default 7,
  p_settle_days int default 4
)
returns table(
  region_nm        text,
  sigungu          text,
  deals            bigint,
  top_apt          text,
  top_area         numeric,
  top_amount       bigint,
  top_deal_date    date,
  top_tx_id        uuid,
  latest_deal_date date,
  is_stale         boolean
)
language sql stable security invoker as $fn$
  with b as (
    select greatest(p_days,1) as w,
           (current_date - greatest(p_settle_days,0)) as cut
  ),
  win as (
    select t.* from apt_transactions t, b
     where t.region_nm = p_region
       and t.sigungu is not null
       and t.deal_date > b.cut - b.w and t.deal_date <= b.cut
  ),
  agg as (
    select w.sigungu, count(*) as deals, max(w.deal_date) as latest_deal_date
      from win w group by w.sigungu
  ),
  top as (
    -- 구군별 «최고 거래» 1건. 동점이면 최신, 그래도 같으면 id 로 고정한다 —
    -- 순서가 흔들리면 source_ref 가 바뀌어 같은 사실이 두 번 쌓인다.
    select distinct on (w.sigungu)
           w.sigungu, w.apt_name, w.exclusive_area, w.deal_amount, w.deal_date, w.id
      from win w
     order by w.sigungu, w.deal_amount desc nulls last, w.deal_date desc, w.id
  ),
  fresh as (
    select max(t.deal_date) as last_seen from apt_transactions t where t.region_nm = p_region
  )
  select p_region, a.sigungu, a.deals,
         tp.apt_name, tp.exclusive_area, tp.deal_amount, tp.deal_date, tp.id,
         a.latest_deal_date,
         -- ⚠️ 지역이 통째로 «정지» 했으면 관측을 만들지 않는다. 「이번 주 0건」은
         --    시장이 조용한 것이 아니라 «수집이 멈춘 것» 일 수 있다. 둘을 섞으면 안 된다.
         (select f.last_seen is null or f.last_seen < b.cut - b.w from fresh f, b)
    from agg a join top tp on tp.sigungu = a.sigungu, b
   order by a.deals desc
$fn$;

grant execute on function public.get_weekly_trades(text, int, int) to anon, authenticated;

-- ══ post_reactions 재사용 ════════════════════════════════════════════════════
--
-- ⚠️ 이 테이블은 posts 전용이었다 — post_id 가 NOT NULL 이고 FK 가 걸려 있다.
--    관측에 붙이려면 5가지를 바꿔야 한다. 행이 «3개» 뿐이라 지금이 가장 싸다.
--    ⛔ 불변식을 «약화하지 않는다». post_id 를 nullable 로 풀되, CHECK 로
--       「둘 중 정확히 하나」를 강제한다. 지금이 예전보다 느슨하지 않다.
alter table post_reactions add column if not exists observation_id bigint references apt_observations(id) on delete cascade;
alter table post_reactions add column if not exists target_type text not null default 'post';
alter table post_reactions alter column post_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_reactions_one_target') then
    alter table post_reactions add constraint post_reactions_one_target check (
      (target_type = 'post'        and post_id is not null and observation_id is null) or
      (target_type = 'observation' and observation_id is not null and post_id is null)
    );
  end if;
end $$;

-- 기존 UNIQUE(post_id,user_id) 는 post_id 가 null 이면 무력하다 — 관측용 짝을 따로 건다.
create unique index if not exists uq_post_reactions_observation
  on post_reactions (observation_id, user_id) where observation_id is not null;
