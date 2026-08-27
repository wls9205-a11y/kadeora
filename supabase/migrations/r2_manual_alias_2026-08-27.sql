-- R2 — 사람이 검증한 별칭 수동 등록 (2026-08-27)
--
-- ── 왜 별도 테이블인가 ──────────────────────────────────────────────────────
-- mv_apt_name_index 는 «변형(name_variants)» 에 최소 6자를 건다. 그 목록에
-- 브랜드·지역·일반어(힐스테이트 137곳 · 김포 · 1차 · 아파트)가 섞여 있어서다.
--
-- 그런데 R2 가 다루는 것은 «사람이 하나씩 대조해 확인한» 별칭이다. 「삼익비치」는
-- 4자라 그 문턱에 걸리는데, 부산 수영구에서 526건이 거래된 실존 단지명이고
-- 현장명은 「남천2-3(삼익비치) 재건축」이다. 자동 규칙으로는 영원히 안 붙는다.
--
-- ⛔ 문턱을 낮추지 «않는다». 낮추면 검증 안 된 짧은 변형이 전부 들어와
--    R1 때 잡았던 종류의 오매칭이 돌아온다.
-- ⚠️ 대신 «사람이 넣은 것만» 따로 받는다. 이 테이블에 들어오려면 세 가지를 통과해야 한다:
--    ① 실제 거래명일 것(apt_transactions 에 존재) ② 같은 시도일 것 ③ 단일 매칭일 것

create table if not exists apt_name_alias_manual (
  site_id     uuid not null references apt_sites(id) on delete cascade,
  token       text not null,
  -- 왜 넣었는지 남긴다. 근거 없는 등록을 막는 장치다.
  evidence    text not null,
  created_at  timestamptz default now(),
  primary key (site_id, token)
);

grant select on apt_name_alias_manual to anon, authenticated;
grant all on apt_name_alias_manual to service_role;

-- ── 등록 ────────────────────────────────────────────────────────────────────
-- ⚠️ «활성 행에만» 넣는다. 같은 이름의 비활성 중복 행이 있는데, 둘 다 넣으면
--    토큰이 두 현장에 걸려 색인의 「한 현장만」 조건에서 통째로 탈락한다.
insert into apt_name_alias_manual (site_id, token, evidence)
select s.id, '삼익비치',
       '부산 수영구 apt_transactions 거래명 526건 · 고유 1건 · 현장명 남천2-3(삼익비치) 재건축'
  from apt_sites s
 where s.name = '남천2-3(삼익비치) 재건축' and s.is_active is true
on conflict do nothing;

-- ── 색인에 반영 ─────────────────────────────────────────────────────────────
-- 수동 별칭은 «길이 제한 없이» 들어간다. 대신 금지어·유일성 검사는 그대로 통과해야 한다.
drop materialized view if exists public.mv_apt_name_index cascade;
create materialized view public.mv_apt_name_index as
with raw as (
  select s.id as site_id, btrim(s.name) as token, 4 as min_len from apt_sites s where s.is_active is not false
  union all
  select s.id, btrim(v), 6 from apt_sites s,
       jsonb_array_elements_text(coalesce(s.name_variants,'[]'::jsonb)) v
   where s.is_active is not false
  union all
  select s.id, btrim(left(s.name, length(s.name) - position(' ' in reverse(s.name)))), 6
    from apt_sites s where s.is_active is not false and s.tx_match_prefix is true and position(' ' in s.name) > 0
  union all
  -- R2 — 사람이 검증한 별칭. 길이 문턱 «없음»(2자).
  select a.site_id, btrim(a.token), 2
    from apt_name_alias_manual a
    join apt_sites s on s.id = a.site_id and s.is_active is not false
),
cleaned as (select site_id, token from raw where token is not null and length(token) >= min_len),
uniq as (select token from cleaned group by token having count(distinct site_id) = 1)
select distinct c.token, c.site_id, length(c.token) as token_len
  from cleaned c
  join uniq u on u.token = c.token
  left join mv_apt_name_stop st on st.token = c.token
 where st.token is null;
create unique index idx_mv_apt_name_index_token on public.mv_apt_name_index (token);
grant select on public.mv_apt_name_index to anon, authenticated, service_role;
