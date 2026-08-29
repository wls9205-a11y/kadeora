-- PV-5 — 후검증 결과 · 검수 큐 `apt_fact_checks` (2026-08-29)
--
-- ⛔ 판정을 «어디에도 안 남기면» 중단점 B 리뷰가 성립하지 않는다. 그리고 판정이
--    틀렸을 때 되돌릴 근거도 사라진다 — 그래서 claims(출처별 주장 원문)를 통째로 보존한다(D1 관례).
--
-- 제약 셋이 규율을 «구조로» 잠근다:
--   ① verdict 는 D6 5값 — apt_sites.confidence 와 «같은 목록» 이다(어휘 두 벌 금지).
--   ② applied 는 verified 일 때만 true — 그 밖의 등급이 조용히 반영되는 길을 막는다.
--      ⚠️ D4 경계(display_name·name_variants·builder)는 «코드» 가 지킨다(autoApplicable).
--         여기서는 「verified 아닌 것이 적용됐다」는 더 큰 사고만 막는다.
--   ③ conflicting 이면 value 는 반드시 null — 갈린 값을 «고르지 않는다» 를 DB 가 강제한다.
create table if not exists apt_fact_checks (
  id            bigserial primary key,
  site_id       uuid not null references apt_sites(id) on delete cascade,
  field         text not null,
  verdict       text not null,
  value         text,
  independent_sources integer not null default 0,
  note          text,
  claims        jsonb not null default '[]'::jsonb,
  applied       boolean not null default false,
  applied_at    timestamptz,
  checked_at    timestamptz not null default now(),
  constraint apt_fact_checks_verdict_chk
    check (verdict in ('rumor','estimated','confirmed','verified','conflicting')),
  constraint apt_fact_checks_applied_needs_verified_chk
    check (applied = false or verdict = 'verified'),
  constraint apt_fact_checks_conflicting_no_value_chk
    check (verdict <> 'conflicting' or value is null)
);

create unique index if not exists apt_fact_checks_site_field_uidx
  on apt_fact_checks (site_id, field, checked_at);
-- 검수 큐 — 사람이 봐야 하는 것만 빠르게 꺼낸다.
create index if not exists apt_fact_checks_queue_idx
  on apt_fact_checks (verdict, checked_at desc) where verdict = 'conflicting';
create index if not exists apt_fact_checks_site_idx on apt_fact_checks (site_id);

alter table apt_fact_checks enable row level security;
grant all on apt_fact_checks to service_role;

comment on table apt_fact_checks is
  'PV-5 후검증 결과 · 검수 큐. 원문(claims)을 보존한다 - 판정이 틀렸을 때 되돌릴 유일한 근거다. applied=true 는 D4 자동 반영 3필드에 한한다.';
comment on column apt_fact_checks.claims is
  '출처별 주장 원문. kind(disclosure/union/builder/announcement/permit/press) + originKey + url + publishedAt.';

-- ══ 재현 쿼리 ═══════════════════════════════════════════════════════════════
-- 검수 큐(값이 갈린 것):
--   select s.slug, f.field, f.note, f.claims from apt_fact_checks f
--     join apt_sites s on s.id=f.site_id where f.verdict='conflicting' order by f.checked_at desc;
-- 자동 반영된 것(D4 3필드):
--   select s.slug, f.field, f.value, f.independent_sources from apt_fact_checks f
--     join apt_sites s on s.id=f.site_id where f.applied order by f.applied_at desc;
