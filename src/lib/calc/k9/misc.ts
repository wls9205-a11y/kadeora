/**
 * K-9 수치층 — misc 클러스터 (2026-09-17).
 *
 * 한 계산기에 두 파이프가 있을 수 있다:
 *   · 법령·시행령 값 → policy_constants(`simvat_` `nps_` `elec_` `customs_` `dui_` 접두) — 서버 주입, 없으면 「미수신」
 *   · 시장·사업자·실무 값 → 이 파일의 *_SOURCE 상수(대표값 + 기준일 + 검증 단계 공개)
 * 원문은 law.go.kr eflaw 현행 판(시행일 ≤ 2026-09-17). 판·대조일은 각 상수 옆에 둔다.
 */
import type { CalcResult } from '../formulas';
import {
  type V, n, fmt, policyReader, missingResult,
  parseYmd, ymd, today, daysBetween, addDays, periodEnd,
} from './misc-common';

export {
  yearEndRefund, creditCardDeduction, monthlyRentDeduction, irpDeduction,
  medicalDeduction, educationDeduction, donationDeduction, insuranceDeduction,
  earnedIncomeDeduction, earnedIncomeTaxCredit, earnedIncomeCreditCap, EARNED_INCOME_SOURCE,
} from './misc-yearend';

const pctText = (rate: number) => `${Math.round(rate * 10000) / 100}%`;

// ─────────────────────────────────────────────────────────────────────────────
// simplified-vat — 부가가치세법 §63②③⑥ · §69① · 시행령 §111②
// ⛔ 옛 코드: 부가가치율 선택지가 법정값의 1/10(「소매/음식 2%」, 법정 15%), 매입공제는 «매입세액×50%»
//    (법정은 세금계산서 등 수취 매입 «공급대가» × 0.5%). 매출 1억 음식점 → 코드 0원, 법정 1,472,500원.
// ─────────────────────────────────────────────────────────────────────────────
export const SIMVAT_INDUSTRIES: Record<string, { key: string; label: string }> = {
  retail_food: { key: 'simvat_rate_retail_food', label: '소매업·재생용 재료수집 및 판매업·음식점업' },
  mfg: { key: 'simvat_rate_mfg', label: '제조업·농업·임업 및 어업·소화물 전문 운송업' },
  lodging: { key: 'simvat_rate_lodging', label: '숙박업' },
  construct_it: { key: 'simvat_rate_construct_it', label: '건설업·운수 및 창고업·정보통신업' },
  finance_realty: { key: 'simvat_rate_finance_realty', label: '금융보험·전문과학기술·사업시설관리·부동산 관련 서비스업·부동산임대업' },
  other_service: { key: 'simvat_rate_other_service', label: '그 밖의 서비스업' },
};

export function simplifiedVat(v: V): CalcResult {
  const ind = SIMVAT_INDUSTRIES[String(v.industry ?? '')] ?? SIMVAT_INDUSTRIES.retail_food;
  const r = policyReader(v);
  const valueAdded = r.rate(ind.key);
  const taxRate = r.rate('simvat_tax_rate');
  const creditRate = r.rate('simvat_purchase_credit');
  const exemptUnder = r.amt('simvat_exempt_under');
  const threshold = r.amt('simvat_threshold');
  if (r.missing.length) return missingResult(r.missing);

  const rev = n(v.revenue);
  const purchase = n(v.purchaseAmount);
  const tax = Math.round(rev * valueAdded * taxRate);
  const creditRaw = Math.round(purchase * creditRate);
  const credit = Math.min(creditRaw, tax);                 // §63⑥ 공제액이 납부세액을 넘는 부분은 없는 것으로 본다
  const payable = tax - credit;
  const common = [
    { label: '업종별 부가가치율', value: `${ind.label} ${pctText(valueAdded)}` },
    { label: '납부세액(공급대가 × 부가가치율 × 10%)', value: fmt(tax) },
    { label: '매입 공제(수취 매입 공급대가 × 0.5%)', value: fmt(credit) },
    ...(rev >= threshold ? [{ label: '⚠️ 유형', value: `연 공급대가 ${fmt(threshold)} 이상이면 간이과세 적용 대상이 아니다(시행령 §109①) — 일반과세 기준으로 다시 계산해야 한다` }] : []),
    { label: '미반영', value: '전자세금계산서 발급세액공제(§63④) · 신용카드매출전표 발행공제 · 겸영 안분 · 과세기간 중 유형 전환 · 부동산임대업·과세유흥장소의 간이과세 배제 기준' },
    ...r.basis(),
  ];
  if (rev < exemptUnder) {
    return {
      main: { label: '납부 부가세', value: `${fmt(0)} (납부의무 면제)` },
      details: [{ label: '사유', value: `해당 과세기간 공급대가 합계 ${fmt(exemptUnder)} «미만» — 납부의무 면제(§69①). 신고 의무는 남는다` }, ...common],
    };
  }
  return { main: { label: '납부 부가세', value: fmt(payable) }, details: common };
}

