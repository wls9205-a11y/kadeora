/**
 * K-9 A″ 감사 — a2 클러스터: FORMULAS 맵 미등록(라이브 «결과 없음») 무감사 계산기 21종 (2026-09-17).
 *
 * 감사 규율: 법령·시행령 값은 policy_constants(서버 `__policy` 주입, 없으면 「미수신」) ·
 *   파서(%·원)가 못 읽는 조문 뼈대(30일·3개월·10년·연차 경계)는 A2_LAW 코드 상수 + 근거 조문 ·
 *   시장·사업자·행정지도 값은 *_SOURCE 공개형(대표값 + 기준일 + 검증 단계) · 순수 산식은 경계값 회귀.
 *
 * 원문: 국가법령정보센터 DRF `target=eflaw` 현행 판(시행일 ≤ 2026-09-17, 조회 2026-09-17)
 *   근로기준법 MST 283457 @2026-08-20 · 근로기준법 시행령 270551 @2025-10-23
 *   소득세법 280405 @2026-07-01 · 소득세법 시행령 286211 @2026-07-01 · 지방세법 282559 @2026-07-01
 *   초·중등교육법 283903 @2026-09-11 (옛 판 76654 @2007-01-03 · 79961 @2007-08-03 대조) · 건축법 273437 @2026-02-27
 *
 * ⚠️ 공유 누진표(INCOME_TAX_BRACKETS, 소득세법 §55①)는 tax-tables.ts 그대로 쓴다 — 공유 누진표 이관은 별건.
 */
import { INCOME_TAX_BRACKETS, calcProgressiveTax, formatKRWExact } from '../tax-tables';
import { parsePolicyPack } from '../gov-tables';
import type { CalcResult } from '../formulas';

type V = Record<string, number | string>;
type Row = { label: string; value: string };
type Meta = Record<string, { item?: string; source?: string; date?: string; status?: string; from?: string; url?: string }>;

const n = (v: unknown) => Number(v) || 0;
const fmt = (v: number) => formatKRWExact(v);
const r = Math.round;

