// 한국 세금 세율표 및 공제 데이터 (2026년 기준)

// ── 소득세 누진세율 (소득세법 제55조) ──
export const INCOME_TAX_BRACKETS = [
  { min: 0, max: 14000000, rate: 0.06, deduction: 0 },
  { min: 14000000, max: 50000000, rate: 0.15, deduction: 1260000 },
  { min: 50000000, max: 88000000, rate: 0.24, deduction: 5760000 },
  { min: 88000000, max: 150000000, rate: 0.35, deduction: 15440000 },
  { min: 150000000, max: 300000000, rate: 0.38, deduction: 19940000 },
  { min: 300000000, max: 500000000, rate: 0.40, deduction: 25940000 },
  { min: 500000000, max: 1000000000, rate: 0.42, deduction: 35940000 },
  { min: 1000000000, max: Infinity, rate: 0.45, deduction: 65940000 },
];

// ── 취득세율 (지방세법 제11조) ──
export const ACQUISITION_TAX_RATES = {
  housing: [
    { max: 600000000, rate: 0.01 },     // 6억 이하
    { max: 900000000, rate: 0.02 },     // 6~9억 (1~3% 점진)
    { max: Infinity, rate: 0.03 },       // 9억 초과
  ],
  housingMulti: {                        // 다주택자 중과
    twoHouse: { regulated: 0.08, normal: 0.01 },
    threeHouse: { regulated: 0.12, normal: 0.01 },
  },
  commercial: 0.04,                      // 상가/토지
  farm: 0.03,                            // 농지
  luxury: 0.12,                          // 고급주택
};

// ── 양도소득세 (소득세법 제104조) ──
export const CAPITAL_GAINS_TAX = {
  general: INCOME_TAX_BRACKETS,          // 일반 누진세율
  shortTerm: { under1y: 0.70, under2y: 0.60 },  // 단기양도 (투기)
  multiHouse: { two: 0.20, three: 0.30 },        // 다주택 중과 가산
  exemption: 12_0000_0000,               // 1세대1주택 비과세 기준 (12억)
  longTermDeduction: [                    // 장기보유특별공제
    { years: 3, rate: 0.06 }, { years: 4, rate: 0.08 }, { years: 5, rate: 0.10 },
    { years: 6, rate: 0.12 }, { years: 7, rate: 0.14 }, { years: 8, rate: 0.16 },
    { years: 9, rate: 0.18 }, { years: 10, rate: 0.20 }, { years: 11, rate: 0.22 },
    { years: 12, rate: 0.24 }, { years: 13, rate: 0.26 }, { years: 14, rate: 0.28 },
    { years: 15, rate: 0.30 },
  ],
  oneHouseLTD: [                          // 1세대1주택 장특공제 (보유+거주)
    { years: 3, hold: 0.12, live: 0.12 },
    { years: 4, hold: 0.16, live: 0.16 },
    { years: 5, hold: 0.20, live: 0.20 },
    { years: 6, hold: 0.24, live: 0.24 },
    { years: 7, hold: 0.28, live: 0.28 },
    { years: 8, hold: 0.32, live: 0.32 },
    { years: 9, hold: 0.36, live: 0.36 },
    { years: 10, hold: 0.40, live: 0.40 },
  ],
};

// ── 재산세 (지방세법 제111조) ──
export const PROPERTY_TAX_RATES = {
  housing: [
    { max: 60000000, rate: 0.001 },
    { max: 150000000, rate: 0.0015, deduction: 30000 },
    { max: 300000000, rate: 0.0025, deduction: 180000 },
    { max: Infinity, rate: 0.004, deduction: 630000 },
  ],
  fairMarketRatio: 0.60,                // 공정시장가액비율 (2026)
};

// ── 종합부동산세 (종부세법) ──
export const COMPREHENSIVE_PROPERTY_TAX = {
  exemption: { general: 900000000, oneHouse: 1200000000 },
  rates: [
    { max: 300000000, rate: 0.005 },
    { max: 600000000, rate: 0.007 },
    { max: 1200000000, rate: 0.01 },
    { max: 2500000000, rate: 0.013 },
    { max: 5000000000, rate: 0.02 },
    { max: Infinity, rate: 0.027 },
  ],
  fairMarketRatio: 0.60,
};

