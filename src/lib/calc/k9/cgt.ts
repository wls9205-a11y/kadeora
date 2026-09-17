/**
 * K-9 수치층 — 양도소득세 클러스터 6종 (2026-09-17)
 *   capital-gains-housing · capital-gains-rights · multi-house-sim · one-house-check
 *   major-shareholder-cgt · overseas-cgt
 *
 * 정본: policy_constants `cgt_*` 행(마이그레이션 k9_cgt_policy_constants_2026-09-17.sql).
 *   원문은 국가법령정보센터 DRF «eflaw 현행 시행본» 으로 재대조했다(시행일 2026-07-01 판):
 *     소득세법 MST 280405 · 소득세법 시행령 MST 286211 · 지방세법 MST 282559
 *     조세특례제한법 MST 280409(9-18 시행 284389 와 §91조의26 동일) · 조특법 시행령 MST 287181(9-18 시행 288915 와 §93조의12 동일)
 *   시행예정판(2027-01-01 · 2027-09-09 · 2028-01-01)과 §55·89·94·95·103·104, 시행령 §154·155·157·159의4·160·167의3·167의10,
 *   지방세법 §103의3 을 비교 — 수치 변동 없음(타법 명칭·표 줄바꿈만 다름).
 *
 * ⛔ 주입(__policy)이 없으면 세율을 지어내지 않는다 — 「세율 기준 미수신」.
 * ⚠️ «기간»(보유 2년·거주 2년·장특 3년 시작·단기 1/2년·일시적 2주택 3년·유예 종료일)은 파서가 읽는 형식(%/원)이 아니라
 *    아래 CGT_LAW 상수로 둔다. 같은 값이 policy_constants 에 «근거 행» 으로도 있다(cgt_exempt_hold_years 등).
 * ⚠️ 공유 누진표 INCOME_TAX_BRACKETS(tax-tables.ts)는 §55① 과 일치 확인됨 — 이관은 별건.
 */
import { INCOME_TAX_BRACKETS, calcProgressiveTax, formatKRWExact } from '../tax-tables';
import { parsePolicyPack, acqTaxPolicyKey, acqTaxMidRatePct, type PolicyPack } from '../gov-tables';
import type { CalcResult } from '../formulas';

type V = Record<string, number | string>;
type Row = { label: string; value: string };

const n = (v: unknown) => Number(v) || 0;
const fmt = (v: number) => formatKRWExact(v);

/** 법정 «기간» 값 — 파서 밖이라 코드 상수. 근거 행은 policy_constants 에 같이 있다. */
export const CGT_LAW = {
  exemptHoldYears: 2,          // 시행령 §154① 본문
  exemptLiveYears: 2,          // 시행령 §154① 괄호 — «취득 당시» 조정대상지역
  ltdStartYears: 3,            // 소득세법 §95② 표 1·표 2
  ltd2LiveMinYears: 2,         // §95② 표 2 거주 2년 이상 3년 미만(보유 3년 이상 한정) · 시행령 §159의4
  shortUnder1: 1,              // §104①3
  shortUnder2: 2,              // §104①2
  temp2WindowYears: 3,         // 시행령 §155① — 신규 주택 취득일부터 3년 이내 종전 주택 양도
  temp2GapYears: 1,            // 시행령 §155① — 종전 주택 취득 후 1년 이상 지나 신규 취득
  heavyGraceEnd: '2026-05-09', // 시행령 §167의10①12의2가 · §167의3①12의2가
  heavyGraceTransitEnd: '2026-11-09', // 같은 호 나목4) 단서(표 지역) — 토지거래허가 5-09까지 신청분
  statuteUrl: {
    s55: 'https://www.law.go.kr/법령/소득세법/제55조',
    s89: 'https://www.law.go.kr/법령/소득세법/제89조',
    s95: 'https://www.law.go.kr/법령/소득세법/제95조',
    s103: 'https://www.law.go.kr/법령/소득세법/제103조',
    s104: 'https://www.law.go.kr/법령/소득세법/제104조',
    d154: 'https://www.law.go.kr/법령/소득세법시행령/제154조',
    d155: 'https://www.law.go.kr/법령/소득세법시행령/제155조',
    d157: 'https://www.law.go.kr/법령/소득세법시행령/제157조',
    d167_10: 'https://www.law.go.kr/법령/소득세법시행령/제167조의10',
    local: 'https://www.law.go.kr/법령/지방세법/제103조의3',
    ria: 'https://www.law.go.kr/법령/조세특례제한법/제91조의26',
    riaDecree: 'https://www.law.go.kr/법령/조세특례제한법시행령/제93조의12',
  },
  verifiedAt: '2026-09-17',
} as const;

