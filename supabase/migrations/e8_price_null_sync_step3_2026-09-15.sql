-- E-8 — Q-1 2단: 합성 분양가 NULL화 · sync_apt_prices 3단계(실거래→분양가) 제거 · 오염 25행 원복 (2026-09-15 · Node 위임 발효)
--
-- ⛔ 원칙(판정회신 NR-A · E-8): 분양가 필드(price_min/max)에 실거래를 주입하지 않는다. 분양가는 모집공고·PDF 파싱·미분양 공표가만.
-- 가역: 백업 테이블 apt_sites_price_backup_e8_20260915 에 id·slug·원값·원 price_source·사유를 먼저 적재한다.
--   되돌리기: update apt_sites a set price_min=b.price_min, price_max=b.price_max, price_source=b.price_source
--             from apt_sites_price_backup_e8_20260915 b where b.id=a.id;

create table if not exists public.apt_sites_price_backup_e8_20260915 (
  id uuid primary key, slug text, price_min numeric, price_max numeric, price_source text, reason text not null,
  backed_up_at timestamptz not null default now());
alter table public.apt_sites_price_backup_e8_20260915 enable row level security;

-- ① 합성 645
insert into public.apt_sites_price_backup_e8_20260915 (id, slug, price_min, price_max, price_source, reason)
select id, slug, price_min, price_max, price_source, 'synthetic'
from public.apt_sites where price_source = 'synthetic' and (price_min is not null or price_max is not null)
on conflict (id) do nothing;

-- ③ 오염 25 — 단지명 실거래 min/max 와 정확히 같고 공고(house_type_info·supply_price_info) 유래가 아닌 비합성 활성 행
insert into public.apt_sites_price_backup_e8_20260915 (id, slug, price_min, price_max, price_source, reason)
select a.id, a.slug, a.price_min, a.price_max, a.price_source, 'trade_injected'
from public.apt_sites a
join (select apt_name, min(deal_amount) pmin, max(deal_amount) pmax from public.apt_transactions where deal_amount > 0 group by 1 having count(*) >= 2) tr
  on tr.apt_name = a.name and tr.pmin = a.price_min and tr.pmax = a.price_max
where a.is_active and a.price_source is null
  and not exists (select 1 from public.apt_subscriptions s, lateral jsonb_array_elements(s.house_type_info) t
                  where jsonb_typeof(s.house_type_info) = 'array' and s.house_nm = a.name and (t->>'lttot_top_amount') ~ '^[0-9]+$'
                  group by s.house_nm having min((t->>'lttot_top_amount')::numeric) = a.price_min and max((t->>'lttot_top_amount')::numeric) = a.price_max)
  and not exists (select 1 from public.apt_subscriptions s, lateral jsonb_array_elements(s.supply_price_info) t
                  where jsonb_typeof(s.supply_price_info) = 'array' and s.house_nm = a.name and (t->>'price_max') ~ '^[0-9]+$'
                  group by s.house_nm having min((t->>'price_max')::numeric) = a.price_min and max((t->>'price_max')::numeric) = a.price_max)
on conflict (id) do nothing;

-- NULL화 — 합성 표지(price_source)도 같이 비운다. 남겨 두면 뒤에 공고 유래 실가격이 채워져도 「합성」으로 가려진다.
update public.apt_sites a set price_min = null, price_max = null, price_source = null
from public.apt_sites_price_backup_e8_20260915 b where b.id = a.id;

-- ② sync_apt_prices — 3단계(실거래) 제거. 나머지 1·2·4단계 불변.
create or replace function public.sync_apt_prices()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  n_sub int := 0; n_pdf int := 0; n_unsold int := 0;
begin
  -- 1) 모집공고 타입별 분양가 (house_type_info.lttot_top_amount)
  with src as (
    select s.house_nm,
           min((t->>'lttot_top_amount')::numeric) as pmin,
           max((t->>'lttot_top_amount')::numeric) as pmax
    from apt_subscriptions s,
         lateral jsonb_array_elements(s.house_type_info) t
    where jsonb_typeof(s.house_type_info) = 'array'
      and (t->>'lttot_top_amount') ~ '^[0-9]+$'
      and (t->>'lttot_top_amount')::numeric > 0
    group by 1
  ), upd as (
    update apt_sites a set price_min = src.pmin, price_max = src.pmax, updated_at = now()
    from src
    where a.name = src.house_nm and a.is_active
      and (a.price_min is null or a.price_min = 0)
    returning 1)
  select count(*) into n_sub from upd;

  -- 2) 모집공고 PDF 파싱 분양가 (supply_price_info.price_max)
  with src as (
    select s.house_nm,
           min((t->>'price_max')::numeric) as pmin,
           max((t->>'price_max')::numeric) as pmax
    from apt_subscriptions s,
         lateral jsonb_array_elements(s.supply_price_info) t
    where jsonb_typeof(s.supply_price_info) = 'array'
      and (t->>'price_max') ~ '^[0-9]+$'
      and (t->>'price_max')::numeric > 0
    group by 1
  ), upd as (
    update apt_sites a set price_min = src.pmin, price_max = src.pmax, updated_at = now()
    from src
    where a.name = src.house_nm and a.is_active
      and (a.price_min is null or a.price_min = 0)
    returning 1)
  select count(*) into n_pdf from upd;

  -- 3) ⛔ 제거(E-8 · 2026-09-15): 실거래 min/max 를 분양가로 넣던 단계.
  --    분양가 필드에 실거래를 주입하지 않는다 — 기축 단지의 «거래가» 가 «분양가» 로 표시·인용됐다(25행 원복).
  --    실거래는 apt_transactions·단지백과 축에서만 보여 준다.

  -- 4) 미분양 공표 가격
  with src as (
    select u.house_nm,
           min(u.sale_price_min) as pmin,
           max(coalesce(u.sale_price_max, u.sale_price_min)) as pmax
    from unsold_apts u
    where u.sale_price_min > 0
    group by 1
  ), upd as (
    update apt_sites a set price_min = src.pmin, price_max = src.pmax, updated_at = now()
    from src
    where a.name = src.house_nm and a.is_active
      and (a.price_min is null or a.price_min = 0)
    returning 1)
  select count(*) into n_unsold from upd;

  return jsonb_build_object(
    'from_subscriptions', n_sub,
    'from_pdf_pricing', n_pdf,
    'from_trades', 0,
    'from_unsold', n_unsold,
    'total', n_sub + n_pdf + n_unsold,
    'still_missing', (select count(*) from apt_sites where is_active and (price_min is null or price_min = 0)),
    'kst', now() at time zone 'Asia/Seoul'
  );
end;
$function$;
