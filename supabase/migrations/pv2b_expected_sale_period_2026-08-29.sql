-- 분양예정시기 `expected_sale_period` 신설 (2026-08-29 · Node 승인)
--
-- ── 왜 «가변 정밀도» 인가 ───────────────────────────────────────────────────
-- 명단 56곳의 원문 표기가 이미 정밀도가 섞여 있다:
--     "2026년 8월"(월) · "2026년 3분기"(분기) · "2026년 하반기"(반기)
--     "2026년"(연도만 — 금곡2-1 · 문현3 · 해운대중동) · "미정"
-- 반기 같은 «한 가지 버킷» 으로 통일하면 두 방향으로 거짓이 된다:
--   ① 월을 아는 현장의 정보를 «버린다»(경쟁 서비스는 월까지 보여준다)
--   ② 연도만 아는 현장에는 반기를 «지어낸다»
-- ⛔ 후자가 특히 나쁘다 — §7-1 「말한 만큼만 표기」 위반이고, 표시광고에서
--    근거 없는 시기를 말한 것이 된다.
-- 그래서 원문이 말한 정밀도를 «그대로» 담는 한 컬럼으로 간다. 상향 추정 금지.
--
--   '2026'      연도만
--   '2026H2'    반기
--   '2026Q3'    분기
--   '2026-09'   월
--   NULL        미정  ← 「모른다」를 값으로 지어내지 않는다

alter table apt_sites
  add column if not exists expected_sale_period text,
  add column if not exists expected_sale_source text;

alter table apt_sites drop constraint if exists apt_sites_expected_sale_period_chk;
alter table apt_sites add constraint apt_sites_expected_sale_period_chk
  check (expected_sale_period is null
         or expected_sale_period ~ '^[0-9]{4}(H[12]|Q[1-4]|-(0[1-9]|1[0-2]))?$');

-- 어휘를 여기서 고정한다. P4 자동 트리거가 «기계 판독» 하는 입력이라
-- 오타 하나가 룰을 통째로 안 걸리게 만든다.
alter table apt_sites drop constraint if exists apt_sites_expected_sale_source_chk;
alter table apt_sites add constraint apt_sites_expected_sale_source_chk
  check (expected_sale_source is null
         or expected_sale_source in ('permit','news','builder','announcement','admin'));

-- ⚠️ 지시서에 «없던» 가드 하나를 넣었다 — 시기가 있으면 출처도 있어야 한다.
--    출처 없는 시기는 어디서 왔는지 아무도 모르는 값이 되고, 그건 이 컬럼이
--    막으려는 바로 그것이다(apt_name_alias_manual.evidence 와 같은 원칙).
--    ⛔ 걸림돌이면 이 제약만 떼면 된다 — 컬럼·형식은 그대로다.
alter table apt_sites drop constraint if exists apt_sites_expected_sale_needs_source_chk;
alter table apt_sites add constraint apt_sites_expected_sale_needs_source_chk
  check (expected_sale_period is null or expected_sale_source is not null);

-- ── 정렬 키 ────────────────────────────────────────────────────────────────
-- 형식이 4가지라 문자열 정렬이 «틀린다»('2026-09' < '2026H2' < '2026Q3' 순서가 나온다).
-- 버킷의 «시작 월» 로 내린다. 생성 컬럼이라 값과 정렬이 어긋날 수 없다 —
-- 애플리케이션이 따로 계산하면 언젠가 둘이 갈린다.
-- ⚠️ 시작 월이다. '2026' 과 '2026H1' 과 '2026Q1' 은 정렬상 같은 자리(2026-01)에 선다.
--    그건 «정보가 그만큼밖에 없다» 는 뜻이고, 순서를 지어내지 않는 쪽이 맞다.
alter table apt_sites
  add column if not exists expected_sale_sort date
  generated always as (
    case
      when expected_sale_period is null then null
      when expected_sale_period ~ '^[0-9]{4}$'
        then make_date(substr(expected_sale_period, 1, 4)::int, 1, 1)
      when expected_sale_period ~ '^[0-9]{4}H[12]$'
        then make_date(substr(expected_sale_period, 1, 4)::int,
                       case substr(expected_sale_period, 6, 1) when '1' then 1 else 7 end, 1)
      when expected_sale_period ~ '^[0-9]{4}Q[1-4]$'
        then make_date(substr(expected_sale_period, 1, 4)::int,
                       (substr(expected_sale_period, 6, 1)::int - 1) * 3 + 1, 1)
      when expected_sale_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
        then make_date(substr(expected_sale_period, 1, 4)::int,
                       substr(expected_sale_period, 6, 2)::int, 1)
      -- ⚠️ 마지막을 «else make_date(...)» 로 두면 안 된다. 생성 컬럼은 CHECK «보다 먼저»
      --    평가되므로 '2026-13' 같은 값이 check_violation 이 아니라 date out of range
      --    로 터진다(실측). 형식 판정은 CHECK 이 하고, 여기서는 모르는 모양이면 NULL 이다.
      else null
    end
  ) stored;

create index if not exists apt_sites_expected_sale_sort_idx
  on apt_sites (expected_sale_sort)
  where expected_sale_period is not null;

comment on column apt_sites.expected_sale_period is
  '분양예정시기. 원문이 말한 정밀도 그대로 — YYYY / YYYYH1 / YYYYQ3 / YYYY-MM, NULL=미정. ⛔ 상향 추정 금지(§7-1).';
comment on column apt_sites.expected_sale_source is
  '시기의 출처: permit(인허가 stcnsSchedDay 월 절사) · news · builder · announcement · admin. 근거·기준일은 confidence_note 에.';
comment on column apt_sites.expected_sale_sort is
  '정렬 전용 파생값(버킷 시작 월). 표시에 쓰지 말 것 — 없는 정밀도를 보여주게 된다.';