/** 계산기별 필요 키. 하나라도 없으면 계산하지 않는다. */
export const CGT_KEYS = {
  housing: {
    pct: ['cgt_ltd_t1_base', 'cgt_ltd_t1_step', 'cgt_ltd_t1_max', 'cgt_ltd_t2_base', 'cgt_ltd_t2_step', 'cgt_ltd_t2_max', 'cgt_ltd_t2_live2',
      'cgt_short_house_1y', 'cgt_short_house_2y', 'cgt_heavy_2house', 'cgt_heavy_3house', 'cgt_local_ratio'],
    amt: ['cgt_house_exempt_cap', 'cgt_basic_deduction'],
  },
  rights: { pct: ['cgt_presale_rate', 'cgt_short_house_1y', 'cgt_short_house_2y', 'cgt_local_ratio'], amt: ['cgt_basic_deduction'] },
  exempt: { pct: [] as string[], amt: ['cgt_house_exempt_cap'] },
  major: {
    pct: ['cgt_major_rate_low', 'cgt_major_rate_high', 'cgt_major_short', 'cgt_local_ratio',
      'cgt_major_threshold_kospi', 'cgt_major_threshold_kosdaq', 'cgt_major_threshold_konex', 'cgt_major_unlisted_pct'],
    amt: ['cgt_major_bracket', 'cgt_basic_deduction', 'cgt_major_threshold_cap', 'cgt_major_unlisted_cap'],
  },
  foreign: {
    pct: ['cgt_foreign_rate', 'cgt_local_ratio', 'cgt_ria_w1', 'cgt_ria_w2', 'cgt_ria_w3'],
    amt: ['cgt_basic_deduction', 'cgt_ria_limit'],
  },
} as const;

type KeySet = { pct: readonly string[]; amt: readonly string[] };
export type CgtPolicy = Record<string, number>;

/** 필요한 키를 전부 모아 한 표로 돌려준다. 하나라도 없으면 null. */
export function loadCgtPolicy(raw: unknown, ...sets: KeySet[]): CgtPolicy | null {
  const pack: PolicyPack | null = parsePolicyPack(raw);
  if (!pack) return null;
  const out: CgtPolicy = {};
  for (const s of sets) {
    for (const k of s.pct) { const x = pack.pct?.[k]; if (typeof x !== 'number') return null; out[k] = x; }
    for (const k of s.amt) { const x = pack.amt?.[k]; if (typeof x !== 'number') return null; out[k] = x; }
  }
  return out;
}

const MISSING = (what: string): CalcResult => ({
  main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
  details: [{ label: '사유', value: `${what} 기준을 아직 받지 못했다. 잠시 후 다시 시도한다` }],
});

// ─────────────────────────────────────────────────────────────────────────────
// 공유 로직 ① 1세대1주택 비과세 판정 (one-house-check · capital-gains-housing · multi-house-sim 교차)
// ─────────────────────────────────────────────────────────────────────────────

export interface OneHouseInput {
  houses: number;
  /** 2주택일 때 «일시적 2주택» 요건(종전 취득 1년 후 신규 취득 + 신규 취득 3년 내 종전 양도) 충족 여부 */
  temporary2: boolean;
  hold: number;
  live: number;
  /** «취득 당시» 조정대상지역 — 거주요건의 기준 시점(시행령 §154①) */
  acqRegulated: boolean;
}
export interface OneHouseJudge {
  /** 1세대1주택으로 보는가(1주택 또는 일시적 2주택 특례) */
  countsAsOne: boolean;
  holdOk: boolean;
  liveRequired: boolean;
  liveOk: boolean;
  /** 시행령 §154① 요건 충족 — 가액(12억)은 별도 */
  eligible: boolean;
}
export function judgeOneHouse(i: OneHouseInput): OneHouseJudge {
  const countsAsOne = i.houses === 1 || (i.houses === 2 && i.temporary2);
  const holdOk = i.hold >= CGT_LAW.exemptHoldYears;
  const liveRequired = i.acqRegulated;
  const liveOk = !liveRequired || i.live >= CGT_LAW.exemptLiveYears;
  return { countsAsOne, holdOk, liveRequired, liveOk, eligible: countsAsOne && holdOk && liveOk };
}

// ─────────────────────────────────────────────────────────────────────────────
// 공유 로직 ② 주택 양도세 (capital-gains-housing · multi-house-sim 교차)
// ─────────────────────────────────────────────────────────────────────────────

