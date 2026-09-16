/**
 * 정부·공사 고시표 상수 파이프 — K-2 (2026-09-16).
 *
 * 왜 이 파일이 생겼나: 계산기 두 종이 «지어낸 공식» 으로 답을 내고 있었다.
 *   · housingBond   — 매입률을 「수도권 5% / 그 외 3%」 단일값으로 박았다.
 *                     실제 매입률은 시가표준액 «구간별 누진» 이라 구조 자체가 틀렸다.
 *                     실측 오차: 5억 특별시 기준 5.0% vs 2.6% — 약 2배 과대.
 *   · housingPension — `0.02 + (age-55)*0.002` 라는 «근거 없는» 비율식.
 *                     실측 오차: 70세·5억 기준 월 208만 vs 공사 표 153.9만 — 약 35% 과대.
 *                     결과 화면에 「정확한 수령액은 공사 시뮬레이터 확인」이 붙어 있었다 —
 *                     못 믿는다는 자백이 이미 코드에 있었던 셈이다.
 *
 * ⛔ 이 파일의 숫자는 «옮겨 적은 것» 이다. 계산으로 만들어 내지 않는다.
 *    새 값을 넣을 때는 출처 URL·기준일·교차 여부를 «같은 커밋에서» 함께 적는다.
 *    (llms.txt 정책: 제도 수치는 법령·정부 발표 원문과 확인일을 둔 상수표에서만 인용)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. 제1종 국민주택채권 매입률 — 부동산 소유권 이전등기(매매) · 주택
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ 이 표는 «매매로 인한 소유권 이전등기 · 주택» 한 갈래다.
 *    상속·증여·소유권 보존등기, 토지·주택 외 건물은 «다른 표» 를 쓴다.
 *    계산기가 지역·시가표준액만 묻고 있으므로 그 전제를 화면에도 적는다.
 */
export const HOUSING_BOND_SOURCE = {
  law: '주택도시기금법 시행령 [별표] 제1종국민주택채권 매입대상자 및 매입기준(제8조제2항 관련)',
  url: 'https://www.law.go.kr/법령/주택도시기금법시행령',
  /** 값을 옮겨 적은 날. 「거짓 신선도」를 막으려고 렌더 시각이 아니라 이 날짜를 쓴다. */
  transcribedAt: '2026-09-16',
  /** ⚠️ 원문 별표 직접 대조는 세션 A 몫이다. 지금은 2차 출처 2곳 교차까지만 됐다. */
  crossChecked: false as boolean,
} as const;

export interface BondRateBracket {
  /** 시가표준액 하한 (원, 이상) */
  min: number;
  /** 시가표준액 상한 (원, 미만). null = 상한 없음 */
  max: number | null;
  /** 특별시·광역시 매입률 (1,000분율) */
  metro: number;
  /** 그 밖의 지역 매입률 (1,000분율). ⛔ null = «원문 미확인» — 0 이 아니다 */
  other: number | null;
}

/** 시가표준액 2,000만원 미만은 매입 대상이 아니다(이 표에 구간이 없다). */
export const HOUSING_BOND_RATES: readonly BondRateBracket[] = [
  // ⚠️ 최저 구간의 「그 밖의 지역」은 2차 출처에서 공란으로 나왔다.
  //    「0」으로 채우지 않는다 — 모르는 것과 없는 것은 다르다. 세션 A 교차 대상.
  { min: 20_000_000, max: 50_000_000, metro: 13, other: null },
  { min: 50_000_000, max: 100_000_000, metro: 19, other: 14 },
  { min: 100_000_000, max: 160_000_000, metro: 21, other: 16 },
  { min: 160_000_000, max: 260_000_000, metro: 23, other: 18 },
  { min: 260_000_000, max: 600_000_000, metro: 26, other: 21 },
  { min: 600_000_000, max: null, metro: 31, other: 26 },
];

/**
 * 시가표준액·지역 → 매입률(1,000분율). 모르면 null 을 돌려준다.
 * ⛔ 폴백 금지 — 표에 없는 구간을 「가장 가까운 값」으로 때우지 않는다.
 */
export function bondRatePerMille(price: number, metro: boolean): number | null {
  if (!Number.isFinite(price) || price < 20_000_000) return 0; // 매입 대상 아님
  for (const b of HOUSING_BOND_RATES) {
    if (price >= b.min && (b.max === null || price < b.max)) {
      return metro ? b.metro : b.other;
    }
  }
  return null;
}

/**
 * 즉시매도 할인율은 «상수가 아니다».
 * 시장금리를 따라 매일 고시된다. 예전 코드가 0.04 를 박아 두고 「약 4%」라 적어 둔 것은
 * 거짓 신선도였다 — 코드가 바뀌지 않으니 몇 년이 지나도 같은 값을 「오늘의 값」처럼 보였다.
 * 그래서 값을 «묻고», 어디서 보는지 알려 준다.
 */
