-- B6 — /apt 위 덩어리의 「최신」 기준을 «모집공고일» 로 (2026-08-28)
--
-- ── 왜 이제야 바꾸나 ────────────────────────────────────────────────────────
-- H5-2 때는 `announcement_date` 가 2,853건 null 이라 «라벨만 바꾸면 다른 날짜를
-- 모집공고일이라 말하는 화면» 이 되므로 접수일(rcept_bgnde)로 두고 라벨도 그렇게 적었다.
-- T1 백필이 끝나 2026-08-28 실측 «2,855/2,855 채워짐 · null 0» 이다. 이제 키와 라벨을
-- «같이» 바꾼다.
--
-- ⚠️ 실측으로 확인하고 바꿨다:
--    · 형식 전부 YYYY-MM-DD (2,855/2,855) → 문자열 정렬 = 날짜 정렬
--    · 공고일이 접수일보다 «늦은» 이상값 0건
--    · 두 날짜가 «다른» 행 2,855건 — 즉 이 변경은 실제로 순서를 바꾼다(무의미한 교체가 아니다)
--
-- ⚠️ announcement_date 는 «text» 다. 형식이 섞이는 순간 정렬이 조용히 틀린다.
--    수집기를 손대면 이 함수를 date 캐스트로 같이 고칠 것.
--
-- ⛔ 반환 컬럼이 늘어 CREATE OR REPLACE 가 안 된다(반환 타입 변경). DROP 후 CREATE.

drop function if exists public.get_apt_region_blocks(text, text, integer, integer);

CREATE FUNCTION public.get_apt_region_blocks(p_region text, p_sigungu text DEFAULT NULL::text, p_min_score integer DEFAULT 40, p_limit integer DEFAULT 40)
 RETURNS TABLE(block text, id uuid, slug text, name text, display_name text, region text, sigungu text, total_units integer, lifecycle_stage text, content_score integer, cover_image_url text, hero_image_url text, rcept_bgnde date, rcept_endde date, announcement_date text, stage_updated_at timestamp with time zone, sort_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  -- ⚠️ UNION 의 각 분기에는 LIMIT 를 직접 못 붙인다. CTE 로 끊어 각각 한도를 준다.
  with opened_raw as (
    -- distinct on 으로 «현장당 최신 회차 1건» 만. 여러 회차면 같은 이름이 여러 번 뜬다.
    select distinct on (s.id)
           s.id, s.slug, s.name, s.display_name, s.region, s.sigungu,
           s.total_units, s.lifecycle_stage, s.content_score,
           s.cover_image_url, s.hero_image_url,
           a.rcept_bgnde, a.rcept_endde, a.announcement_date, s.stage_updated_at
      from apt_sites s
      join apt_subscriptions a on btrim(a.house_nm) = s.name
     where s.is_active is not false
       and s.region = p_region
       and (p_sigungu is null or s.sigungu = p_sigungu)
       and coalesce(s.content_score, 0) >= p_min_score
     -- ⚠️ 「현장당 최신 회차」의 기준도 «정렬 키와 같아야» 한다. 아래 opened 가
     --    모집공고일로 줄을 세우는데 여기서 접수일로 회차를 고르면 두 기준이 갈린다.
     order by s.id, a.announcement_date desc nulls last
  ),
  opened as (
    select * from opened_raw
     -- B6 — 「최신」의 기준은 «모집공고일» 이다. 접수일이 아니다.
     -- ⚠️ announcement_date 는 text 인데 «전부 YYYY-MM-DD»(2,855/2,855 실측)라
     --    문자열 정렬이 곧 날짜 정렬이다. 형식이 섞이면 이 정렬이 «조용히» 틀린다 —
     --    형식을 바꾸는 수집기를 넣게 되면 여기를 date 캐스트로 고칠 것.
     order by announcement_date desc nulls last, stage_updated_at desc nulls last
     limit p_limit
  ),
  pipeline as (
    -- ⚠️ 위 덩어리에 «없는» 것만. 있으면 같은 현장이 두 번 나온다.
    select s.id, s.slug, s.name, s.display_name, s.region, s.sigungu,
           s.total_units, s.lifecycle_stage, s.content_score,
           s.cover_image_url, s.hero_image_url,
           null::date as rcept_bgnde, null::date as rcept_endde,
           null::text as announcement_date, s.stage_updated_at
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
     -- 그래서 «단계» 를 우선순위로 둔다. 「곧 나올」은 곧 분양이 나온다는 뜻이고,
     -- 분양에 가까운 단계일수록 그 뜻에 가깝다. 같은 단계 안에서만 최신순을 쓴다.
     --
     -- ⚠️ 그리고 «큐레이션이 그보다 앞» 이다. is_curated 는 담당이 손으로 올린 것이고,
     --    자동 신호가 못 잡는 것을 사람이 잡아 둔 자리다. 실측: 부산의 「곧 나올 현장」
     --    후보 308곳 중 큐레이션은 «1곳»(오티에르 해운대) 뿐이다 — 목록을 뒤집는
     --    규칙이 아니라 사람이 지정한 소수를 앞에 세우는 규칙이다.
     --    그 현장은 stage_updated_at 이 null 이고 단계가 site_planning 이라 자동 정렬로는
     --    326위였다. 데이터 결손을 가리는 게 아니라, «사람의 지정» 을 우선하는 것이다.
     -- ⛔ 라벨은 바뀌지 않는다. 「인기」가 아니다 — 순위 신호가 아니라 담당 지정이다.
     order by (s.is_curated is true) desc,
              case s.lifecycle_stage
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
         o.rcept_bgnde, o.rcept_endde, o.announcement_date, o.stage_updated_at,
         coalesce(o.announcement_date::timestamptz, o.stage_updated_at) as sort_at
    from opened o
  union all
  select 'pipeline'::text, p.id, p.slug, p.name, p.display_name, p.region, p.sigungu,
         p.total_units, p.lifecycle_stage, p.content_score, p.cover_image_url, p.hero_image_url,
         p.rcept_bgnde, p.rcept_endde, p.announcement_date, p.stage_updated_at,
         p.stage_updated_at as sort_at
    from pipeline p
$function$;

grant execute on function public.get_apt_region_blocks(text, text, integer, integer) to anon, authenticated, service_role;
