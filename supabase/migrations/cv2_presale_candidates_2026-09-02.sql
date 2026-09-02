-- CV-2 — 분양예정 후보 스테이징 (2026-09-02)
--
-- ── 왜 «스테이징 표» 인가 ────────────────────────────────────────────────────
-- 오늘 전수조사에서 결측 3갈래 중 ①(수집 결측)의 직접 원인이 나왔다:
-- `builder-site-sync` 는 «인리치 전용» 이라 apt_sites 에 이미 있는 행만 손댄다.
-- 목록에서 읽은 카드가 기존 행에 안 붙으면 «기록 없이 버려진다».
-- 그래서 태영 데시앙 공식 페이지에 김해 외동(1,135)·부암동(831)이 떠 있는데도
-- DB 에는 레코드가 없었다 — 페이지가 없으니 키워드도 없고, 광고에 안 나온다.
--
-- ⛔ 그 카드를 곧장 apt_sites 에 쓰지 않는다. 확신이 없는 것을 본판에 앉히면
--    「대연3 ↔ 디아이엘」류 쌍둥이가 생긴다. «버리지도 않고, 바로 앉히지도 않는» 자리가
--    이 표다. 미해소 후보는 queued 로 «남는다» — 폐기는 rejected 라는 이름으로만 한다.
--
-- ── D2(수동 시드 금지)와의 관계 ─────────────────────────────────────────────
-- 소스 유래 자동 시드는 수동이 아니다. 대신 «어디서 왔는지» 를 못 잃게 한다:
--   presale_candidates.source        'crawl:desian' · 'news:monthly-digest' · 'backfill:pv20260829'
--   apt_sites.stage_source           'crawl:<소스>'  ← 사람이 이름을 옮겨 적은 행과 구분되는 축
-- 사람이 이름을 옮겨 적는 경로는 계속 금지다.

