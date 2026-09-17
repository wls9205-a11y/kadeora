/**
 * K-9 수치층 — 연말정산·공제 8종 (2026-09-17).
 *
 * 원문: law.go.kr eflaw 현행 판(시행일 ≤ 2026-09-17)
 *   · 소득세법 2026-07-01 판(법률 제21221호) — §47 §59 §59의3 §59의4
 *   · 조세특례제한법 2026-07-01 판(법률 제21223호) — §95의2 §126의2
 * ⛔ 율·한도는 policy_constants(`ye_` 접두) 에서만 읽는다. 없으면 「세율 기준 미수신」.
 * ⚠️ §47(근로소득공제)·§59①(근로소득세액공제 산식) «구간표» 는 코드 표다 — 누진세율표(INCOME_TAX_BRACKETS)와 같은
 *    처리(공유 누진표 이관은 별건). 표 옆에 조문·판·대조일을 둔다.
 */
import type { CalcResult } from '../formulas';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../tax-tables';
import { type V, n, fmt, policyReader, missingResult } from './misc-common';

export const EARNED_INCOME_SOURCE = {
  law: '소득세법 §47①(근로소득공제)·§59(근로소득세액공제)',
  url: 'https://www.law.go.kr/법령/소득세법/제47조',
  edition: 'eflaw 현행 2026-07-01 판(법률 제21221호)',
  verifiedAt: '2026-09-17',
} as const;

/**
 * 근로소득공제 — 소득세법 §47① 표(5구간) + 단서 한도 2천만원.
 * ⛔ 옛 코드: `min(급여×70%, 1,500만 + (급여−500만)×15%)` — 조문에 없는 식. 5,000만에서 2,175만(법정 1,225만).
 */
export function earnedIncomeDeduction(salary: number): number {
  const s = Math.max(0, salary);
  let d: number;
  if (s <= 5_000_000) d = s * 0.7;
  else if (s <= 15_000_000) d = 3_500_000 + (s - 5_000_000) * 0.4;
  else if (s <= 45_000_000) d = 7_500_000 + (s - 15_000_000) * 0.15;
  else if (s <= 100_000_000) d = 12_000_000 + (s - 45_000_000) * 0.05;
  else d = 14_750_000 + (s - 100_000_000) * 0.02;
  return Math.round(Math.min(d, 20_000_000));
}

/** 근로소득세액공제 한도 — §59② (총급여 구간별, 하한 있는 체감식). */
export function earnedIncomeCreditCap(salary: number): number {
  if (salary <= 33_000_000) return 740_000;
  if (salary <= 70_000_000) return Math.max(660_000, 740_000 - (salary - 33_000_000) * 8 / 1000);
  if (salary <= 120_000_000) return Math.max(500_000, 660_000 - (salary - 70_000_000) / 2);
  return Math.max(200_000, 500_000 - (salary - 120_000_000) / 2);
}

/** 근로소득세액공제 — §59① 산식(130만 이하 55% / 초과 71.5만+30%) 후 ② 한도. */
export function earnedIncomeTaxCredit(computedTax: number, salary: number): number {
  const t = Math.max(0, computedTax);
  const raw = t <= 1_300_000 ? t * 0.55 : 715_000 + (t - 1_300_000) * 0.3;
  return Math.round(Math.min(raw, earnedIncomeCreditCap(salary)));
}

