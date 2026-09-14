-- 원본: docs/PV_INSTRUCTION_20260910.md ① (9/10 파일명 cvb_merge_succession_2026-09-10 으로 예고됐으나 미적용 → 적용일로 생성)
-- CV-B 병합 승계 — merge_succession() (2026-09-10)
-- 근거·설계: docs/PV_INSTRUCTION_20260910.md ①
--
-- ⛔ 이 함수는 «승계 전용» 이다. dead 비활성화(is_active=false)와 apt_site_merges 등재는
--    기존 병합 절차가 그대로 한다. 순서는 [승계 → 병합 등재 → gen-merged-slugs.mjs 재생성].
-- ⚠️ apt_site_merges 를 바꾸면 scripts/gen-merged-slugs.mjs 를 반드시 다시 돌린다.
--    301 맵(src/lib/apt/merged-slugs.ts)은 자동 생성물이고 middleware 가 그걸 읽는다
--    (src/middleware.ts:159). 이 짝을 빠뜨리면 구 slug 가 404 가 된다.

create or replace function public.merge_succession(
  p_dead_slug     text,
  p_survivor_slug text,
  p_dry           boolean default true,
  p_run_id        text    default null
)
returns table (field text, action text, dead_value text, survivor_value text)
language plpgsql
security definer
set search_path = public, pg_temp  -- security definer: pg_temp 를 «뒤로» 명시
as $$
declare
  d        public.apt_sites%rowtype;
  s        public.apt_sites%rowtype;
  v_entry  jsonb;   -- 함수 «진입 직후» 별칭. 원장의 before 는 언제나 이것이다.
  v_before jsonb;   -- 스칼라 UPDATE «직후» 별칭. 차집합 계산에만 쓴다.
  v_after  jsonb;
  v_add    jsonb;
  v_run    text := coalesce(p_run_id,
                            'merge_succession:' || to_char(now(), 'YYYYMMDDHH24MISS'));