// ─────────────────────────────────────────────────────────────────────────────
// national-pension — 국민연금법 §51① · §63① · 부칙(법률 제21203호 계열) 제4조 · 복지부 고시 제2026-31호
// ⛔ 옛 코드: 가입 1년당 (A+B)×1.2%(20년 넘으면 1%) — 조문에 없는 식. 월 300만·20년 → 1,437,360원(법정 근사 643,816원, 약 2.2배).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * A값(연금 수급 전 3년간 전체 가입자 평균소득월액) — ⚠️ 2026년 적용값 «미확정».
 * 고시 본문에 없다(재평가율표만 있음). 2,989,000원은 2024년 적용값으로 «알려진» 수치다.
 * 화면이 이 사실을 말하고, 사용자가 공단 공시값을 넣으면 그것을 쓴다.
 */
export const NPS_A_VALUE_ASSUMED = {
  value: 2_989_000,
  basis: '2024년 적용 A값으로 알려진 수치(국민연금공단 공시 원문 미열람) — 2026년 A값 미확정',
} as const;

export function nationalPension(v: V): CalcResult {
  const r = policyReader(v);
  const factor = r.rate('nps_benefit_factor');           // 1천분의 1,290 → 1.29
  const over20 = r.rate('nps_extra_over20');             // 1천분의 50
  const reducedBase = r.rate('nps_reduced_base');        // 10~20년: 1천분의 500
  const reducedStep = r.rate('nps_reduced_step');        // + 1년당 1천분의 50
  const empRate = r.rate('nps_rate_employee_2026');
  const regRate = r.rate('nps_rate_regional_2026');
  const cap = r.amt('nps_income_cap');
  const floor = r.amt('nps_income_floor');
  if (r.missing.length) return missingResult(r.missing);

  const salary = n(v.monthlySalary);
  const B = Math.min(Math.max(salary, floor), cap);
  const years = Math.max(0, n(v.years));
  const userA = n(v.aValue);
  const A = userA > 0 ? userA : NPS_A_VALUE_ASSUMED.value;
  const basicAnnual = factor * (A + B) * (years > 20 ? 1 + over20 * (years - 20) : 1);
  let ratio: number;
  if (years >= 20) ratio = 1;
  else if (years >= 10) ratio = reducedBase + reducedStep * (years - 10);
  else ratio = 0;
  const monthly = Math.round((basicAnnual * ratio) / 12);

  const details = [
    { label: '기준소득월액(B, 상·하한 반영)', value: fmt(B) },
    { label: 'A값', value: userA > 0 ? `${fmt(A)} (입력값)` : `${fmt(A)} — ⚠️ ${NPS_A_VALUE_ASSUMED.basis}` },
    { label: '산식', value: `기본연금액 = (A+B) × ${Math.round(factor * 1000)}/1,000${years > 20 ? ` × (1 + 20년 초과 ${years - 20}년 × ${Math.round(over20 * 1000)}/1,000)` : ''}${years < 20 && years >= 10 ? ` · 가입 ${years}년 노령연금 = 기본연금액 × ${Math.round(ratio * 1000)}/1,000(§63①2호)` : ''}` },
    { label: '2026년 본인 보험료(사업장가입자)', value: `${fmt(Math.round(B * empRate))} (기준소득월액의 ${pctText(empRate)})` },
    { label: '2026년 보험료(지역·임의가입자)', value: `${fmt(Math.round(B * regRate))} (${pctText(regRate)})` },
    { label: '미반영', value: '2025년 이전 가입기간의 종전 비율(부칙 — 연도별 급여율) · 연도별 재평가율 · 물가 연동 조정 · 부양가족연금 · 출산·군복무 크레딧 · 조기·연기 연금 — 실제 예상액은 국민연금공단 「내 연금 알아보기」에서 확인' },
    { label: '보험료율 변화', value: '보험료율은 부칙 제4조에 따라 2032년까지 매년 오른다 — 총 납부액을 2026년 율로 곱해 보여 주지 않는다' },
    ...r.basis(),
  ];
  if (years < 10) {
    return {
      main: { label: '노령연금', value: '수급권 없음(가입 10년 미만)' },
      details: [{ label: '사유', value: '가입기간 10년 미만은 노령연금이 없다(§61·§63①) — 반환일시금 대상' }, ...details],
    };
  }
  return { main: { label: '예상 월 수령액(현재가치 근사)', value: fmt(monthly) }, details };
}