// ─────────────────────────────────────────────────────────────────────────────
// year-end-refund
// ─────────────────────────────────────────────────────────────────────────────
export function yearEndRefund(v: V): CalcResult {
  const salary = n(v.annualSalary);
  const earnedDed = earnedIncomeDeduction(salary);
  const earnedIncome = Math.max(0, salary - earnedDed);
  const taxBase = Math.max(0, earnedIncome - n(v.incomeDeduction));
  const computed = Math.round(calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS));
  const earnedCredit = earnedIncomeTaxCredit(computed, salary);
  const otherCredit = n(v.taxCredit);
  const determined = Math.max(0, computed - earnedCredit - otherCredit);
  const paid = n(v.alreadyPaid);
  const refund = paid - determined;
  return {
    main: { label: refund >= 0 ? '예상 환급액(소득세)' : '추가 납부액(소득세)', value: fmt(Math.abs(refund)), color: refund >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
    details: [
      { label: '근로소득공제(§47)', value: fmt(earnedDed) },
      { label: '근로소득금액', value: fmt(earnedIncome) },
      { label: '과세표준', value: fmt(taxBase) },
      { label: '산출세액(§55)', value: fmt(computed) },
      { label: '근로소득세액공제(§59)', value: fmt(earnedCredit) },
      { label: '그 밖의 세액공제(입력)', value: fmt(otherCredit) },
      { label: '결정세액', value: fmt(determined) },
      { label: '기납부세액', value: fmt(paid) },
      { label: '미반영', value: '개인지방소득세(별도 정산) · 세액감면 · 공제액의 산출세액 초과분 이월 규정 — 「그 밖의 세액공제」에 표준세액공제(특별공제 미신청 시 연 13만원, §59의4⑨)·자녀·연금·특별세액공제를 직접 합산해 넣어야 한다' },
      { label: '근거', value: `${EARNED_INCOME_SOURCE.law} · ${EARNED_INCOME_SOURCE.edition} · 대조 ${EARNED_INCOME_SOURCE.verifiedAt}` },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// credit-card-deduction — 조특법 §126의2 ②·⑩·⑪
// ─────────────────────────────────────────────────────────────────────────────
export function creditCardDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const salary = n(v.annualSalary);
  const tier = r.amt('ye_card_salary_tier');
  const thr = r.rate('ye_card_threshold');
  const rCredit = r.rate('ye_card_rate_credit');
  const rDebit = r.rate('ye_card_rate_debit');
  const rMarket = r.rate('ye_card_rate_market');
  const rTransit = r.rate('ye_card_rate_transit');
  const rCulture = r.rate('ye_card_rate_culture');
  const low = salary <= tier;
  const kids = Math.min(2, Math.max(0, Math.floor(n(v.childCount))));
  const capKey = kids === 0 ? (low ? 'ye_card_cap_le70m' : 'ye_card_cap_gt70m')
    : `ye_card_cap_child${kids}_${low ? 'le70m' : 'gt70m'}`;
  const cap = r.amt(capKey);
  const extraCap = r.amt(low ? 'ye_card_extra_cap_le70m' : 'ye_card_extra_cap_gt70m');
  if (r.missing.length) return missingResult(r.missing);

  const credit = n(v.credit); const debit = n(v.debit); const market = n(v.traditional);
  const transit = n(v.transit); const culture = n(v.culture);
  // ②5호: 7천만 초과면 문화체육분은 별도 율이 없고 «신용카드사용분» 에 들어간다.
  const C = credit + (low ? 0 : culture);
  const D = debit;
  const Cu = low ? culture : 0;
  const total = credit + debit + market + transit + culture;
  const threshold = Math.round(salary * thr);
  if (total <= threshold) {
    return { main: { label: '소득공제', value: fmt(0) }, details: [{ label: '사유', value: `사용액 합계 ${fmt(total)}가 최저사용금액(총급여의 ${thr * 100}%, ${fmt(threshold)}) 이하` }, ...r.basis()] };
  }
  const marketTransitAmt = market * rMarket + transit * rTransit;
  const gross = marketTransitAmt + Cu * rCulture + D * rDebit + C * rCredit;
  // ②6호 — 최저사용금액은 «신용카드사용분부터» 차감(가·나·다목).
  let sub: number;
  if (threshold <= C) sub = threshold * rCredit;
  else if (threshold <= C + D + Cu) sub = C * rCredit + (threshold - C) * rDebit;
  else sub = C * rCredit + (D + Cu) * rDebit + (threshold - C - D - Cu) * rMarket;
  const base = Math.max(0, Math.round(gross - sub));
  // ⑪ 추가공제 — 한도 초과분과 (전통시장·대중교통[·문화체육] 공제분 합, 연 한도) 중 작은 금액.
  const extraBase = Math.min(Math.round(marketTransitAmt + (low ? Cu * rCulture : 0)), extraCap);
  const within = Math.min(base, cap);
  const extra = Math.min(Math.max(0, base - cap), extraBase);
  const final = within + extra;
  return {
    main: { label: '소득공제 금액', value: fmt(final) },
    details: [
      { label: '최저사용금액(총급여 25%)', value: fmt(threshold) },
      { label: '공제 전 금액(율 적용 − 최저사용금액분)', value: fmt(base) },
      { label: `기본 한도(${low ? '총급여 7천만 이하' : '7천만 초과'}${kids ? ` · 자녀 등 ${kids === 2 ? '2명 이상' : '1명'}` : ''})`, value: fmt(cap) },
      { label: '추가공제(⑪ 전통시장·대중교통 등)', value: fmt(extra) },
      { label: '차감 순서', value: '최저사용금액은 신용카드분(15%) → 직불·현금(30%) → 전통시장·대중교통(40%) 순으로 먼저 채운다(§126의2②6호)' },
      { label: '미반영', value: '도서·공연 등 문화체육분의 세부 인정 요건, 국외 사용분 제외, 부양가족 사용분 합산 요건 — 입력값이 이미 공제 대상 금액이라고 가정한다' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// monthly-rent-deduction — 조특법 §95의2 (숫자는 옛 코드와 같았다 · 근거 법령명이 틀렸다)
// ─────────────────────────────────────────────────────────────────────────────
export function monthlyRentDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const salaryCap = r.amt('ye_rent_salary_cap');
  const salaryLow = r.amt('ye_rent_salary_low');
  const cap = r.amt('ye_rent_cap');
  const rLow = r.rate('ye_rent_rate_low');
  const rHigh = r.rate('ye_rent_rate_high');
  if (r.missing.length) return missingResult(r.missing);
  const salary = n(v.annualSalary); const rent = n(v.annualRent);
  if (salary > salaryCap) {
    return { main: { label: '월세 세액공제', value: fmt(0) }, details: [{ label: '사유', value: `총급여 ${fmt(salaryCap)} 초과 — 공제 대상 아님(조특법 §95의2①)` }, ...r.basis()] };
  }
  const base = Math.min(rent, cap);
  const rate = salary <= salaryLow ? rLow : rHigh;
  return {
    main: { label: '월세 세액공제', value: fmt(Math.round(base * rate)) },
    details: [
      { label: '공제 대상 월세', value: fmt(base) },
      { label: '공제율', value: `${Math.round(rate * 1000) / 10}%` },
      { label: '요건(화면이 묻지 않음)', value: '과세기간 종료일 현재 무주택 세대의 세대주 등 · 대통령령으로 정하는 주택(국민주택규모 또는 기준시가 요건) · 종합소득금액 7천만원 초과자 제외(17% 율은 4,500만원 초과자 제외)' },
      { label: '미반영', value: '배우자 추가공제(§95의2②, 부부 합산 한도) · 공제액이 산출세액을 넘는 부분' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// irp-deduction — 소득세법 §59의3
// ─────────────────────────────────────────────────────────────────────────────
export function irpDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const capSav = r.amt('ye_pension_cap_savings');
  const capTotal = r.amt('ye_pension_cap_total');
  const salaryLow = r.amt('ye_pension_salary_low');
  const rLow = r.rate('ye_pension_rate_low');
  const rHigh = r.rate('ye_pension_rate_high');
  if (r.missing.length) return missingResult(r.missing);
  const salary = n(v.annualSalary);
  const pension = Math.min(n(v.pensionSavings), capSav);
  const irp = Math.max(0, Math.min(n(v.irp), capTotal - pension));
  const total = pension + irp;
  const rate = salary <= salaryLow ? rLow : rHigh;
  const credit = Math.round(total * rate);
  return {
    main: { label: '연금계좌세액공제(소득세)', value: fmt(credit) },
    details: [
      { label: '연금저축(한도 반영)', value: fmt(pension) },
      { label: 'IRP(합산 한도 반영)', value: fmt(irp) },
      { label: '공제율(소득세)', value: `${Math.round(rate * 1000) / 10}%` },
      { label: '공제율 구분', value: `근로소득만 있으면 총급여 ${fmt(salaryLow)} 이하가 높은 율(종합소득이 있으면 종합소득금액 4,500만원 기준)` },
      { label: '미반영', value: '개인지방소득세 감소분(별도) · ISA 만기 전환액 추가 한도(§59의3④) · 공제액이 산출세액을 넘는 부분은 환급되지 않음' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// medical-deduction — 소득세법 §59의4②
// ─────────────────────────────────────────────────────────────────────────────
export function medicalDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const thr = r.rate('ye_medical_threshold');
  const genCap = r.amt('ye_medical_general_cap');
  const rate = r.rate('ye_medical_rate');
  const ratePre = r.rate('ye_medical_rate_preterm');
  const rateIvf = r.rate('ye_medical_rate_ivf');
  if (r.missing.length) return missingResult(r.missing);
  const salary = n(v.annualSalary);
  const G = n(v.generalMedical); const S = n(v.specificMedical);
  const P = n(v.pretermMedical); const I = n(v.ivfMedical);
  const T = Math.round(salary * thr);
  // 1호 — 3% 초과분, 700만 한도
  const d1 = Math.min(Math.max(0, G - T), genCap);
  // 2호 — 1호가 3%에 «미달하면 그 미달액을 뺀다»
  const d2 = Math.max(0, S - Math.max(0, T - G));
  // 3호 — 1·2호 합계가 미달하면 뺀다 / 4호 — 1~3호 합계가 미달하면 뺀다
  const d3 = Math.max(0, P - Math.max(0, T - G - S));
  const d4 = Math.max(0, I - Math.max(0, T - G - S - P));
  const credit = Math.round((d1 + d2) * rate + d3 * ratePre + d4 * rateIvf);
  return {
    main: { label: '의료비 세액공제', value: fmt(credit) },
    details: [
      { label: '문턱(총급여의 3%)', value: fmt(T) },
      { label: '일반 의료비 공제대상(한도 반영)', value: fmt(d1) },
      { label: '본인·6세 이하·65세 이상·장애인 등', value: fmt(d2) },
      { label: '미숙아·선천성이상아(20%)', value: fmt(d3) },
      { label: '난임시술(30%)', value: fmt(d4) },
      { label: '문턱 미달분 차감', value: '일반 의료비가 3%에 못 미치면 그 부족분을 본인·65세 이상 등 의료비에서 먼저 뺀다(§59의4②2호 단서)' },
      { label: '미반영', value: '실손보험 수령액 차감 · 공제액의 산출세액 초과분' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// education-deduction — 소득세법 §59의4③
// ─────────────────────────────────────────────────────────────────────────────
export function educationDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const rate = r.rate('ye_edu_rate');
  const capSchool = r.amt('ye_edu_cap_school');
  const capUniv = r.amt('ye_edu_cap_univ');
  if (r.missing.length) return missingResult(r.missing);
  const self = n(v.selfEdu);
  const school = Math.min(n(v.schoolEdu), capSchool * Math.max(0, n(v.schoolCount)));
  const univ = Math.min(n(v.univEdu), capUniv * Math.max(0, n(v.univCount)));
  const credit = Math.round((self + school + univ) * rate);
  return {
    main: { label: '교육비 세액공제', value: fmt(credit) },
    details: [
      { label: '본인(한도 없음)', value: fmt(self) },
      { label: '취학 전·초중고(1명당 한도 반영)', value: fmt(school) },
      { label: '대학생(1명당 한도 반영)', value: fmt(univ) },
      { label: '한도 계산', value: '1명당 한도 × 인원수로 합산 한도를 잡는다 — 한 명에게 몰린 지출은 실제보다 크게 잡힐 수 있다' },
      { label: '미반영', value: '장애인 특수교육비(한도 없음) · 대학원(본인만) · 비과세 학자금 차감 · 공제액의 산출세액 초과분' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// donation-deduction — 소득세법 §59의4④ · 한도는 같은 항 2호(§34 준용 구조)
// ─────────────────────────────────────────────────────────────────────────────
export function donationDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const rBase = r.rate('ye_donation_rate_base');
  const rOver = r.rate('ye_donation_rate_over');
  const tier = r.amt('ye_donation_tier');
  const limGeneral = r.rate('ye_donation_limit_general');
  const limRel = r.rate('ye_donation_limit_religious');
  const limRelExtra = r.rate('ye_donation_limit_religious_extra');
  if (r.missing.length) return missingResult(r.missing);
  const salary = n(v.annualSalary);
  const special = n(v.specialDonation);
  const general = n(v.generalDonation);
  const religious = n(v.religiousDonation);
  // 근로소득만 있다고 보고 «소득금액» = 근로소득금액(총급여 − §47 공제).
  const income = Math.max(0, salary - earnedIncomeDeduction(salary));
  const specialOk = Math.min(special, income);
  const base2 = Math.max(0, income - specialOk);
  const generalLimit = religious > 0
    ? base2 * limRel + Math.min(base2 * limRelExtra, general)
    : base2 * limGeneral;
  const generalOk = Math.min(general + religious, Math.round(generalLimit));
  const eligible = specialOk + generalOk;
  const credit = Math.round(eligible <= tier ? eligible * rBase : tier * rBase + (eligible - tier) * rOver);
  return {
    main: { label: '기부금 세액공제', value: fmt(credit) },
    details: [
      { label: '소득금액(근로소득만 가정)', value: fmt(income) },
      { label: '특례기부금 인정액', value: fmt(specialOk) },
      { label: `일반기부금 한도(${religious > 0 ? '종교단체 기부 있음' : '종교단체 기부 없음'})`, value: fmt(Math.round(generalLimit)) },
      { label: '일반기부금 인정액', value: fmt(generalOk) },
      { label: '한도 초과분', value: fmt(Math.max(0, special + general + religious - eligible)) },
      { label: '미반영', value: '한도 초과분 10년 이월 · 정치자금기부금(조특법 §76) · 고향사랑기부금(조특법 §58) · 공제액의 산출세액 초과분' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// insurance-deduction — 소득세법 §59의4①
// ─────────────────────────────────────────────────────────────────────────────
export function insuranceDeduction(v: V): CalcResult {
  const r = policyReader(v);
  const cap = r.amt('ye_ins_cap');
  const rGen = r.rate('ye_ins_rate_general');
  const rDis = r.rate('ye_ins_rate_disabled');
  if (r.missing.length) return missingResult(r.missing);
  const premium = Math.min(n(v.premium), cap);
  const disability = Math.min(n(v.disabilityPremium), cap);
  const credit = Math.round(premium * rGen + disability * rDis);
  return {
    main: { label: '보험료 세액공제', value: fmt(credit) },
    details: [
      { label: '보장성보험(한도 반영)', value: fmt(premium) },
      { label: '장애인전용보장성(한도 반영)', value: fmt(disability) },
      { label: '공제율', value: `일반 ${Math.round(rGen * 1000) / 10}% · 장애인전용 ${Math.round(rDis * 1000) / 10}%` },
      { label: '미반영', value: '공제액의 산출세액 초과분' },
      ...r.basis(),
    ],
  };
}
