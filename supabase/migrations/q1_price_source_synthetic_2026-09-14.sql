-- Q-1 F1 1단 — 합성 분양가 «표시 격리» (BPNR v2.1 §2 · 2026-09-14)
--
-- 무엇: 지역 채움값이 단지별 분양가인 척 붙어 있다(활성 가격 보유 5,663 중 645).
--       값은 지우지 않는다(2단 +14일 관찰 후 백업 선행 NULL화). 여기서는 «표시» 만 막는다.
--
-- 판정 = top6 고정쌍 ∪ 같은 region 동일 (price_min, price_max) 가 활성 10곳 이상.
-- ⚠️ 지시서의 오탐 예외(「source_ids·expected_sale_source 에 공고 근거가 있으면 제외」)는 «넣지 않았다».
--    실측: 경기 24500~57500 클러스터 128 중 60행이 house_manage_no·subscription_id 를 갖고 있지만
--    연결된 공고의 평당가가 254·321·330 으로 서로 다른데 min/max 만 같다 — 공고 키가 있어도 값은 채움값이다.
--    그 예외를 넣으면 합성가 60+행이 격리에서 샌다.
-- ⚠️ 생산자: 현재 기록자(sync-apt-sites 미분양 · apt-crawl-pricing)는 이 값을 만들지 않는다
--    (unsold_apts.sale_price_* 전량 NULL · crawl-pricing 은 NULL/0 일 때만 쓴다). 과거 잔재라 1회 마킹으로 닫힌다.
--    새 잔재가 생기는지는 fn_mark_synthetic_prices(true) 재실행으로 본다(dry = 쓰기 0).

alter table public.apt_sites add column if not exists price_source text;
alter table public.apt_sites drop constraint if exists apt_sites_price_source_check;
alter table public.apt_sites add constraint apt_sites_price_source_check
  check (price_source is null or price_source in ('synthetic'));
comment on column public.apt_sites.price_source is
  'Q-1 F1: synthetic = 지역 채움값(표시 금지). NULL = 판정 대상 아님. 판정기 fn_mark_synthetic_prices()';

create or replace function public.fn_mark_synthetic_prices(p_dry boolean default true)
returns table(rule text, n bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_marked bigint;
begin
  create temp table _syn on commit drop as
  with c as (
    select region, price_min, price_max, count(*) cnt
    from apt_sites
    where is_active and price_min is not null and price_max is not null
    group by 1, 2, 3
  )
  select s.id,
         ((s.price_min, s.price_max) in ((66000,140000),(24500,57500),(20800,55500),(24000,51500),(10500,27800),(10000,35000))) as top6,
         exists (select 1 from c where c.region = s.region and c.price_min = s.price_min
                   and c.price_max = s.price_max and c.cnt >= 10) as cluster10
  from apt_sites s
  where s.is_active and s.price_min is not null and s.price_max is not null;

  delete from _syn where not (top6 or cluster10);

  return query select 'top6'::text, count(*) from _syn where top6;
  return query select 'cluster10'::text, count(*) from _syn where cluster10;
  return query select 'union'::text, count(*) from _syn;
  return query select 'already_marked'::text, count(*) from apt_sites a join _syn using (id) where a.price_source = 'synthetic';

  if not p_dry then
    update apt_sites a set price_source = 'synthetic'
    from _syn where a.id = _syn.id and a.price_source is distinct from 'synthetic';
    get diagnostics v_marked = row_count;
    return query select 'marked_now'::text, v_marked;
  end if;
end $$;

revoke all on function public.fn_mark_synthetic_prices(boolean) from public, anon, authenticated;