export const BOND_DISCOUNT_LOOKUP_URL =
  'https://nhuf.molit.go.kr/FP/FP07/FP0705/FP070509.jsp';

// ─────────────────────────────────────────────────────────────────────────────
// 2. 주택연금 월지급금 — 일반주택 · 종신지급방식 · 정액형
// ─────────────────────────────────────────────────────────────────────────────

export const HOUSING_PENSION_SOURCE = {
  issuer: '한국주택금융공사(HF) 월지급금 예시',
  url: 'https://www.hf.go.kr/ko/sub03/sub03_01_01_02.do',
  /** 공사가 고시한 «적용 기준일». 이 값이 바뀌면 표를 통째로 갈아야 한다. */
  effectiveFrom: '2026-03-01',
  transcribedAt: '2026-09-16',
  crossChecked: false as boolean,
  conditions: '일반주택 · 종신지급방식 · 정액형',
} as const;

/** 표의 연령 축(세). 표에 없는 나이는 사이를 «보간» 한다. */
export const PENSION_AGES: readonly number[] = [55, 60, 65, 70, 75, 80];

/** 표의 주택가격 축(원). 1억 ~ 12억. */
export const PENSION_PRICES: readonly number[] = [
  100_000_000, 200_000_000, 300_000_000, 400_000_000, 500_000_000, 600_000_000,
  700_000_000, 800_000_000, 900_000_000, 1_000_000_000, 1_100_000_000, 1_200_000_000,
];

/**
 * 월지급금 (단위: 천원). 행 = PENSION_AGES, 열 = PENSION_PRICES.
 *
 * ⚠️ 고령·고가 구간이 «평평해지는» 것은 오타가 아니라 대출한도 상한 때문이다.
 *    그래서 가격축 보간은 반드시 «격자 사이» 로만 한다 — 전체를 직선으로 보면
 *    상한을 넘는 금액이 나온다(예전 공식이 정확히 그 병이었다).
 */
export const PENSION_MONTHLY_THOUSAND: readonly (readonly number[])[] = [
  /* 55세 */ [156, 312, 468, 624, 780, 936, 1092, 1248, 1404, 1560, 1716, 1872],
  /* 60세 */ [210, 421, 632, 842, 1053, 1264, 1475, 1685, 1896, 2107, 2318, 2528],
  /* 65세 */ [252, 505, 758, 1011, 1264, 1517, 1770, 2023, 2276, 2529, 2782, 3035],
  /* 70세 */ [307, 615, 923, 1231, 1539, 1847, 2155, 2462, 2770, 3078, 3386, 3414],
  /* 75세 */ [381, 762, 1143, 1525, 1906, 2287, 2669, 3050, 3431, 3666, 3666, 3666],
  /* 80세 */ [483, 966, 1449, 1932, 2416, 2899, 3382, 3865, 4060, 4060, 4060, 4060],
];

/** 가입 하한 연령. 이보다 어리면 «계산하지 않는다» — 0 을 돌려주지 않는다. */
export const PENSION_MIN_AGE = 55;

/** 이 표가 다루는 주택가격 상한. 넘으면 상한에서 잰다(표의 마지막 열). */
export const PENSION_MAX_PRICE = 1_200_000_000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 축 위에서 값 v 의 위치를 (아래index, 위index, 비율) 로. 격자 «사이» 만 본다. */
function locate(axis: readonly number[], v: number): [number, number, number] {
  if (v <= axis[0]) return [0, 0, 0];
  const last = axis.length - 1;
  if (v >= axis[last]) return [last, last, 0];
  for (let i = 0; i < last; i++) {
    if (v >= axis[i] && v <= axis[i + 1]) {
      return [i, i + 1, (v - axis[i]) / (axis[i + 1] - axis[i])];
    }
  }
  return [last, last, 0];
}

/**
 * 나이·주택가격 → 예상 월지급금(원). 표를 격자 보간해서 낸다.
 * 가입 연령 미만이면 null — «못 받는다» 와 «0원» 은 다른 말이다.
 *
 * ⛔ 이 값은 «예시표 보간» 이지 공사의 확정 산출이 아니다. 화면에 그렇게 적는다.
 */
export function pensionMonthly(price: number, age: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(age)) return null;
  if (age < PENSION_MIN_AGE) return null;
  const p = Math.min(Math.max(price, 0), PENSION_MAX_PRICE);
  const [a0, a1, at] = locate(PENSION_AGES, age);
  const [p0, p1, pt] = locate(PENSION_PRICES, p);
  const low = lerp(PENSION_MONTHLY_THOUSAND[a0][p0], PENSION_MONTHLY_THOUSAND[a0][p1], pt);
  const high = lerp(PENSION_MONTHLY_THOUSAND[a1][p0], PENSION_MONTHLY_THOUSAND[a1][p1], pt);
  return Math.round(lerp(low, high, at) * 1000);
}