export interface HousingCgtInput extends OneHouseInput {
  sell: number;
  buy: number;
  expenses: number;
  /** «양도 당시» 조정대상지역 — 중과의 기준 시점(§104⑦) */
  saleRegulated: boolean;
  /** 중과 유예 적용(2026-05-09까지 양도 또는 시행령 §167의10①12의2 나·다목 경과규정 해당) */
  grace: boolean;
}
export interface HousingCgtOut {
  status: 'no-gain' | 'exempt' | 'taxed';
  judge: OneHouseJudge;
  gain: number;
  /** 12억 초과 안분 후 양도차익 */
  taxableGain: number;
  prorated: boolean;
  ltdTable: 'none' | 'table1' | 'table2' | 'heavy-excluded';
  ltdHoldPct: number;
  ltdLivePct: number;
  ltdAmount: number;
  basicDeduction: number;
  base: number;
  heavy: boolean;
  heavyAddPct: number;
  shortPct: number;
  /** 어느 세율이 이겼는가 */
  rateBasis: 'progressive' | 'progressive+heavy' | 'short';
  incomeTax: number;
  localTax: number;
  total: number;
}

export function ltdTable1Pct(hold: number, P: CgtPolicy): number {
  const y = Math.floor(hold);
  if (y < CGT_LAW.ltdStartYears) return 0;
  return Math.min(P.cgt_ltd_t1_max, P.cgt_ltd_t1_base + P.cgt_ltd_t1_step * (y - CGT_LAW.ltdStartYears));
}
export function ltdTable2Pct(hold: number, live: number, P: CgtPolicy): { hold: number; live: number } {
  const h = Math.floor(hold); const l = Math.floor(live);
  const holdPct = h < CGT_LAW.ltdStartYears ? 0 : Math.min(P.cgt_ltd_t2_max, P.cgt_ltd_t2_base + P.cgt_ltd_t2_step * (h - CGT_LAW.ltdStartYears));
  let livePct = 0;
  if (l >= CGT_LAW.ltdStartYears) livePct = Math.min(P.cgt_ltd_t2_max, P.cgt_ltd_t2_base + P.cgt_ltd_t2_step * (l - CGT_LAW.ltdStartYears));
  else if (l >= CGT_LAW.ltd2LiveMinYears && h >= CGT_LAW.ltdStartYears) livePct = P.cgt_ltd_t2_live2; // 보유 3년 이상 한정
  return { hold: holdPct, live: livePct };
}

export function computeHousingCgt(i: HousingCgtInput, P: CgtPolicy): HousingCgtOut {
  const judge = judgeOneHouse(i);
  const gain = i.sell - i.buy - i.expenses;
  const cap = P.cgt_house_exempt_cap;
  const base0: HousingCgtOut = {
    status: 'no-gain', judge, gain, taxableGain: 0, prorated: false, ltdTable: 'none', ltdHoldPct: 0, ltdLivePct: 0, ltdAmount: 0,
    basicDeduction: 0, base: 0, heavy: false, heavyAddPct: 0, shortPct: 0, rateBasis: 'progressive', incomeTax: 0, localTax: 0, total: 0,
  };
  if (gain <= 0) return base0;
  if (judge.eligible && i.sell <= cap) return { ...base0, status: 'exempt' };

  // 중과: 양도 당시 조정 + 2주택 이상 + (유예 미적용) + §167의10①13(일시적 2주택으로 §154① 충족) 제외
  const graceApplies = i.grace && i.hold >= CGT_LAW.exemptHoldYears; // 12의2 는 보유 2년 이상 주택만
  const temp2Excluded = i.houses === 2 && i.temporary2 && judge.eligible;
  const heavy = i.saleRegulated && i.houses >= 2 && !graceApplies && !temp2Excluded;
  const heavyAddPct = heavy ? (i.houses >= 3 ? P.cgt_heavy_3house : P.cgt_heavy_2house) : 0;

  // 고가주택 안분(비과세 요건 충족분만) — 시행령 §160①
  const prorated = judge.eligible && i.sell > cap;
  const taxableGain = prorated ? Math.round(gain * (i.sell - cap) / i.sell) : gain;

  // 장기보유특별공제 — 중과 대상 배제(§95② 괄호), 1세대1주택+거주 2년 이상이면 표 2(시행령 §159의4), 그 밖 표 1
  let ltdTable: HousingCgtOut['ltdTable'] = 'none';
  let ltdHoldPct = 0; let ltdLivePct = 0;
  if (heavy) ltdTable = 'heavy-excluded';
  else if (judge.countsAsOne && i.live >= CGT_LAW.ltd2LiveMinYears) {
    const t = ltdTable2Pct(i.hold, i.live, P); ltdHoldPct = t.hold; ltdLivePct = t.live; ltdTable = 'table2';
  } else { ltdHoldPct = ltdTable1Pct(i.hold, P); ltdTable = ltdHoldPct > 0 ? 'table1' : 'none'; }
  const ltdAmount = Math.round(taxableGain * (ltdHoldPct + ltdLivePct) / 100);

  const income = taxableGain - ltdAmount;
  const basicDeduction = Math.min(Math.max(0, income), P.cgt_basic_deduction);
  const base = Math.max(0, income - P.cgt_basic_deduction);

  // 세율 — §104① 후단·§104⑦ 후단: 둘 이상 해당하면 큰 세액
  const shortPct = i.hold < CGT_LAW.shortUnder1 ? P.cgt_short_house_1y : i.hold < CGT_LAW.shortUnder2 ? P.cgt_short_house_2y : 0;
  const progressive = calcProgressiveTax(base, INCOME_TAX_BRACKETS) + base * heavyAddPct / 100;
  const shortTax = base * shortPct / 100;
  const useShort = shortTax > progressive;
  const incomeTax = Math.round(useShort ? shortTax : progressive);
  const localTax = Math.round(incomeTax * P.cgt_local_ratio / 100);
  return {
    status: 'taxed', judge, gain, taxableGain, prorated, ltdTable, ltdHoldPct, ltdLivePct, ltdAmount, basicDeduction, base,
    heavy, heavyAddPct, shortPct, rateBasis: useShort ? 'short' : heavy ? 'progressive+heavy' : 'progressive',
    incomeTax, localTax, total: incomeTax + localTax,
  };
}

