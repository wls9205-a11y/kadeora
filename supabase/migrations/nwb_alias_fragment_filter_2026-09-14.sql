-- NW-B 본대 조건 — 별칭 승계 필터 (설계서_NW_20260913 v1.7 §NW-2)
--
-- ── 왜 ──────────────────────────────────────────────────────────────────────
-- merge_succession() 은 dead 의 별칭을 «통째로» 붙였다. 8/24 시드 계열 레코드는
-- 「부산」「재개발」 같은 단독 조각을 별칭에 들고 있어, 병합할 때마다 survivor 로 번진다
-- (감만1 실측: survivor·dead 둘 다 「부산」「재개발」 보유). 조각 별칭은 검색·광고 키워드
-- 매칭에서 무관한 현장을 끌어온다.
--
-- ⛔ 필터는 «독립 함수» 다. F6 시드 조각 청소 스캔이 같은 규칙을 그대로 재사용한다.
--    규칙이 두 벌이면 한쪽만 고치게 된다.
-- ⛔ 조합형(「남구 우암1 재개발」)은 통과한다. 단독 토큰만 자른다.

-- 정규화 — 공백·하이픈·중점·괄호·& 제거, 소문자.
create or replace function public.alias_norm(p text)
returns text language sql immutable
as $$ select lower(regexp_replace(coalesce(p, ''), '[\s\-·・&()\[\]]', '', 'g')) $$;

-- 시군구 조각 집합 — 「수영구」와 접미를 뗀 「수영」 둘 다. 호출자가 한 번 만들어 넘긴다.
create or replace function public.alias_sigungu_set()
returns text[] language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select public.alias_norm(sigungu) x from apt_sites where nullif(btrim(sigungu), '') is not null
    union
    select public.alias_norm(regexp_replace(sigungu, '(구|군|시)$', ''))
      from apt_sites where sigungu ~ '^.{2,}(구|군|시)$'
  ) s where length(x) >= 1
$$;

-- 조각 판정 — NULL 이면 통과, 아니면 컷 사유.
-- ⚠️ 규칙 ⑤(survivor 기존 별칭과 정규화 중복)는 «짝» 이 있어야 판정되므로 여기 없고
--    merge_succession 이 한다. 이 함수는 별칭 «하나만» 보고 답한다.
create or replace function public.alias_fragment_reason(p_alias text, p_sigungu_set text[])
returns text language sql immutable
as $$
  with n as (select public.alias_norm(p_alias) v)
  select case
    when v = ''            then 'empty'
    -- ④ 2자 이하 단독 토큰 (「남」「부산」「재개」…)
    when length(v) <= 2    then 'short_le2'
    -- ① 광역명 단독
    when v = any (array['서울','서울특별시','부산','부산광역시','대구','대구광역시','인천','인천광역시',
                        '광주','광주광역시','대전','대전광역시','울산','울산광역시','세종','세종특별자치시',
                        '경기','경기도','강원','강원도','강원특별자치도','충북','충청북도','충남','충청남도',
                        '전북','전라북도','전북특별자치도','전남','전라남도','경북','경상북도',
                        '경남','경상남도','제주','제주도','제주특별자치도','부울경'])
                           then 'region_only'
    -- ② 시군구명 단독
    when v = any (coalesce(p_sigungu_set, '{}'))
                           then 'sigungu_only'
    -- ③ 정비 접미 단독
    when v = any (array['재개발','재건축','재정비','재정비촉진','가로주택정비','소규모재건축',
                        '재개발사업','재건축사업','가로주택정비사업','소규모재건축사업','정비사업',
                        '재개발구역','재건축구역'])
                           then 'suffix_only'
    else null end
  from n
$$;

-- merge_succession — dead 별칭에 필터 적용 (survivor 자가 복원분은 필터 밖: survivor 자신의 값이다)
create or replace function public.merge_succession(
  p_dead_slug     text,
  p_survivor_slug text,
  p_dry           boolean default true,
  p_run_id        text    default null
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
  v_keep   jsonb;   -- 필터 통과한 dead 별칭
  v_cut    jsonb;   -- {별칭: 사유}
  v_sgg    text[];
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

  -- ── 별칭 필터 (dry·집행 공통) ─────────────────────────────────────────────────
  -- 규칙 ①~④ = alias_fragment_reason · ⑤ = survivor «진입 시점» 별칭과 정규화 중복.
  -- ⚠️ 정확 일치만 보던 기존 판정은 「남 감만1 재개발」 ↔ 「남감만1재개발」을 별개로 봤다.
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
           coalesce(public.alias_fragment_reason(dv.a, v_sgg),
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

  -- 붙일 것 = [필터 통과 dead 별칭] ∪ [진입 시점 별칭 중 사라진 것(자가 복원 — 필터 밖)]
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

revoke all on function public.merge_succession(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.merge_succession(text, text, boolean, text) to service_role;
