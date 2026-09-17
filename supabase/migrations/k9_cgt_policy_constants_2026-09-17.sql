-- K-9 cgt — 양도소득세 클러스터 6종 정책 상수 35행 (적용: MCP apply_migration k9_cgt_policy_constants_2026_09_17)
-- 원문: 국가법령정보센터 DRF eflaw «현행 시행본» XML 직접 대조(2026-09-17)
--   소득세법 MST 280405(시행 2026-07-01) · 소득세법 시행령 MST 286211(2026-07-01) · 지방세법 MST 282559(2026-07-01)
--   조세특례제한법 MST 280409(2026-07-01, §91조의26 은 9-18 시행 284389 와 동일) · 조특법 시행령 MST 287181(§93조의12)
--   시행예정판(2027-01-01·2027-09-09·2028-01-01)과 해당 조문 비교 — 수치 변동 없음.
-- 파서 규칙: numbers 첫 원소가 「N%」면 pct, 「N억원·N만원·N원」이면 amt. 한 행 한 수.
--   «기간·날짜» 행(cgt_exempt_hold_years 등)은 첫 원소가 파서 밖이라 pct/amt 에 들어가지 않는다 — 근거(meta) 전용, 계산은 코드 상수(k9/cgt.ts CGT_LAW).
-- 접두 `cgt_` — 기존 접두(acq_ deposit_ designation_ dsr_ farm_ … multi_ int_ …)와 LIKE 충돌 없음(사전 0행 실측). LIKE 는 ESCAPE 로.
-- 취득세는 기존 acq_tax_* 5행(confirmed)을 재사용 — 이 파일은 건드리지 않는다.
-- effective_from: 원문 부칙으로 최초 적용일을 대조한 행만 채운다(중과 재적용 2026-05-10 · RIA 2026-01-01). 나머지는 NULL(미대조) — 없음≠현행 아님.
INSERT INTO policy_constants (key,item,value_text,numbers,condition,source_title,source_url,source_date,effective_from,verified_at,status,note) VALUES
('cgt_house_exempt_cap','1세대1주택 비과세 — 고가주택 기준','12억원 이하 비과세, 초과분은 (양도가−12억)/양도가 비율로 과세',ARRAY['12억원'],'양도 당시 실지거래가액 합계. 12억 «초과» 가 고가주택','소득세법 제89조제1항제3호 · 시행령 제160조제1항','https://www.law.go.kr/법령/소득세법/제89조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_exempt_hold_years','1세대1주택 비과세 — 보유기간','2년 이상',ARRAY['2년'],'근거 행(파서 밖). 코드 CGT_LAW.exemptHoldYears','소득세법 시행령 제154조제1항','https://www.law.go.kr/법령/소득세법시행령/제154조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_exempt_live_years','1세대1주택 비과세 — 거주기간(취득 당시 조정대상지역)','보유기간 중 거주 2년 이상',ARRAY['2년'],'«취득 당시» 조정대상지역 주택만. 근거 행(파서 밖)','소득세법 시행령 제154조제1항','https://www.law.go.kr/법령/소득세법시행령/제154조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_temp2_window','일시적 2주택 — 종전 주택 양도 기한','신규 주택 취득일부터 3년 이내(종전 취득 후 1년 이상 지나 신규 취득)',ARRAY['3년','1년'],'근거 행(파서 밖). 상속·동거봉양·혼인 특례(§155②~)는 별도','소득세법 시행령 제155조제1항','https://www.law.go.kr/법령/소득세법시행령/제155조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t1_base','장기보유특별공제 표 1 — 보유 3년 공제율','3년 이상 4년 미만 6%',ARRAY['6%'],'토지·건물(미등기·§104⑦ 중과 대상 제외)','소득세법 제95조제2항 표 1','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t1_step','장기보유특별공제 표 1 — 연 가산','1년마다 2%p',ARRAY['2%'],'표 1','소득세법 제95조제2항 표 1','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t1_max','장기보유특별공제 표 1 — 상한','15년 이상 30%',ARRAY['30%'],'표 1','소득세법 제95조제2항 표 1','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t2_base','장기보유특별공제 표 2(1세대1주택) — 보유·거주 3년 공제율','보유 3년 12% · 거주 3년 12%',ARRAY['12%'],'1세대1주택 + 보유기간 중 거주 2년 이상(시행령 §159의4). 미달이면 표 1','소득세법 제95조제2항 표 2 · 시행령 제159조의4','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t2_step','장기보유특별공제 표 2 — 연 가산','보유·거주 각 1년마다 4%p',ARRAY['4%'],'표 2','소득세법 제95조제2항 표 2','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t2_max','장기보유특별공제 표 2 — 보유·거주 각 상한','10년 이상 각 40% (합계 80%)',ARRAY['40%'],'표 2','소득세법 제95조제2항 표 2','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ltd_t2_live2','장기보유특별공제 표 2 — 거주 2년 이상 3년 미만','8% (보유기간 3년 이상에 한정)',ARRAY['8%'],'표 2 거주기간 첫 칸','소득세법 제95조제2항 표 2','https://www.law.go.kr/법령/소득세법/제95조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_basic_deduction','양도소득 기본공제','소득군별 연 250만원',ARRAY['250만원'],'①1 부동산·권리·기타(미등기 제외) / ①2 주식등(국내 대주주·비상장·해외주식 합산 1회) / ①3 파생 / ①4 신탁','소득세법 제103조제1항','https://www.law.go.kr/법령/소득세법/제103조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_short_house_1y','단기양도세율 — 1년 미만(주택·조합원입주권·분양권)','70%',ARRAY['70%'],'보유 1년 미만. 토지·건물 일반은 50%','소득세법 제104조제1항제3호','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_short_house_2y','단기양도세율 — 1년 이상 2년 미만(주택·조합원입주권·분양권)','60%',ARRAY['60%'],'토지·건물 일반은 40%','소득세법 제104조제1항제2호','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_presale_rate','분양권 세율 — 보유기간 무관 최저','60%',ARRAY['60%'],'§104①1 괄호. 1년 미만은 70%(①3), 둘 이상 해당하면 큰 세액(①후단)','소득세법 제104조제1항제1호','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_heavy_2house','다주택 중과 가산 — 조정대상지역 1세대 2주택','기본세율 + 20%p, 장기보유특별공제 배제',ARRAY['20%'],'«양도 당시» 조정대상지역. 시행령 §167의10 제외 주택 아님. 보유 2년 미만이면 단기세율과 비교해 큰 세액. 2026-05-10 이후 양도분(경과: 토지거래허가 5-09까지 신청분 최장 2026-11-09)','소득세법 제104조제7항제1호 · 시행령 제167조의10제1항제12호의2','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01','2026-05-10','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조. 재유예 «입법예고» 여부는 DRF 로 닫지 못함(공포·시행 개정 없음)'),
('cgt_heavy_3house','다주택 중과 가산 — 조정대상지역 1세대 3주택 이상','기본세율 + 30%p, 장기보유특별공제 배제',ARRAY['30%'],'«양도 당시» 조정대상지역. 시행령 §167의3 제외 주택 아님. 경과규정 동일','소득세법 제104조제7항제3호 · 시행령 제167조의3제1항제12호의2','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01','2026-05-10','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_heavy_grace_end','다주택 중과 유예 종료일','2026-05-09 양도분까지 유예 — 종료',ARRAY['2026년 5월 9일'],'근거 행(파서 밖). 토지거래허가 대상: 5-09까지 신청·허가·계약금 + 계약일부터 4개월(표 지역 6개월), 5-10 이후 계약이면 9-09(표 지역 11-09)까지. 비대상: 5-09까지 계약 + 4개월(6개월)','소득세법 시행령 제167조의10제1항제12호의2','https://www.law.go.kr/법령/소득세법시행령/제167조의10','2026-07-01','2026-05-10','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_local_ratio','양도소득 개인지방소득세 — 소득세 대비 구조','표준세율이 소득세 세율의 1/10(단기 70/60→7/6%, 중과 +2/+3%p, 분양권 6%, 대주주 2%·600만+2.5%, 해외주식 2%)',ARRAY['10%'],'지방자치단체 조례로 표준세율의 ±50% 가감 가능(④)','지방세법 제103조의3제1항·제10항','https://www.law.go.kr/법령/지방세법/제103조의3','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조 — 대주주 표(①11가2) 텍스트 확인'),
('cgt_major_rate_low','대주주 주식 양도세율 — 과세표준 3억원 이하','20%',ARRAY['20%'],'1년 미만 비중소기업은 cgt_major_short','소득세법 제104조제1항제11호가목2)','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_rate_high','대주주 주식 양도세율 — 과세표준 3억원 초과분','6천만원 + 3억원 초과액 × 25%',ARRAY['25%'],'구간 기준은 양도차익이 아니라 «과세표준»','소득세법 제104조제1항제11호가목2)','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_bracket','대주주 주식 양도세율 — 구간 경계','과세표준 3억원',ARRAY['3억원'],'','소득세법 제104조제1항제11호가목2)','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_short','대주주 단기 세율','1년 미만 보유 + 중소기업 외 법인 주식 30%',ARRAY['30%'],'중소기업 주식이면 1년 미만이어도 20/25%','소득세법 제104조제1항제11호가목1)','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_threshold_kospi','상장 대주주 판정 — 유가증권시장 지분율','1% 이상',ARRAY['1%'],'직전 사업연도 종료일 현재, 특수관계인 합산 단서','소득세법 시행령 제157조제1항제1호','https://www.law.go.kr/법령/소득세법시행령/제157조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_threshold_kosdaq','상장 대주주 판정 — 코스닥 지분율','2% 이상',ARRAY['2%'],'직전 사업연도 종료일 현재','소득세법 시행령 제157조제2항제1호','https://www.law.go.kr/법령/소득세법시행령/제157조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_threshold_konex','상장 대주주 판정 — 코넥스 지분율','4% 이상',ARRAY['4%'],'직전 사업연도 종료일 현재','소득세법 시행령 제157조제2항제2호','https://www.law.go.kr/법령/소득세법시행령/제157조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_threshold_cap','상장 대주주 판정 — 시가총액','50억원 이상(전 시장 공통)',ARRAY['50억원'],'직전 사업연도 종료일 최종시세가액(§157④1)','소득세법 시행령 제157조제1항제2호·제2항','https://www.law.go.kr/법령/소득세법시행령/제157조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_unlisted_pct','비상장 대주주 판정 — 지분율','4% 이상',ARRAY['4%'],'주주 1인 및 기타주주 합계','소득세법 시행령 제167조의8제1항제2호가목','https://www.law.go.kr/법령/소득세법시행령/제167조의8','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_major_unlisted_cap','비상장 대주주 판정 — 시가총액','10억원 이상(벤처기업 40억원)',ARRAY['10억원','40억원'],'','소득세법 시행령 제167조의8제1항제2호나목','https://www.law.go.kr/법령/소득세법시행령/제167조의8','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_foreign_rate','해외주식(§94①3다) 양도세율 — 그 밖의 주식등','20%',ARRAY['20%'],'지방소득세 1천분의 20 별도(지방세법 §103의3①12나)','소득세법 제104조제1항제12호나목','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_foreign_sme_rate','해외주식(§94①3다) 양도세율 — 중소기업 주식등','10%',ARRAY['10%'],'외국법인에 «중소기업» 정의가 적용되는지 미대조 — 계산기는 쓰지 않음','소득세법 제104조제1항제12호가목','https://www.law.go.kr/법령/소득세법/제104조','2026-07-01',NULL,'2026-09-17','confirmed','K-9 cgt. 세율 자체는 DRF 대조. 적용 범위 미대조'),
('cgt_ria_w1','RIA 국외상장주식 양도소득 공제율 — 2026-01-01~05-31 양도','100% × 조정비율',ARRAY['100%'],'2025-12-23 이전 보유분을 국내시장복귀계좌로 양도. 기본공제 후 금액 범위(조특령 §93의12②)','조세특례제한법 제91조의26제2항제1호가목','https://www.law.go.kr/법령/조세특례제한법/제91조의26','2026-07-01','2026-01-01','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ria_w2','RIA 국외상장주식 양도소득 공제율 — 2026-06-01~07-31 양도','80% × 조정비율',ARRAY['80%'],'동상','조세특례제한법 제91조의26제2항제1호나목','https://www.law.go.kr/법령/조세특례제한법/제91조의26','2026-07-01','2026-01-01','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ria_w3','RIA 국외상장주식 양도소득 공제율 — 2026-08-01~12-31 양도','50% × 조정비율',ARRAY['50%'],'동상. 조정비율 = 1 − (A−B)/C, 0~1 (조특령 §93의12④)','조세특례제한법 제91조의26제2항제1호다목','https://www.law.go.kr/법령/조세특례제한법/제91조의26','2026-07-01','2026-01-01','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조'),
('cgt_ria_limit','국내시장복귀계좌 납입한도','전 금융회사 합계 5,000만원',ARRAY['5,000만원'],'납입일부터 1년 안 인출 시 공제세액 추징(④)','조세특례제한법 제91조의26제3항제1호','https://www.law.go.kr/법령/조세특례제한법/제91조의26','2026-07-01','2026-01-01','2026-09-17','confirmed','K-9 cgt. DRF eflaw 현행 대조');