function housingDetails(o: HousingCgtOut, i: HousingCgtInput, P: CgtPolicy): Row[] {
  const d: Row[] = [{ label: '양도차익', value: fmt(o.gain) }];
  if (o.prorated) d.push({ label: `12억 초과분 안분 (×(양도가−${fmt(P.cgt_house_exempt_cap)})/양도가)`, value: fmt(o.taxableGain) });
  const ltdLabel = o.ltdTable === 'heavy-excluded' ? '장기보유특별공제 — 중과 대상이라 배제(§95②)'
    : o.ltdTable === 'table2' ? `장기보유특별공제 표 2 (보유 ${o.ltdHoldPct}% + 거주 ${o.ltdLivePct}%)`
    : o.ltdTable === 'table1' ? `장기보유특별공제 표 1 (${o.ltdHoldPct}%)` : '장기보유특별공제 (보유 3년 미만 — 없음)';
  d.push({ label: ltdLabel, value: fmt(o.ltdAmount) });
  d.push({ label: '기본공제', value: fmt(o.basicDeduction) });
  d.push({ label: '과세표준', value: fmt(o.base) });
  const rate = o.rateBasis === 'short' ? `단기 ${o.shortPct}% (§104①${o.shortPct === P.cgt_short_house_1y ? '3' : '2'})`
    : o.rateBasis === 'progressive+heavy' ? `기본세율 +${o.heavyAddPct}%p 중과 (§104⑦)` : '기본세율 6~45% (§55①)';
  d.push({ label: '적용 세율', value: rate });
  if (o.heavy && o.shortPct > 0) d.push({ label: '비교', value: `중과세액과 단기세율 ${o.shortPct}% 세액 중 큰 쪽을 썼다(§104⑦ 후단)` });
  d.push({ label: '양도소득세', value: fmt(o.incomeTax) });
  d.push({ label: `지방소득세 (소득세의 ${P.cgt_local_ratio}% 구조)`, value: fmt(o.localTax) });
  if (i.saleRegulated && i.houses >= 2 && !o.heavy) {
    d.push({ label: '중과 미적용 사유', value: i.grace && i.hold >= CGT_LAW.exemptHoldYears
      ? `유예 적용으로 입력 — ${CGT_LAW.heavyGraceEnd}까지 양도분 또는 토지거래허가 경과규정분(최장 ${CGT_LAW.heavyGraceTransitEnd})만 해당`
      : '일시적 2주택으로 §154① 요건 충족 — 중과 제외(시행령 §167의10①13)' });
  }
  if (i.grace && i.hold < CGT_LAW.exemptHoldYears && i.saleRegulated && i.houses >= 2) {
    d.push({ label: '⚠️ 유예', value: '유예(시행령 §167의10①12의2)는 보유 2년 이상 주택만 — 이 입력은 유예 대상이 아니다' });
  }
  return d;
}

const HOUSING_DISCLOSURE: Row[] = [
  { label: '⚠️ 중과 유예', value: `${CGT_LAW.heavyGraceEnd} 종료 — 2026-05-10 이후 양도분은 조정대상지역 2주택 +20%p · 3주택 이상 +30%p 가 다시 붙는다(시행령 §167의10①12의2가). 재유예 «입법예고» 여부는 원문(DRF)으로 닫지 못했다 — 공포·시행된 개정은 없다` },
  { label: '⚠️ 판정 안 함', value: '중과 제외 주택(장기임대·기준시가 1억 이하·지방 저가주택 등 시행령 §167의3·§167의10 각 호), 조합원입주권·분양권 보유 시 판정(§89②·§104⑦2·4), 상속·동거봉양·혼인 특례는 계산하지 않는다' },
  { label: '⚠️ 지방소득세', value: '표준세율(소득세의 1/10 구조). 조례로 ±50% 가감 가능(지방세법 §103의3④)' },
];