-- ══ ① 후보 스테이징 ═════════════════════════════════════════════════════════
create table if not exists public.presale_candidates (
  id                  bigserial primary key,

  -- 어느 소스가 이 카드를 봤나. 소스 리콜(CV-4 지표 4)의 분해 축이다.
  source              text not null,
  -- ⚠️ 원문 URL 은 «필수» 다. AI 추출이 환각을 섞어도 사람이 원본으로 돌아갈 수 있어야 한다.
  source_url          text not null,

  raw_name            text not null,
  -- ⚠️ apt_sites 의 표현식 인덱스와 «같은 규칙» 이어야 한다:
  --      regexp_replace(lower(slug), '[^가-힣a-z0-9]', '', 'g')
  --    TS 쪽 원본은 `slugDupKey()` 하나뿐이다. 한쪽을 고치면 반드시 다른 쪽도 고칠 것.
  norm_name           text not null,

  region              text,
  sigungu             text,
  addr_raw            text,
  builder_raw         text,
  builder_canonical   text,
  total_units         integer,
  -- 원문 그대로. 「2026년 상반기」·「26.03」 을 date 로 접으면 근거가 사라진다.
  expected_period_raw text,

  -- ── R2. 공급유형 축 ──────────────────────────────────────────────────────
  -- 명지 A5 가 왜 필요한지 보여줬다: 이름 정규식 필터는 공공택지 블록을 통과시키고,
  -- 그대로 광고에 실리면 «전환되지 않는 클릭» 에 돈이 나간다.
  -- ⚠️ 기본값이 '미상' 인 것이 핵심이다. 모르면 광고하지 않는다.
  supply_type         text not null default '미상'
                      check (supply_type in ('민영','공공','임대','미상')),

  matched_site_id     uuid references public.apt_sites(id) on delete set null,
  match_method        text check (match_method in ('name','variants','addr','none')),
  seeded_site_id      uuid references public.apt_sites(id) on delete set null,

  -- matched  기존 현장에 붙었다 (D4 자동 범위만 보강)
  -- seeded   새 pre_announcement 행을 만들었다
  -- queued   기준 미달 — «잔류» 한다. 이 상태로 오래 있는 것이 CV-4 지표 1이다
  -- rejected 사람이 기각했다. 폐기는 이 이름으로만 한다
  resolution          text not null default 'queued'
                      check (resolution in ('matched','seeded','queued','rejected')),
  resolution_note     text,

  reviewed_by         text,
  resolved_at         timestamptz,

  -- ⚠️ first/last 를 «가른다». created_at 하나면 「언제부터 큐에 있었나」와
  --    「소스에 아직 살아 있나」가 같은 숫자로 접힌다. 체류 일수(지표 1)는 first 기준,
  --    소스에서 사라진 카드 판정은 last 기준이다.
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ⚠️ 멱등 키를 (source, norm_name) 으로 «좁게» 잡는다.
--    region·sigungu 를 키에 넣고 싶어질 것이다. 넣지 말 것 — 첫 크롤에서 주소가 비고
--    다음 크롤에서 채워지면 같은 카드가 «두 행» 이 된다. 시공사 목록 한 장 안에서
--    동명이단지는 사실상 없고, 있으면 큐에서 사람이 본다.
create unique index if not exists presale_candidates_source_norm_uk
  on public.presale_candidates (source, norm_name);

-- 큐 화면·다이제스트가 매번 읽는 축.
create index if not exists presale_candidates_open_idx
  on public.presale_candidates (resolution, first_seen_at)
  where resolution = 'queued';
create index if not exists presale_candidates_region_idx
  on public.presale_candidates (region, sigungu);
create index if not exists presale_candidates_norm_idx
  on public.presale_candidates (norm_name);

-- 서버 전용. service_role 만 닿는다(apt_permits·apt_stage_review_queue 와 같은 규약).
alter table public.presale_candidates enable row level security;

comment on table public.presale_candidates is
  'CV-2 분양예정 후보 스테이징. 소스(시공사 공식·공공 API·언론)가 본 카드를 '
  '본판(apt_sites)에 앉히기 «전» 에 받는 자리. 미해소분은 queued 로 잔류한다 — 폐기 금지.';
comment on column public.presale_candidates.supply_type is
  'R2. 민영만 광고 기본 적격. 공공·임대·미상은 페이지는 만들되 광고에 싣지 않는다.';
comment on column public.presale_candidates.norm_name is
  'slugDupKey() 와 «같은» 규칙: regexp_replace(lower(name), ''[^가-힣a-z0-9]'', '''', ''g'')';

-- ══ ② 어댑터 부패 감시 (R1) ═════════════════════════════════════════════════
-- 손파서 20개를 두면 «조용히 썩는 지점» 이 20개다. AI 추출 단일 경로로 가는 대신,
-- 소스별로 「마지막으로 카드를 실제로 본 시각」을 기록한다.
-- ⛔ 0카드를 «성공» 으로 적지 않는다 — 침묵 성공(구조 결함 ③)이 바로 그 형태였다.
--    crawl-apt-subscription 은 키가 없어도 success:true 로 통과했다.
create table if not exists public.presale_source_health (
  source_key      text primary key,
  last_run_at     timestamptz,
  -- ⚠️ ok 는 «카드를 1장 이상 얻은» 실행만이다. 200 응답은 ok 가 아니다.
  last_ok_at      timestamptz,
  last_card_count integer,
  -- 0카드가 연달아 몇 번인가. 2 이상이면 다이제스트에 이상 신호로 올린다.
  zero_streak     integer not null default 0,
  -- PV-5 3분류(no_result·bad_json·call_failed)를 그대로 싣는다. ⚠️ 자격 «값» 은 담지 않는다.
  last_outcome    text,
  last_detail     text,
  updated_at      timestamptz not null default now()
);
alter table public.presale_source_health enable row level security;

comment on table public.presale_source_health is
  'R1 어댑터 부패 감시. 0카드 2회 연속이면 소스가 썩은 것으로 본다. '
  '소스 하나의 실패가 크론 전체를 죽이지 않도록 격리하되, 조용히 넘어가지도 않게 한다.';

-- ══ ③ 광고 적격 차단 플래그 (R2) ════════════════════════════════════════════
-- sa.py 는 apt_sites 를 읽는다. 그래서 공급유형 게이트가 «본판에» 있어야 효력이 있다.
--
-- ⚠️ 기본값을 false 로 둔다 — 「미상은 광고 X」를 기존 행 전체에 소급하면
--    supply_type 이 null 인 현행 3천여 행이 «전부» 광고 부적격이 되어 기존 커버리지가
--    통째로 꺼진다. R2 가 막으려는 것은 «새로 들어오는» 공공 블록이다.
-- ⛔ 기존 행에 대한 공공·임대 소급 스윕은 «별건» 이다. Node `!` 없이 돌리지 말 것.
alter table public.apt_sites
  add column if not exists supply_type text
    check (supply_type is null or supply_type in ('민영','공공','임대','미상')),
  add column if not exists ad_blocked boolean not null default false,
  add column if not exists ad_blocked_reason text;

comment on column public.apt_sites.ad_blocked is
  'R2. true 면 sa-sync 가 키워드를 «등록하지 않는다». 페이지는 그대로 산다. '
  '기본 false — 소급 적용 아님. 새 시드 중 supply_type<>''민영'' 인 건에만 켠다.';

-- 부울경 미등록 잔량(CV-4 지표 2)이 매일 훑는 축.
create index if not exists apt_sites_ad_blocked_idx
  on public.apt_sites (ad_blocked)
  where ad_blocked;