-- 말미 단언: 35행 존재 + 접두 패턴이 이 35행 외 0행
DO $$
DECLARE c int; t int;
BEGIN
  SELECT count(*) INTO c FROM policy_constants WHERE key LIKE 'cgt\_%' ESCAPE '\';
  SELECT count(*) INTO t FROM policy_constants WHERE key IN (
    'cgt_house_exempt_cap','cgt_exempt_hold_years','cgt_exempt_live_years','cgt_temp2_window',
    'cgt_ltd_t1_base','cgt_ltd_t1_step','cgt_ltd_t1_max','cgt_ltd_t2_base','cgt_ltd_t2_step','cgt_ltd_t2_max','cgt_ltd_t2_live2',
    'cgt_basic_deduction','cgt_short_house_1y','cgt_short_house_2y','cgt_presale_rate','cgt_heavy_2house','cgt_heavy_3house','cgt_heavy_grace_end',
    'cgt_local_ratio','cgt_major_rate_low','cgt_major_rate_high','cgt_major_bracket','cgt_major_short',
    'cgt_major_threshold_kospi','cgt_major_threshold_kosdaq','cgt_major_threshold_konex','cgt_major_threshold_cap','cgt_major_unlisted_pct','cgt_major_unlisted_cap',
    'cgt_foreign_rate','cgt_foreign_sme_rate','cgt_ria_w1','cgt_ria_w2','cgt_ria_w3','cgt_ria_limit');
  IF c <> 35 OR t <> 35 THEN
    RAISE EXCEPTION 'k9 cgt 단언 실패: prefix=% keys=% (기대 35/35)', c, t;
  END IF;
END $$;
