-- A5 — 블로그·이슈를 «현장» 에 붙인다 (2026-08-27)
--
-- ⚠️ 지시서는 `apt_site_id bigint` 였다. apt_sites.id 는 «uuid» 다. 타입을 맞췄다.

alter table blog_posts   add column if not exists apt_site_id uuid references apt_sites(id);
alter table blog_posts   add column if not exists mentioned_site_ids uuid[];
alter table issue_alerts add column if not exists apt_site_id uuid references apt_sites(id);
create index if not exists idx_blog_posts_apt_site   on blog_posts   (apt_site_id) where apt_site_id is not null;
create index if not exists idx_issue_alerts_apt_site on issue_alerts (apt_site_id) where apt_site_id is not null;

-- ══ 매칭 사전 3종 ══════════════════════════════════════════════════════════
--
-- ⛔ name_variants 를 «그대로» 매칭에 쓰면 안 된다. 실측:
--      힐스테이트 137곳 · 푸르지오 113곳 · 더샵 83 · e편한세상 82 · 미분양 169 · 재개발 48
--      인천 57 · 부산 44 …  브랜드·지역·일반어가 변형 목록에 그대로 들어 있다.
--    거르지 않으면 제목 하나가 수백 현장에 매칭된다.

-- ① 브랜드·일반어 금지 목록 — «5곳 이상» 이 공유하는 변형
drop materialized view if exists public.mv_apt_name_stop cascade;
create materialized view public.mv_apt_name_stop as
select btrim(v) as token
  from apt_sites s, jsonb_array_elements_text(coalesce(s.name_variants,'[]'::jsonb)) v
 where s.is_active is not false and length(btrim(v)) >= 2
 group by btrim(v) having count(distinct s.id) >= 5;
create unique index idx_mv_apt_name_stop on public.mv_apt_name_stop (token);

-- ② 지역 사전 — 시도 + 시군구(접미사 제거). 한 토큰이 여러 시도에 걸리면 버린다.
drop materialized view if exists public.mv_geo_token cascade;
create materialized view public.mv_geo_token as
with sido(token, region) as (values
  ('서울','서울'),('부산','부산'),('대구','대구'),('인천','인천'),('광주','광주'),
  ('대전','대전'),('울산','울산'),('세종','세종'),('경기','경기'),('강원','강원'),
  ('충북','충북'),('충남','충남'),('전북','전북'),('전남','전남'),
  ('경북','경북'),('경남','경남'),('제주','제주')
), sgg as (
  select distinct regexp_replace(btrim(sigungu), '(시|군|구)$', '') as token, region
    from apt_sites where sigungu is not null and region is not null and length(btrim(sigungu)) >= 3
), allrows as (select * from sido union all select * from sgg)
select token, min(region) as region from allrows where length(token) >= 2
 group by token having count(distinct region) = 1;
create unique index idx_mv_geo_token on public.mv_geo_token (token);

-- ③ 단지명 색인 — 정식이름 4자↑ / 변형 6자↑ / tx_match_prefix 접두.
--    «한 현장만» 쓰는 토큰만 남기고, 위 금지 목록은 뺀다.
drop materialized view if exists public.mv_apt_name_index cascade;
create materialized view public.mv_apt_name_index as
with raw as (
  select s.id as site_id, btrim(s.name) as token, 4 as min_len from apt_sites s where s.is_active is not false
  union all
  select s.id, btrim(v), 6 from apt_sites s,
       jsonb_array_elements_text(coalesce(s.name_variants,'[]'::jsonb)) v where s.is_active is not false
  union all
  select s.id, btrim(left(s.name, length(s.name) - position(' ' in reverse(s.name)))), 6
    from apt_sites s where s.is_active is not false and s.tx_match_prefix is true and position(' ' in s.name) > 0
),
cleaned as (select site_id, token from raw where token is not null and length(token) >= min_len),
uniq as (select token from cleaned group by token having count(distinct site_id) = 1)
select distinct c.token, c.site_id, length(c.token) as token_len
  from cleaned c join uniq u on u.token = c.token
  left join mv_apt_name_stop st on st.token = c.token
 where st.token is null;
create unique index idx_mv_apt_name_index_token on public.mv_apt_name_index (token);
grant select on public.mv_apt_name_index, public.mv_geo_token, public.mv_apt_name_stop to anon, authenticated, service_role;

-- ══ 매칭 함수 ══════════════════════════════════════════════════════════════
create or replace function public.match_apt_sites_all(p_text text)
returns uuid[] language sql stable as $fn$
  with hit as (
    select m.site_id, m.token from mv_apt_name_index m
     where p_text is not null and position(m.token in p_text) > 0
  ),
  -- ⚠️ 지역 판정은 «매칭된 단지명을 뺀» 나머지 글로 한다.
  --    「목포 진주빌라」는 «진주»빌라 때문에 경남이 언급된 것으로 읽혀
  --    경남 통영 현장이 통과했다. 이름을 지우면 남는 것은 목포(전남) 뿐이라 올바르게 걸린다.
  scored as (
    select h.site_id, s.region,
           (select count(*) from mv_geo_token g where position(g.token in replace(p_text, h.token, ' ')) > 0) as geo_n,
           (select count(*) from mv_geo_token g where g.region = s.region
              and position(g.token in replace(p_text, h.token, ' ')) > 0) as geo_ok
      from hit h join apt_sites s on s.id = h.site_id
  )
  select coalesce(array_agg(distinct site_id), '{}'::uuid[])
    from scored where geo_n = 0 or geo_ok > 0
$fn$;

create or replace function public.match_apt_site(p_text text)
returns uuid language sql stable as $fn$
  -- ⛔ 「2건 이상이면 null」. 억지로 하나 고르면 «틀린 현장에 글이 붙는다».
  --    애매한 것은 mentioned_site_ids 로 보낸다.
  select case when array_length(v, 1) = 1 then v[1] else null end
    from (select public.match_apt_sites_all(p_text) as v) t
$fn$;
grant execute on function public.match_apt_sites_all(text), public.match_apt_site(text) to anon, authenticated;

-- ══ 백필 결과 (2026-08-27) ══════════════════════════════════════════════════
--   blog_posts(발행·apt) 4,714 → 단일 2,938 (62.3%) · 모호 147 · 무매칭 1,629
--   issue_alerts(apt)    6,717 → 5,380 연결 · region_sido null 6,433 → 4,347
--   무매칭 재분류: policy 93 · market 1,105 · 미분류 잔여 431
--   ⚠️ 잔여 431 은 두 종류가 섞여 있다 — ①브랜드가 이름인 현장 글(호반써밋 첨단3지구 등)
--      ②애초에 부동산이 아닌 글(CATL 배터리 · K-푸드 수출 등 category 오분류).
--      섞인 채로 policy/market 을 붙이면 거짓 라벨이 된다. 그대로 뒀다.
--
-- ⚠️ 색인은 materialized view 다. 현장이 늘면 갱신해야 한다:
--      refresh materialized view mv_apt_name_stop;
--      refresh materialized view mv_geo_token;
--      refresh materialized view mv_apt_name_index;   -- stop 을 참조하므로 «이 순서»