// ── 증여세 (상속세및증여세법 제26조) ──
export const GIFT_TAX_BRACKETS = [
  { max: 100000000, rate: 0.10, deduction: 0 },
  { max: 500000000, rate: 0.20, deduction: 10000000 },
  { max: 1000000000, rate: 0.30, deduction: 60000000 },
  { max: 3000000000, rate: 0.40, deduction: 160000000 },
  { max: Infinity, rate: 0.50, deduction: 460000000 },
];

export const GIFT_EXEMPTIONS = {
  spouse: 600000000,
  adultChild: 50000000,
  minorChild: 20000000,
  otherRelative: 10000000,
  generationSkip: 1.3,                  // 세대생략 30% 할증
};

// ── 상속세 ──
export const INHERITANCE_TAX = {
  brackets: GIFT_TAX_BRACKETS,          // 증여세와 동일 세율
  basicDeduction: 500000000,            // 기초공제 5억
  spouseDeduction: { min: 500000000, max: 3000000000 },
  lumpDeduction: 500000000,             // 일괄공제 5억
};

// ── 4대보험 요율 (2026) ──
export const SOCIAL_INSURANCE_RATES = {
  nationalPension: { employee: 0.045, employer: 0.045 },
  healthInsurance: { employee: 0.03545, employer: 0.03545 },
  longTermCare: 0.1295,                 // 건강보험료의 12.95%
  employmentInsurance: { employee: 0.009, employer: 0.009 },
};

// ── 연말정산 세액공제율 ──
export const YEAR_END_DEDUCTIONS = {
  pensionSavings: { maxAmount: 6000000 },
  irp: { maxAmount: 9000000 },          // 연금저축+IRP 합산
  creditCard: {
    threshold: 0.25,                     // 총급여 25% 초과분
    rates: { credit: 0.15, debit: 0.30, cash: 0.30, traditional: 0.40, culture: 0.30 },
    maxDeduction: { under7000: 3000000, over7000: 2500000, over12000: 2000000 },
  },
  medical: { threshold: 0.03, rate: 0.15, maxNone: true },
  education: { self: -1, child: 3000000, preschool: 3000000 },
  donation: { legal: 1.0, designated: 0.30, political: 100000 },
  monthlyRent: { maxSalary: 80000000, rate: 0.17, max: 10000000 },
  insurance: { maxAmount: 1000000, rate: 0.12 },
  childCredit: [0, 150000, 350000, 350000],  // 1/2/3명+
};

// ── 중개수수료율 (공인중개사법 시행규칙) ──
export const BROKERAGE_RATES = {
  trade: [
    { max: 50000000, rate: 0.006, maxFee: 250000 },
    { max: 200000000, rate: 0.005, maxFee: 800000 },
    { max: 600000000, rate: 0.004, maxFee: null },
    { max: 900000000, rate: 0.005, maxFee: null },
    { max: Infinity, rate: 0.009, maxFee: null },
  ],
  lease: [
    { max: 50000000, rate: 0.005, maxFee: 200000 },
    { max: 100000000, rate: 0.004, maxFee: 300000 },
    { max: 600000000, rate: 0.003, maxFee: null },
    { max: 300000000, rate: 0.004, maxFee: null },
    { max: Infinity, rate: 0.008, maxFee: null },
  ],
};

// ── 전월세 전환율 ──
export const JEONSE_CONVERSION_RATE = 0.045; // 2026년 기준 (한국은행 기준금리 + 2%)

// ── 국민연금 수령 테이블 ──
export const NATIONAL_PENSION = {
  contributionRate: 0.09,               // 9% (근로자+사업주 각 4.5%)
  maxIncome: 5900000,                   // 상한액 월 590만원
  minIncome: 370000,                    // 하한액 월 37만원
  startAge: { born1969plus: 65 },       // 수령 시작 연령
};

// ── 공통 유틸 ──
export function calcProgressiveTax(amount: number, brackets: {min:number;max:number;rate:number;deduction:number}[]): number {
  for (const b of brackets) {
    if (amount <= b.max) return Math.max(0, amount * b.rate - b.deduction);
  }
  const last = brackets[brackets.length - 1];
  return amount * last.rate - last.deduction;
}

export function formatKRW(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(n % 100000000 === 0 ? 0 : 1)}억원`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만원`;
  return `${Math.round(n).toLocaleString()}원`;
}

export function formatPercent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
