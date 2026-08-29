-- PV-2b — 수집 작업 대장 `apt_permit_cursor` (2026-08-29 · 안건 ①·⑥·⑦)
--
-- ── 왜 이 표가 필요한가 ─────────────────────────────────────────────────────
-- bjdongCd 가 «필수» 로 판명되면서 1회 전수가 2,834동 × 2트랙 = 5,668 호출이 됐다.
-- 초당 제한 350ms + 응답 지연으로 실측 ≈ 99분인데 라우트 maxDuration 은 300초다.
-- 한 번의 호출로 전수는 «물리적으로 불가능» 하다 → 여러 번에 나눠 돌고, 어디까지
-- 갔는지를 이 표가 기억한다.
--
-- ⛔ 단일 포인터(「몇 번째까지 했다」)를 쓰지 «않는다». 법정동 표는 오늘 하루에만
--    43코드 → 2,834동으로 바뀌었다. 표가 흔들리면 인덱스형 포인터는 아무 경고 없이
--    «다른 곳» 을 가리키고, 건너뛴 구간은 영영 안 돌아온다.
--
-- ── 이 표가 «구분해서» 남기는 것 ────────────────────────────────────────────
-- ⚠️ 「0건이었다」와 「못 물어봤다」는 다른 사실이다.
--    2026-08-29 1차 수집의 커버율 표에서 그 둘이 한 칸(0건 법정동 749)에 섞였고,
--    그래서 울산 남구 «달동» 이 진짜 0건인지 EMPTY_BODY 구멍인지 판정할 수 없었다.
--    하필 아실 결측 명단 2건(달동더리브·대상웰라움달동)이 거기 걸려 있다.
--    last_status 가 그 둘을 가른다: 'empty' 는 물어봤고 없었다, 'error' 는 못 물어봤다.

create table if not exists apt_permit_cursor (
  -- (트랙, 시군구, 법정동)이 «작업 한 단위» 다.
  track      text not null,
  sigungu    text not null,           -- 시군구 5자리
  bjdong     text not null,           -- 법정동 5자리
  primary key (track, sigungu, bjdong),

  last_run_at     timestamptz,
  last_status     text,               -- ok | empty | error
  last_error_code text,               -- error 일 때만. EMPTY_BODY · HTTP_503 · 23 …
  items           integer not null default 0,
  candidates      integer not null default 0,

  -- 안건 ⑦ — house 0건 동의 90일 캐시. «영구 스킵이 아니다».
  --   house 는 0건 법정동이 1,171 중 749(64%)라 다음 주기 비용이 그만큼 준다.
  --   arch 는 0건이 20 뿐이라 적용하지 «않는다» — 아끼는 것 없이 누락 위험만 진다.
  skip_until  timestamptz,

  -- 안건 ⑥ — 못 물어본 곳의 재조회 예약. 1h → 2h → 4h … 24h.
  --   ⛔ 30(키 미등록)·22(일 한도)는 예약하지 않는다: 같은 답이 오고 한도만 더 탄다.
  retry_after timestamptz,
  attempts    integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 어휘를 여기서 고정한다. 오타 하나가 큐를 통째로 비게 만드는 것을 막는다.
  constraint apt_permit_cursor_track_chk  check (track in ('house','arch')),
  constraint apt_permit_cursor_status_chk check (last_status is null or last_status in ('ok','empty','error')),
  -- error 가 아닌데 에러 코드가 남아 있으면 「성공했는데 실패로 보이는」 행이 된다.
  constraint apt_permit_cursor_errcode_chk check (last_status = 'error' or last_error_code is null)
);

-- 회전 큐 — 「못 물어본 곳」이 먼저, 그다음 오래된 순.
create index if not exists apt_permit_cursor_retry_idx
  on apt_permit_cursor (retry_after)
  where retry_after is not null;

create index if not exists apt_permit_cursor_rotate_idx
  on apt_permit_cursor (last_run_at nulls first);

-- 커버율 집계(PV-4 갭워치)의 축.
create index if not exists apt_permit_cursor_region_idx
  on apt_permit_cursor (sigungu, last_status);

create trigger apt_permit_cursor_set_updated_at
  before update on apt_permit_cursor
  for each row execute function set_updated_at();

-- ⚠️ 운영 대장이다. 화면·공개 API 가 읽을 일이 없다.
alter table apt_permit_cursor enable row level security;
grant all on apt_permit_cursor to service_role;

comment on table apt_permit_cursor is
  'PV-2b 수집 작업 대장. (트랙,시군구,법정동) 단위 회전 커서. last_status 가 «0건» 과 «못 물어봤다» 를 가른다.';
comment on column apt_permit_cursor.skip_until is
  '안건 ⑦ — house 0건 동 90일 캐시. 영구 스킵 금지 · arch 미적용.';
comment on column apt_permit_cursor.retry_after is
  '안건 ⑥ — 못 물어본 곳(EMPTY_BODY·503)의 재조회 예약. 0건 캐시보다 «우선» 한다.';