// ═══ capital-gains-housing ═══

export function capitalGainsHousing(v: V): CalcResult {
  const P = loadCgtPolicy(v.__policy, CGT_KEYS.housing);
  if (!P) return MISSING('양도소득세율');
  const houses = Math.max(1, Math.floor(n(v.houseCount)) || 1);
  // ⛔ 옛 입력 `regulated` 는 받기만 하고 함수에서 한 번도 안 썼다. 시점이 다른 두 입력으로 쪼갰다.
  const legacy = v.regulated === 'yes';
  const i: HousingCgtInput = {
    sell: n(v.sellPrice), buy: n(v.buyPrice), expenses: n(v.expenses), hold: n(v.holdYears), live: n(v.liveYears), houses,
    temporary2: v.temporary2 === 'yes',
    acqRegulated: v.acqRegulated === undefined ? legacy : v.acqRegulated === 'yes',
    saleRegulated: v.saleRegulated === undefined ? legacy : v.saleRegulated === 'yes',
    grace: v.saleTiming === 'grace',
  };
  const o = computeHousingCgt(i, P);
  if (o.status === 'no-gain') return { main: { label: '양도소득세', value: '0원 (차익 없음)' }, details: [{ label: '양도차익', value: fmt(o.gain) }] };
  if (o.status === 'exempt') {
    return {
      main: { label: '양도소득세', value: '0원 (비과세)', color: 'var(--accent-green)' },
      details: [
        { label: '사유', value: `1세대1주택${houses === 2 ? '(일시적 2주택 특례)' : ''} · 보유 ${CGT_LAW.exemptHoldYears}년 이상${o.judge.liveRequired ? ` · 취득 당시 조정대상지역이라 거주 ${CGT_LAW.exemptLiveYears}년 이상` : ''} · 양도가 ${fmt(P.cgt_house_exempt_cap)} 이하` },
        { label: '근거', value: '소득세법 §89①3 · 시행령 §154①' + (houses === 2 ? ' · §155①' : '') },
        HOUSING_DISCLOSURE[1],
      ],
    };
  }
  const details = housingDetails(o, i, P);
  if (houses === 1 && !o.judge.eligible) {
    details.unshift({ label: '비과세 불가 사유', value: !o.judge.holdOk ? `보유 ${CGT_LAW.exemptHoldYears}년 미만` : `취득 당시 조정대상지역 — 거주 ${CGT_LAW.exemptLiveYears}년 미만` });
  }
  return { main: { label: '양도소득세 (지방소득세 포함)', value: fmt(o.total) }, details: [...details, ...HOUSING_DISCLOSURE] };
}

// ═══ one-house-check ═══

export function oneHouseCheck(v: V): CalcResult {
  const P = loadCgtPolicy(v.__policy, CGT_KEYS.exempt);
  if (!P) return MISSING('고가주택');
  const houses = Math.max(1, Math.floor(n(v.houseCount)) || 1);
  const temporary2 = houses === 2 && v.newAfter1y === 'yes' && v.within3y === 'yes';
  const legacy = v.regulated === 'yes';
  const acqRegulated = v.acqRegulated === undefined ? legacy : v.acqRegulated === 'yes';
  const hold = n(v.holdYears); const live = n(v.liveYears); const price = n(v.sellPrice);
  const j = judgeOneHouse({ houses, temporary2, hold, live, acqRegulated });
  const cap = P.cgt_house_exempt_cap;
  const priceOk = price <= cap;
  const outOfScope: Row = { label: '⚠️ 판정 안 함', value: '상속·동거봉양·혼인 합가 특례(시행령 §155②~⑤), 보유기간 예외(임대주택 5년 거주·수용·해외이주·근무상 형편 — §154①1~3), 조합원입주권·분양권 보유(§89②)는 이 판정기가 보지 않는다' };
  const scopeRow: Row = { label: '주택 수 판정', value: houses === 1 ? '1주택' : temporary2 ? '일시적 2주택 — 1세대1주택으로 본다(시행령 §155①)' : `${houses}주택` };

  if (!j.countsAsOne) {
    const why = houses === 2
      ? `일시적 2주택 요건 미충족 — 종전 주택 취득 후 ${CGT_LAW.temp2GapYears}년 이상 지나 새 주택을 샀고, 새 주택 취득일부터 ${CGT_LAW.temp2WindowYears}년 이내에 종전 주택을 파는 경우만 해당`
      : '3주택 이상';
    return {
      main: { label: '비과세 불가 (이 판정기 범위에서)', value: '1세대1주택 아님', color: 'var(--accent-red)' },
      details: [scopeRow, { label: '사유', value: why }, outOfScope],
    };
  }
  const details: Row[] = [
    scopeRow,
    { label: `보유 ${CGT_LAW.exemptHoldYears}년 이상`, value: j.holdOk ? '충족' : '미충족' },
    { label: `거주 ${CGT_LAW.exemptLiveYears}년 이상 (취득 당시 조정대상지역만)`, value: j.liveRequired ? (j.liveOk ? '충족' : '미충족') : '해당 없음 — 취득 당시 비조정' },
    { label: `양도가 ${fmt(cap)} 이하`, value: priceOk ? '충족' : '초과 — 초과분 비율만큼 과세(시행령 §160)' },
    { label: '근거', value: '소득세법 §89①3 · 시행령 §154①' + (temporary2 ? ' · §155①' : '') },
    outOfScope,
  ];
  return {
    main: {
      label: j.eligible ? '비과세 해당' : '비과세 불가',
      value: j.eligible ? (priceOk ? '전액 비과세' : `${fmt(cap)} 초과분 과세`) : '요건 미충족',
      color: j.eligible ? 'var(--accent-green)' : 'var(--accent-red)',
    },
    details,
  };
}

