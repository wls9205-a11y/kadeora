-- U-3층 ⑤ — 검색광고 키워드 «일별 비용» (2026-08-29)
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- v_lead_keyword_performance 는 키워드→리드를 «세기만» 한다. 지출이 없으니
-- 리드 단가(= 지출 ÷ 리드)의 «분자» 가 통째로 비어 있었다. 이 표가 그 분자다.
--
-- 조인 축 — 문자열이 아니라 «ID» 다:
--   ad_stats_daily.keyword_id = ad_keywords.keyword_id = leads.utm->>'n_keyword_id'
-- ⛔ 키워드 «문자열» 로 붙이지 않는다. 동명 키워드가 캠페인마다 다른 값을 갖는다(U3 §6).
--
-- ⚠️ 적용 경로 주의: apply_migration 이 「Failed to initialise history table」로
--    3회 연속 끊겨(DB 는 정상 — 읽기 즉답) execute_sql 로 적용했다.
--    그래서 «이 파일이 정본 기록» 이다. 재현 시 그대로 실행하면 된다.
create table if not exists ad_stats_daily (
  keyword_id text not null,
  stat_date  date not null,
  imp_cnt    integer not null default 0,
  clk_cnt    integer not null default 0,
  -- 원 단위 지출. ⚠️ VAT 제외가 네이버 StatReport 의 기본값이다(실호출 확인).
  sales_amt  integer not null default 0,
  ctr        numeric,
  cpc        numeric,
  avg_rnk    numeric,
  -- 원문 보존(D1 관례). 정규화가 틀렸을 때 되돌릴 유일한 근거다.
  raw        jsonb,
  fetched_at timestamptz not null default now(),
  primary key (keyword_id, stat_date),
  -- 음수 지표는 «수집이 틀린 것» 이다. 조용히 들어와 평균을 갉지 않게 막는다.
  constraint ad_stats_daily_nonneg_chk check (imp_cnt >= 0 and clk_cnt >= 0 and sales_amt >= 0),
  -- 노출보다 클릭이 많을 수 없다. 파싱이 두 필드를 뒤바꾸면 여기서 걸린다.
  constraint ad_stats_daily_clk_le_imp_chk check (clk_cnt <= imp_cnt)
);

create index if not exists ad_stats_daily_date_idx on ad_stats_daily (stat_date desc);
-- 대부분의 행은 노출만 있고 지출이 0 이다. 집계는 지출 있는 것만 훑는다.
create index if not exists ad_stats_daily_spend_idx on ad_stats_daily (keyword_id) where sales_amt > 0;

alter table ad_stats_daily enable row level security;
grant all on ad_stats_daily to service_role;

comment on table ad_stats_daily is
  'U-3층 검색광고 키워드 일별 실적(읽기 전용 수집). 리드 단가의 분자. 조인 축은 keyword_id = leads.utm->>n_keyword_id.';
comment on column ad_stats_daily.sales_amt is '원 단위 지출(VAT 제외 - 네이버 StatReport 기본값).';

-- 스모크(2026-08-29, 예외 롤백으로 행 0 복귀): 음수차단 · 클릭>노출차단 · 멱등 upsert ·
--   리드조인(아크로라로체 keyword_id ↔ leads.utm) · 광고키워드조인 — 5항 통과.
