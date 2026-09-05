-- SU-B3 — v_signup_funnel_daily 개정: 서버 구간(authorize·콜백)을 깔때기에 편입 (2026-09-05)
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- 이 뷰는 「방문 → 로그인 클릭 → 가입」만 봤다. 그 사이의 서버 구간 —
-- authorize · 콜백 · 제공자 오류 — 이 통째로 비어 있었고, 그래서 9/4 07:21 의
-- kauth 504(서버측 토큰 교환 타임아웃)는 이 표에서 «그냥 가입이 없는 날» 로 보였다.
-- 21일 실측: 시도 20 · authorize 17 · 콜백 8 · 성공 8. 이 표는 그중 마지막 하나만
-- 알고 있었다.
--
-- ── 이 파일이 존재하는 이유 (CV-B 거버넌스 소급 해소) ────────────────────────
-- ⚠️ 이 뷰는 여태 «DB 에만» 있었다. 저장소에 정의가 0건이라, 누가 언제 무엇을
--    바꿨는지 되짚을 근거가 없었다. 이 파일이 그 정의를 저장소에 처음 동봉한다.
--    이후 이 뷰의 변경은 반드시 마이그레이션 파일로 온다.
--
-- ⛔ 기존 4열(visitors · login_visits · signups · conv_rate_pct) 삭제·개명 금지.
--    소비처가 있다. 추가만 한다 — 그래서 신규 열은 전부 «뒤» 에 붙는다.
-- ⚠️ 날짜 축은 기존과 같은 `::date` 캐스트를 쓴다. 여기서만 AT TIME ZONE 을 넣으면
--    같은 행의 좌우 열이 서로 다른 하루를 말하게 된다.
create or replace view v_signup_funnel_daily as
with days as (
  select generate_series(current_date - interval '6 days', current_date::timestamp, interval '1 day')::date as day
)
select
  d.day,

  -- ── 기존 4열 (정의 불변) ────────────────────────────────────────────────
  (select count(distinct ue.visitor_id) from user_events ue
    where ue.created_at::date = d.day) as visitors,

  (select count(distinct ce.visitor_id) from conversion_events ce
    where ce.created_at::date = d.day
      and ce.event_type = 'cta_click'
      and (ce.category = 'signup' or ce.cta_name like 'login_%' or ce.cta_name like '%signup%'
           or ce.cta_name = 'sticky_signup_bar' or ce.cta_name = 'kakao_hero')) as login_visits,

  (select count(*) from v_real_users ru where ru.created_at::date = d.day) as signups,

  case when (select count(distinct ue.visitor_id) from user_events ue
              where ue.created_at::date = d.day) > 0
       then round(100.0 * (select count(*) from v_real_users ru where ru.created_at::date = d.day)::numeric
                  / nullif((select count(distinct ue.visitor_id) from user_events ue
                             where ue.created_at::date = d.day), 0)::numeric, 2)
       else 0::numeric
  end as conv_rate_pct,

  -- ── SU-B3 신규 5열 — signup_attempts 기반 서버 구간 ──────────────────────
  -- 시작. track-attempt 가 앉힌 행 수 = 「카카오/구글 버튼을 실제로 누른 횟수」.
  (select count(*) from signup_attempts sa
    where sa.oauth_started_at::date = d.day) as oauth_starts,

  -- 콜백 «도달». A-3 이후로는 실패 콜백도 여기에 잡힌다 —
  -- 그전까지 제공자 오류는 「콜백 미도달」로 위장돼 이 칸에서 사라졌다.
  (select count(*) from signup_attempts sa
    where sa.oauth_callback_at::date = d.day) as oauth_callbacks,

  -- 완료(프로필 생성까지). ⚠️ 재로그인이 섞인다 — 신규만 세려면 new_signups 를 본다.
  (select count(*) from signup_attempts sa
    where sa.oauth_callback_at::date = d.day and sa.success) as oauth_completes,

  -- 제공자/교환 실패. 0 이 아니면 그날의 「가입 없음」은 마케팅이 아니라 인프라다.
  (select count(*) from signup_attempts sa
    where sa.oauth_callback_at::date = d.day and sa.dropped_step = 'callback_error') as provider_errors,

  -- 신규가입. ⚠️ 9/5 이전 행은 is_new_user 가 null 이라 구간 전체가 0 이다(백필 안 함).
  (select count(*) from signup_attempts sa
    where sa.oauth_callback_at::date = d.day and sa.success and sa.is_new_user) as new_signups

from days d
order by d.day desc;

comment on view v_signup_funnel_daily is
  'SU-B3(2026-09-05): 클라 구간 4열 + signup_attempts 서버 구간 5열. 정의 정본은 supabase/migrations/su2_v_signup_funnel_daily_2026-09-05.sql. 열 삭제·개명 금지(소비처 존재).';
