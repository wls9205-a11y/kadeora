-- EX-A2 ① — 제도 상수 블록 (판정회신_EX-A2_20260915 §1)
--
-- 전국 공통 «제도» 수치만: 청약 순위·가점, LTV·DSR, 전매·재당첨 틀, 취득세율, 중도금 대출 보증.
-- ⛔ 계약금·중도금·잔금 비율은 넣지 않는다 — 현장별 계약 조건(모집공고마다 다름)이지 제도 상수가 아니다.
-- 행 = 항목·값·조건·출처(법령/고시/발표)·출처일·확인일. 글 주입은 확인일(verified_at) 180일 이내 행만(issue-draft loadPolicyConstants).
-- 수치 게이트는 불변 — 이 블록은 허용 목록의 소스 하나가 늘어나는 것뿐이다.

create table if not exists public.policy_constants (
  key          text primary key,
  item         text not null,
  value_text   text not null,
  numbers      text[] not null default '{}',
  condition    text,
  source_title text not null,
  source_url   text not null,
  source_date  date,
  effective_from date,
  verified_at  date not null,
  status       text not null check (status in ('confirmed', 'unverified_current')),
  note         text,
  updated_at   timestamptz not null default now()
);
alter table public.policy_constants enable row level security;
comment on table public.policy_constants is 'EX-A2 제도 상수(전국 공통). 현장 계약 조건 금지. verified_at 180일 초과 행은 글 주입 제외';
