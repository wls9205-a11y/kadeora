-- H7-2 — 단계 오염의 «진짜 원인»: 같은 컬럼에 기록자가 둘이었다 (2026-08-28)
--
-- ══ 지시서 진단과 달랐던 점 ═════════════════════════════════════════════════
-- 지시서는 `derive_subscription_stage` 를 고치라고 했다. 그런데 그 함수를 «재계산해 보면
-- 옳은 값을 낸다»:
--     더샵 트리센트         저장 move_in_ready → 재계산 award_announced
--     한화포레나 부산대연     저장 post_move_in  → 재계산 move_in_started
--     구서 다움포레          저장 post_move_in  → 재계산 move_in_started
--     move_in_ready 16건 전부 → 재계산 award_announced
-- 게다가 그 함수에는 `move_in_ready` 를 «반환하는 경로가 아예 없다».
-- 즉 함수를 고쳤다면 «맞는 로직만 바꾸고 원인은 그대로» 남았을 것이다.
--
-- ── 진짜 원인 ───────────────────────────────────────────────────────────────
-- `fn_refresh_lifecycle_stage` (pg_cron `lifecycle-stage-refresh`, 06:23 KST)가
-- 같은 컬럼을 «다른 규칙으로» 쓴다. H6 의 stage-derive(05:00)보다 «뒤에» 돌고
-- «전진 방향으로만» 밀기 때문에 매일 이긴다.
--
--   구 함수                                   H6 함수
--   ├ 조인 source_ids->>subscription_id       ├ 조인 btrim(house_nm)=name
--   ├ stage_source 를 «무시» (사람 값도 덮음)   ├ stage_source 존중
--   ├ rank 가 큰 쪽으로만 전진                  ├ 양방향
--   ├ 계약 종료일 지나면 move_in_ready         ├ 그 단계 자체가 없음
--   ├ 입주월이 지난달이면 «즉시» post_move_in   ├ 입주 +180일 유예
--   └ stage_updated_at·previous_stage 안 씀    └ 둘 다 기록
--
-- ⚠️ 구 함수는 stage_source 를 안 보므로 «사람이 정한 376건» 까지 덮을 수 있었다
--    (busan_opendata 277 · migration 72 · seed 26 · admin 1).
-- ⚠️ 오늘도 705행을 바꿀 참이었다.
--
-- ── 왜 «구 함수를» 은퇴시키나 ───────────────────────────────────────────────
-- 실측: 이름 조인 2,758곳 · source_ids 조인 2,755곳 · «구 조인에만 있는 현장 1곳».
-- 잃는 것이 사실상 없다. 반면 구 함수는 사람 값을 덮고 유예도 없다.
-- ⛔ 함수를 «삭제하지 않는다» — 스케줄만 끈다(되돌릴 수 있게). 실체 확인 없이 삭제 금지.
-- ⚠️ 구 조인에만 있던 1곳: 「인천 가정2지구 B2블록 우미 린(사전청약)」.
--    이름이 안 맞아 이름 조인이 못 잡는다. 자동 갱신에서 빠지는 것을 «알고» 둔다.

-- ── ① 두 번째 기록자를 멈춘다 ───────────────────────────────────────────────
-- 권한 메모: `update cron.job` 은 permission denied 다. 지원 API 는 cron.alter_job.
-- 스케줄만 끈다 — unschedule 은 지우는 것이라 쓰지 않는다.
select cron.alter_job(jobid, active := false)
  from cron.job where jobname = 'lifecycle-stage-refresh';

comment on function public.fn_refresh_lifecycle_stage() is
  '⛔ 2026-08-28 은퇴(H7-2). apt_sites.lifecycle_stage 의 기록자는 '
  'refresh_subscription_stages 하나뿐이다. 이 함수는 stage_source 를 무시하고 '
  'previous_stage·stage_updated_at 도 안 남긴다. 스케줄을 «되살리지 말 것».';

-- ── ② 유도 규칙 — 모르면 앞으로 밀지 않는다 ─────────────────────────────────
-- ⚠️ 지시서 항목 2·3·4 는 «이미 그렇게 되어 있었다»(입주일 null → construction 유지,
--    post_move_in 은 입주 +180일 초과만, move_in_ready 반환 경로 없음). 손대지 않았다.
-- 항목 1(계약기간 null → award_announced 유지)만 넣는다.
--    ⚠️ 오늘 기준 «영향 0건» 이다 — 계약 시작일이 없는 회차가 0/2,855 다.
--       미래에 그런 데이터가 들어왔을 때 조용히 「입주」로 밀리지 않게 하는 가드다.
create or replace function public.derive_subscription_stage(
  p_rcept_bgnde date, p_rcept_endde date, p_presnatn_de date,
  p_cntrct_bgnde date, p_cntrct_endde date, p_move_in date,
  p_today date default current_date)
returns text language sql immutable as $function$
  select case
    -- 접수 시작일조차 없으면 판정하지 않는다. 억지로 채우면 그게 곧 근거 없는 값이다.
    when p_rcept_bgnde is null then null
    when p_today < p_rcept_bgnde then 'pre_announcement'
    when p_today <= coalesce(p_rcept_endde, p_rcept_bgnde) then 'subscription_open'

    -- 접수는 끝났고 발표 전. ⚠️ 발표일이 «없으면» subscription_open 을 유지한다 —
    --    「발표를 기다린다」와 「발표일을 모른다」는 다르다.
    when p_presnatn_de is null then 'subscription_open'
    when p_today < p_presnatn_de then 'award_pending'
    when p_today <= p_presnatn_de + 30 then 'award_announced'

    -- H7-2 ⚠️ 계약 일정을 «모르면» 여기서 멈춘다. 발표는 있었다는 것까지가 아는 전부다.
    --    (「발표일이 없으면 subscription_open 유지」와 같은 원칙이다.)
    when p_cntrct_bgnde is null then 'award_announced'

    when p_today >= p_cntrct_bgnde
     and p_today <= coalesce(p_cntrct_endde, p_cntrct_bgnde + 7) then 'contract_signing'

    when p_move_in is not null and p_today < p_move_in then 'construction'
    when p_move_in is not null and p_today <= p_move_in + 180 then 'move_in_started'
    when p_move_in is not null then 'post_move_in'

    -- 입주일을 모르면 «계약 이후» 까지만 말하고 멈춘다.
    else 'construction'
  end
$function$;

-- ── ③ 백필 함수와 크론 함수를 «가른다» ──────────────────────────────────────
-- ⚠️ 이게 「최근 움직인 현장」이 전부 같은 문구가 된 이유다. 8-27 백필이 865건의
--    stage_updated_at 을 «그날» 로 찍었고, 그 컬럼이 곧 「움직임」의 정의였다.
--    백필은 «우리가 값을 고친 것» 이고 현장이 움직인 것이 아니다.
-- ⛔ 이 함수는 stage_updated_at 을 «건드리지 않는다». 되돌리지 말 것.
create or replace function public.backfill_subscription_stages(p_today date default current_date)
returns table(site_id uuid, from_stage text, to_stage text)
language sql as $function$
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
       set lifecycle_stage = c.nxt,
           stage_source    = 'derived_subscription'
      from calc c
     where c.id = s.id and c.nxt is not null and c.nxt is distinct from c.cur
     returning s.id, c.cur, c.nxt
  )
  select id, cur, nxt from upd
$function$;

grant execute on function public.backfill_subscription_stages(date) to service_role;