begin
  select * into d from apt_sites where slug = p_dead_slug;
  if not found then raise exception 'dead slug 없음: %', p_dead_slug; end if;
  select * into s from apt_sites where slug = p_survivor_slug;
  if not found then raise exception 'survivor slug 없음: %', p_survivor_slug; end if;
  if d.id = s.id then raise exception 'dead 와 survivor 가 같은 행이다: %', p_dead_slug; end if;

  -- ⚠️ 진입 시점 별칭을 «먼저» 붙든다. 아래 스칼라 UPDATE 가 builder 를 SET 목록에
  --    넣는 순간 trg_apt_sites_auto_variants 가 발화하고, 그 시점 별칭이 3 미만이면
  --    name_variants 를 통째로 «교체» 한다. 원장의 before 가 교체«후» 값이면 그 행은
  --    복원 근거가 되지 못한다 — 덮인 사실만 남고 덮이기 전 값이 사라진다.
  --    (감만1은 vn=13 이라 무관하나, 미래 쌍에는 vn<3 이 실재한다. 활성 6,285 중 467건.)
  v_entry := coalesce(s.name_variants, '[]'::jsonb);

  drop table if exists _rep;
  create temp table _rep (field text, action text, dead_value text, survivor_value text)
    on commit drop;

  -- ⑴ 화이트리스트 6열 — coalesce 로 «빈 칸만» 채운다.
  --    ⚠️ builder 는 '' 로 들어온 행이 많다. nullif 로 빈 문자열을 NULL 과 같이 본다.
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

  -- ⑵ 제외 2열 — 「사업지 vs 조합사무실」은 값 «유무» 가 아니라 «의미» 검사다.
  --    자동화 밖. 값이 갈리면 언제나 사람이 본다.
  insert into _rep
  select w.f, '⛔ 자동 승계 제외 · 검수 큐', w.dv, w.sv
  from (values
    ('address',         d.address,         s.address),
    ('lifecycle_stage', d.lifecycle_stage, s.lifecycle_stage)
  ) as w(f, dv, sv)
  where w.dv is distinct from w.sv and w.dv is not null;

  if p_dry then
    -- 별칭은 집행 경로에서 «다시» 계산한다(트리거가 갈아엎을 수 있어서). 여기선 예고만.
    select coalesce(jsonb_agg(distinct e.value), '[]'::jsonb) into v_add
      from jsonb_array_elements(coalesce(d.name_variants, '[]'::jsonb)) e
     where not (coalesce(s.name_variants, '[]'::jsonb) @> jsonb_build_array(e.value));
    insert into _rep values ('name_variants',
      'would_append ' || jsonb_array_length(v_add), v_add::text,
      coalesce(s.name_variants, '[]'::jsonb)::text);
    return query select * from _rep order by 1;  -- ⚠️ 「field」는 OUT 변수와 이름이 겹친다(ambiguous) — 순번으로 정렬
    return;
  end if;

  -- ── 집행 ────────────────────────────────────────────────────────────────────
  -- ⚠️ RULES#146. 트리거 컬럼을 «먼저» 한 문장으로 쓴다. builder 하나가
  --    trg_normalize_builder · trg_sync_builder_normalized · trg_apt_sites_auto_variants
  --    셋을 동시에 깨우고, 그 시점 별칭이 3 미만이면 auto_variants 가 name_variants 를
  --    통째로 «교체» 한다. 그래서 별칭은 언제나 마지막이다.
  -- ⑶ coalesce 라 survivor 의 non-null 값은 구조적으로 덮이지 않는다 —
  --    CONFLICT 행은 보고서에만 남고 DB 는 손대지 않는다.
  update apt_sites set
      total_units   = coalesce(total_units,             d.total_units),
      complex_units = coalesce(complex_units,           d.complex_units),
      builder       = coalesce(nullif(builder, ''),     nullif(d.builder, '')),
      dong          = coalesce(nullif(dong, ''),        nullif(d.dong, '')),
      region        = coalesce(nullif(region, ''),      nullif(d.region, '')),
      sigungu       = coalesce(nullif(sigungu, ''),     nullif(d.sigungu, '')),
      updated_at    = now()
   where id = s.id;

  -- ⚠️ 위 UPDATE 가 별칭을 갈아엎었을 수 있다. «다시 읽고» 나서 차집합을 구한다.
  select name_variants into v_before from apt_sites where id = s.id;

  -- 교체가 실제로 일어났으면 «그 사실» 을 보고서에 세운다. 조용히 지나가지 않는다.
  if v_entry is distinct from coalesce(v_before, '[]'::jsonb) then
    insert into _rep values ('name_variants ⚠ auto_variants 발화',
      'RULES#146 — 스칼라 쓰기가 별칭을 교체했다. 아래 append 에서 같은 트랜잭션 자가 복원',
      v_entry::text, coalesce(v_before, '[]'::jsonb)::text);
  end if;

  -- 붙일 것 = [dead 의 별칭] ∪ [진입 시점 별칭 중 사라진 것] — 현재 상태에 없는 것만.
  -- ⚠️ 두 번째 항이 «자가 복원» 이다. auto_variants 가 교체해 날아간 진입 시점 별칭을
  --    같은 트랜잭션에서 되돌린다. 야간 heal 에 맡기지 않는 이유:
  --    heal_realias 는 「site_name_candidates.resolution='applied' ↔ 별칭 실재」를 대조하는데,
  --    승계 별칭은 dead 레코드에서 오지 후보 행에서 오지 않는다 — 대조할 짝이 «없다».
  --    원장은 복원의 «근거» 일 뿐이고, 근거만으로는 사람이 손을 대야 한다.
  select coalesce(jsonb_agg(distinct e.value), '[]'::jsonb) into v_add
    from (
      select value from jsonb_array_elements(coalesce(d.name_variants, '[]'::jsonb))
      union
      select value from jsonb_array_elements(v_entry)
    ) e
   where not (coalesce(v_before, '[]'::jsonb) @> jsonb_build_array(e.value));

  -- ⑷ 별칭 마지막. name_variants «만» 쓰는 UPDATE 는 감시 컬럼이 아니라 트리거를 안 깨운다.
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

  -- ⑸ 원장. 스칼라 변경은 trg_apt_change_log 가 이미 전부 잡으므로 여기엔 «별칭만» 적는다 —
  --    before/after 를 별칭 배열로 두어 alias_add 와 모양을 같게 유지해야
  --    heal_realias 야간 대사가 같은 규칙으로 읽는다.
  -- ⚠️ before 는 v_before(스칼라 UPDATE 후)가 아니라 v_entry(함수 진입 직후)다.
  --    auto_variants 가 중간에 교체했더라도 이 한 행이면 원상 복원이 선다.
  insert into site_name_applies (site_id, op, before_value, after_value, run_id, applied_at)
  values (s.id, 'merge_succeed', v_entry, v_after, v_run, now());

  return query select * from _rep order by 1;  -- ⚠️ 「field」는 OUT 변수와 이름이 겹친다(ambiguous) — 순번으로 정렬
end;
$$;

comment on function public.merge_succession(text, text, boolean, text) is
  '병합 데이터 승계 — 열 단위 coalesce. p_dry=true 가 기본(보고서만). '
  'address·lifecycle_stage 는 의미 검사라 자동 승계 제외. 근거: docs/PV_INSTRUCTION_20260910.md';

-- ── 2026-09-14 적용 시 보정 2건 (문서 초안에 없던 것) ────────────────────────────
-- ⑴ 원장 op CHECK 에 'merge_succeed' 가 없었다. 그대로면 집행 경로의 원장 INSERT 가 23514 로
--    실패하고 트랜잭션 전체(스칼라 승계 포함)가 롤백된다 — dry 는 원장을 안 써서 통과해 보인다.
alter table public.site_name_applies drop constraint site_name_applies_op_check;
alter table public.site_name_applies add constraint site_name_applies_op_check
  check (op = any (array['alias_add','display_set','display_demote','builder_set','units_set',
                         'merge_deactivate','heal_realias','merge_succeed']));

-- ⑵ security definer 쓰기 함수다. 기본 EXECUTE 가 PUBLIC 이라 anon 이 RPC 로 부를 수 있었다.
revoke all on function public.merge_succession(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.merge_succession(text, text, boolean, text) to service_role;

-- ⑶ 초안의 `order by field` 는 RETURNS TABLE 의 OUT 변수 field 와 _rep.field 가 겹쳐
--    실행 시 42702(ambiguous) 로 죽는다 — 첫 호출(dry)에서 바로 난다. `order by 1` 로 고쳤다.
-- ⑷ security definer 의 search_path 에 pg_temp 를 «뒤로» 명시했다(임시 객체 가로채기 방지).
