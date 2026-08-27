-- H5-2 — 2단 목록 두 덩어리 (2026-08-27)
--
--   위 : 청약 접수일 기준 최신   (모집공고가 나온 현장)
--   아래: 곧 나올 현장            (공고 전 · 단계 갱신 최신)
--
-- ⚠️ 라벨에 「모집공고」를 쓰지 않는다. 정렬 키가 rcept_bgnde(청약 «접수» 시작일)이고
--    announcement_date(모집공고일)는 T1 에서 «이제 막» 저장을 시작했다. 2,853건이
--    아직 null 이다. 백필과 검증이 끝난 뒤 Phase B6 에서 키와 라벨을 같이 바꾼다.
--    지금 라벨만 바꾸면 «다른 날짜를 모집공고일이라고 말하는» 화면이 된다.
--
-- ⚠️ 조인은 btrim(a.house_nm) = s.name 이다. house_nm 에 후행 공백이 든 행이 12건
--    있고, 그중 최근 90일 미매칭 3건 중 1건이 이 문제였다(T1-2).

create or replace function public.get_apt_region_blocks(
  p_region     text,
  p_sigungu    text default null,
  p_min_score  int  default 40,
  p_limit      int  default 40
)
returns table (
  block            text,
  id               uuid,
  slug             text,
  name             text,
  display_name     text,
  region           text,
  sigungu          text,
  total_units      int,
  lifecycle_stage  text,
  content_score    int,
  cover_image_url  text,
  hero_image_url   text,
  rcept_bgnde      date,
  rcept_endde      date,
  stage_updated_at timestamptz,
  sort_at          timestamptz
)
language sql stable security invoker as $fn$
  -- ⚠️ UNION 의 각 분기에는 LIMIT 를 직접 못 붙인다. CTE 로 끊어 각각 한도를 준다.
  with opened_raw as (
    -- distinct on 으로 «현장당 최신 회차 1건» 만. 여러 회차면 같은 이름이 여러 번 뜬다.
    select distinct on (s.id)
           s.id, s.slug, s.name, s.display_name, s.region, s.sigungu,
           s.total_units, s.lifecycle_stage, s.content_score,
           s.cover_image_url, s.hero_image_url,
           a.rcept_bgnde, a.rcept_endde, s.stage_updated_at
      from apt_sites s
      join apt_subscriptions a on btrim(a.house_nm) = s.name
     where s.is_active is not false
       and s.region = p_region
       and (p_sigungu is null or s.sigungu = p_sigungu)
       and coalesce(s.content_score, 0) >= p_min_score
     order by s.id, a.rcept_bgnde desc nulls last
  ),
  opened as (
    select * from opened_raw
     order by rcept_bgnde desc nulls last, stage_updated_at desc nulls last
     limit p_limit
  ),
  pipeline as (
    -- ⚠️ 위 덩어리에 «없는» 것만. 있으면 같은 현장이 두 번 나온다.
    select s.id, s.slug, s.name, s.display_name, s.region, s.sigungu,
           s.total_units, s.lifecycle_stage, s.content_score,
           s.cover_image_url, s.hero_image_url,
           null::date as rcept_bgnde, null::date as rcept_endde, s.stage_updated_at
      from apt_sites s
     where s.is_active is not false
       and s.region = p_region
       and (p_sigungu is null or s.sigungu = p_sigungu)
       and coalesce(s.content_score, 0) >= p_min_score
       -- ⚠️ 지시서 목록에 «pre_announcement(분양예정)» 이 빠져 있었다. 「곧 나올 현장」의
       --    가장 전형적인 단계다. 부산만 19곳이고, 체크리스트가 지목한 「연제 갤러리 자이」가
       --    바로 이 단계라 목록에서 통째로 빠져 있었다. 넣는다.
       and s.lifecycle_stage in
           ('pre_announcement','site_planning','union_established',
            'plan_approved','mgmt_approved','construction')
       and not exists (select 1 from apt_subscriptions a2 where btrim(a2.house_nm) = s.name)
     -- ⚠️ 「최신순」만으로는 안 된다. 실측: 부산의 공고 전 현장 308곳 중 289곳이
     --    stage_updated_at 이 «같은 날짜(2026-08-24)» 다 — 정비사업 대량 크롤 시각이고
     --    현장별 「움직임」이 아니다. 그대로 정렬하면 목록이 재개발로 뒤덮이고,
     --    정작 분양이 임박한 「연제 갤러리 자이」가 290위로 밀려 화면에서 사라진다.
     --    (updated_at 을 섞는 것도 시도했다가 버렸다 — 그건 더 심한 크론 타임스탬프다.)
     --
     -- 그래서 «단계» 를 1순위로 둔다. 「곧 나올」은 곧 분양이 나온다는 뜻이고,
     -- 분양에 가까운 단계일수록 그 뜻에 가깝다. 같은 단계 안에서만 최신순을 쓴다.
     order by case s.lifecycle_stage
                when 'pre_announcement'   then 1
                when 'construction'       then 2
                when 'mgmt_approved'      then 3
                when 'plan_approved'      then 4
                when 'union_established'  then 5
                else 6                                  -- site_planning
              end,
              s.stage_updated_at desc nulls last,
              s.content_score desc nulls last
     limit p_limit
  )
  select 'opened'::text, o.id, o.slug, o.name, o.display_name, o.region, o.sigungu,
         o.total_units, o.lifecycle_stage, o.content_score, o.cover_image_url, o.hero_image_url,
         o.rcept_bgnde, o.rcept_endde, o.stage_updated_at,
         coalesce(o.rcept_bgnde::timestamptz, o.stage_updated_at) as sort_at
    from opened o
  union all
  select 'pipeline'::text, p.id, p.slug, p.name, p.display_name, p.region, p.sigungu,
         p.total_units, p.lifecycle_stage, p.content_score, p.cover_image_url, p.hero_image_url,
         p.rcept_bgnde, p.rcept_endde, p.stage_updated_at,
         p.stage_updated_at as sort_at
    from pipeline p
$fn$;

grant execute on function public.get_apt_region_blocks(text, text, int, int) to anon, authenticated;

comment on function public.get_apt_region_blocks(text, text, int, int) is
  'H5-2 부동산 홈 2단 목록. block=opened(청약 접수일 기준 최신) / pipeline(곧 나올 현장). 조인은 btrim(house_nm)=name — house_nm 후행 공백 12건 때문.';
