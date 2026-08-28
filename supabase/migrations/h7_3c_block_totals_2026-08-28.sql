-- H7-3c — /apt 두 덩어리의 «캡 전» 실제 건수 (2026-08-28)
--
-- 화면이 「부산 40곳」이라고 적고 있었는데 그 40은 «limit» 이다. 부산에 현장이 정확히
-- 40곳이어서가 아니라 40개만 가져와서다. 숫자가 상한을 말하면서 실측인 척한다.
--
-- ⚠️ get_apt_region_blocks 를 고쳐 총계를 «같이» 내는 방법도 있지만 그러면 반환 타입이
--    또 바뀌어(오늘만 두 번째) DROP+CREATE 가 필요하다. 건수는 조건이 같고 행이 없으니
--    «따로 세는» 편이 싸고 읽기도 쉽다. 조건이 갈리지 않게 «주석으로 묶어» 둔다.
-- ⛔ 이 함수의 where 절은 get_apt_region_blocks 의 opened_raw·pipeline 과 «같아야 한다».
--    한쪽만 고치면 화면의 숫자와 목록이 어긋난다.

create or replace function public.get_apt_region_block_totals(
  p_region text, p_sigungu text default null::text, p_min_score integer default 40)
returns table(opened_total integer, pipeline_total integer)
language sql stable as $function$
  select
    (select count(distinct s.id)::int
       from apt_sites s
       join apt_subscriptions a on btrim(a.house_nm) = s.name
      where s.is_active is not false
        and s.is_aggregate = false
        and s.region = p_region
        and (p_sigungu is null or s.sigungu = p_sigungu)
        and coalesce(s.content_score, 0) >= p_min_score),
    (select count(*)::int
       from apt_sites s
      where s.is_active is not false
        and s.is_aggregate = false
        and s.region = p_region
        and (p_sigungu is null or s.sigungu = p_sigungu)
        and coalesce(s.content_score, 0) >= p_min_score
        and s.lifecycle_stage in
            ('pre_announcement','site_planning','union_established',
             'plan_approved','mgmt_approved','construction')
        and not exists (select 1 from apt_subscriptions a2 where btrim(a2.house_nm) = s.name))
$function$;

grant execute on function public.get_apt_region_block_totals(text, text, integer)
  to anon, authenticated, service_role;
