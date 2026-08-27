-- H6-1 — 청약 날짜에서 단계를 «유도» 한다 (2026-08-27)
--
-- ── 왜 ──────────────────────────────────────────────────────────────────────
-- 실측: site_type='subscription' 현장의 lifecycle_stage 가 «거의 전부 근거 없음» 이다.
--   post_move_in 2,172건 · move_in_ready 724건 — 둘 다 stage_source 가 «100% null»,
--   즉 기본값이 그대로 남아 있다. 청약 날짜와 한 번도 대조된 적이 없다.
--
-- 그래서 화면에 이런 게 나온다:
--   「더샵 트리센트 · 입주 예정」인데 청약 접수가 «이번 달» 이다
--   「기장 이진캐스빌 · 기축」인데 「마감 D+115」 배지가 붙어 있다
--
-- ⛔ 렌더할 때 유도하지 않는다. 화면마다 판정이 갈리고, 정렬·필터는 DB 가 하므로
--    화면에서만 고치면 목록 순서와 배지가 서로 다른 말을 한다. 컬럼을 채운다.

create or replace function public.derive_subscription_stage(
  p_rcept_bgnde   date,
  p_rcept_endde   date,
  p_presnatn_de   date,
  p_cntrct_bgnde  date,
  p_cntrct_endde  date,
  p_move_in       date,
  p_today         date default current_date
)
returns text
language sql immutable as $fn$
  select case
    -- 접수 시작일조차 없으면 판정하지 않는다. 억지로 채우면 그게 곧 근거 없는 값이다.
    when p_rcept_bgnde is null then null

    -- 공고는 났고 접수 전
    when p_today < p_rcept_bgnde then 'pre_announcement'

    -- 접수 기간 (종료일이 없으면 시작일 하루로 본다)
    when p_today <= coalesce(p_rcept_endde, p_rcept_bgnde) then 'subscription_open'

    -- 접수는 끝났고 발표 전. ⚠️ 발표일이 «없으면» subscription_open 을 유지한다 —
    --    「발표를 기다린다」와 「발표일을 모른다」는 다르다.
    when p_presnatn_de is null then 'subscription_open'
    when p_today < p_presnatn_de then 'award_pending'

    -- 발표 후 30일까지는 발표 단계로 둔다(당첨자 확인·서류 기간)
    when p_today <= p_presnatn_de + 30 then 'award_announced'

    -- 계약 기간
    when p_cntrct_bgnde is not null and p_today >= p_cntrct_bgnde
     and p_today <= coalesce(p_cntrct_endde, p_cntrct_bgnde + 7) then 'contract_signing'

    -- 계약 후 ~ 입주 전
    when p_move_in is not null and p_today < p_move_in then 'construction'

    -- 입주 시작 후 180일까지
    when p_move_in is not null and p_today <= p_move_in + 180 then 'move_in_started'
    when p_move_in is not null then 'post_move_in'

    -- 입주일을 모르면 «계약 이후» 까지만 말하고 멈춘다. post_move_in 으로 밀면
    -- 지금 이 화면의 문제(근거 없는 「기축」)를 그대로 재생산한다.
    else 'construction'
  end
$fn$;

grant execute on function public.derive_subscription_stage(date,date,date,date,date,date,date) to anon, authenticated;

-- ── 현장별 유도값 뷰 ──
-- ⚠️ 현장 하나에 청약 회차가 여러 건이면 «가장 최근 회차» 를 본다.
--    옛 회차로 판정하면 재분양 현장이 영원히 post_move_in 이 된다.
-- ⚠️ 조인은 btrim(house_nm) = name (후행 공백 12행 · T1-2).
create or replace view public.v_subscription_stage_derived
with (security_invoker = on) as
with latest as (
  select distinct on (s.id)
         s.id as site_id, s.lifecycle_stage as current_stage, s.stage_source,
         a.rcept_bgnde, a.rcept_endde, a.przwner_presnatn_de,
         a.cntrct_cncls_bgnde, a.cntrct_cncls_endde,
         -- move_in_date 는 text 다. 'YYYY-MM' · 'YYYY-MM-DD' 가 섞여 있어 안전하게 캐스팅한다.
         case
           when s.move_in_date ~ '^\d{4}-\d{2}-\d{2}$' then s.move_in_date::date
           when s.move_in_date ~ '^\d{4}-\d{2}$'       then (s.move_in_date || '-01')::date
           when a.mvn_prearnge_ym ~ '^\d{6}$'
             then (substr(a.mvn_prearnge_ym,1,4) || '-' || substr(a.mvn_prearnge_ym,5,2) || '-01')::date
           else null
         end as move_in
    from apt_sites s
    join apt_subscriptions a on btrim(a.house_nm) = s.name
   where s.site_type = 'subscription'
     and s.stage_source is null          -- ⛔ 사람이 정한 단계는 «건드리지 않는다»
   order by s.id, a.rcept_bgnde desc nulls last
)
select site_id, current_stage,
       derive_subscription_stage(rcept_bgnde, rcept_endde, przwner_presnatn_de,
                                 cntrct_cncls_bgnde, cntrct_cncls_endde, move_in) as derived_stage
  from latest;