// ═══ capital-gains-rights ═══

export function capitalGainsRights(v: V): CalcResult {
  const P = loadCgtPolicy(v.__policy, CGT_KEYS.rights);
  if (!P) return MISSING('분양권 세율');
  const gain = n(v.sellPrice) - n(v.buyPrice) - n(v.expenses);
  if (gain <= 0) return { main: { label: '양도소득세', value: '0원 (차익 없음)' }, details: [{ label: '양도차익', value: fmt(gain) }] };
  const hold = n(v.holdYears);
  // ⛔ 옛 코드는 보유 2년 이상을 누진세율로 보냈다. 분양권은 보유기간과 무관하게 최저 60%(§104①1 괄호).
  //    1년 미만 70%(①3) · 1~2년 60%(①2) · 2년 이상 60%(①1). 둘 이상 해당하면 큰 세액(①후단).
  const shortPct = hold < CGT_LAW.shortUnder1 ? P.cgt_short_house_1y : hold < CGT_LAW.shortUnder2 ? P.cgt_short_house_2y : 0;
  const ratePct = Math.max(P.cgt_presale_rate, shortPct);
  const basic = Math.min(gain, P.cgt_basic_deduction);
  const base = Math.max(0, gain - P.cgt_basic_deduction);
  const incomeTax = Math.round(base * ratePct / 100);
  const localTax = Math.round(incomeTax * P.cgt_local_ratio / 100);
  const clause = hold < CGT_LAW.shortUnder1 ? '§104①3 (1년 미만)' : hold < CGT_LAW.shortUnder2 ? '§104①2 (1년 이상 2년 미만)' : '§104①1 괄호 (보유기간 무관 최저)';
  return {
    main: { label: '양도소득세 (지방소득세 포함)', value: fmt(incomeTax + localTax) },
    details: [
      { label: '양도차익', value: fmt(gain) },
      { label: '장기보유특별공제', value: '없음 — 분양권은 §95② 대상 자산이 아니다' },
      { label: '기본공제', value: fmt(basic) },
      { label: '과세표준', value: fmt(base) },
      { label: `적용 세율 ${ratePct}%`, value: clause },
      { label: '양도소득세', value: fmt(incomeTax) },
      { label: `지방소득세 (소득세의 ${P.cgt_local_ratio}% 구조)`, value: fmt(localTax) },
      { label: '⚠️ 조정대상지역', value: '분양권 세율은 조정대상지역 여부와 무관하다. 다만 분양권을 가진 채 «주택» 을 팔면 그 주택의 비과세·중과 판정이 달라진다(§89② · §104⑦2·4) — 이 계산기는 그 판정을 하지 않는다' },
    ],
  };
}

// ═══ multi-house-sim ═══

/**
 * ⛔ 옛 구조는 «매도 주택 가격» 에 취득세를 매기고 같은 가격으로 양도세(24% 단일 근사)를 더해 「중과세 합계」라 불렀다.
 *    취득세는 «새로 사는» 주택에, 양도세는 «파는» 주택에 붙는다 — 두 거래를 입력부터 가른다.
 * 취득세 본세는 acquisition-tax 와 같은 policy 행(acq_tax_*) · 같은 키 함수(acqTaxPolicyKey)를 쓴다.
 * 양도세는 capital-gains-housing 과 같은 computeHousingCgt 를 쓴다.
 */