/** 파서가 못 읽는 조문 뼈대 — 값 옆에 근거 조문. */
export const A2_LAW = {
  /** 근로기준법 §26 본문 — 30일 전 예고 / 30일분 이상의 통상임금. */
  noticeDays: 30,
  /** 근로기준법 §26 단서 1호 — 계속 근로한 기간이 3개월 미만이면 적용 제외. */
  noticeMinTenureMonths: 3,
  /** 근로기준법 §18③ — 1주 소정근로시간 15시간 미만은 주휴(§55) 미적용. */
  weeklyHolidayMinHours: 15,
  /** 근로기준법 §50① — 1주 법정근로시간(주휴시간 산정 상한). */
  statutoryWeeklyHours: 40,
  /** 소득세법 §57② — 공제한도 초과 외국소득세액 이월공제기간(년). */
  foreignTaxCarryYears: 10,
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// 1. jeonse-loan — 순수 산식(단리 이자) · 금리는 사용자 입력(시장값)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 옛 코드와 월 이자 산식은 같다(금액 × 금리 ÷ 12). 감사에서 고친 것:
 *   · «매월 이자만 내는 만기일시상환» 가정을 화면에 적는다(원리금 상환이면 이 값이 아니다).
 *   · 은행은 일할(연 365일)로 이자를 매긴다 — 30일·31일 달 이자를 같이 보여준다(월 ÷12 값과 다르다).
 *   · 기본 금리 3.5% 는 예시값이다(시장값 — 은행·상품·신용에 따라 다름).
 */
export function jeonseLoan(v: V): CalcResult {
  const amount = Math.max(0, n(v.loanAmount));
  const ratePct = Math.max(0, n(v.rate));
  const rate = ratePct / 100;
  const monthly = r(amount * rate / 12);
  const annual = r(amount * rate);
  const day30 = r(amount * rate * 30 / 365);
  const day31 = r(amount * rate * 31 / 365);
  return {
    main: { label: '월 이자', value: fmt(monthly) },
    details: [
      { label: '연 이자', value: fmt(annual) },
      { label: '일할 계산 — 30일 달 (금액 × 금리 × 30 ÷ 365)', value: fmt(day30) },
      { label: '일할 계산 — 31일 달', value: fmt(day31) },
      { label: '⚠️ 상환 방식 가정', value: '매월 이자만 내고 만기에 원금을 갚는 만기일시상환이다. 원리금·원금 분할상환이면 월 납입액이 이 값보다 크다' },
      { label: '⚠️ 금리', value: `입력 금리 ${ratePct}% 를 만기까지 고정으로 봤다. 기본값 3.5% 는 예시값이다 — 은행·보증기관·우대조건에 따라 다르다` },
      { label: '⚠️ 미반영', value: '보증료(HUG·HF·SGI)·인지세·중도상환수수료는 계산하지 않았다' },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. severance-calc (해고예고수당) — 근로기준법 §26 · 시행령 §6②4호·③
// ═════════════════════════════════════════════════════════════════════════════

export interface NoticePayParts {
  weeklyPaidHours: number;
  /** 고용노동부 실무의 반올림 기준시간(주 40시간 → 209). */
  monthHours: number;
  /** 시행령 §6②4호 식 그대로(반올림 없음, 주 40시간 → 208.57…). */
  monthHoursExact: number;
  hourly: number;
  daily: number;
  pay: number;
  payExact: number;
}

/**
 * ⛔ 옛 코드: 월 통상임금을 그대로 「30일분」 으로 찍었다.
 *    §26 은 «30일분 이상의 통상임금», 시행령 §6③ 일급 = 시간급 × 1일 소정근로시간,
 *    §6②4호 시간급 = 월급 ÷ 월 통상임금 산정 기준시간(주 기준시간 × 1년 평균 주 수 ÷ 12).
 *    월 350만·주 40시간·1일 8시간: 옛 3,500,000원 → 법 4,019,139원(209시간 기준, 14.8% 과소였다).
 */
export function noticePayParts(monthlySalary: number, weeklyHoursIn: number, dailyHoursIn: number): NoticePayParts {
  const weekly = Math.max(0, weeklyHoursIn);
  const holiday = weekly >= A2_LAW.weeklyHolidayMinHours ? Math.min(weekly, A2_LAW.statutoryWeeklyHours) / 5 : 0;
  const weeklyPaidHours = weekly + holiday;
  const monthHoursExact = weeklyPaidHours * 365 / 7 / 12;
  const monthHours = Math.round(monthHoursExact);
  const daily8 = Math.max(0, dailyHoursIn);
  const hourly = monthHours > 0 ? monthlySalary / monthHours : 0;
  const hourlyExact = monthHoursExact > 0 ? monthlySalary / monthHoursExact : 0;
  const daily = hourly * daily8;
  return {
    weeklyPaidHours, monthHours, monthHoursExact, hourly, daily,
    pay: r(daily * A2_LAW.noticeDays),
    payExact: r(hourlyExact * daily8 * A2_LAW.noticeDays),
  };
}

export function severanceCalc(v: V): CalcResult {
  const monthly = Math.max(0, n(v.monthlySalary));
  const weeklyHours = v.weeklyHours === undefined || v.weeklyHours === '' ? 40 : n(v.weeklyHours);
  const dailyHours = v.dailyHours === undefined || v.dailyHours === '' ? 8 : n(v.dailyHours);
  if (v.tenure === 'under3m') {
    return {
      main: { label: '해고예고수당', value: fmt(0) },
      details: [
        { label: '사유', value: `계속 근로기간 ${A2_LAW.noticeMinTenureMonths}개월 미만 — 해고예고 적용 제외(근로기준법 §26 단서 1호)` },
        { label: '근거', value: '근로기준법 제26조 (eflaw 현행 2026-08-20 판 대조)' },
      ],
    };
  }
  const p = noticePayParts(monthly, weeklyHours, dailyHours);
  if (p.monthHours <= 0 || dailyHours <= 0) {
    return { main: { label: '해고예고수당', value: '—', color: 'var(--text-tertiary)' }, details: [{ label: '사유', value: '주·1일 소정근로시간을 0보다 크게 넣는다' }] };
  }
  return {
    main: { label: `해고예고수당 (법정 최소 ${A2_LAW.noticeDays}일분)`, value: fmt(p.pay) },
    details: [
      { label: '월 통상임금', value: fmt(monthly) },
      { label: '월 통상임금 산정 기준시간', value: `${p.monthHours}시간 (주 ${Number(p.weeklyPaidHours.toFixed(2))}시간 × 365 ÷ 7 ÷ 12 = ${p.monthHoursExact.toFixed(2)}, 반올림 — 고용노동부 실무 209시간과 같은 방식)` },
      { label: '시간급 통상임금 (월급 ÷ 기준시간, 시행령 §6②4호)', value: fmt(r(p.hourly)) },
      { label: `1일 통상임금 (시간급 × ${dailyHours}시간, 시행령 §6③)`, value: fmt(r(p.daily)) },
      { label: `× ${A2_LAW.noticeDays}일 (근로기준법 §26)`, value: fmt(p.pay) },
      { label: '참고: 기준시간을 반올림하지 않으면', value: fmt(p.payExact) },
      { label: '⚠️ 30일분 «이상»', value: '법정 최소액이다. 30일 전에 예고했으면 수당 의무가 없다' },
      { label: '⚠️ 적용 제외', value: '계속 근로 3개월 미만(위 선택) · 천재·사변 등으로 사업 계속 불가 · 근로자의 고의로 막대한 손해(고용노동부령 사유) — §26 단서' },
      { label: '⚠️ 미반영', value: '세금·4대보험(세전 금액) · 통상임금에 들어가는 수당 판정 — 월 통상임금은 직접 넣는다' },
      { label: '근거', value: '근로기준법 제26조 · 근로기준법 시행령 제6조 (eflaw 현행 판 대조 2026-09-17)' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 — 정책 꾸러미 읽기 (fin.ts 와 같은 모양: 없는 키는 기본값으로 때우지 않는다)
// ─────────────────────────────────────────────────────────────────────────────

function load(v: V, pctKeys: string[], amtKeys: string[] = []) {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const missing = [...pctKeys.filter((k) => typeof P[k] !== 'number'), ...amtKeys.filter((k) => typeof A[k] !== 'number')];
  return { P, A, meta: (pack?.meta ?? {}) as Meta, missing };
}

function noPolicy(what: string): CalcResult {
  return {
    main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
    details: [{ label: '사유', value: `${what} 기준을 아직 받지 못했다. 잠시 후 다시 시도한다` }],
  };
}

function sourceRow(meta: Meta, keys: string[]): Row[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const k of keys) {
    const s = meta[k]?.source;
    if (s && !seen.has(s)) { seen.add(s); parts.push(s); }
  }
  return parts.length ? [{ label: '근거', value: parts.join(' · ') }] : [];
}

// ═════════════════════════════════════════════════════════════════════════════
// 3·4. business-income-tax · freelancer-tax — 소득세법 §50①·§55①·§59의4⑨2나 · 지방세법 §92①
// ═════════════════════════════════════════════════════════════════════════════

/** 재사용 행: 기본공제 1명당(§50①) · 표준세액공제 근로소득 없는 종합소득자(§59의4⑨2나) · 지방소득세 비율. */
export const BIZ_TAX_AMT = ['pension_basic_ded', 'pension_std_credit'];
export const BIZ_TAX_PCT = ['int_tax_local'];

export interface BizTaxParts {
  income: number;
  loss: number;
  persons: number;
  basic: number;
  other: number;
  base: number;
  calc: number;
  stdCredit: number;
  tax: number;
  local: number;
  total: number;
}

/**
 * 사업소득만 있는 거주자의 종합소득세 근사 — business-income-tax · freelancer-tax 가 «같은» 함수를 쓴다(이중 진실 금지).
 *
 * ⛔ 옛 코드(두 계산기 공통): 과세표준 = 소득 − «500만원(공제 근사)». 500만은 어느 조문에도 없는 숫자다.
 *    법: 기본공제 1명당 150만원(§50①) + 그 밖의 소득공제(사용자 입력) → 기본세율(§55①)
 *        → 표준세액공제 7만원(§59의4⑨2나 — 특별세액공제 신청 없는 비근로 종합소득자, 성실사업자 제외) → 결정세액.
 *    지방소득세: 지방세법 §92① 표준세율표가 §55① 의 정확히 1/10 이라 산출세액의 10% 와 같다 — 세액공제 후 10% 로 근사.
 */
export function bizTaxParts(incomeIn: number, personsIn: number, otherDed: number, P: Record<string, number>, A: Record<string, number>): BizTaxParts {
  const income = r(incomeIn);
  const loss = income < 0 ? -income : 0;
  const pos = Math.max(0, income);
  const persons = Math.max(1, Math.floor(personsIn || 1));
  const basic = A.pension_basic_ded * persons;
  const other = Math.max(0, r(otherDed));
  const base = Math.max(0, pos - basic - other);
  const calc = r(calcProgressiveTax(base, INCOME_TAX_BRACKETS));
  const stdCredit = Math.min(calc, A.pension_std_credit);
  const tax = calc - stdCredit;
  const local = r(tax * P.int_tax_local / 100);
  return { income, loss, persons, basic, other, base, calc, stdCredit, tax, local, total: tax + local };
}

function bizTaxRows(t: BizTaxParts, P: Record<string, number>, A: Record<string, number>): Row[] {
  return [
    { label: `기본공제 (1명당 ${fmt(A.pension_basic_ded)} × ${t.persons}명, §50①)`, value: fmt(t.basic) },
    ...(t.other > 0 ? [{ label: '그 밖의 소득공제 (입력)', value: fmt(t.other) }] : []),
    { label: '과세표준', value: fmt(t.base) },
    { label: '산출세액 (기본세율 §55①)', value: fmt(t.calc) },
    { label: '표준세액공제 (§59의4⑨2나)', value: `−${fmt(t.stdCredit)}` },
    { label: '종합소득세 (결정세액)', value: fmt(t.tax) },
    { label: `지방소득세 (${P.int_tax_local}% 근사 — 지방세법 §92① 표준세율 = 기본세율의 1/10)`, value: fmt(t.local) },
  ];
}

const optNum = (x: unknown, dflt: number) => (x === undefined || x === '' ? dflt : n(x));

export function businessIncomeTax(v: V): CalcResult {
  const L = load(v, BIZ_TAX_PCT, BIZ_TAX_AMT);
  if (L.missing.length) return noPolicy('기본공제·표준세액공제');
  const t = bizTaxParts(n(v.revenue) - n(v.expenses), optNum(v.persons, 1), n(v.otherDeductions), L.P, L.A);
  return {
    main: { label: '사업소득세 + 지방소득세', value: fmt(t.total) },
    details: [
      { label: '사업소득금액 (총수입 − 필요경비)', value: fmt(Math.max(0, t.income)) },
      ...(t.loss > 0 ? [{ label: '결손금 (세액 0원 — 다른 종합소득에서 공제·이월될 수 있다)', value: fmt(t.loss) }] : []),
      ...bizTaxRows(t, L.P, L.A),
      { label: '⚠️ 미반영', value: '연금보험료·노란우산 등 소득공제는 «그 밖의 소득공제» 에 직접 넣는다. 기장세액공제·성실사업자 표준세액공제(더 크다)·중간예납·기납부세액·다른 종합소득 합산은 계산하지 않았다' },
      ...sourceRow(L.meta, ['pension_basic_ded', 'pension_std_credit']),
      { label: '근거(누진·지방세)', value: '소득세법 제55조제1항 · 지방세법 제92조제1항 (eflaw 현행 판 대조 2026-09-17)' },
    ],
  };
}

export function freelancerTax(v: V): CalcResult {
  const L = load(v, BIZ_TAX_PCT, BIZ_TAX_AMT);
  if (L.missing.length) return noPolicy('기본공제·표준세액공제');
  const rev = Math.max(0, n(v.annualRevenue));
  const ratePct = Math.min(100, Math.max(0, n(v.expenseRate)));
  const expenses = r(rev * ratePct / 100);
  const t = bizTaxParts(rev - expenses, optNum(v.persons, 1), n(v.otherDeductions), L.P, L.A);
  const withheld = Math.max(0, n(v.withheld));
  const refund = withheld - t.total;
  return {
    main: {
      label: refund >= 0 ? '예상 환급' : '추가 납부',
      value: fmt(Math.abs(refund)),
      color: refund >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
    },
    details: [
      { label: `필요경비 (수입 × 경비율 ${ratePct}%)`, value: fmt(expenses) },
      { label: '사업소득금액', value: fmt(t.income) },
      ...bizTaxRows(t, L.P, L.A),
      { label: '세금 합계 (소득세 + 지방소득세)', value: fmt(t.total) },
      { label: '기납부세액 (3.3% 원천징수 합계, 입력)', value: fmt(withheld) },
      { label: '⚠️ 경비율', value: '단순경비율은 직전 과세기간 수입금액이 업종별 기준에 미달하는 사업자만 쓸 수 있다(소득세법 시행령 §143④). 넘으면 기준경비율·장부로 계산돼 세액이 크게 늘 수 있다. 기본값 64.1% 는 예시값이다 — 국세청 고시에서 본인 업종코드의 율을 넣는다' },
      { label: '⚠️ 미반영', value: '연금보험료 등 소득공제는 «그 밖의 소득공제» 에 직접 넣는다. 성실사업자 표준세액공제(더 크다)·다른 종합소득 합산·국민연금·건강보험 지역가입자 보험료는 계산하지 않았다' },
      ...sourceRow(L.meta, ['pension_basic_ded', 'pension_std_credit']),
      { label: '근거(누진·지방세)', value: '소득세법 제55조제1항 · 지방세법 제92조제1항 (eflaw 현행 판 대조 2026-09-17)' },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. credit-loan-est — 행정지도(규제 공개형): 신용대출 한도 차주 연소득 이내
// ═════════════════════════════════════════════════════════════════════════════

/** 법령이 아니라 금융당국 가계부채 관리 조치 — 공개형(대표값 + 기준일 + 검증 단계). */
export const CREDIT_LOAN_CAP_SOURCE = {
  title: '금융위원회 보도자료 「긴급 가계부채 점검회의」 — 수도권 중심의 「가계부채 관리 강화 방안」',
  url: 'https://www.fsc.go.kr/no010101/84824',
  announced: '2025-06-27',
  effective: '2025-06-28',
  /** 「차주별 연소득 이내」(종전 연소득 1~2배) — 전 금융권. */
  incomeMultiple: 1,
  /** 옮겨 적은 날(렌더 시각 아님). */
  transcribedAt: '2026-09-17',
  verification: '보도자료 본문 대조(요약) — 이후 완화·변경 여부는 카더라가 추적하지 않았다',
} as const;

/**
 * ⛔ 옛 코드: 연소득 × 등급별 배수(1등급 3.0 · 3등급 2.5 · 5등급 2.0 · 7등급 1.0). 배수는 근거 없는 가정이고,
 *    2025-06-28 부터 전 금융권 신용대출 한도는 «차주별 연소득 이내» 다 — 옛 값은 규제 상한의 최대 3배를 「추정 한도」 로 보여줬다.
 *    연소득 5,000만·3등급: 옛 125,000,000원 → 상한 50,000,000원.
 *    등급은 상한을 올리지 못한다 — 입력에서 뺐다(실제 한도는 상한 이하에서 은행 심사).
 */
export function creditLoanEst(v: V): CalcResult {
  const income = Math.max(0, r(n(v.annualIncome)));
  const S = CREDIT_LOAN_CAP_SOURCE;
  const cap = income * S.incomeMultiple;
  return {
    main: { label: '신용대출 한도 상한 (연소득 이내)', value: fmt(cap) },
    details: [
      { label: '연소득', value: fmt(income) },
      { label: '상한', value: `연소득의 ${S.incomeMultiple}배 이내 — 전 금융권 (${S.effective} 시행)` },
      { label: '⚠️ 성격', value: '넘을 수 없는 «상한» 이지 받을 수 있는 금액이 아니다. 실제 한도는 신용점수·재직·기존 대출·DSR(dsr-calc 계산기) 심사로 이보다 작게 정해진다' },
      { label: '⚠️ 규제 성격', value: `법령이 아니라 금융당국 가계부채 관리 조치다. ${S.verification} (옮겨 적은 날 ${S.transcribedAt})` },
      { label: '근거', value: `${S.title} (${S.announced}) ${S.url}` },
    ],
  };
}
