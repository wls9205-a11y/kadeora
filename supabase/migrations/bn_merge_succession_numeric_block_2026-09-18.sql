-- BN-1 판정 §2 — merge_succession() 수치 필드 승계 차단.
--
-- 규율: 병합 시 세대수 등 «수치 필드» 는 승계하지 않는다(촉진2-1 9,000 유령 전례). 그런데 함수는
--   total_units·complex_units 를 열 단위 coalesce 채움 목록에 넣고 있었다 — 규율 미구현.
--   2026-09-18 사직4 병합에서 dead 의 complex_units 1730 이 넘어갈 뻔했다(세션 A 가 dead 선차단으로 우회).
-- 수리: 두 열을 채움 목록에서 빼 「⛔ 자동 승계 제외 · 검수 큐」 보고로 옮기고 UPDATE 에서도 뺀다.
--   나머지(builder·dong·region·sigungu 채움, address·lifecycle_stage 제외, 별칭 필터·자가 복원·원장)는 불변.
-- 원본: 라이브 정의(5인자 · p_exclude_aliases) — 저장소 cvb_merge_succession_2026-09-14.sql 은 4인자판이다.
-- CREATE OR REPLACE 는 기존 GRANT(service_role 전용)를 유지한다.

CREATE OR REPLACE FUNCTION public.merge_succession(p_dead_slug text, p_survivor_slug text, p_dry boolean DEFAULT true, p_run_id text DEFAULT NULL::text, p_exclude_aliases text[] DEFAULT '{}'::text[])
 RETURNS TABLE(field text, action text, dead_value text, survivor_value text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  d        public.apt_sites%rowtype;
  s        public.apt_sites%rowtype;
  v_entry  jsonb;
  v_before jsonb;
  v_after  jsonb;
  v_add    jsonb;
  v_keep   jsonb;
  v_cut    jsonb;
  v_sgg    text[];
  v_excl   text[];
  v_run    text := coalesce(p_run_id,
                            'merge_succession:' || to_char(now(), 'YYYYMMDDHH24MISS'));
begin
  select * into d from apt_sites where slug = p_dead_slug;
  if not found then raise exception 'dead slug 없음: %', p_dead_slug; end if;
  select * into s from apt_sites where slug = p_survivor_slug;
  if not found then raise exception 'survivor slug 없음: %', p_survivor_slug; end if;
  if d.id = s.id then raise exception 'dead 와 survivor 가 같은 행이다: %', p_dead_slug; end if;

  v_entry := coalesce(s.name_variants, '[]'::jsonb);
  v_sgg   := public.alias_sigungu_set();
  v_excl  := array(select public.alias_norm(x) from unnest(coalesce(p_exclude_aliases, '{}')) x);

  drop table if exists _rep;
  create temp table _rep (field text, action text, dead_value text, survivor_value text)
    on commit drop;

  insert into _rep
  select w.f,
         case
           when w.dv is null                   then 'skip · dead 값 없음'
           when w.sv is null                   then case when p_dry then 'would_fill' else 'filled' end
           when w.dv is not distinct from w.sv then 'same'
           else '⚠ CONFLICT · 자동 갱신 안 함 — 검수'
         end,
         w.dv, w.sv
  from (values
    ('builder',       nullif(d.builder, ''),             nullif(s.builder, '')),
    ('dong',          nullif(d.dong, ''),                nullif(s.dong, '')),
    ('region',        nullif(d.region, ''),              nullif(s.region, '')),
    ('sigungu',       nullif(d.sigungu, ''),             nullif(s.sigungu, ''))
  ) as w(f, dv, sv);

  -- BN-1: 수치 필드(total_units·complex_units)도 여기 — 승계 금지 규율(촉진2-1 9,000 유령).
  insert into _rep
  select w.f, '⛔ 자동 승계 제외 · 검수 큐', w.dv, w.sv
  from (values
    ('address',         d.address,                s.address),
    ('lifecycle_stage', d.lifecycle_stage,        s.lifecycle_stage),
    ('total_units',     d.total_units::text,      s.total_units::text),
    ('complex_units',   d.complex_units::text,    s.complex_units::text)
  ) as w(f, dv, sv)
  where w.dv is distinct from w.sv and w.dv is not null;

  with dv as (
    select distinct e.value #>> '{}' a
    from jsonb_array_elements(coalesce(d.name_variants, '[]'::jsonb)) e
    where jsonb_typeof(e.value) = 'string'
  ), sv as (
    select distinct public.alias_norm(e.value #>> '{}') n
    from jsonb_array_elements(v_entry) e
    where jsonb_typeof(e.value) = 'string'
  ), j as (
    select dv.a,
           coalesce(case when public.alias_norm(dv.a) = any (v_excl) then 'manual_exclude' end,
                    public.alias_fragment_reason(dv.a, v_sgg),
                    case when exists (select 1 from sv where sv.n = public.alias_norm(dv.a))
                         then 'dup_survivor' end) reason
    from dv
  )
  select coalesce(jsonb_agg(to_jsonb(a) order by a) filter (where reason is null), '[]'::jsonb),
         coalesce(jsonb_object_agg(a, reason) filter (where reason is not null), '{}'::jsonb)
    into v_keep, v_cut
  from j;

  if p_dry then
    insert into _rep values ('name_variants',
      'would_append ' || jsonb_array_length(v_keep), v_keep::text, v_entry::text);
    insert into _rep values ('name_variants_cut',
      'cut ' || (select count(*) from jsonb_object_keys(v_cut)), v_cut::text, null);
    return query select * from _rep order by 1;
    return;
  end if;

  update apt_sites set
      builder       = coalesce(nullif(builder, ''),     nullif(d.builder, '')),
      dong          = coalesce(nullif(dong, ''),        nullif(d.dong, '')),
      region        = coalesce(nullif(region, ''),      nullif(d.region, '')),
      sigungu       = coalesce(nullif(sigungu, ''),     nullif(d.sigungu, '')),
      updated_at    = now()
   where id = s.id;

  select name_variants into v_before from apt_sites where id = s.id;

  if v_entry is distinct from coalesce(v_before, '[]'::jsonb) then
    insert into _rep values ('name_variants ⚠ auto_variants 발화',
      'RULES#146 — 스칼라 쓰기가 별칭을 교체했다. 아래 append 에서 같은 트랜잭션 자가 복원',
      v_entry::text, coalesce(v_before, '[]'::jsonb)::text);
  end if;

  select coalesce(jsonb_agg(distinct e.value), '[]'::jsonb) into v_add
    from (
      select value from jsonb_array_elements(v_keep)
      union
      select value from jsonb_array_elements(v_entry)
    ) e
   where not (coalesce(v_before, '[]'::jsonb) @> jsonb_build_array(e.value));

  if jsonb_array_length(v_add) > 0 then
    update apt_sites
       set name_variants = coalesce(name_variants, '[]'::jsonb) || v_add,
           updated_at    = now()
     where id = s.id
    returning name_variants into v_after;
  else
    v_after := v_before;
  end if;

  insert into _rep values ('name_variants',
    'appended ' || jsonb_array_length(v_add), v_add::text, v_after::text);
  insert into _rep values ('name_variants_cut',
    'cut ' || (select count(*) from jsonb_object_keys(v_cut)), v_cut::text, null);

  insert into site_name_applies (site_id, op, before_value, after_value, run_id, applied_at)
  values (s.id, 'merge_succeed', v_entry, v_after, v_run, now());

  return query select * from _rep order by 1;
end;
$function$;