export function multiHouseSim(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = loadCgtPolicy(v.__policy, CGT_KEYS.housing);
  const acqPrice = n(v.acqPrice);
  const acqHouses = Math.max(1, Math.floor(n(v.acqHouseCount)) || 1);
  const acqRegulated = v.acqRegulated === 'yes';
  const acqKey = acqTaxPolicyKey(acqHouses, acqRegulated, acqPrice);
  const acqPctDb = pack?.pct?.[acqKey];
  if (!P || typeof acqPctDb !== 'number') return MISSING('취득세·양도세율');
  const acqPct = acqKey === 'acq_tax_1house_6_9eok' ? acqTaxMidRatePct(acqPrice) : acqPctDb;
  const acqTax = Math.round(acqPrice * acqPct / 100);

  const sellHouses = Math.max(1, Math.floor(n(v.sellHouseCount)) || 1);
  const i: HousingCgtInput = {
    sell: n(v.sellPrice), buy: n(v.sellBuyPrice), expenses: n(v.sellExpenses), hold: n(v.sellHoldYears), live: n(v.sellLiveYears),
    houses: sellHouses, temporary2: false, acqRegulated: v.sellAcqRegulated === 'yes', saleRegulated: v.sellRegulated === 'yes',
    grace: v.saleTiming === 'grace',
  };
  const o = computeHousingCgt(i, P);
  const cgt = o.total;
  const m = pack?.meta?.[acqKey] ?? {};
  const details: Row[] = [
    { label: '① 취득 — 취득세 본세', value: fmt(acqTax) },
    { label: '   적용 세율', value: `${acqPct}% (${acqHouses}주택 취득 · ${acqRegulated ? '조정' : '비조정'}${m.item ? ` · ${m.item}` : ''})` },
    { label: '   ⚠️ 부가세목', value: '지방교육세·농어촌특별세는 여기서 빼고 본세만 — 합계는 취득세 계산기에서 본다' },
  ];
  if (acqKey === 'acq_tax_heavy_8' && acqRegulated && acqHouses === 2) {
    details.push({ label: '   ⚠️ 단서', value: '일시적 2주택은 취득세 중과 제외다 — 해당하면 표준세율을 본다' });
  }
  details.push({ label: '② 양도 — 양도소득세+지방소득세', value: o.status === 'exempt' ? '0원 (비과세)' : fmt(cgt) });
  if (o.status === 'taxed') {
    for (const r of housingDetails(o, i, P)) details.push({ label: `   ${r.label}`, value: r.value });
  }
  details.push(...HOUSING_DISCLOSURE);
  return {
    main: { label: '두 거래 세금 (취득세 본세 + 양도세)', value: fmt(acqTax + cgt) },
    details,
  };
}

// ═══ major-shareholder-cgt ═══

export function majorShareholderCgt(v: V): CalcResult {
  const P = loadCgtPolicy(v.__policy, CGT_KEYS.major);
  if (!P) return MISSING('대주주 양도세율');
  const profit = n(v.profit);
  const short = v.holdPeriod === 'short';
  const sme = v.sme === 'yes';
  const used = v.deductionUsed === 'yes';
  const basic = used ? 0 : Math.min(Math.max(0, profit), P.cgt_basic_deduction);
  const base = Math.max(0, profit - basic);
  // ⛔ 옛 코드: 지방세를 «포함한» 33%·22%·27.5% 에 다시 ×1.1 → 실효 36.3/24.2/30.25%. 기본공제 250만 누락.
  //    3억 구간도 «양도차익» 기준이었다. 원문은 «과세표준» 기준(§104①11가2)).
  let incomeTax: number; let rateText: string;
  if (short && !sme) {
    incomeTax = Math.round(base * P.cgt_major_short / 100);
    rateText = `${P.cgt_major_short}% — 1년 미만 · 중소기업 외 법인(§104①11가1))`;
  } else {
    const br = P.cgt_major_bracket;
    incomeTax = Math.round(Math.min(base, br) * P.cgt_major_rate_low / 100 + Math.max(0, base - br) * P.cgt_major_rate_high / 100);
    rateText = `과세표준 ${fmt(br)} 이하 ${P.cgt_major_rate_low}% · 초과분 ${P.cgt_major_rate_high}% (§104①11가2))`;
  }
  const localTax = Math.round(incomeTax * P.cgt_local_ratio / 100);
  return {
    main: { label: '양도소득세 (지방소득세 포함)', value: fmt(incomeTax + localTax) },
    details: [
      { label: '양도차익', value: fmt(profit) },
      { label: '기본공제', value: used ? '0원 — 올해 주식등 소득군에서 이미 사용' : fmt(basic) },
      { label: '과세표준', value: fmt(base) },
      { label: '적용 세율', value: rateText },
      { label: '양도소득세', value: fmt(incomeTax) },
      { label: `지방소득세 (소득세의 ${P.cgt_local_ratio}% 구조)`, value: fmt(localTax) },
      { label: '대주주 판정 (상장)', value: `직전 사업연도 말 지분율 코스피 ${P.cgt_major_threshold_kospi}% · 코스닥 ${P.cgt_major_threshold_kosdaq}% · 코넥스 ${P.cgt_major_threshold_konex}% 이상 또는 시가총액 ${fmt(P.cgt_major_threshold_cap)} 이상 (소득세법 시행령 §157①·②, 특수관계인 합산 단서 있음)` },
      { label: '대주주 판정 (비상장)', value: `지분 ${P.cgt_major_unlisted_pct}% 이상 또는 시가총액 ${fmt(P.cgt_major_unlisted_cap)} 이상 (벤처 40억원, 시행령 §167의8①2)` },
      { label: '⚠️ 기본공제', value: '연 250만원은 해외주식·비상장주식 등 «주식등» 소득 전체에서 한 번만 공제한다(§103①2)' },
      { label: '⚠️ 판정 안 함', value: '대주주 해당 여부 자체, 양도 차손 통산, 증권거래세는 계산하지 않는다 — 대주주가 아니면 상장주식 장내 양도는 과세하지 않는다' },
    ],
  };
}

