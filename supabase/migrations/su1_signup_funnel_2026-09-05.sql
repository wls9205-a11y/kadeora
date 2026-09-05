-- SU-B2 — signup_attempts 에 «누구였나» 와 «신규였나» 를 붙인다 (2026-09-05)
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- 21일(8/15~9/4) 깔때기: 시도 20 · authorize 17 · 콜백 8 · 성공 8.
-- 그런데 실가입(profiles kakao·비시드)은 주 1~3명이다. 「성공 8」과 실가입의 괴리는
-- 재로그인이 섞여 있기 때문인데, signup_attempts 만 봐서는 그 둘을 «가를 자가 없다».
--   → is_new_user (콜백 시점에 user.created_at 이 5분 이내인가) 가 그 자다.
--
-- visitor_id: 콜백이 conversion_events 에 user.id 를 visitor_id 로 심어 온 오염
-- (최근 14일 cta_complete 11/11 이 UUID) 을 끊으려면, 서버가 «클라의 방문자 id» 를
-- 읽을 수 있어야 한다. 그 통로가 kd_vid 쿠키이고(SU B-1), 그 값을 여기에도 남겨
-- 가입 퍼널과 CTA 퍼널이 같은 축으로 붙는다.
--
-- ⛔ 기존 행 백필 금지. 이 지시서는 «9/5 이후» 를 계측 기준선으로 삼는다.
--    소급해 채운 값은 실측이 아니라 추정이고, 다음 사람이 그걸 실측으로 읽는다.
alter table signup_attempts
  add column if not exists visitor_id text,
  add column if not exists is_new_user boolean;

comment on column signup_attempts.visitor_id is
  'kd_vid 1st-party 쿠키 값(SU B-1 정본). ⛔ user.id 를 넣지 않는다 — 그것이 cta_complete 오염의 발원지였다.';
comment on column signup_attempts.is_new_user is
  '콜백 시점 user.created_at < 5분 = 신규가입. false 면 재로그인. 9/5 이전 행은 null(백필 안 함).';

-- 콜백의 폴백 매처가 쓰는 축. source 는 «조건에서 뺐다» — 콜백 URL 의 source 와
-- 시작 행의 source 가 다른 사례가 실측됐고, 그 좁힘이 고아 콜백의 절반을 만들었다.
create index if not exists idx_signup_attempts_match
  on signup_attempts (provider, ip_hash, oauth_started_at desc);


-- ═══════════════════════════════════════════════════════════════════════════
-- SU-B4 — 배포 후 검증 쿼리 3종 (세션 A 가 실행)
--   ⚠️ 「배포시각」은 실제 배포 타임스탬프로 바꿔서 실행한다. 그 앞의 행은
--      수리 이전 기록이므로 섞으면 판정이 흐려진다.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ① cta_complete visitor_id 오염 재발 0 (A-5)
--    기대: 둘 다 0. 1 이상이면 user.id 를 쓰는 경로가 아직 남아 있다.
--    ⚠️ 「UUID 모양」은 «지표» 이지 증거가 아니다 — 정본 방문자 id 는 base36-rand 로
--       발급되므로(SU B-1) 지금은 모양만으로도 갈리지만, 확증은 auth.users 대조다.
-- select
--   count(*) filter (where visitor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-')            as uuid_shaped,
--   count(*) filter (where exists (select 1 from auth.users u where u.id::text = ce.visitor_id)) as is_user_id
--   from conversion_events ce
--  where event_type = 'cta_complete'
--    and created_at > timestamptz '2026-09-05 00:00+09';   -- ← 배포시각
--
-- ② 고아 콜백 0 (A-2)
--    기대: 0. 콜백은 도달했는데 시작 행이 없다 = 매칭이 또 빗나갔다는 뜻.
-- select count(*) as orphan_callbacks
--   from signup_attempts
--  where oauth_callback_at is not null
--    and oauth_started_at is null
--    and coalesce(oauth_callback_at, created_at) > timestamptz '2026-09-05 00:00+09';
--
-- ③ 깔때기 신규 열 채워짐 (B-3)
--    기대: oauth_starts·oauth_callbacks·oauth_completes 가 0 이 아니고,
--          provider_errors·new_signups 열이 존재한다.
-- select * from v_signup_funnel_daily;
--
-- 보조) dropped_step 시맨틱 (A-4) — 성공 행에 'oauth_start' 가 남아 있으면 안 된다.
-- select dropped_step, count(*) from signup_attempts
--  where coalesce(oauth_callback_at, created_at) > timestamptz '2026-09-05 00:00+09'
--  group by 1 order by 2 desc;
