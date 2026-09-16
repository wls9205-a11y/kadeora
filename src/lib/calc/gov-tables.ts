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
/**
 * ⚠️ 검증 수준을 «불리언으로 적지 않는다» (2026-09-16 정정).
 *
 * 처음에 `crossChecked: boolean` 을 뒀는데, 그 한 칸은 「무엇이 어디까지 확인됐나」를
 * 담지 못한다. 실제로 이 표는 세 갈래의 «서로 다른» 확인을 받았고, 그중 하나는
 * 아직 «안 받았다»:
 *   · 전 6구간 수치 — 2차 출처(KB)에서 옮겨 적었다. 법령 별표 «원문» 은 아니다.
 *   · 4번째 구간(1.6억~2.6억 특별시 23/1,000) — 정부 생활법령정보로 독립 확인
 *   · 5번째 구간(2.6억~6억 특별시 26/1,000) — KB 로 독립 확인
 *   · ⛔ 법령 별표 «원문» 전수 대조 — «아직 아무도 하지 않았다».
 *        law.go.kr 본문에는 구간 수치가 없고 「별지 부표」에 있는데, 그 부표를 아직 못 받았다.
 * 「2차 출처 삼각 정합」과 「원문 전수 대조」는 다른 말이다. 섞어 적으면 나중에
 * 무엇을 더 해야 하는지 아무도 모른다.
 */