// ═══ overseas-cgt ═══

export function overseasCgt(v: V): CalcResult {
  const P = loadCgtPolicy(v.__policy, CGT_KEYS.foreign);
  if (!P) return MISSING('해외주식 양도세율');
  const net = n(v.profit) + n(v.otherProfit) - n(v.otherLoss);
  const used = v.deductionUsed === 'yes';
  const basic = used ? 0 : Math.min(Math.max(0, net), P.cgt_basic_deduction);
  const details: Row[] = [{ label: '순 양도차익 (차익 − 손실)', value: fmt(net) }, { label: '기본공제', value: used ? '0원 — 올해 주식등 소득군에서 이미 사용' : fmt(basic) }];

  // RIA(국내시장복귀계좌) — 조특법 §91조의26 · 시행령 §93조의12
  let riaDed = 0;
  if (v.ria === 'yes') {
    const period = String(v.riaPeriod);
    const w = period === 'p1' ? P.cgt_ria_w1 : period === 'p2' ? P.cgt_ria_w2 : P.cgt_ria_w3;
    const ratio = Math.min(1, Math.max(0, Number(v.riaRatio ?? 1)));
    const riaGain = Math.min(Math.max(0, n(v.riaGain)), Math.max(0, net));
    const raw = Math.round(riaGain * w / 100 * ratio);
    // 시행령 §93조의12② — 주식등 소득에서 기본공제를 적용한 금액의 범위에서 공제
    riaDed = Math.min(raw, Math.max(0, net - basic));
    details.push({ label: `RIA 특례 공제 (${w}% × 조정비율 ${ratio})`, value: fmt(riaDed) });
    details.push({ label: '⚠️ 조정비율', value: '입력값이다. 산식은 1 − (A−B)/C (0~1): A·B = RIA 밖 계좌의 2026년 해외주식·해외지수 ETF 등 취득(A)·양도(B) 가액 × 시기별 가중치, C = RIA 로 판 해외주식 양도가액 × 가중치 (조특법 시행령 §93조의12④). 증권사 산정치를 넣는다' });
    details.push({ label: '⚠️ 요건', value: `2025-12-23 이전 보유분을 RIA 로 2026-12-31까지 양도 · 납입한도 ${fmt(P.cgt_ria_limit)} · 납입일부터 1년 안에 인출하면 공제세액 추징(§91조의26④)` });
  }
  const base = Math.max(0, net - basic - riaDed);
  const incomeTax = Math.round(base * P.cgt_foreign_rate / 100);
  const localTax = Math.round(incomeTax * P.cgt_local_ratio / 100);
  details.push(
    { label: '과세표준', value: fmt(base) },
    { label: `양도소득세 (${P.cgt_foreign_rate}%, §104①12나)`, value: fmt(incomeTax) },
    { label: `지방소득세 (소득세의 ${P.cgt_local_ratio}% 구조, 지방세법 §103의3①12)`, value: fmt(localTax) },
    { label: '⚠️ 기본공제', value: '연 250만원은 국내 대주주·비상장 주식 등 «주식등» 소득 전체에서 합산 1회다(§103①2) — 다른 곳에서 썼으면 「이미 사용」을 고른다' },
    { label: '⚠️ 중소기업 10%', value: '§104①12가 중소기업 주식 10% 가 외국법인 주식에 적용되는지는 중소기업 정의를 원문 대조하지 않았다 — 20% 로만 계산한다' },
  );
  return { main: { label: '양도소득세 (지방소득세 포함)', value: fmt(incomeTax + localTax) }, details };
}
