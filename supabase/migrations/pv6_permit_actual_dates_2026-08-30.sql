-- 인증키 확장 ② — 「예정」과 «실제» 를 가른다 (2026-08-30)
--
-- ── 무엇이 없었나 ───────────────────────────────────────────────────────────
-- `apt_permits` 에는 use_approval_expected(사용승인 «예정») 만 있었다.
-- hub.ts 의 필드 스펙에는 `useApprovedDay: 'useInsptDay'`(실제)가 «있었는데»
-- toPermitInsert 가 어느 컬럼에도 쓰지 않아 raw 에만 남았다 — 그리고 raw 에도 0건이다.
--
-- ⛔ 실측(2026-08-30, 후보 1,347건):
--      use_approval_expected  903건  · 그중 «예정일이 지난 것» 532건
--      use_approval_actual      0건
--    예정일이 지났다고 승인이 난 것이 «아니다». 그걸 기축 전환 근거로 쓰면
--    532개 현장이 잘못 넘어간다. 그래서 컬럼을 갈라 둔다.
--
-- ⚠️ 원문에 «존재하지 않는 날짜» 가 있다 — 실측 `19990431`(4월 31일).
--    관대한 변환은 이걸 조용히 1999-05-01 로 «지어낸다». safe_date_yyyymmdd 가 null 을 준다.
--    「모른다」와 「5월 1일이다」는 다른 사실이다.
alter table apt_permits
  add column if not exists use_approval_actual date,
  add column if not exists construct_start_actual date;

create index if not exists apt_permits_use_appr_actual_idx
  on apt_permits (use_approval_actual) where use_approval_actual is not null;

comment on column apt_permits.use_approval_actual is
  '실제 사용승인일(useInsptDay/useAprDay). use_approval_expected(예정)와 다른 사실이다 - 예정일이 지났다고 승인이 난 것이 아니다. 기축 전환의 유일한 근거.';
comment on column apt_permits.construct_start_actual is
  '실제 착공일(stcnsDay/realStcnsDay). 수명 규칙의 기산점을 예정 대신 실제로 쓸 수 있게 한다.';

create or replace function safe_date_yyyymmdd(t text) returns date
language plpgsql immutable as $$
begin
  if t is null or t !~ '^\d{8}$' then return null; end if;
  return to_date(t, 'YYYYMMDD');
exception when others then
  return null;   -- 19990431 같은 «없는 날짜» — 지어내지 않는다
end $$;

comment on function safe_date_yyyymmdd(text) is
  'YYYYMMDD → date. 없는 날짜(19990431 실측)는 null. 관대한 변환이 날짜를 지어내는 것을 막는다.';

-- raw 에 이미 들어와 있던 값을 소급(재수집 없이).
-- ⚠️ DDL 과 «같은 트랜잭션에 두지 말 것» — UPDATE 가 실패하면 ALTER 까지 롤백된다(2026-08-30 실제로 겪음).
update apt_permits set
  use_approval_actual = coalesce(
    safe_date_yyyymmdd(nullif(raw->>'useInsptDay','')),
    safe_date_yyyymmdd(nullif(raw->>'useAprDay',''))),
  construct_start_actual = coalesce(
    safe_date_yyyymmdd(nullif(raw->>'stcnsDay','')),
    safe_date_yyyymmdd(nullif(raw->>'realStcnsDay','')));

-- 소급 결과(2026-08-30): 실제 사용승인 0 · 실제 착공 43 · 없는 날짜로 버려진 것 3.