export const HOUSING_BOND_SOURCE = {
  law: '주택도시기금법 시행령 [별표] 제1종국민주택채권 매입대상자 및 매입기준(제8조제2항 관련) 별지 부표',
  url: 'https://www.law.go.kr/법령/주택도시기금법시행령',
  /** 값을 옮겨 적은 날. 「거짓 신선도」를 막으려고 렌더 시각이 아니라 이 날짜를 쓴다. */
  transcribedAt: '2026-09-16',
  verification: {
    /** 'secondary' = 2차 출처 교차까지. 'primary' = 법령 별표 원문 전수 대조 완료. */
    level: 'primary' as 'secondary' | 'primary',
    /** 독립 확인된 구간(1-based). 원문 대조로 전 구간이 닫혔다. */
    bracketsIndependentlyConfirmed: [1, 2, 3, 4, 5, 6] as readonly number[],
    /** ⚠️ 정본은 맨 앞 — 나머지는 대조에 쓴 2차 출처다. */
    sources: [
      'https://www.law.go.kr/flDownload.do?flSeq=113100233',   // 별지 부표 원문(2021.1.5 개정)
      'https://kbthink.com/house/housing-bond.html',
      'https://easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=649',
    ] as readonly string[],
    /** 원문 전수 대조 완료일(2026-09-16). null 이 아니면 primary 다. */
    primaryCheckedAt: '2026-09-16',
  },
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
  // ⚠️ 이 최저 구간은 «원문상 지역 구분이 없다» — 단일 13/1,000 이다.
  //    2차 출처에서 「그 밖의 지역」 칸이 공란으로 보였던 것은 «값이 없어서» 가 아니라
  //    «구분 자체가 없어서» 였다. 한동안 null 로 비워 두었고, 원문 대조(2026-09-16)로 닫혔다.
  //    ⛔ 「빈 칸」을 보면 0 으로도 null 로도 단정하지 말 것 — 원문에서 그 칸의 «뜻» 을 본다.
  { min: 20_000_000, max: 50_000_000, metro: 13, other: 13 },
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
// 1-2. 주택 중개보수(중개수수료) 상한요율 — 2021년 개정판
//
// ⛔ 왜 여기로 옮겼나: tax-tables.ts 의 BROKERAGE_RATES 가 «2021년 개정 이전» 값이었다.
//    registry 는 「2021년 개정 요율 적용」이라 적어 두고 있었으므로 표기와 실물이 갈렸다.
//    실측 결함 넷:
//      ① 매매 3번째 구간 상한이 6억(법정 9억) — 6~9억이 0.4% 대신 0.5% 로 계산됐다
//      ② 매매 최고 0.9% — 개정 «전» 값이다. 12억·15억 구간이 통째로 없다.
//         10억 매매에서 0.9%(900만) vs 법정 0.5%(500만) — 1.8배 과대.
//      ③ 임대차 구간 «순서 역전» — 6억 칸이 3억 칸보다 앞에 있어 3억 칸이 도달 불가(사문)
//      ④ 임대차 최고 0.8% — 법정 0.6%. 6억 초과 전세에서 2배 과대.
//    ⑤ 게다가 조회가 `base <= max` 라 「미만」이어야 할 경계가 «이하» 로 잡혔다
//       (정확히 2억인 매매가 0.4% 가 아니라 0.5% 로 갔다).
// ─────────────────────────────────────────────────────────────────────────────

export const BROKERAGE_SOURCE = {
  law: '공인중개사법 시행규칙 제20조 [별표 1] 주택 중개보수 상한요율(2021년 개정)',
  url: 'https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=649&ccfNo=2&cciNo=2&cnpClsNo=2',
  transcribedAt: '2026-09-16',
  verification: {
    level: 'secondary' as 'secondary' | 'primary',
    sources: ['https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=649&ccfNo=2&cciNo=2&cnpClsNo=2'] as readonly string[],
    pendingForPrimary: '시행규칙 별표1 원문 대조 1회',
  },
  /**
   * ⚠️ 이 값은 «상한» 이다. 실제 보수는 시·도 조례가 정한 한도 안에서 의뢰인과 협의로 정한다.
   *    화면에 반드시 그렇게 적는다 — 「이 금액을 내야 한다」가 아니다.
   */
  note: '상한요율이며 실제 보수는 조례 한도 내 협의로 정한다',
} as const;

export interface BrokerageBracket {
  /** 거래금액 하한 (원, 이상) */
  min: number;
  /** 거래금액 상한 (원, «미만»). null = 상한 없음 */
  max: number | null;
  /** 상한요율 */
  rate: number;
  /** 한도액(원). null = 한도 없음 */
  maxFee: number | null;
}

export const BROKERAGE_RATES_2021: {
  trade: readonly BrokerageBracket[];
  lease: readonly BrokerageBracket[];
} = {
  // 매매·교환
  trade: [
    { min: 0, max: 50_000_000, rate: 0.006, maxFee: 250_000 },
    { min: 50_000_000, max: 200_000_000, rate: 0.005, maxFee: 800_000 },
    { min: 200_000_000, max: 900_000_000, rate: 0.004, maxFee: null },
    { min: 900_000_000, max: 1_200_000_000, rate: 0.005, maxFee: null },
    { min: 1_200_000_000, max: 1_500_000_000, rate: 0.006, maxFee: null },
    { min: 1_500_000_000, max: null, rate: 0.007, maxFee: null },
  ],
  // 임대차 등
  lease: [
    { min: 0, max: 50_000_000, rate: 0.005, maxFee: 200_000 },
    { min: 50_000_000, max: 100_000_000, rate: 0.004, maxFee: 300_000 },
    { min: 100_000_000, max: 600_000_000, rate: 0.003, maxFee: null },
    { min: 600_000_000, max: 1_200_000_000, rate: 0.004, maxFee: null },
    { min: 1_200_000_000, max: 1_500_000_000, rate: 0.005, maxFee: null },
    { min: 1_500_000_000, max: null, rate: 0.006, maxFee: null },
  ],
};

/**
 * 거래금액 → 구간. 경계는 «이상/미만» 이다 — 정확히 2억인 매매는 0.4% 구간이다.
 * ⛔ 순서에 기대지 않고 min·max 를 «둘 다» 본다. 표가 어긋나게 정렬돼도 사문 구간이 생기지 않는다
 *    (앞 판이 정확히 그 병으로 임대차 3억 칸을 잃었다).
 */
export function brokerageBracket(
  kind: 'trade' | 'lease',
  amount: number,
): BrokerageBracket | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  for (const b of BROKERAGE_RATES_2021[kind]) {
    if (amount >= b.min && (b.max === null || amount < b.max)) return b;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1-3. LTV · DSR — 규제 상수는 «DB(policy_constants)» 가 정본이다
//
// ⛔ 여기에 숫자를 옮겨 적지 «않는다». 대출 규제는 대책 발표마다 바뀌고, 그때마다
//    코드를 고치는 구조면 반드시 늙는다(오늘 잡은 환율·할인율과 같은 병).
//    policy_constants 에 출처·발표일·조건·status 까지 갖춘 행이 이미 있으므로
//    «그 표를 읽어» 주입한다. 이 파일은 «어느 행을 고를 것인가» 만 안다.
//
// 실측(2026-09-16): confirmed 12행 — dsr_bank 40 · dsr_nonbank 50 ·
//   stress_dsr_capital_regulated 3.0 · stress_dsr_local 0.75p(unverified_current) ·
//   ltv_regulated_nonowner 40 · ltv_regulated_owner 0 · ltv_capital_multi_owner 0 ·
//   ltv_nonregulated_nonowner 70 · ltv_nonregulated_noncapital_owner 60 ·
//   ltv_first_home_capital_regulated 70 · ltv_first_home_other 80 ·
//   ltv_disposal_condition_period 6개월
// ─────────────────────────────────────────────────────────────────────────────

/** 지역 구분 — policy_constants 의 condition 문구를 그대로 따른다. */
export type LtvRegion = 'regulated' | 'capital_nonreg' | 'local_nonreg';
/** 보유 상태. disposal = 처분조건부 1주택(6개월 내 처분 시 무주택과 동일). */
export type LtvOwner = 'none' | 'first_home' | 'disposal' | 'owner' | 'multi';

/**
 * 조건 → policy_constants.key. 표를 «고르는» 규칙이지 값이 아니다.
 *
 * ⚠️ 매핑 근거는 각 행의 condition 원문이다:
 *   · 생애최초 + 수도권·규제지역           → 70%(6개월 전입의무)
 *   · 생애최초 + 그 외                     → 80%
 *   · 무주택/처분조건부 + 규제지역          → 40%   (「처분조건부 1주택 포함」)
 *   · 무주택/처분조건부 + 비규제           → 70%   (「처분조건부 1주택 포함」)
 *   · 유주택·2주택+ + 규제지역             → 0%    (주택구입목적 주담대 금지)
 *   · 유주택·2주택+ + 수도권(비규제 포함)   → 0%    (미처분 1주택 추가구입 포함)
 *   · 유주택·2주택+ + 수도권 외 비규제      → 60%
 */
export function ltvPolicyKey(region: LtvRegion, owner: LtvOwner): string {
  if (owner === 'first_home') {
    return region === 'local_nonreg' ? 'ltv_first_home_other' : 'ltv_first_home_capital_regulated';
  }
  if (owner === 'none' || owner === 'disposal') {
    return region === 'regulated' ? 'ltv_regulated_nonowner' : 'ltv_nonregulated_nonowner';
  }
  // owner | multi
  if (region === 'regulated') return 'ltv_regulated_owner';
  if (region === 'capital_nonreg') return 'ltv_capital_multi_owner';
  return 'ltv_nonregulated_noncapital_owner';
}

/**
 * 주택 유상취득 취득세 — 조건 → policy_constants.key.
 *
 * ⚠️ 중과 판정은 «조정대상지역 여부 × 주택 수» 로 갈리고, 둘의 조합이 비대칭이다.
 *    옛 코드는 이걸 `houseCount>=3 ? (regulated?0.12:0.04) : ...` 로 뭉갰고 세 군데가 틀렸다:
 *      · 비조정 2주택 → 1% 고정이었다. 실제는 «표준세율»(가액 구간 1~3%)이다
 *      · 비조정 3주택 → 4% 였다. 실제 8%
 *      · 비조정 4주택 이상 → 4% 였다. 실제 12%
 *    (4% 는 주택이 «아닌» 부동산의 표준세율이다. 주택에 쓰면 안 되는 숫자였다.)
 * ⚠️ 조정 2주택 8% 에는 「일시적 2주택 제외」가 붙는다 — 화면이 그 단서를 말해야 한다.
 */
export function acqTaxPolicyKey(
  houseCount: number,
  regulated: boolean,
  price: number,
): string {
  const heavy12 = regulated ? houseCount >= 3 : houseCount >= 4;
  if (heavy12) return 'acq_tax_heavy_12';
  const heavy8 = regulated ? houseCount === 2 : houseCount === 3;
  if (heavy8) return 'acq_tax_heavy_8';
  // 중과 비대상 — 취득당시가액 구간
  if (price <= 600_000_000) return 'acq_tax_1house_6eok_under';
  if (price <= 900_000_000) return 'acq_tax_1house_6_9eok';
  return 'acq_tax_1house_9eok_over';
}

/**
 * 6억 초과 9억 이하 «사잇세율» — (취득가액 × 2 / 3억 − 3) × 1/100.
 *
 * ⛔ 이 구간을 «2% 고정» 으로 두면 안 된다. tax-tables 의 ACQUISITION_TAX_RATES 가 그렇게
 *    적혀 있었고, 함수는 선형보간을 하고 있어 «표와 함수가 서로 다른 답» 을 냈다.
 *    policy_constants 원문이 산식이므로 산식이 이긴다.
 * 경계 확인: 6억 → 1%, 9억 → 3%.
 */
export function acqTaxMidRatePct(price: number): number {
  const 억 = 100_000_000;
  const raw = (price * 2) / (3 * 억) - 3;
  // ⚠️ 지방세법 §11①8 후단: 「소수점 다섯째 자리에서 반올림하여 «넷째 자리까지»」.
  //    처음에 1e5 로 나눠 다섯째 자리까지 남겼는데(7억 → 1.66667) 그건 한 자리 더 간 것이다.
  //    법정 표기는 1.6667% 다. 반올림 «자리» 도 법이 정한 값이라 임의로 늘리지 않는다.
  return Math.round(raw * 10000) / 10000;
}

/**
 * 주택 취득 시 «부가세목» — 지방교육세·농어촌특별세 (과세표준 대비 %).
 *
 * ⛔ 본세만 고치고 부가세목을 그대로 두면 합계가 다시 틀린다. 실제로 그랬다:
 *    옛 코드는 `eduTax = 취득세액 × 10%` 를 «중과에도» 적용해 8% 중과에서 0.8% 가 됐다.
 *    중과주택 지방교육세는 «0.4% 고정» 이다(표준세율 4%의 1/2 × 20%) — 2배 과대였다.
 *    농특세도 `취득세액 × 2%` 라 8% 중과에서 0.16% 였다. 실제 0.6% — 약 1/4 로 과소였다.
 *    두 오차가 우연히 상쇄돼 합계가 비슷해 보이던 구간이 있어 더 위험했다.
 *
 * ⚠️ 농어촌특별세는 «전용면적 85㎡ 초과» 에만 붙는다. 면적을 묻지 않으면 답이 갈린다.
 * ⚠️ 이 수치들은 아직 policy_constants 에 «행이 없다» — 화면이 그 사실을 밝힌다.
 */
export function acqSurtaxPct(
  baseRatePct: number,
  heavy: 'none' | 'heavy8' | 'heavy12',
  over85: boolean,
): { eduPct: number; farmPct: number } {
  const eduPct = heavy === 'none' ? baseRatePct * 0.1 : 0.4;
  const farmPct = !over85 ? 0 : heavy === 'heavy12' ? 1.0 : heavy === 'heavy8' ? 0.6 : 0.2;
  return { eduPct, farmPct };
}

/**
 * 국내 주식 «증권거래세 + 농어촌특별세» — K-9 ⓒ 3군 재분류 (2026-09-16).
 *
 * ⛔ 이 값은 «시장값이 아니라 법정값» 이다. 변경 주체가 시장이 아니라 시행령(탄력세율)이고
 *    출처가 시세 API 가 아니라 법령이다. 그래서 liveData(환율 통로)가 아니라
 *    policy_constants(취득세와 같은 법정 파이프) 소속이다.
 *    ⚠️ 다만 연도별 로드맵으로 계속 움직여 온 값이라 «적용시기» 가 붙는다.
 *
 * 옛 코드는 `0.0018`(0.18%) 한 값이었다 — 2024년 화석이다. 그 사이 두 번 움직였다:
 *   2025년 역대 최저 0.15% → 2026-01-01 인상. 현행 총 0.20%.
 * ⚠️ 그리고 «구성이 다르다»:
 *   코스피 = 거래세 0.05% + 농특세 0.15%
 *   코스닥 = 거래세 0.20% 단일(농특세 없음)
 *   총액만 보면 2026년 한정으로 양 시장이 0.20% 로 «우연히» 같다.
 *   합계만 맞히고 성분을 뭉개면 내년 개정 때 조용히 틀린다 —
 *   「합계 근사가 아니라 성분별 대조가 정본」(취득세에서 세운 규율)이 여기 그대로 적용된다.
 */
export type StockMarket = 'kospi' | 'kosdaq' | 'us';

export function secTaxKeys(market: StockMarket): { trade: string | null; farm: string | null } {
  if (market === 'kospi') return { trade: 'sec_tax_kospi_trade', farm: 'sec_tax_kospi_farm' };
  if (market === 'kosdaq') return { trade: 'sec_tax_kosdaq_trade', farm: null };
  return { trade: null, farm: null };   // 해외는 증권거래세가 없다(양도세는 별도 계산기)
}

/** DSR 한도 키 — 업권으로 갈린다. */
export function dsrPolicyKey(lender: 'bank' | 'nonbank'): string {
  return lender === 'bank' ? 'dsr_bank' : 'dsr_nonbank';
}

/** 스트레스 금리 키 — 지역으로 갈린다. */
export function stressDsrKey(region: LtvRegion): string {
  return region === 'local_nonreg' ? 'stress_dsr_local' : 'stress_dsr_capital_regulated';
}

/**
 * 주입된 정책 상수 꾸러미. 서버가 policy_constants 를 읽어 이 모양으로 넘긴다.
 * ⛔ 없는 키를 «기본값으로 때우지 않는다» — 모르면 계산하지 않고 그렇게 말한다.
 */
export interface PolicyPack {
  /** key → 퍼센트 수치(40, 70, 0 …). */
  pct: Record<string, number>;
  /** key → 사람이 읽을 조건·출처. 화면이 근거를 말할 수 있게. */
  meta: Record<string, { item?: string; source?: string; date?: string; status?: string }>;
}

export function parsePolicyPack(raw: unknown): PolicyPack | null {
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (p && typeof p === 'object' && (p as any).pct) return p as PolicyPack;
  } catch { /* 주입 없음 */ }
  return null;
}

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