grant select on public.v_subscription_stage_derived to anon, authenticated;

-- ── 백필 1회 ────────────────────────────────────────────────────────────────
-- ⚠️ stage_updated_at 을 «바꾸지 않는다». A6 의 stage 관측이 「24시간 안에 바뀐 현장」을
--    잡는데, 백필로 864건을 한꺼번에 찍으면 관측이 그 864건을 「방금 움직였다」고 쏟아낸다.
--    사실이 아니다 — 우리가 값을 고친 것이지 현장이 움직인 게 아니다.
-- ⚠️ previous_stage 도 기록하지 않는다. 같은 이유다.
update apt_sites s
   set lifecycle_stage = v.derived_stage,
       stage_source    = 'derived_subscription'
  from v_subscription_stage_derived v
 where v.site_id = s.id
   and v.derived_stage is not null
   and v.derived_stage is distinct from v.current_stage;
-- 실측(2026-08-27): 대상 2,960 · 변경 864 · 판정불가 0
--   move_in_ready→construction 708 · post_move_in→move_in_started 118
--   move_in_ready→award_announced 16 · subscription_open→award_pending 9 · 기타 13

-- ── 일 1회 재계산 RPC ───────────────────────────────────────────────────────
-- ⚠️ 백필과 «다르게» stage_updated_at 과 previous_stage 를 갱신한다.
--    백필은 「우리가 값을 고친 것」이고 여기는 「현장이 실제로 다음 단계로 넘어간 것」이다.
--    그래야 A6 의 stage 관측이 진짜 변화만 잡는다.
-- ⛔ stage_source 가 «사람이 정한 값» 이면 건드리지 않는다. 우리가 찍은
--    'derived_subscription' 만 다시 계산한다.
create or replace function public.refresh_subscription_stages(p_today date default current_date)
returns table(site_id uuid, from_stage text, to_stage text)
language sql volatile security invoker as $fn$
  with latest as (
    select distinct on (s.id)
           s.id, s.lifecycle_stage as cur,
           a.rcept_bgnde, a.rcept_endde, a.przwner_presnatn_de,
           a.cntrct_cncls_bgnde, a.cntrct_cncls_endde,
           case
             when s.move_in_date ~ '^\d{4}-\d{2}-\d{2}$' then s.move_in_date::date
             when s.move_in_date ~ '^\d{4}-\d{2}$'       then (s.move_in_date || '-01')::date
             when a.mvn_prearnge_ym ~ '^\d{6}$'
               then (substr(a.mvn_prearnge_ym,1,4) || '-' || substr(a.mvn_prearnge_ym,5,2) || '-01')::date
             else null
           end as move_in
      from apt_sites s
      join apt_subscriptions a on btrim(a.house_nm) = s.name
     where s.site_type = 'subscription'
       and (s.stage_source is null or s.stage_source = 'derived_subscription')
     order by s.id, a.rcept_bgnde desc nulls last
  ),
  calc as (
    select id, cur,
           derive_subscription_stage(rcept_bgnde, rcept_endde, przwner_presnatn_de,
                                     cntrct_cncls_bgnde, cntrct_cncls_endde, move_in, p_today) as nxt
      from latest
  ),
  upd as (
    update apt_sites s
       set lifecycle_stage  = c.nxt,
           previous_stage   = c.cur,
           stage_source     = 'derived_subscription',
           stage_updated_at = now()
      from calc c
     where c.id = s.id and c.nxt is not null and c.nxt is distinct from c.cur
     returning s.id, c.cur, c.nxt
  )
  select id, cur, nxt from upd
$fn$;

grant execute on function public.refresh_subscription_stages(date) to service_role;