// ─────────────────────────────────────────────────────────────────────────────
// customs-duty — 관세법 §94 4호 · 관세법 시행규칙 §45②1호 · 부가가치세법 §29②·§30
// ⛔ 옛 코드: «원화 15만원» 고정 + 배송비 합산으로 면세 판정. 법정은 운임·보험료를 «뺀» 물품가격이 «미화 150달러 이하».
// ─────────────────────────────────────────────────────────────────────────────
export const CUSTOMS_DEMINIMIS = {
  usd: 150,
  law: '관세법 시행규칙 §45②1호(물품가격 = 과세가격 − 운임·보험료)',
  url: 'https://www.law.go.kr/법령/관세법시행규칙/제45조',
  edition: 'eflaw 현행 2026-07-31 판',
  verifiedAt: '2026-09-17',
  /** ⚠️ 미국발 목록통관 200달러 특례는 관세청 고시(원문 미열람) — 계산에 쓰지 않고 공개만 한다. */
  usUnverified: '미국발 목록통관 물품의 200달러 특례는 관세청 고시 사항으로 원문 대조 전이라 계산에 반영하지 않았다',
} as const;

/** 품목별 관세율은 HS 코드별 법정 세율표 값이다 — 아래는 «예시» 이며 원문 대조 전이다. */
export const CUSTOMS_EXAMPLE_RATES: Record<string, { rate: number; label: string }> = {
  general: { rate: 0.08, label: '일반(예시 8%)' },
  clothing: { rate: 0.13, label: '의류(예시 13%)' },
  electronics: { rate: 0.04, label: '전자제품(예시 4%)' },
  food: { rate: 0.08, label: '식품(예시 8%)' },
  cosmetics: { rate: 0.065, label: '화장품(예시 6.5%)' },
};

