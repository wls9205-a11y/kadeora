-- NW-B 필터 규칙 ⑥⑦ + 건별 컷 (설계서_NW_20260913 v1.8)
--
-- ⑥ 고유 식별자 없는 조합 — 광역명·시군구명·정비 접미·「구역」만으로 이뤄진 별칭(「부산 재개발」).
--    판정 = 정규화 문자열에서 그 토큰들을 긴 것부터 지우고 «남는 게 없으면» 컷.
--    ⚠️ 토큰 분리(공백) 방식은 「부산재개발」 같은 붙여 쓴 형태를 놓친다 — 그래서 잔여 방식.
--    ⚠️ 지우다가 식별자 안쪽을 먹어도 «잔여가 남으면» 통과라 오컷이 나지 않는다.
-- ⑦ 「구역구역」 중복 접미 — F6 실증 조각(「부산 대연8구역구역」).
-- 건별 컷 — 상권 통칭+브랜드(「서면 롯데캐슬」)는 규칙화하면 「광안 SK뷰」 같은 정당 별칭이 다친다.
--    호출자가 p_exclude_aliases 로 넘긴다(채팅 건별 판정).

create or replace function public.alias_fragment_reason(p_alias text, p_sigungu_set text[])
returns text language plpgsql immutable
as $$
declare
  v    text := public.alias_norm(p_alias);
  v_pat text;
  v_regions text[] := array['서울특별시','서울','부산광역시','부산','대구광역시','대구','인천광역시','인천',
                        '광주광역시','광주','대전광역시','대전','울산광역시','울산','세종특별자치시','세종',
                        '경기도','경기','강원특별자치도','강원도','강원','충청북도','충북','충청남도','충남',
                        '전북특별자치도','전라북도','전북','전라남도','전남','경상북도','경북',
                        '경상남도','경남','제주특별자치도','제주도','제주','부울경'];
  v_suffix text[] := array['가로주택정비사업','소규모재건축사업','가로주택정비','소규모재건축',
                        '재개발사업','재건축사업','재정비촉진','재개발구역','재건축구역',
                        '정비사업','재개발','재건축','재정비'];
begin
  if v = ''                                  then return 'empty'; end if;
  if length(v) <= 2                          then return 'short_le2'; end if;        -- ④
  if v = any (v_regions)                     then return 'region_only'; end if;      -- ①
  if v = any (coalesce(p_sigungu_set, '{}')) then return 'sigungu_only'; end if;     -- ②
  if v = any (v_suffix)                      then return 'suffix_only'; end if;      -- ③
  if v like '%구역구역%'                      then return 'dup_suffix_guyeok'; end if; -- ⑦

  -- ⑥ 잔여 판정. 긴 토큰부터 지워야 「부산광역시」가 「부산」+「광역시」 찌꺼기로 남지 않는다.
  select string_agg(regexp_replace(t, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'), '|' order by length(t) desc)
    into v_pat
    from (select distinct t from unnest(v_regions || v_suffix || coalesce(p_sigungu_set, '{}') || array['구역']) t
           where length(t) >= 1) s;
  if v_pat is not null and regexp_replace(v, v_pat, '', 'g') = '' then
    return 'no_identifier';
  end if;
  return null;
end;
$$;

-- merge_succession — 건별 컷 인자 추가(5번째). 4인자 판은 지운다(겹치는 오버로드는 호출 모호).
drop function if exists public.merge_succession(text, text, boolean, text);

create or replace function public.merge_succession(
  p_dead_slug       text,
  p_survivor_slug   text,
  p_dry             boolean default true,
  p_run_id          text    default null,
  p_exclude_aliases text[]  default '{}'
)
returns table (field text, action text, dead_value text, survivor_value text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    ('total_units',   nullif(d.total_units::text, ''),   nullif(s.total_units::text, '')),
    ('complex_units', nullif(d.complex_units::text, ''), nullif(s.complex_units::text, '')),
    ('builder',       nullif(d.builder, ''),             nullif(s.builder, '')),
    ('dong',          nullif(d.dong, ''),                nullif(s.dong, '')),
    ('region',        nullif(d.region, ''),              nullif(s.region, '')),
    ('sigungu',       nullif(d.sigungu, ''),             nullif(s.sigungu, ''))
  ) as w(f, dv, sv);

  insert into _rep
  select w.f, '⛔ 자동 승계 제외 · 검수 큐', w.dv, w.sv
  from (values
    ('address',         d.address,         s.address),
    ('lifecycle_stage', d.lifecycle_stage, s.lifecycle_stage)
  ) as w(f, dv, sv)
  where w.dv is distinct from w.sv and w.dv is not null;

  -- 규칙 ①~④⑥⑦ = alias_fragment_reason · ⑤ = survivor 진입 시점 별칭과 정규화 중복 · 건별 컷
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
      total_units   = coalesce(total_units,             d.total_units),
      complex_units = coalesce(complex_units,           d.complex_units),
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
$$;

revoke all on function public.merge_succession(text, text, boolean, text, text[]) from public, anon, authenticated;
grant execute on function public.merge_succession(text, text, boolean, text, text[]) to service_role;
