-- D-2 — 분양예정시기의 «기준일» (2026-08-30 · Node 승인)
--
-- ── 왜 컬럼인가 (재사용을 먼저 재고 나서) ─────────────────────────────────
-- 지시는 「신설보다 재사용 우선 — verify-facts 의 as-of 를 노출하는 것이 1안」이었다.
-- 실측 결과 그 길은 «지금 닿지 않는다»:
--   ① apt_fact_checks 가 검증하는 필드는 셋뿐이다 — display_name · total_units · builder.
--      expected_sale_period 행은 «0건» 이고, 없는 행의 checked_at 은 기준일이 될 수 없다.
--   ② 상세 화면의 쿼리 예산은 2폭 파도로 고정돼 있다(Rule #49). 조인을 새로 붙이면
--      그 규율을 깨면서까지 «오늘 0건인 표» 를 읽게 된다.
--   ③ 진짜 기준일은 이미 있다 — 다만 confidence_note 안에 «산문» 으로만 있다:
--        그랑라크   「뉴시스·서울경제 2026-08-10」
--        문수로     「헤럴드경제 2026-08-24」
--      ⛔ 문장에서 날짜를 파싱해 표시광고 근거로 삼지 않는다. 형식이 보장되지 않는다.
--
-- ⚠️ 그래서 컬럼을 만들되 «기준일의 집은 하나» 로 둔다.
--    나중에 verify-facts 가 이 필드를 검증하게 되면, 그 결과도 «이 컬럼에» 쓴다.
--    두 곳에 적으면 한쪽만 늘어난다 — 오늘 STATUS 에 적은 그 공리 그대로다.

alter table apt_sites
  add column if not exists expected_sale_period_asof date;

comment on column apt_sites.expected_sale_period_asof is
  '분양예정시기의 기준일 — «출처가 말한 날»(보도일·공고일)이지 우리가 적재한 날이 아니다. '
  '§7-1 4요소(한정어·출처·기준일·confidence) 중 셋째. verify-facts 가 이 필드를 '
  '검증하게 되면 그 as-of 도 여기에 쓴다(기준일의 집은 하나).';

-- 시기가 없는데 기준일만 있는 행은 «무엇의» 기준일인지 말하지 못한다.
alter table apt_sites drop constraint if exists apt_sites_sale_asof_needs_period_chk;
alter table apt_sites add constraint apt_sites_sale_asof_needs_period_chk
  check (expected_sale_period_asof is null or expected_sale_period is not null);

-- ⛔ 역방향(시기가 있으면 기준일 필수)은 «걸지 않았다».
--    인허가 승격 경로(permitToExpectedSalePeriod)가 아직 기준일을 실어 보내지 않는다 —
--    지금 제약을 걸면 그 크론이 조용히 실패한다(크론은 항상 200 이라 더 안 보인다).
--    대신 «화면» 이 4요소를 강제한다: 기준일이 없으면 시기를 표시하지 않는다.

-- 백필 2건 — 근거는 각 행의 confidence_note 가 인용한 보도일이다. 지어낸 값이 아니다.
update apt_sites set expected_sale_period_asof = date '2026-08-10'
 where slug = '그랑라크-에일린의-뜰' and expected_sale_period is not null;
update apt_sites set expected_sale_period_asof = date '2026-08-24'
 where slug = '문수로-비스타-더파크' and expected_sale_period is not null;