export function customsDuty(v: V): CalcResult {
  const r = policyReader(v);
  const vatRate = r.rate('customs_vat_rate');
  if (r.missing.length) return missingResult(r.missing);
  const priceUsd = n(v.priceUsd);
  const shipUsd = n(v.shippingUsd);
  const fx = n(v.exchangeRate);
  const cat = CUSTOMS_EXAMPLE_RATES[String(v.category ?? '')] ?? CUSTOMS_EXAMPLE_RATES.general;
  const disclose = [
    { label: '면세 기준', value: `물품가격(운임·보험료 제외) 미화 ${CUSTOMS_DEMINIMIS.usd}달러 이하 자가사용물품 — ${CUSTOMS_DEMINIMIS.law}` },
    { label: '미반영', value: `${CUSTOMS_DEMINIMIS.usUnverified} · 같은 날 입항 물품 합산과세 · 개별소비세·교육세·주세 대상 품목 · FTA 원산지 세율 · 반복·분할 수입 배제` },
    ...r.basis(),
  ];
  if (priceUsd <= CUSTOMS_DEMINIMIS.usd) {
    return {
      main: { label: '관세·부가세', value: `${fmt(0)} (소액물품 면세)` },
      details: [{ label: '판정', value: `물품가격 ${priceUsd}달러 ≤ ${CUSTOMS_DEMINIMIS.usd}달러 — 배송비는 판정 금액에 넣지 않는다` }, ...disclose],
    };
  }
  if (fx <= 0) {
    return {
      main: { label: '관세·부가세', value: '과세환율 입력 필요' },
      details: [{ label: '판정', value: `물품가격 ${priceUsd}달러 > ${CUSTOMS_DEMINIMIS.usd}달러 — 과세 대상. 관세청 고시 과세환율(원/달러)을 넣으면 세액을 계산한다` }, ...disclose],
    };
  }
  // 과세가격(CIF) = 물품가격 + 운임
  const dutiable = Math.round((priceUsd + shipUsd) * fx);
  const duty = Math.round(dutiable * cat.rate);
  const vat = Math.round((dutiable + duty) * vatRate);   // 부가세법 §29② 과세가격 + 관세
  return {
    main: { label: '관세 + 부가세', value: fmt(duty + vat) },
    details: [
      { label: '과세가격(물품가격+운임)', value: fmt(dutiable) },
      { label: `관세 — ${cat.label}`, value: fmt(duty) },
      { label: `부가세(${pctText(vatRate)})`, value: fmt(vat) },
      { label: '⚠️ 관세율', value: '품목별 세율은 HS 코드로 정해진다. 표시한 율은 예시(원문 대조 전) — 관세청 「관세율표」에서 품목을 확인할 것' },
      ...disclose,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// electricity — 전력기금(전기사업법 시행령 §36, 법정) + 주택용 저압 요금표(한전 약관 — 공개형)
// ⛔ 옛 코드: 전력기금 3.7%(현행 2.7%, 2025-07-01~), 기본요금 910원 고정(구간별 910/1,600/7,300),
//    하계 누진구간 없음, 기후환경·연료비조정 9원·5원을 근거 없이 박음, 계약 종류 입력을 무시.
// ─────────────────────────────────────────────────────────────────────────────
export const KEPCO_RES_LOW_TARIFF = {
  basis: '한국전력 전기요금표 — 주택용 전력(저압)',
  url: 'https://online.kepco.co.kr',
  /** 요금표 페이지의 적용일 표기. 약관·인가 값이라 법령 파이프가 아니다. */
  appliedFrom: '2023-11-09',
  verification: 'secondary' as 'secondary' | 'primary',
  base: [910, 1_600, 7_300],
  energy: [120.0, 214.6, 307.3],
  bounds: { other: [200, 400], summer: [300, 450] },
  superUser: { above: 1_000, rate: 736.2 },
} as const;

export function electricityBill(v: V): CalcResult {
  const r = policyReader(v);
  const fundRate = r.rate('elec_fund_rate');
  const vatRate = r.rate('elec_vat_rate');
  if (r.missing.length) return missingResult(r.missing);
  const t = KEPCO_RES_LOW_TARIFF;
  const usage = Math.max(0, n(v.usage));
  const season = String(v.season ?? 'other');
  const [b1, b2] = season === 'summer' ? t.bounds.summer : t.bounds.other;
  const superApplies = (season === 'summer' || season === 'winter') && usage > t.superUser.above;
  const tierUse = [
    Math.min(usage, b1),
    Math.max(0, Math.min(usage, b2) - b1),
    Math.max(0, (superApplies ? t.superUser.above : usage) - b2),
  ];
  const superUse = superApplies ? usage - t.superUser.above : 0;
  const energy = Math.round(tierUse[0] * t.energy[0] + tierUse[1] * t.energy[1] + tierUse[2] * t.energy[2] + superUse * t.superUser.rate);
  const base = usage <= b1 ? t.base[0] : usage <= b2 ? t.base[1] : t.base[2];
  const climate = Math.round(usage * n(v.climateRate));
  const fuel = Math.round(usage * n(v.fuelRate));
  const charge = base + energy + climate + fuel;
  const vat = Math.round(charge * vatRate);
  const fund = Math.round(charge * fundRate);
  const total = charge + vat + fund;
  return {
    main: { label: '전기요금(주택용 저압 · 부가세·전력기금 포함)', value: fmt(total) },
    details: [
      { label: '기본요금', value: fmt(base) },
      { label: `전력량요금(${season === 'summer' ? `하계 ${b1}/${b2}kWh 구간` : `${b1}/${b2}kWh 구간`}${superApplies ? ' · 1,000kWh 초과 슈퍼유저 요금' : ''})`, value: fmt(energy) },
      { label: '기후환경요금(입력 단가)', value: fmt(climate) },
      { label: '연료비조정요금(입력 단가)', value: fmt(fuel) },
      { label: `부가가치세(${pctText(vatRate)})`, value: fmt(vat) },
      { label: `전력산업기반기금(${pctText(fundRate)})`, value: fmt(fund) },
      { label: '⚠️ 요금표', value: `${t.basis} · 요금표 적용일 표기 ${t.appliedFrom} · 약관 값(원문 대조 단계: 2차) — 요금 개정 시 달라진다` },
      { label: '⚠️ 미확정', value: '기후환경요금·연료비조정요금 단가는 분기마다 한전이 공시한다 — 확인 전이라 기본값 0원이며 입력해야 반영된다' },
      { label: '미반영', value: '청구 시 원 단위 절사 규칙 · 필수사용량 보장공제 · 복지할인 · 일반용 등 다른 계약종별 · TV 수신료' },
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// discharge-date — 병역법 §18② · §19①3호 · §30①
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 복무기간 — 법정 기간(§18②·§30①)과 «단축 조치 후» 실무 기간이 다르다.
 * ⚠️ 18/20/21개월은 §19①3호(6개월 이내 단축)에 따른 조치 결과로 알려진 값 — 국방부 단축 조치 문서 원문 미열람.
 */
export const SERVICE_MONTHS: Record<string, { months: number; statutory: string; label: string }> = {
  army: { months: 18, statutory: '2년(§18②1호)', label: '육군' },
  marine: { months: 18, statutory: '2년(§18②2호 단서)', label: '해병대' },
  navy: { months: 20, statutory: '2년 2개월(§18②2호)', label: '해군' },
  airforce: { months: 21, statutory: '2년 3개월(§18②3호)', label: '공군' },
  social: { months: 21, statutory: '2년 2개월(§30①)', label: '사회복무요원' },
};

export function dischargeDate(v: V): CalcResult {
  const start = parseYmd(v.enlistDate);
  if (!start) return { main: { label: '전역 예정일', value: '입대일을 입력하세요' }, details: [] };
  const b = SERVICE_MONTHS[String(v.branch ?? '')] ?? SERVICE_MONTHS.army;
  const end = periodEnd(start, b.months);
  const now = today(v);
  const totalDays = daysBetween(start, end) + 1;
  const served = Math.min(totalDays, Math.max(0, daysBetween(start, now) + 1));
  const remain = daysBetween(now, end);
  return {
    main: { label: '전역 예정일', value: ymd(end) },
    details: [
      { label: 'D-Day', value: remain > 0 ? `D-${remain}` : remain === 0 ? 'D-Day' : '전역일 지남' },
      { label: '복무 진행률', value: `${Math.round((served / totalDays) * 100)}% (${served}/${totalDays}일)` },
      { label: '복무기간', value: `${b.label} ${b.months}개월 — 법정 ${b.statutory}, 단축 조치 반영값` },
      { label: '⚠️ 근거 단계', value: '단축 조치(병역법 §19①3호) 문서 원문 미열람 — 실무에 알려진 기간이다' },
      { label: '계산 규칙', value: '입영일 산입 · 최종 월 해당일의 전일(해당일이 없으면 그 달 말일) — 민법 §160 준용' },
      { label: '미반영', value: '영창·휴가 미복귀 등 복무기간 불산입 · 전역 보류 · 조기전역' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// age-calc — 민법 §158 (출생일 산입) · 행정기본법 §16
// ─────────────────────────────────────────────────────────────────────────────
export function ageCalc(v: V): CalcResult {
  const bd = parseYmd(v.birthDate);
  if (!bd) return { main: { label: '만 나이', value: '생년월일을 입력하세요' }, details: [] };
  const now = today(v);
  let age = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
  let next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
  if (next.getTime() <= now.getTime()) next = new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate());
  return {
    main: { label: '만 나이', value: `${age}세` },
    details: [
      { label: '다음 생일까지', value: `${daysBetween(now, next)}일` },
      ...(bd.getMonth() === 1 && bd.getDate() === 29 ? [{ label: '2월 29일생', value: '평년에는 3월 1일에 나이가 늘어나는 것으로 계산했다' }] : []),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// statute-of-limitations — 민법 §157·§160·§162~§166·§766, 상법 §64, 근로기준법 §49
// ⛔ 옛 선택지 「일용직 임금 1년」은 오류 — 근로기준법상 근로자면 일용직도 임금채권 3년(§49).
//    §164 3호 1년은 «노역인·연예인의 임금» 이다.
// ─────────────────────────────────────────────────────────────────────────────
export const LIMITATION_TYPES: Record<string, { years: number; label: string; law: string }> = {
  general: { years: 10, label: '일반 민사채권', law: '민법 §162①' },
  commercial: { years: 5, label: '상행위로 인한 채권', law: '상법 §64' },
  wage: { years: 3, label: '임금채권(일용근로자 포함)', law: '근로기준법 §49' },
  severance: { years: 3, label: '퇴직금', law: '근로자퇴직급여 보장법 §10' },
  short3: { years: 3, label: '3년 단기(이자·사용료, 의사·공사·변호사 보수 등)', law: '민법 §163' },
  short1: { years: 1, label: '1년 단기(숙박료·음식료·동산 사용료·노역인·연예인 임금 등)', law: '민법 §164' },
  tortKnown: { years: 3, label: '불법행위 손해배상 — 손해와 가해자를 안 날부터', law: '민법 §766①' },
  tortOccurred: { years: 10, label: '불법행위 손해배상 — 불법행위를 한 날부터', law: '민법 §766②' },
  judgment: { years: 10, label: '판결 등으로 확정된 채권', law: '민법 §165①' },
};
/** 옛 선택지 값(숫자) → 새 키. 「1」은 옛 라벨이 오류였으므로 §164 로만 잇는다. */
const LEGACY_LIMITATION: Record<string, string> = { '10': 'general', '5': 'commercial', '3': 'wage', '1': 'short1' };

export function statuteOfLimitations(v: V): CalcResult {
  const start = parseYmd(v.startDate);
  if (!start) return { main: { label: '소멸시효', value: '날짜 입력 필요' }, details: [] };
  const raw = String(v.type ?? 'general');
  const t = LIMITATION_TYPES[raw] ?? LIMITATION_TYPES[LEGACY_LIMITATION[raw] ?? 'general'];
  // §157 초일 불산입 → 기산일은 다음 날, §160 역에 의한 계산
  const expiry = periodEnd(addDays(start, 1), t.years * 12);
  const remain = daysBetween(today(v), expiry);
  return {
    main: { label: '소멸시효 만료일', value: ymd(expiry) },
    details: [
      { label: '시효 기간', value: `${t.label} ${t.years}년 — ${t.law}` },
      { label: '남은 기간', value: remain >= 0 ? `${remain}일` : '만료됨' },
      { label: '기산점', value: '권리를 행사할 수 있는 날(민법 §166①) 기준 · 초일 불산입(§157)' },
      { label: '미반영', value: '청구·압류·승인 등 시효중단(§168)·정지 · 말일이 공휴일이면 다음 날 만료(§161) · 특별법상 다른 기간' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// accident-compensation — 비법정(약관·판례) · 공개형
// ⛔ 옛 화면은 계수의 출처를 말하지 않았다. 계산식은 «카더라 가정» 이다 — 보험사 약관·법원 기준이 아니다.
//    대표값·범위는 표준약관·법원 기준 원문 미열람이라 지어내지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
export function accidentCompensation(v: V): CalcResult {
  const treat = n(v.treatmentCost); const days = n(v.treatmentDays);
  const wage = n(v.dailyWage); const disGrade = Number(v.disability) || 0;
  const consolation = days <= 14 ? 500_000 : days <= 30 ? 1_000_000 : days <= 90 ? 2_000_000 : 5_000_000;
  const lostWage = wage * days;
  const disCompensation = Math.round(disGrade > 0 ? wage * 365 * (15 - disGrade) * 0.05 : 0);
  const total = treat + consolation + lostWage + disCompensation;
  return {
    main: { label: '추정 합의금 (예시)', value: fmt(total) },
    details: [
      { label: '치료비(입력)', value: fmt(treat) },
      { label: '위자료(가정)', value: fmt(consolation) },
      { label: '휴업손해(일소득 × 치료일수, 가정)', value: fmt(lostWage) },
      { label: '장해 보상(가정)', value: fmt(disCompensation) },
      { label: '⚠️ 성격', value: '추정·예시값이다. 위자료 구간·휴업손해 100%·장해식(일소득×365×(15−등급)×5%)은 카더라 가정이며 자동차보험 표준약관·법원 산정기준이 아니다' },
      { label: '미반영', value: '과실상계 · 노동능력상실률·중간이자 공제(호프만) · 향후치료비 · 보험사 약관 기준과 소송 기준의 차이' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// consolation-money — 비법정(법원 재량) · 공개형
// ⛔ 옛 코드는 «유책 배우자 연소득 / 5천만» 을 곱했다 — 근거 없는 계수이고 소득 0이면 위자료 0원이 됐다. 제거.
// ─────────────────────────────────────────────────────────────────────────────
export const CONSOLATION_ASSUMED = {
  base: { low: 10_000_000, medium: 30_000_000, high: 50_000_000 } as Record<string, number>,
  perYear: 0.05,
  basis: '카더라 가정 — 법원 산정기준 원문 미열람. 판례·실무의 대표값·범위는 확인 전이라 제시하지 않는다',
} as const;

export function consolationMoney(v: V): CalcResult {
  const years = Math.max(0, n(v.marriageYears));
  const base = CONSOLATION_ASSUMED.base[String(v.faultDegree ?? 'medium')] ?? CONSOLATION_ASSUMED.base.medium;
  const amount = Math.round(base * (1 + years * CONSOLATION_ASSUMED.perYear));
  return {
    main: { label: '위자료 (예시)', value: fmt(amount) },
    details: [
      { label: '가정 계수', value: `유책 정도 기준액 ${fmt(base)} × (1 + 혼인 ${years}년 × 5%)` },
      { label: '⚠️ 성격', value: CONSOLATION_ASSUMED.basis },
      { label: '실제 판단 요소', value: '유책행위의 내용·정도, 혼인 기간, 파탄 경위, 당사자의 나이·재산 상태 등을 법원이 종합해 정한다(민법 §843·§806 준용)' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// alcohol-calc — Widmark 추정식(비법정) + 도로교통법 기준(법정, `dui_` 행)
// ─────────────────────────────────────────────────────────────────────────────
export const WIDMARK_ASSUMED = {
  r: { male: 0.68, female: 0.55 },
  eliminationPerHour: 0.015,
  mlPerDrink: { soju: 50, beer: 355, wine: 150, whiskey: 30 } as Record<string, number>,
  abv: { soju: 0.17, beer: 0.05, wine: 0.13, whiskey: 0.4 } as Record<string, number>,
  ethanolDensity: 0.789,
} as const;

export function alcoholCalc(v: V): CalcResult {
  const r = policyReader(v);
  const tMin = r.pct('dui_bac_min');
  const t2 = r.pct('dui_bac_tier2');
  const t3 = r.pct('dui_bac_tier3');
  const w = WIDMARK_ASSUMED;
  const gender = v.gender === 'female' ? 'female' : 'male';
  const kg = Math.max(1, n(v.weight));
  const type = String(v.drinkType ?? 'soju');
  const grams = n(v.drinks) * (w.mlPerDrink[type] ?? w.mlPerDrink.soju) * (w.abv[type] ?? w.abv.soju) * w.ethanolDensity;
  const bac = Math.max(0, (grams / (kg * w.r[gender] * 1000)) * 100 - n(v.hours) * w.eliminationPerHour);
  const est = [
    { label: '섭취 알코올(추정)', value: `${grams.toFixed(1)}g` },
    { label: '추정식', value: `Widmark — 체내분포계수 ${w.r[gender]} · 시간당 ${w.eliminationPerHour}% 감소 가정. 흡수율·개인차·음식 섭취를 반영하지 않는다` },
    { label: '⛔ 주의', value: '이 수치로 운전 가능 여부를 판단하지 말 것 — 조금이라도 마셨으면 운전하지 않는다' },
  ];
  if (r.missing.length) {
    return { main: { label: `추정 BAC ${bac.toFixed(3)}%`, value: '법정 기준 미수신', color: 'var(--text-tertiary)' }, details: [...est, ...missingResult(r.missing).details] };
  }
  let status: string; let color: string; let rule: string;
  if (bac >= t3) { status = `${t3}% 이상 구간`; color = 'var(--accent-red)'; rule = `도로교통법 §148의2③1호 벌칙 구간(${t3}% 이상)`; }
  else if (bac >= t2) { status = `${t2}~${t3}% 구간`; color = 'var(--accent-red)'; rule = `도로교통법 §148의2③2호 벌칙 구간(${t2}% 이상 ${t3}% 미만)`; }
  else if (bac >= tMin) { status = `${tMin}~${t2}% 구간`; color = 'var(--accent-yellow)'; rule = `운전 금지 기준 ${tMin}% 이상(§44④) · §148의2③3호 벌칙 구간`; }
  else { status = `${tMin}% 미만(추정)`; color = 'var(--accent-green)'; rule = `운전 금지 기준 ${tMin}% 미만 — 추정치일 뿐이다`; }
  return {
    main: { label: `추정 BAC ${bac.toFixed(3)}%`, value: status, color },
    details: [
      { label: '법정 구간', value: rule },
      { label: '면허 행정처분', value: '정지·취소 기준(시행규칙 별표)은 원문 대조 전 — 흔히 0.03% 정지 · 0.08% 취소로 알려져 있다' },
      ...est,
      ...r.basis(),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// body-fat · due-date · d-day — 법정값 없음. 추정식·관례를 그렇다고 말한다(G7).
// ─────────────────────────────────────────────────────────────────────────────
export function bodyFat(v: V): CalcResult {
  const g = v.gender as string; const a = n(v.age); const h = n(v.height) / 100; const kg = n(v.weight);
  const bmiVal = h > 0 ? kg / (h * h) : 0;
  const bf = g === 'male' ? 1.2 * bmiVal + 0.23 * a - 16.2 : 1.2 * bmiVal + 0.23 * a - 5.4;
  const grade = g === 'male' ? (bf < 14 ? '마른 체형' : bf < 20 ? '정상' : bf < 25 ? '약간 과체중' : '비만') : (bf < 21 ? '마른 체형' : bf < 28 ? '정상' : bf < 32 ? '약간 과체중' : '비만');
  return {
    main: { label: `추정 체지방률 ${bf.toFixed(1)}%`, value: grade },
    details: [
      { label: 'BMI', value: bmiVal.toFixed(1) },
      { label: '추정식', value: 'Deurenberg(1991) — 1.2×BMI + 0.23×나이 − 16.2(남) / − 5.4(여). 체성분 측정이 아니며 오차가 수 %p 날 수 있다' },
      { label: '등급 구간', value: '참고용 구분 — 공인 기준표에서 옮긴 값이 아니다' },
    ],
  };
}

export function dueDate(v: V): CalcResult {
  const lmp = parseYmd(v.lastPeriod);
  if (!lmp) return { main: { label: '출산 예정일', value: '날짜를 입력하세요' }, details: [] };
  const cycle = n(v.cycleLength) || 28;
  const due = addDays(lmp, 280 + (cycle - 28));
  const now = today(v);
  const weeks = Math.floor(daysBetween(lmp, now) / 7);
  return {
    main: { label: '출산 예정일', value: ymd(due) },
    details: [
      { label: '현재 임신 주수', value: weeks > 0 ? `${weeks}주` : '임신 전' },
      { label: 'D-Day', value: `${daysBetween(now, due)}일` },
      { label: '계산 방식', value: 'Naegele 법칙(마지막 생리 시작일 + 280일, 주기 보정) — 초음파로 확정한 예정일과 다를 수 있다' },
    ],
  };
}

export function dDay(v: V): CalcResult {
  const s = parseYmd(v.startDate); const e = parseYmd(v.endDate);
  if (!s || !e) return { main: { label: 'D-Day', value: '날짜를 입력하세요' }, details: [] };
  const diff = daysBetween(s, e);
  return {
    main: { label: 'D-Day', value: diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day!' : `D+${Math.abs(diff)}` },
    details: [
      { label: '일수 차이', value: `${Math.abs(diff)}일` },
      { label: '세는 법', value: '시작일을 빼고 센 날짜 차이다 — 시작일을 1일째로 세면 1일 더한다' },
    ],
  };
}
