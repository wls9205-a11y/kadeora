-- E-12 — 리드폼 선택 필드 파일럿(예산 범위·통화 가능 시간) · A/B · 자동 회수 트리거 (판정회신 ABG 증분 6 §2 · 2026-09-15)
--
-- 설계: 현장 slug 해시로 실험군(exp)·대조군(ctrl) 절반. 실험군 폼에만 «선택 입력» 2칸.
--   값은 Apps Script(시트)로 가지 않는다 — 스크립트가 fn_insert_lead 정해진 필드만 넘겨 받고 버리게 되므로 자체 테이블에 leadRef 키로 둔다.
--   응대 시 어드민에서 병행 확인(Node 동선).
-- 판정 축: user_events apt_lead_form 의 lead_form_start → lead_form_submit (방문자 수) 전환율, properties.pilot_arm 로 가른다.
-- 회수: 실험군 전환율이 대조군보다 20%p 이상 낮은 날이 «최근 3일 연속» 이면 app_config e12.pilot_enabled=false (판정 없이) + admin_alerts.
-- 가역: pilot_enabled=false 면 폼이 2칸을 그리지 않고 저장 API 도 받지 않는다. 테이블은 남는다.

create table if not exists public.lead_pilot_extras (
  lead_ref text primary key,
  site_slug text not null,
  arm text not null check (arm in ('exp')),
  budget_range text,
  call_time text,
  created_at timestamptz not null default now()
);
alter table public.lead_pilot_extras enable row level security;
comment on table public.lead_pilot_extras is 'E-12 파일럿: 리드폼 선택 입력(예산·통화 시간). leads 와 leadRef 로만 잇는다(시트 미전송). 응대는 어드민 병행 확인';

insert into public.app_config (namespace, key, value, description, updated_at)
values ('e12', 'pilot_enabled', 'true'::jsonb, 'E-12 리드폼 선택 필드 파일럿 스위치 — fn_e12_pilot_guard 가 자동 회수', now())
on conflict (namespace, key) do nothing;

create or replace function public.fn_e12_pilot_guard()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bad int;
  v_days jsonb;
  v_on boolean;
begin
  select coalesce((value)::text = 'true', false) into v_on from app_config where namespace = 'e12' and key = 'pilot_enabled';
  with d as (select generate_series(current_date - 3, current_date - 1, interval '1 day')::date as day),
  ev as (
    select created_at::date as day, properties->>'pilot_arm' as arm, event_type, count(distinct visitor_id) as v
    from user_events
    where event_name = 'apt_lead_form' and event_type in ('lead_form_start', 'lead_form_submit')
      and created_at >= current_date - 3 and created_at < current_date
      and properties->>'pilot_arm' in ('exp', 'ctrl')
    group by 1, 2, 3),
  r as (
    select d.day,
      coalesce((select v from ev where ev.day = d.day and arm = 'exp' and event_type = 'lead_form_submit'), 0)::numeric
        / nullif((select v from ev where ev.day = d.day and arm = 'exp' and event_type = 'lead_form_start'), 0) as exp_rate,
      coalesce((select v from ev where ev.day = d.day and arm = 'ctrl' and event_type = 'lead_form_submit'), 0)::numeric
        / nullif((select v from ev where ev.day = d.day and arm = 'ctrl' and event_type = 'lead_form_start'), 0) as ctrl_rate
    from d)
  select count(*) filter (where exp_rate is not null and ctrl_rate is not null and exp_rate < ctrl_rate - 0.20),
         jsonb_agg(jsonb_build_object('day', day, 'exp', round(exp_rate, 3), 'ctrl', round(ctrl_rate, 3)) order by day)
    into v_bad, v_days from r;

  if v_on and v_bad = 3 then
    update app_config set value = 'false'::jsonb, updated_at = now() where namespace = 'e12' and key = 'pilot_enabled';
    insert into admin_alerts (type, severity, title, message, metadata)
    values ('e12_pilot_retracted', 'warning', 'E-12 리드폼 파일럿 자동 회수 — 실험군 전환율 3일 연속 20%p+ 열세',
            '예산·통화 시간 선택 입력을 끈다(pilot_enabled=false). 판정 없이 회수 — ABG 증분 6 조건 ②', jsonb_build_object('days', v_days));
  end if;
  return jsonb_build_object('enabled_before', v_on, 'bad_days', v_bad, 'days', v_days, 'retracted', v_on and v_bad = 3);
end $$;
revoke all on function public.fn_e12_pilot_guard() from public, anon, authenticated;

select cron.schedule('e12-pilot-guard', '40 0 * * *', $$SELECT public.fn_e12_pilot_guard()$$);
