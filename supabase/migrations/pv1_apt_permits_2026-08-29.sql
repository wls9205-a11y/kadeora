-- PV-1 — 인허가 스테이징 `apt_permits` (2026-08-29)
--
-- ── 왜 «스테이징» 인가 ──────────────────────────────────────────────────────
-- D1: 현장의 단일 진실은 apt_sites 다. 이 표는 «진실이 아니라 원자재» 다.
--   외부 인허가 API 응답을 손대지 않고 받아 두는 곳이고, 화면은 이 표를 읽지 않는다.
--   매칭·승격은 PV-3 이 한다 — 수집과 반영을 한 트랜잭션에 섞으면, 잘못 붙은 것을
--   되돌릴 때 «무엇이 원문이었는지» 가 사라진다.
--
-- ⚠️ R-4: 이 표에 손으로 행을 넣지 «않는다». 4월 upcoming_projects · 8월 seed:web
--    두 번의 부패가 전부 수동 시드에서 나왔다. 수집기가 넣은 것만 있어야
--    「API 커버가 반쪽인지」 를 이 표로 판정할 수 있다.
-- ⚠️ `raw` 는 지우지 않는다. 정규화 컬럼이 틀렸을 때 되돌릴 유일한 근거다.
--
-- ── 아직 «비어 있는» 것 ─────────────────────────────────────────────────────
-- 어느 API 를 쓸지는 PV-2 에서 확정된다(건축HUB 활용신청 대기 중). 그래서
-- 정규화 컬럼은 «있으면 채우고 없으면 null» 로 둔다. null 을 0 이나 '' 로
-- 채우지 않는다 — 결측과 0 을 섞으면 커버율 실측이 그 순간 거짓말이 된다.

create table if not exists apt_permits (
  id            bigserial primary key,

  -- ── 출처 ────────────────────────────────────────────────────────────────
  -- (source, source_key) 가 «같은 인허가건» 의 정의다. 재수집이 중복을 만들지 않도록.
  source        text not null,          -- 'archhub' | 'molit_permit' | 'gosi' …
  source_key    text not null,          -- API 고유키(민원접수번호 등)
  source_url    text,
  raw           jsonb not null,         -- 원문 그대로
  fetched_at    timestamptz not null default now(),

  -- ── 지역 ────────────────────────────────────────────────────────────────
  -- lawd_cd 는 «요청한 코드» 가 아니라 «응답에 실린 코드» 를 넣는다.
  -- 둘이 다르면 그건 매칭이 아니라 수집이 틀린 것이다(D5-4).
  sido          text,
  sigungu       text,
  dong          text,
  lawd_cd       text,                   -- 시군구 5자리
  bjd_cd        text,                   -- 법정동 10자리
  address       text,
  road_address  text,

  -- ── 사업 ────────────────────────────────────────────────────────────────
  -- project_name 은 «사업명» 이다. 브랜드명이 아니다 —
  -- 「명륜2구역 주택재개발」 같은 값이 들어오고, 브랜드는 PV-3·후검증이 붙인다.
  project_name  text,
  builder       text,
  developer     text,
  total_units   integer,
  building_count integer,
  main_purpose  text,                   -- 주용도(공동주택 여부 판별용)

  -- ── 단계 ────────────────────────────────────────────────────────────────
  permit_kind   text,                   -- 사업계획승인 | 건축허가 | 착공신고 | 사용검사
  permit_date   date,
  construct_start_expected date,        -- 착공예정 — 수명 규칙(+180일 강등)의 기준
  use_approval_expected    date,

  -- ── 매칭 상태 (PV-3 이 쓴다. PV-1 은 자리만 만든다) ───────────────────────
  -- ⚠️ 기본값이 'pending' 인 것이 핵심이다. 수집만으로 apt_sites 에 닿는 경로를
  --    만들지 않는다 — 자동 반영 경계(D4)는 PV-3 에서 컬럼 단위로 건다.
  match_status     text not null default 'pending',
  matched_site_id  uuid references apt_sites(id) on delete set null,
  match_method     text,
  match_confidence text,
  match_note       text,
  matched_at       timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- 어휘를 여기서 고정한다. 오타 하나가 큐를 통째로 비게 만드는 것을 막는다.
  constraint apt_permits_match_status_chk
    check (match_status in ('pending','matched','review','rejected','no_target')),
  -- apt_sites.confidence 와 «같은 4단계» 를 쓴다. 두 어휘를 만들지 않는다.
  constraint apt_permits_match_confidence_chk
    check (match_confidence is null
           or match_confidence in ('rumor','estimated','confirmed','verified')),
  -- 붙였다고 표시하려면 대상이 있어야 한다. 상태와 대상이 어긋나는 행을 막는다.
  constraint apt_permits_matched_needs_site_chk
    check (match_status <> 'matched' or matched_site_id is not null)
);

create unique index if not exists apt_permits_source_key_uidx
  on apt_permits (source, source_key);

-- PV-3 의 작업 큐. 「아직 안 붙은 것」을 오래된 순으로 꺼낸다.
create index if not exists apt_permits_pending_idx
  on apt_permits (permit_date desc nulls last)
  where match_status = 'pending';

-- 갭워치(PV-4)가 지역별 커버율을 세는 축.
create index if not exists apt_permits_region_idx on apt_permits (sido, sigungu);
create index if not exists apt_permits_site_idx   on apt_permits (matched_site_id)
  where matched_site_id is not null;

create trigger apt_permits_set_updated_at
  before update on apt_permits
  for each row execute function set_updated_at();

-- ⚠️ 스테이징이다. 화면·공개 API 가 읽을 일이 없으므로 anon·authenticated 에 열지 않는다.
alter table apt_permits enable row level security;
grant all on apt_permits to service_role;
grant usage, select on sequence apt_permits_id_seq to service_role;

comment on table apt_permits is
  'PV 인허가 스테이징. 외부 API 원문 보관 + 정규화. 화면 노출 금지 — 단일 진실은 apt_sites(D1).';
