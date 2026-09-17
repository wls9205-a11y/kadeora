/**
 * K-9 수치층 — 금융·소득세 클러스터(fin) 16종 (2026-09-17).
 *
 * ⛔ 이 파일에는 «세율·공제액·한도» 숫자를 적지 않는다. 정본은 policy_constants 이고
 *    서버가 `__policy` 로 주입한다(page.tsx). 없는 키는 «기본값으로 때우지 않는다» — 「세율 기준 미수신」.
 *    여기 남은 숫자는 표의 «뼈대»(구간 경계 연수·연차·개월)와 단위 환산뿐이다.
 *
 * 원문: 국가법령정보센터 DRF `target=eflaw` 현행본(2026-09-17 조회)
 *   소득세법 MST 280405 @2026-07-01 · 시행령 286211 @2026-07-01 · 시행규칙 286379 @2026-07-01
 *   국세기본법 288571 @2026-08-11 · 시행령 283623 @2026-07-01 · 조특법 280409 @2026-07-01 · 지방세법 282559 @2026-07-01
 *
 * ⚠️ 공유 누진표(INCOME_TAX_BRACKETS, 소득세법 §55①)는 tax-tables.ts 그대로 쓴다 — 원문과 8구간 일치 확인.
 *    policy_constants 로의 이관은 여러 계산기가 걸린 별건이다.
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
const pctText = (p: number) => `${Number(p.toFixed(4))}%`;

// ─────────────────────────────────────────────────────────────────────────────
// 공통 — 정책 꾸러미 읽기
// ─────────────────────────────────────────────────────────────────────────────

interface Loaded {
  P: Record<string, number>;
  A: Record<string, number>;
  meta: Meta;
  missing: string[];
}

function load(v: V, pctKeys: string[], amtKeys: string[] = []): Loaded {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const missing = [
    ...pctKeys.filter((k) => typeof P[k] !== 'number'),
    ...amtKeys.filter((k) => typeof A[k] !== 'number'),
  ];
  return { P, A, meta: (pack?.meta ?? {}) as Meta, missing };
}

function noPolicy(what: string): CalcResult {
  return {
    main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
    details: [{ label: '사유', value: `${what} 기준을 아직 받지 못했다. 잠시 후 다시 시도한다` }],
  };
}

/** 근거 한 줄 — 행들의 출처 제목을 중복 없이. */
function sourceRow(meta: Meta, keys: string[]): Row[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const k of keys) {
    const s = meta[k]?.source;
    if (s && !seen.has(s)) { seen.add(s); parts.push(s); }
  }
  return parts.length ? [{ label: '근거', value: parts.join(' · ') }] : [];
}

/**
 * 누적 구간식 — 경계 t[i] 사이마다 다른 율(%)을 곱해 더한다.
 * 연금소득공제(§47의2①)·환산급여공제(§48①2)의 「기초액 + 초과분×율」 표는 기초액이 앞 구간 누계와 «정확히 같다»
 * (350→490→630만 · 800→4,520→6,170→1억5,170만). 그래서 기초액을 따로 싣지 않고 율·경계만으로 복원한다.
 */
export function piecewise(x: number, bounds: number[], ratesPct: number[]): number {
  let total = 0;
  let lo = 0;
  for (let i = 0; i < ratesPct.length; i++) {
    const hi = i < bounds.length ? bounds[i] : Infinity;
    if (x <= lo) break;
    total += (Math.min(x, hi) - lo) * ratesPct[i] / 100;
    lo = hi;
  }
  return total;
}

/** 원천징수 소액부징수 판정(소득세법 §86 1호) — 세액 1천원 미만이면 징수하지 않는다. */
function smallExempt(tax: number, A: Record<string, number>): boolean {
  return tax > 0 && tax < A.wh_small_exempt;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. 퇴직소득세 — 소득세법 §48 · §55② · 지방세법 §92④
// ═════════════════════════════════════════════════════════════════════════════

const RET_PCT = ['retinc_conv_b1', 'retinc_conv_b2', 'retinc_conv_b3', 'retinc_conv_b4', 'retinc_conv_b5', 'int_tax_local'];
const RET_AMT = ['retinc_svc_le5', 'retinc_svc_6_10', 'retinc_svc_11_20', 'retinc_svc_gt20',
  'retinc_conv_t1', 'retinc_conv_t2', 'retinc_conv_t3', 'retinc_conv_t4'];

export interface RetirementTaxParts {
  years: number;
  svcDeduction: number;
  converted: number;
  convDeduction: number;
  taxBase: number;
  tax: number;
  local: number;
}

/**
 * 퇴직소득 산출세액 — retirement-income-tax · retirement-pension-sim 이 «같은» 함수를 쓴다(이중 진실 금지).
 *
 * ⛔ 옛 코드는 2015년 이전 «40% 정률공제 + 연분» 식이었다. 근속연수공제도 5배 과대였고 환산급여공제 단계가 없었다.
 *    1억·10년: 옛 120만 → 법 387.5만(3.2배 과소). 2억·20년: 90만 → 702.5만(7.8배 과소).
 * 순서(§48①): 퇴직소득금액 − 근속연수공제 → ÷근속연수×12 = 환산급여 → − 환산급여공제 = 과세표준
 *            → 기본세율 → ÷12 × 근속연수(§55②).
 */
export function retirementTaxParts(pay: number, yearsIn: number, P: Record<string, number>, A: Record<string, number>): RetirementTaxParts {
  // 1년 미만 기간은 1년으로 본다(§48① 괄호) — 소수 입력은 올린다.
  const years = Math.max(1, Math.ceil(yearsIn));
  const s1 = A.retinc_svc_le5, s2 = A.retinc_svc_6_10, s3 = A.retinc_svc_11_20, s4 = A.retinc_svc_gt20;
  // §48①1 표의 구간 경계(5·10·20년)는 표의 뼈대다. 기초액(500만·1,500만·4,000만)은 앞 구간 누계와 같다.
  const svc = years <= 5 ? s1 * years
    : years <= 10 ? 5 * s1 + s2 * (years - 5)
    : years <= 20 ? 5 * s1 + 5 * s2 + s3 * (years - 10)
    : 5 * s1 + 5 * s2 + 10 * s3 + s4 * (years - 20);
  const svcDeduction = Math.min(Math.max(0, pay), svc); // §48② 퇴직소득금액이 모자라면 그 금액까지
  const converted = (Math.max(0, pay) - svcDeduction) / years * 12;
  const convDeduction = piecewise(
    converted,
    [A.retinc_conv_t1, A.retinc_conv_t2, A.retinc_conv_t3, A.retinc_conv_t4],
    [P.retinc_conv_b1, P.retinc_conv_b2, P.retinc_conv_b3, P.retinc_conv_b4, P.retinc_conv_b5],
  );
  const taxBase = Math.max(0, converted - convDeduction);
  const raw = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS) / 12 * years;
  const tax = r(raw);
  // 지방세법 §92④ — 같은 순서로 1/10 표준세율. 표가 국세의 정확히 1/10 이라 산출세액의 10% 와 같다.
  const local = r(raw * P.int_tax_local / 100);
  return { years, svcDeduction: r(svcDeduction), converted: r(converted), convDeduction: r(convDeduction), taxBase: r(taxBase), tax, local };
}

export function retirementIncomeTax(v: V): CalcResult {
  const L = load(v, RET_PCT, RET_AMT);
  if (L.missing.length) return noPolicy('퇴직소득 공제·세율');
  const pay = n(v.retirementPay);
  const t = retirementTaxParts(pay, n(v.years), L.P, L.A);
  const total = t.tax + t.local;
  return {
    main: { label: '퇴직소득세 + 지방소득세', value: fmt(total) },
    details: [
      { label: '퇴직소득금액', value: fmt(pay) },
      { label: `근속연수공제 (${t.years}년)`, value: fmt(t.svcDeduction) },
      { label: '환산급여 ((금액−근속공제)÷연수×12)', value: fmt(t.converted) },
      { label: '환산급여공제', value: fmt(t.convDeduction) },
      { label: '과세표준', value: fmt(t.taxBase) },
      { label: '퇴직소득세 (기본세율 ÷12 × 근속연수)', value: fmt(t.tax) },
      { label: `지방소득세 (${L.P.int_tax_local}%)`, value: fmt(t.local) },
      { label: '실효세율 (국세+지방)', value: pay > 0 ? `${(total / pay * 100).toFixed(2)}%` : '—' },
      { label: '⚠️ 미반영', value: '비과세 퇴직소득·임원 퇴직금 한도·중간정산 합산·이연퇴직소득(IRP 이체)은 계산하지 않았다' },
      { label: '⚠️ 근속연수', value: '1년 미만 기간은 1년으로 올려 셌다(§48①)' },
      ...sourceRow(L.meta, ['retinc_svc_le5', 'retinc_conv_b1', 'int_tax_local']),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. 퇴직연금 연금 vs 일시금 — 소득세법 §129①5의3
// ═════════════════════════════════════════════════════════════════════════════

/** 연금 실제 수령연차 → 연금외수령 원천징수세율에 곱할 비율 키. 연차 경계(10·20년)는 조문 뼈대. */
export function retirementPensionRatioKey(yearNo: number): string {
  if (yearNo <= 10) return 'pension_ret_le10';
  if (yearNo <= 20) return 'pension_ret_11_20';
  return 'pension_ret_gt20';
}

export function retirementPensionSim(v: V): CalcResult {
  const L = load(v, [...RET_PCT, 'pension_ret_le10', 'pension_ret_11_20', 'pension_ret_gt20'], RET_AMT);
  if (L.missing.length) return noPolicy('퇴직소득·연금수령 세율');
  const total = n(v.totalAmount);
  const pensionYears = Math.max(1, Math.round(n(v.pensionYears)));
  // ⛔ 옛 코드: 공제 500만×연수 · «×0.6» · 연금세율 3.3/4.4% — 앞의 둘은 존재하지 않는 식이고,
  //    3.3~5.5% 는 연금계좌 «납입액·운용수익» 세율(§129①5의2)이다. 퇴직소득 연금수령과 무관.
  //    2억·20년·10년: 옛 절세 513.6만 → 법 231.8만(지방 포함) — 2.2배 과대.
  const lump = retirementTaxParts(total, n(v.years), L.P, L.A);
  const lumpTotal = lump.tax + lump.local;
  // 연금외수령 원천징수세율 = 연금외수령 가정 퇴직소득세 ÷ 퇴직소득금액 (시행령 §202의2)
  const effRate = total > 0 ? lump.tax / total : 0;
  const annual = total / pensionYears;
  let pensionTax = 0;
  for (let k = 1; k <= pensionYears; k++) {
    const t = annual * effRate * L.P[retirementPensionRatioKey(k)] / 100;
    pensionTax += t;
  }
  const pTax = r(pensionTax);
  const pLocal = r(pensionTax * L.P.int_tax_local / 100);
  const pensionTotal = pTax + pLocal;
  const saving = lumpTotal - pensionTotal;
  return {
    main: saving > 0
      ? { label: '연금 수령 시 세금이 적다', value: `${fmt(saving)} 차이` }
      : { label: '세금 차이 없음', value: fmt(0) },
    details: [
      { label: '일시금 — 퇴직소득세', value: fmt(lump.tax) },
      { label: '일시금 — 지방소득세', value: fmt(lump.local) },
      { label: '일시금 세금 합계', value: fmt(lumpTotal) },
      { label: '연금외수령 원천징수세율 (퇴직소득세÷퇴직금)', value: `${(effRate * 100).toFixed(4)}%` },
      { label: `연금 수령 세율 (1~10년차 ${L.P.pension_ret_le10}% · 11~20년차 ${L.P.pension_ret_11_20}% · 21년차~ ${L.P.pension_ret_gt20}% 적용)`, value: `${pensionYears}년 균등 수령` },
      { label: '연금 — 소득세 합계', value: fmt(pTax) },
      { label: '연금 — 지방소득세 합계', value: fmt(pLocal) },
      { label: '연금 세금 합계', value: fmt(pensionTotal) },
      { label: '연간 수령액 (세전)', value: fmt(r(annual)) },
      { label: '⚠️ 연금수령한도', value: '연차별 한도를 넘겨 찾은 금액은 연금외수령(일시금 세율)이다. 수령 기간을 짧게 잡으면 이 비교가 과대해진다 — 한도는 반영하지 않았다' },
      { label: '⚠️ 미반영', value: '운용수익(연금계좌 세율 3~5% 대상)·중도 인출·물가는 계산하지 않았다. 퇴직소득 연금수령분은 금액과 무관하게 분리과세(§14③9가)' },
      ...sourceRow(L.meta, ['pension_ret_le10', 'retinc_svc_le5', 'int_tax_local']),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 연금소득세 — 소득세법 §47의2 · §129①5의2 · §14③9 · §64의4 · §59의4⑨2
// ═════════════════════════════════════════════════════════════════════════════

const PEN_DED_PCT = ['pension_ded_b1', 'pension_ded_b2', 'pension_ded_b3', 'pension_ded_b4'];
const PEN_DED_AMT = ['pension_ded_t1', 'pension_ded_t2', 'pension_ded_t3', 'pension_ded_cap', 'pension_basic_ded', 'pension_std_credit'];

/** 연금소득공제(§47의2①) — 4구간 누적, 한도 900만. */
export function pensionDeduction(annual: number, P: Record<string, number>, A: Record<string, number>): number {
  const raw = piecewise(Math.max(0, annual),
    [A.pension_ded_t1, A.pension_ded_t2, A.pension_ded_t3],
    [P.pension_ded_b1, P.pension_ded_b2, P.pension_ded_b3, P.pension_ded_b4]);
  return Math.min(raw, A.pension_ded_cap);
}

/** 연금만 있는 사람의 종합과세 결정세액(국세) — 연금소득공제 → 기본공제 → 기본세율 → 표준세액공제. */
function pensionComprehensive(annual: number, persons: number, P: Record<string, number>, A: Record<string, number>) {
  const ded = pensionDeduction(annual, P, A);
  const income = Math.max(0, annual - ded);
  const basic = A.pension_basic_ded * persons;
  const base = Math.max(0, income - basic);
  const calc = calcProgressiveTax(base, INCOME_TAX_BRACKETS);
  const tax = r(Math.max(0, calc - A.pension_std_credit));
  return { ded: r(ded), income: r(income), basic, base: r(base), calc: r(calc), tax };
}

export function pensionIncomeTax(v: V): CalcResult {
  const L = load(v,
    [...PEN_DED_PCT, 'pension_priv_lt70', 'pension_priv_70_79', 'pension_priv_80', 'pension_priv_life', 'pension_priv_sep_opt', 'int_tax_local'],
    [...PEN_DED_AMT, 'pension_priv_sep_cap']);
  if (L.missing.length) return noPolicy('연금소득 공제·세율');
  const { P, A } = L;
  const annual = n(v.annualPension);
  const age = n(v.age);
  const persons = Math.max(1, Math.round(n(v.persons) || 1));
  const localPct = P.int_tax_local;
  const assume = { label: '⚠️ 가정', value: '다른 종합소득(근로·사업 등)이 없고, 공제는 기본공제·표준세액공제만 넣었다' };

  if (v.type === 'public') {
    // ⛔ 옛 코드: min(40%, 900만) 한 줄 + 근거 없는 «500만» 공제 + 표준세액공제·지방세 누락.
    //    1,200만: 옛 13.2만 → 법 20.6만(+지방 22.66만).
    const c = pensionComprehensive(annual, persons, P, A);
    const local = r(c.tax * localPct / 100);
    return {
      main: { label: '연금소득세 + 지방소득세 (연간)', value: fmt(c.tax + local) },
      details: [
        { label: '과세 대상 총연금액', value: fmt(annual) },
        { label: '연금소득공제 (4구간 · 한도 적용)', value: fmt(c.ded) },
        { label: '연금소득금액', value: fmt(c.income) },
        { label: `기본공제 (${persons}명)`, value: fmt(c.basic) },
        { label: '과세표준', value: fmt(c.base) },
        { label: '산출세액', value: fmt(c.calc) },
        { label: '표준세액공제', value: fmt(A.pension_std_credit) },
        { label: '연금소득세 (결정세액)', value: fmt(c.tax) },
        { label: `지방소득세 (${localPct}% 근사)`, value: fmt(local) },
        assume,
        { label: '⚠️ 과세 대상분', value: '국민연금은 2002년 이후 납입분에서 나온 연금만 과세된다 — 공단 지급명세의 «과세 대상» 금액을 넣는다(비율 산식은 원문 미대조)' },
        { label: '⚠️ 매월 원천징수', value: '매달은 연금소득 간이세액표로 떼고 이듬해 1월 연말정산한다 — 이 값은 연간 결정세액 근사다' },
        ...sourceRow(L.meta, ['pension_ded_b1', 'pension_basic_ded', 'pension_std_credit']),
      ],
    };
  }

  // 사적연금(연금저축·IRP 의 납입액·운용수익 부분)
  const life = v.lifeAnnuity === 'yes';
  const ageKey = age >= 80 ? 'pension_priv_80' : age >= 70 ? 'pension_priv_70_79' : 'pension_priv_lt70';
  const ratePct = life ? Math.min(P[ageKey], P.pension_priv_life) : P[ageKey];
  const whTax = r(annual * ratePct / 100);
  const whLocal = r(whTax * localPct / 100);
  const details: Row[] = [
    { label: '연간 사적연금 수령액', value: fmt(annual) },
    { label: `원천징수세율 (${life ? '종신계약·' : ''}${age}세)`, value: `${ratePct}% + 지방소득세 ${localPct}%` },
    { label: '매 수령 시 원천징수 합계 (연간)', value: fmt(whTax + whLocal) },
  ];
  if (annual <= A.pension_priv_sep_cap) {
    details.push({ label: '과세 방식', value: `연 ${fmt(A.pension_priv_sep_cap)} 이하 — 원천징수로 끝나는 분리과세(종합과세 합산 선택도 가능)` });
    details.push({ label: '⚠️ 1,500만원 판정', value: '퇴직소득을 연금으로 받는 분·의료목적 등 부득이한 인출분은 합계에서 뺀다(§14③9)' });
    details.push(...sourceRow(L.meta, [ageKey, 'pension_priv_sep_cap', 'int_tax_local']));
    return { main: { label: '연금소득세 + 지방소득세 (연간)', value: fmt(whTax + whLocal) }, details };
  }
  // ⛔ 옛 코드는 금액과 무관하게 5.5% 일괄이었다. 1,500만 초과면 «15% 분리과세» 와 «종합과세» 중 선택(§64의4).
  const sepTax = r(annual * P.pension_priv_sep_opt / 100);
  const sepLocal = r(sepTax * localPct / 100);
  const c = pensionComprehensive(annual, persons, P, A);
  const compLocal = r(c.tax * localPct / 100);
  const sepTotal = sepTax + sepLocal;
  const compTotal = c.tax + compLocal;
  details.push({ label: '과세 방식', value: `연 ${fmt(A.pension_priv_sep_cap)} 초과 — 분리과세 ${P.pension_priv_sep_opt}% 와 종합과세 중 선택` });
  details.push({ label: `① 분리과세 ${P.pension_priv_sep_opt}% (+지방)`, value: fmt(sepTotal) });
  details.push({ label: '② 종합과세 (+지방 근사)', value: fmt(compTotal) });
  details.push({ label: '② 연금소득공제 · 과세표준', value: `${fmt(c.ded)} · ${fmt(c.base)}` });
  details.push({ label: '⚠️ 정산', value: '어느 쪽이든 이미 원천징수된 세액은 5월 신고에서 빼거나 돌려받는다' });
  details.push(assume);
  details.push(...sourceRow(L.meta, ['pension_priv_sep_opt', 'pension_priv_sep_cap', 'pension_ded_b1']));
  const better = sepTotal <= compTotal ? '분리과세' : '종합과세';
  return { main: { label: `연간 세금 — ${better} 선택 시`, value: fmt(Math.min(sepTotal, compTotal)) }, details };
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. 금융소득종합과세 — 소득세법 §14③6·④ · §17③ · §56 · §62 · 시행령 §116의2
// ═════════════════════════════════════════════════════════════════════════════

export function financialIncomeTax(v: V): CalcResult {
  const L = load(v, ['div_grossup', 'int_tax_income', 'div_tax_income', 'int_tax_local'], ['fin_comp_threshold']);
  if (L.missing.length) return noPolicy('금융소득 종합과세');
  const { P, A } = L;
  const interest = n(v.interest);
  const divG = n(v.dividend);          // Gross-up 대상 배당(국내 법인세 과세 법인 배당)
  const divO = n(v.otherDividend);     // Gross-up 비대상 배당(해외주식·ETF 분배금·리츠 등)
  const other = n(v.otherIncome);      // 다른 종합소득 과세표준(소득공제 후)
  const threshold = A.fin_comp_threshold;
  const localPct = P.int_tax_local;
  // §14④ — 기준금액 판정에는 Gross-up 가산액을 넣지 않는다(총수입금액으로 판정).
  const revenue = interest + divG + divO;
  const withheld = r(interest * P.int_tax_income / 100) + r((divG + divO) * P.div_tax_income / 100);
  const gTail = L.meta.div_grossup_2027;
  const scheduleRow: Row[] = typeof P.div_grossup_2027 === 'number'
    ? [{ label: '⚠️ 시행예정', value: `배당 가산율 ${P.div_grossup_2027}% — ${gTail?.from ?? '2027-01-01'} 이후 받는 배당부터. 이 계산은 현행 ${P.div_grossup}% 로 했다` }]
    : [];

  if (revenue <= threshold) {
    return {
      main: { label: '추가 납부세액', value: fmt(0) },
      details: [
        { label: '금융소득 합계 (총수입금액)', value: fmt(revenue) },
        { label: '판정', value: `${fmt(threshold)} 이하 — 원천징수로 끝나는 분리과세(§14③6)` },
        { label: '원천징수 소득세', value: fmt(withheld) },
        { label: `원천징수 지방소득세 (${localPct}%)`, value: fmt(r(withheld * localPct / 100)) },
        ...scheduleRow,
        ...sourceRow(L.meta, ['fin_comp_threshold', 'int_tax_income']),
      ],
    };
  }

  // 배당소득금액 = 총수입 + Gross-up 가산액(§17③)
  const grossUp = divG * P.div_grossup / 100;
  const finAmount = revenue + grossUp;            // 이자소득등의 «금액»
  const excess = finAmount - threshold;
  // 시행령 §116의2 — 이자 → Gross-up 비대상 배당 → Gross-up 대상 배당 순으로 채운다. 대상 배당은 «맨 뒤» 라 초과분에 먼저 걸린다.
  const excessDivG = Math.min(divG + grossUp, Math.max(0, excess));
  // §56①④ — 기준금액을 넘는 대상 배당«금액» 안에 든 가산액. 금액 = 수입×(1+g) 이므로 가산액 = 금액 × g/(1+g).
  const credit = excessDivG * (P.div_grossup / 100) / (1 + P.div_grossup / 100);
  // §62 1호: (초과분 + 다른 종합소득) × 기본세율 + 기준금액 × 14%
  const m1 = calcProgressiveTax(excess + other, INCOME_TAX_BRACKETS) + threshold * P.int_tax_income / 100;
  // §62 2호: 이자소득등 × 원천징수세율 + 다른 종합소득 산출세액
  const otherTax = calcProgressiveTax(other, INCOME_TAX_BRACKETS);
  const m2 = withheld + otherTax;
  const calc = Math.max(m1, m2);
  const useM1 = m1 >= m2;
  const decided = useM1 ? calc - credit : calc;
  const additional = r(Math.max(0, decided - m2));
  const addLocal = r(additional * localPct / 100);
  const creditOverGap = useM1 && credit > m1 - m2;
  return {
    main: { label: '추가 납부세액 (소득세 + 지방소득세)', value: fmt(additional + addLocal) },
    details: [
      { label: '금융소득 합계 (총수입금액 · 판정 기준)', value: fmt(revenue) },
      { label: `Gross-up 가산액 (대상 배당 × ${P.div_grossup}%)`, value: fmt(r(grossUp)) },
      { label: '기준금액 초과 금융소득금액', value: fmt(r(excess)) },
      { label: '① 종합과세 산출세액 (§62 1호)', value: fmt(r(m1)) },
      { label: '② 비교 산출세액 (§62 2호)', value: fmt(r(m2)) },
      { label: '적용 산출세액 (큰 쪽)', value: `${fmt(r(calc))} — ${useM1 ? '①' : '②'}` },
      { label: '배당세액공제 (초과 대상 배당의 가산액)', value: useM1 ? fmt(r(credit)) : '없음 — ② 적용 시 공제하지 않는다' },
      { label: '이미 낸 세금 (원천징수 + 다른 소득 산출세액)', value: fmt(r(m2)) },
      { label: '추가 소득세', value: fmt(additional) },
      { label: `추가 지방소득세 (${localPct}% 근사)`, value: fmt(addLocal) },
      ...(creditOverGap ? [{ label: '⚠️ 공제 한도', value: '배당세액공제가 ①−② 차이보다 크다. 한도 규정의 현행 조문을 원문 대조하지 못했다 — 추가 납부세액을 0 으로 막아 두었다' }] : []),
      { label: '⚠️ 입력 의미', value: '「다른 종합소득」은 근로·사업소득에서 소득공제까지 뺀 «과세표준» 이다. 세액공제는 넣지 않았다' },
      { label: '⚠️ 미반영', value: '비영업대금 이익(25%)·출자공동사업자 배당·외국납부세액공제·국외 원천징수 안 된 소득' },
      ...scheduleRow,
      ...sourceRow(L.meta, ['fin_comp_threshold', 'div_grossup', 'int_tax_income']),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. 배당 — dividend-calc · dividend-income-tax · 소득세법 §129①2나 · §129④
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 미국 배당 원천세 15% — 한미조세협약 배당 제한세율.
 * ⚠️ 조약 원문을 DRF 로 대조하지 않았다(미확정). 법령이 아니라 policy_constants 에 싣지 않고 여기서 «그렇게 말합니다» 로 공개한다.
 */
export const US_DIVIDEND_TREATY_PCT = 15;
const US_TREATY_NOTE = '한미조세협약 제한세율로 알려진 값이다 — 조약 원문 대조 전(미확정). 미국에서 떼고 국내 추가 원천징수는 없다(§129④)';

interface DivParts { income: number; local: number; exempt: boolean; foreign: number }
function dividendParts(gross: number, market: 'kr' | 'us', P: Record<string, number>, A: Record<string, number>, applySmall: boolean): DivParts {
  if (market === 'us') return { income: 0, local: 0, exempt: false, foreign: r(gross * US_DIVIDEND_TREATY_PCT / 100) };
  const income = r(gross * P.div_tax_income / 100);
  if (applySmall && smallExempt(income, A)) return { income: 0, local: 0, exempt: true, foreign: 0 };
  return { income, local: r(income * P.int_tax_local / 100), exempt: false, foreign: 0 };
}

export function dividendCalc(v: V): CalcResult {
  const L = load(v, ['div_tax_income', 'int_tax_local'], ['fin_comp_threshold']);
  if (L.missing.length) return noPolicy('배당소득 원천징수');
  const gross = n(v.investment) * n(v.yieldRate) / 100;
  const market = v.market === 'us' ? 'us' : 'kr';
  // 연간 합계라 지급 건별 소액부징수는 판정하지 않는다.
  const d = dividendParts(gross, market, L.P, L.A, false);
  const tax = d.income + d.local + d.foreign;
  const net = gross - tax;
  const details: Row[] = [{ label: '세전 배당금 (연간)', value: fmt(r(gross)) }];
  if (market === 'kr') {
    details.push({ label: `배당소득세 (${L.P.div_tax_income}%)`, value: fmt(d.income) });
    details.push({ label: `지방소득세 (소득세의 ${L.P.int_tax_local}%)`, value: fmt(d.local) });
  } else {
    details.push({ label: `미국 원천세 (${US_DIVIDEND_TREATY_PCT}%)`, value: fmt(d.foreign) });
    details.push({ label: '⚠️ 미확정', value: US_TREATY_NOTE });
  }
  details.push({ label: '월 배당금 (세후 · 12등분)', value: fmt(r(net / 12)) });
  details.push({ label: '⚠️ 종합과세', value: `이자·배당 합계가 연 ${fmt(L.A.fin_comp_threshold)} 를 넘으면 종합과세 대상 — 금융소득종합과세 계산기` });
  details.push({ label: '⚠️ 미반영', value: '매매 수수료·증권거래세·주가 변동·배당 재투자는 계산하지 않는다(재투자는 배당 재투자 시뮬레이터)' });
  details.push(...sourceRow(L.meta, ['div_tax_income', 'int_tax_local']));
  return { main: { label: '세후 연간 배당금', value: fmt(r(net)) }, details };
}

export function dividendIncomeTax(v: V): CalcResult {
  const L = load(v, ['div_tax_income', 'int_tax_local'], ['wh_small_exempt', 'fin_comp_threshold']);
  if (L.missing.length) return noPolicy('배당소득 원천징수');
  const div = n(v.dividend);
  const market = v.market === 'us' ? 'us' : 'kr';
  const d = dividendParts(div, market, L.P, L.A, true);
  const tax = d.income + d.local + d.foreign;
  const details: Row[] = [];
  if (market === 'kr') {
    details.push({ label: `배당소득세 (${L.P.div_tax_income}%)`, value: d.exempt ? `${fmt(0)} — 소액부징수` : fmt(d.income) });
    details.push({ label: `지방소득세 (소득세의 ${L.P.int_tax_local}%)`, value: fmt(d.local) });
    if (d.exempt) details.push({ label: '소액부징수', value: `원천징수세액이 ${fmt(L.A.wh_small_exempt)} 미만이면 떼지 않는다(§86 1호) — 1회 지급분 기준` });
  } else {
    details.push({ label: `미국 원천세 (${US_DIVIDEND_TREATY_PCT}%)`, value: fmt(d.foreign) });
    details.push({ label: '국내 추가 원천징수', value: `${fmt(0)} — 외국 원천세가 국내 세액보다 크다(§129④)` });
    details.push({ label: '⚠️ 미확정', value: US_TREATY_NOTE });
  }
  details.push({ label: '세후 수령', value: fmt(div - tax) });
  details.push({ label: '⚠️ 종합과세', value: `이자·배당 합계가 연 ${fmt(L.A.fin_comp_threshold)} 를 넘으면 종합과세 대상 — 금융소득종합과세 계산기` });
  details.push(...sourceRow(L.meta, ['div_tax_income', 'wh_small_exempt']));
  return { main: { label: '배당 관련 세금 합계', value: fmt(tax) }, details };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. ETF — 시행령 §26의2④ · 소득세법 §94①3다 · §103①2 · §104①12나
// ═════════════════════════════════════════════════════════════════════════════

export function etfTax(v: V): CalcResult {
  const L = load(v, ['div_tax_income', 'int_tax_local', 'etf_ovs_rate'], ['etf_ovs_basic_ded', 'wh_small_exempt']);
  if (L.missing.length) return noPolicy('ETF 과세');
  const { P, A } = L;
  const profit = n(v.profit);
  const type = String(v.type);
  if (type === 'domesticStock' || type === 'domestic') {
    // ⛔ 옛 코드는 국내 ETF 를 전부 15.4% 로 과세했다. 국내 «주식형» ETF 가 상장주식을 사고팔아 낸 손익은
    //    집합투자기구 이익에서 빠진다(시행령 §26의2④2가). 500만 차익: 옛 77만 → 법 0원.
    return {
      main: { label: '매매차익 세금', value: fmt(0) },
      details: [
        { label: '판정', value: '국내 상장 주식형 ETF — 상장주식 매매·평가손익은 과세 대상 이익에서 뺀다(시행령 §26의2④)' },
        { label: '⚠️ 분배금', value: `분배금(배당·이자 재원)은 따로 ${P.div_tax_income}% + 지방소득세로 원천징수된다` },
        { label: '⚠️ 판단 기준', value: '국내 증시 대표지수를 따르는 주식형인지로 갈린다. 해외지수·채권·원자재·레버리지 합성형은 «국내 상장 기타» 를 고른다' },
        ...sourceRow(L.meta, ['div_tax_income']),
      ],
    };
  }
  if (type === 'domesticOther') {
    const income = r(profit * P.div_tax_income / 100);
    const exempt = smallExempt(income, A);
    const inc = exempt ? 0 : income;
    const local = r(inc * P.int_tax_local / 100);
    return {
      main: { label: '배당소득세 + 지방소득세', value: fmt(inc + local) },
      details: [
        { label: '매도 이익 (입력)', value: fmt(profit) },
        { label: `배당소득세 (${P.div_tax_income}%)`, value: exempt ? `${fmt(0)} — 소액부징수(§86)` : fmt(inc) },
        { label: `지방소득세 (소득세의 ${P.int_tax_local}%)`, value: fmt(local) },
        { label: '⚠️ 과세표준기준가격', value: '실제 과세는 매매차익과 «과세표준기준가격 증가분» 중 작은 쪽이다. 그 산정 규칙은 원문 미대조라 매매차익 전액으로 계산했다 — 실제 세금은 이보다 같거나 작다' },
        { label: '⚠️ 종합과세', value: '배당소득이라 이자·배당 합계 2천만원 판정에 들어간다' },
        ...sourceRow(L.meta, ['div_tax_income', 'int_tax_local']),
      ],
    };
  }
  // 해외 상장 ETF — 해외주식 양도소득
  const base = Math.max(0, profit - A.etf_ovs_basic_ded);
  const income = r(base * P.etf_ovs_rate / 100);
  const local = r(income * P.int_tax_local / 100);
  return {
    main: { label: '양도소득세 + 지방소득세', value: fmt(income + local) },
    details: [
      { label: '양도차익', value: fmt(profit) },
      { label: '기본공제 (연 1회)', value: fmt(A.etf_ovs_basic_ded) },
      { label: '과세표준', value: fmt(base) },
      { label: `양도소득세 (${P.etf_ovs_rate}%)`, value: fmt(income) },
      { label: `지방소득세 (${P.int_tax_local}%)`, value: fmt(local) },
      { label: '⚠️ 기본공제', value: '해외주식·국내 비상장주식 등 같은 그룹 양도차익 «전체» 에 연 1번만 준다 — 다른 해외주식 차익이 있으면 합산한다' },
      { label: '⚠️ 신고', value: '이듬해 5월 양도소득세 확정신고 · 같은 해 손실과 통산' },
      ...sourceRow(L.meta, ['etf_ovs_basic_ded', 'etf_ovs_rate']),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. ISA — 조특법 §91의18
// ═════════════════════════════════════════════════════════════════════════════

export function isaTaxFree(v: V): CalcResult {
  const L = load(v, ['isa_excess_rate', 'int_tax_income', 'int_tax_local'], ['isa_taxfree_general', 'isa_taxfree_low']);
  if (L.missing.length) return noPolicy('ISA 비과세 한도');
  const { P, A } = L;
  const profit = Math.max(0, n(v.profit));
  const limit = v.type === 'lowIncome' ? A.isa_taxfree_low : A.isa_taxfree_general;
  const taxFree = Math.min(profit, limit);
  const excess = Math.max(0, profit - limit);
  const lp = P.int_tax_local / 100;
  const isaIncome = r(excess * P.isa_excess_rate / 100);
  const isaLocal = r(isaIncome * lp);
  const isaTax = isaIncome + isaLocal;
  const genIncome = r(profit * P.int_tax_income / 100);
  const genTax = genIncome + r(genIncome * lp);
  // ⛔ 옛 코드는 «비과세분 × 15.4%» 만 절세로 셌다 — 초과분의 (15.4 − 9.9)% 차익이 빠졌다. 300만: 옛 30.8만 → 36.3만.
  const saved = genTax - isaTax;
  return {
    main: { label: '일반 과세 대비 절세 금액', value: fmt(saved) },
    details: [
      { label: '순이익 (손익통산 후)', value: fmt(profit) },
      { label: '비과세 한도', value: fmt(limit) },
      { label: '비과세분', value: fmt(taxFree) },
      { label: `초과분 분리과세 (${P.isa_excess_rate}% + 지방 ${pctText(P.isa_excess_rate * lp)})`, value: fmt(isaTax) },
      { label: `일반 계좌였다면 (${P.int_tax_income}% + 지방 ${pctText(P.int_tax_income * lp)})`, value: fmt(genTax) },
      { label: '농어촌특별세', value: '없음 — 농특세법 §4 비과세 목록(§91의18)' },
      { label: '⚠️ 비교 가정', value: '일반 계좌에서도 이익 전부가 이자·배당으로 과세된다고 보았다. 국내 상장주식 매매차익처럼 원래 비과세인 이익이 섞이면 절세액은 줄어든다' },
      { label: '⚠️ 서민형 요건', value: '직전 연도 총급여 5천만원 이하 또는 종합소득금액 3,800만원 이하(가입·연장일 기준)' },
      ...sourceRow(L.meta, ['isa_taxfree_general', 'isa_excess_rate']),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 원천징수 — 3.3% · 일용 · 소득 유형별 (소득세법 §129 · §84 · §86 · 시행령 §87 · §149의3)
// ═════════════════════════════════════════════════════════════════════════════

export function withholding33(v: V): CalcResult {
  const L = load(v, ['wh_biz_rate', 'int_tax_local']);
  if (L.missing.length) return noPolicy('사업소득 원천징수');
  const { P } = L;
  const amount = n(v.amount);
  const combined = P.wh_biz_rate * (1 + P.int_tax_local / 100) / 100; // 3% + 3%×10% = 3.3%
  const beforeTax = v.direction === 'beforeTax';
  // 세후 → 세전: 세전 × (1 − 3.3%) = 세후
  const gross = beforeTax ? r(amount / (1 - combined)) : amount;
  const income = r(gross * P.wh_biz_rate / 100);
  const local = r(income * P.int_tax_local / 100);
  const net = gross - income - local;
  const details: Row[] = [
    { label: '세전 지급액', value: fmt(gross) },
    { label: `사업소득세 (${P.wh_biz_rate}%)`, value: fmt(income) },
    { label: `지방소득세 (소득세의 ${P.int_tax_local}%)`, value: fmt(local) },
    { label: '원천징수 합계', value: fmt(income + local) },
    { label: '세후 수령액', value: fmt(net) },
    { label: '소액부징수', value: '적용 안 됨 — 계속·반복 인적용역 사업소득은 1천원 미만이어도 뗀다(§86 1호 · 시행령 §149의3)' },
    { label: '⚠️ 단수 처리', value: '소득세·지방소득세를 따로 원 단위로 반올림했다. 원 미만 절사 규칙은 원문 미대조 — 몇 원 차이가 날 수 있다' },
    { label: '⚠️ 종합소득세', value: '3.3% 는 미리 떼는 세금이다. 이듬해 5월 종합소득세 신고에서 정산해 환급 또는 추가 납부한다(이 계산기는 계산하지 않는다)' },
    ...sourceRow(L.meta, ['wh_biz_rate', 'int_tax_local']),
  ];
  return beforeTax
    ? { main: { label: '세전 금액', value: fmt(gross) }, details }
    : { main: { label: '세후 수령액', value: fmt(net) }, details };
}

export function dailyWorkerTax(v: V): CalcResult {
  const L = load(v, ['daily_wh_rate', 'daily_wh_credit', 'int_tax_local'], ['daily_wage_ded', 'wh_small_exempt']);
  if (L.missing.length) return noPolicy('일용근로소득 원천징수');
  const { P, A } = L;
  const daily = n(v.dailyWage);
  const days = Math.max(1, Math.round(n(v.days) || 1));
  const taxablePerDay = Math.max(0, daily - A.daily_wage_ded);
  const perDay = taxablePerDay * P.daily_wh_rate / 100 * (1 - P.daily_wh_credit / 100);
  const raw = r(perDay * days);
  // ⛔ 옛 코드는 §86 소액부징수를 몰랐다 — 일당 18.7만: 옛 1,099원 → 법 0원.
  const exempt = smallExempt(raw, A);
  const income = exempt ? 0 : raw;
  const local = r(income * P.int_tax_local / 100);
  const pay = daily * days;
  return {
    main: { label: '원천징수세액 (이번 지급분)', value: fmt(income + local) },
    details: [
      { label: '지급액', value: `${fmt(pay)} (${days}일분)` },
      { label: '근로소득공제 (1일)', value: fmt(A.daily_wage_ded) },
      { label: '과세 대상 (1일)', value: fmt(taxablePerDay) },
      { label: `산출세액 (${P.daily_wh_rate}%) − 근로소득세액공제 ${P.daily_wh_credit}%`, value: fmt(raw) },
      { label: '소득세', value: exempt ? `${fmt(0)} — 소액부징수(세액 ${fmt(A.wh_small_exempt)} 미만)` : fmt(income) },
      { label: `지방소득세 (소득세의 ${P.int_tax_local}%)`, value: fmt(local) },
      { label: '실수령', value: fmt(pay - income - local) },
      { label: '⚠️ 판정 단위', value: '소액부징수는 «지급할 때» 원천징수세액으로 판정한다 — 여러 날치를 한꺼번에 주면 합계 세액으로 본다' },
      { label: '⚠️ 단수 처리', value: '원 단위 반올림. 원 미만 절사 규칙은 원문 미대조' },
      ...sourceRow(L.meta, ['daily_wage_ded', 'daily_wh_rate', 'daily_wh_credit', 'wh_small_exempt']),
    ],
  };
}

export function withholdingCalc(v: V): CalcResult {
  const type = String(v.type);
  if (type === 'salary') {
    return {
      main: { label: '원천징수세액', value: '간이세액표 적용' },
      details: [
        { label: '근거', value: '매월 근로소득은 근로소득 간이세액표로 뗀다(§129③) — 급여 실수령액 계산기에서 계산한다' },
      ],
    };
  }
  const L = load(v, ['wh_biz_rate', 'wh_oth_rate', 'wh_oth_exp60', 'wh_oth_exp80', 'int_tax_income', 'int_tax_local'], ['wh_oth_min', 'wh_small_exempt']);
  if (L.missing.length) return noPolicy('원천징수세율');
  const { P, A } = L;
  const amount = n(v.amount);
  const lp = P.int_tax_local / 100;
  const details: Row[] = [{ label: '지급액', value: fmt(amount) }];
  let income = 0;
  let keys: string[] = [];

  if (type === 'interest') {
    income = r(amount * P.int_tax_income / 100);
    details.push({ label: `이자소득세 (${P.int_tax_income}%)`, value: fmt(income) });
    details.push({ label: '소액부징수', value: '적용 안 됨 — 이자소득은 1천원 미만이어도 뗀다(§86 1호)' });
    details.push({ label: '⚠️ 미반영', value: '비영업대금 이익 25%·실지명의 미확인 45%·상호금융 저율과세' });
    keys = ['int_tax_income', 'int_tax_local'];
  } else if (type === 'other') {
    // ⛔ 옛 코드: 기타소득 8.8% 일괄. 8.8% 는 필요경비 60% 가 의제되는 기타소득(강연료·원고료 등)에서만 성립하고,
    //    §84 3호 «기타소득금액 건별 5만원 이하 과세최저한» 이 없었다. 12.5만: 옛 1.1만 → 법 0원.
    const kind = String(v.otherKind || 'exp60');
    const expPct = kind === 'exp80' ? P.wh_oth_exp80 : kind === 'none' ? 0 : P.wh_oth_exp60;
    const otherIncome = amount * (1 - expPct / 100);
    details.push({ label: `필요경비 (${expPct}% 의제)`, value: fmt(r(amount - otherIncome)) });
    details.push({ label: '기타소득금액', value: fmt(r(otherIncome)) });
    if (otherIncome <= A.wh_oth_min) {
      details.push({ label: '과세최저한', value: `기타소득금액이 건별 ${fmt(A.wh_oth_min)} 이하 — 과세하지 않는다(§84 3호)` });
      details.push(...sourceRow(L.meta, ['wh_oth_min', 'wh_oth_exp60']));
      return { main: { label: '원천징수세액', value: fmt(0) }, details: [...details, { label: '세후 수령', value: fmt(amount) }] };
    }
    income = r(otherIncome * P.wh_oth_rate / 100);
    details.push({ label: `기타소득세 (${P.wh_oth_rate}%)`, value: fmt(income) });
    details.push({ label: '⚠️ 유형', value: '60% 경비: 강연료·원고료·인세·자문료 등(시행령 §87 1의2) · 80% 경비: 공익법인 상금·주택입주 지체상금 등 · 복권·연금외수령 등은 세율이 달라 여기서 계산하지 않는다' });
    keys = ['wh_oth_rate', 'wh_oth_exp60', 'wh_oth_min'];
  } else {
    income = r(amount * P.wh_biz_rate / 100);
    details.push({ label: `사업소득세 (${P.wh_biz_rate}%)`, value: fmt(income) });
    details.push({ label: '소액부징수', value: '적용 안 됨 — 계속·반복 인적용역 사업소득(시행령 §149의3)' });
    keys = ['wh_biz_rate', 'int_tax_local'];
  }
  let exempt = false;
  if (type === 'other' && smallExempt(income, A)) { exempt = true; income = 0; }
  const local = r(income * lp);
  if (exempt) details.push({ label: '소액부징수', value: `원천징수세액 ${fmt(A.wh_small_exempt)} 미만 — 떼지 않는다(§86 1호)` });
  details.push({ label: `지방소득세 (소득세의 ${P.int_tax_local}%)`, value: fmt(local) });
  details.push({ label: '세후 수령', value: fmt(amount - income - local) });
  details.push(...sourceRow(L.meta, keys));
  return { main: { label: '원천징수세액 (소득세 + 지방소득세)', value: fmt(income + local) }, details };
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. 가상자산 — 미시행(2027-01-01 양도·대여분부터)
// ═════════════════════════════════════════════════════════════════════════════

export function cryptoTax(v: V): CalcResult {
  const L = load(v, ['crypto_rate'], ['crypto_basic_ded']);
  if (L.missing.length) return noPolicy('가상자산 과세(시행예정)');
  const { P, A, meta } = L;
  const from = meta.crypto_rate?.from ?? '2027-01-01';
  const profit = n(v.profit);
  const base = Math.max(0, profit - A.crypto_basic_ded);
  const income = r(base * P.crypto_rate / 100);
  const today = new Date().toISOString().slice(0, 10);
  const notYet = today < from;
  return {
    main: { label: notYet ? `미시행 시뮬레이션 — ${from} 이후 양도·대여분부터` : '가상자산 소득세', value: fmt(income) },
    details: [
      { label: '연간 가상자산소득금액 (손익 통산 후)', value: fmt(profit) },
      { label: '기본공제 (연)', value: fmt(A.crypto_basic_ded) },
      { label: '과세표준', value: fmt(base) },
      { label: `소득세 (${P.crypto_rate}% 분리과세)`, value: fmt(income) },
      { label: '⚠️ 지방소득세', value: '분리과세 가상자산소득의 지방소득세 조문을 원문 대조하지 못했다(미확정) — 합계에 넣지 않았다' },
      { label: '⚠️ 시행', value: `현행 소득세법에는 이 조문이 아직 없다. 시행일 ${from} — 이미 세 번 연기됐다(2021·2022·2024 개정)` },
      { label: '⚠️ 취득가액', value: '시행일 전부터 보유한 자산은 «2026-12-31 시가» 와 실제 취득가액 중 큰 금액을 취득가액으로 본다(시행예정 §37⑤)' },
      ...sourceRow(meta, ['crypto_rate', 'crypto_basic_ded']),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. 금융투자소득세 — 폐지된 제도
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ⛔ 계산을 멈춘다. 근거 장(소득세법 제2장의2, §87의2~§87의27)이 2024-12-31 «전부 삭제» 됐다.
 *    옛 화면의 「시행 유예 중」은 거짓이었고, 22%·27.5%(지방세 포함 율)에 ×1.1 을 또 곱해 지방세를 이중으로 얹었다.
 *    1억 수익에 1,210만원 — 없는 세금이었다.
 */
export function fisTaxSim(): CalcResult {
  return {
    main: { label: '폐지된 제도', value: '계산하지 않음', color: 'var(--text-tertiary)' },
    details: [
      { label: '근거', value: '소득세법 제2장의2(제87조의2~제87조의27) — 2024-12-31 전부 삭제(법률 제20615호)' },
      { label: '현행 국내 상장주식', value: '소액주주가 증권시장에서 판 차익은 양도소득세 과세 대상이 아니다(§94①3가)' },
      { label: '대주주', value: '대주주 양도소득세 계산기에서 계산한다' },
      { label: '해외주식', value: '해외주식 양도소득세 계산기에서 계산한다(연 250만원 공제)' },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. 가산세 — 국세기본법 §47의2~§48 · 국기령 §27의4
// ═════════════════════════════════════════════════════════════════════════════

/** 법정신고기한 경과 개월 → 감면율 키(§48②). 개월 경계는 조문 뼈대. */
export function penaltyCutKey(kind: 'late' | 'amend', months: number): string | null {
  if (months <= 0) return null;
  if (kind === 'late') {
    if (months <= 1) return 'penalty_cut_late_1m';
    if (months <= 3) return 'penalty_cut_late_3m';
    if (months <= 6) return 'penalty_cut_late_6m';
    return null;
  }
  if (months <= 1) return 'penalty_cut_amend_1m';
  if (months <= 3) return 'penalty_cut_amend_3m';
  if (months <= 6) return 'penalty_cut_amend_6m';
  if (months <= 12) return 'penalty_cut_amend_12m';
  if (months <= 18) return 'penalty_cut_amend_18m';
  if (months <= 24) return 'penalty_cut_amend_24m';
  return null;
}

export function penaltyTax(v: V): CalcResult {
  const L = load(v, [
    'penalty_nofile', 'penalty_nofile_fraud', 'penalty_under', 'penalty_under_fraud',
    'penalty_late_daily', 'penalty_late_monthly', 'penalty_notice',
    'penalty_cut_late_1m', 'penalty_cut_late_3m', 'penalty_cut_late_6m',
    'penalty_cut_amend_1m', 'penalty_cut_amend_3m', 'penalty_cut_amend_6m', 'penalty_cut_amend_12m', 'penalty_cut_amend_18m', 'penalty_cut_amend_24m',
  ], ['penalty_monthly_min']);
  if (L.missing.length) return noPolicy('가산세율');
  const { P, A, meta } = L;
  const type = String(v.type);
  const amount = n(v.taxAmount);
  const fraud = v.fraud === 'yes';

  if (type === 'noFiling' || type === 'underReport') {
    const isNo = type === 'noFiling';
    const key = isNo ? (fraud ? 'penalty_nofile_fraud' : 'penalty_nofile') : (fraud ? 'penalty_under_fraud' : 'penalty_under');
    const base = r(amount * P[key] / 100);
    const months = Math.max(0, Math.round(n(v.monthsLate)));
    const cutKey = months > 0 ? penaltyCutKey(isNo ? 'late' : 'amend', months) : null;
    const cutPct = cutKey ? P[cutKey] : 0;
    const cut = r(base * cutPct / 100);
    const details: Row[] = [
      { label: isNo ? '무신고 납부세액' : '과소신고 납부세액', value: fmt(amount) },
      { label: `${isNo ? '무신고' : '과소신고'}가산세 (${P[key]}%${fraud ? ' · 부정행위' : ''})`, value: fmt(base) },
    ];
    if (months > 0) {
      details.push(cutKey
        ? { label: `${isNo ? '기한 후 신고' : '수정신고'} 감면 (${months}개월 이내 구간 · ${cutPct}%)`, value: `−${fmt(cut)}` }
        : { label: `${isNo ? '기한 후 신고' : '수정신고'} 감면`, value: `없음 — ${isNo ? '6개월' : '2년'}을 넘겼다` });
      details.push({ label: '⚠️ 감면 제외', value: '세무서가 경정·결정할 것을 미리 알고 신고하면 감면하지 않는다(§48②)' });
    }
    details.push({ label: '⚠️ 별도', value: '세금을 늦게 낸 기간의 납부지연가산세가 따로 붙는다 — 종류에서 「납부지연」을 골라 더한다' });
    details.push({ label: '⚠️ 미반영', value: '역외거래 부정행위 60% · 복식부기의무자 수입금액 기준 가산세(무신고 1만분의 7 등)와의 비교 · 영세율 과세표준 가산' });
    details.push(...sourceRow(meta, [key, ...(cutKey ? [cutKey] : [])]));
    return { main: { label: '가산세', value: fmt(base - cut) }, details };
  }

  // 납부지연가산세 — §47의4①1·1의2·3
  const days = Math.max(0, Math.round(n(v.days)));
  const daily = r(amount * days * P.penalty_late_daily / 100);
  const noticed = v.noticed === 'yes';
  const details: Row[] = [
    { label: '미납 세액', value: fmt(amount) },
    { label: `법정납부기한 다음 날~납부(고지)일 전날 ${days}일 × 1일 ${P.penalty_late_daily}%`, value: fmt(daily) },
  ];
  let total = daily;
  if (noticed) {
    const notice = r(amount * P.penalty_notice / 100);
    // ⑦ 5년 한도 — 개월 수로 60개월
    const months = Math.min(60, Math.max(0, Math.round(n(v.monthsAfterDue))));
    const monthlyApplies = amount >= A.penalty_monthly_min;
    const monthly = monthlyApplies ? r(amount * months * P.penalty_late_monthly / 100) : 0;
    total += notice + monthly;
    details.push({ label: `고지 후 지정납부기한까지 안 낸 세액 × ${P.penalty_notice}%`, value: fmt(notice) });
    details.push(monthlyApplies
      ? { label: `지정납부기한 뒤 ${months}개월 × 월 ${P.penalty_late_monthly}%`, value: fmt(monthly) }
      : { label: '지정납부기한 뒤 월 가산', value: `없음 — 고지서별·세목별 세액 ${fmt(A.penalty_monthly_min)} 미만(§47의4⑧)` });
    details.push({ label: '⚠️ 적용 시기', value: `월 ${P.penalty_late_monthly}% 는 ${meta.penalty_late_monthly?.from ?? '2026-07-01'} 이후 지정납부기한이 지난 분부터다. 그 전에 지난 분은 종전 규정(1일 ${P.penalty_late_daily}% 계속)` });
    details.push({ label: '⚠️ 한도', value: '지정납부기한 뒤 기간은 5년까지만 센다(§47의4⑦)' });
  }
  details.push({ label: '⚠️ 미반영', value: '독촉 비용(등기우편 요금) · 인지세 전용 가산세' });
  details.push(...sourceRow(meta, ['penalty_late_daily', ...(noticed ? ['penalty_late_monthly'] : [])]));
  return { main: { label: '납부지연가산세', value: fmt(total) }, details };
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. 주택임대소득 분리과세 — 소득세법 §14③7 · §64의2 · 조특법 §96
// ═════════════════════════════════════════════════════════════════════════════

const RENT_CUT_KEYS: Record<string, string> = {
  one: 'rent_small_cut_1', oneLong: 'rent_small_cut_1_long', multi: 'rent_small_cut_2', multiLong: 'rent_small_cut_2_long',
};

export function rentalIncomeTax(v: V): CalcResult {
  const L = load(v,
    ['rent_sep_rate', 'rent_sep_exp_reg', 'rent_sep_exp_unreg', 'int_tax_local', ...Object.values(RENT_CUT_KEYS)],
    ['rent_sep_ded_reg', 'rent_sep_ded_unreg', 'rent_sep_other_cap', 'rent_sep_revenue_cap']);
  if (L.missing.length) return noPolicy('주택임대소득 분리과세');
  const { P, A, meta } = L;
  const rent = n(v.annualRent);
  const other = n(v.otherIncome);
  const reg = v.registered === 'yes';

  // ⛔ 옛 코드: 수입 2천만 초과도 분리과세로 계산했다(§14③7 위반).
  if (rent > A.rent_sep_revenue_cap) {
    return {
      main: { label: '분리과세 불가 — 종합과세 대상', value: '계산하지 않음', color: 'var(--text-tertiary)' },
      details: [
        { label: '주택임대 총수입금액', value: fmt(rent) },
        { label: '판정', value: `연 ${fmt(A.rent_sep_revenue_cap)} 초과 — 분리과세를 고를 수 없다(§14③7)` },
        { label: '종합과세', value: '장부 또는 추계 경비율·인적공제에 달려 이 계산기는 계산하지 않는다 — 종합소득세 계산기' },
        ...sourceRow(meta, ['rent_sep_revenue_cap']),
      ],
    };
  }
  const expPct = reg ? P.rent_sep_exp_reg : P.rent_sep_exp_unreg;
  const expense = rent * expPct / 100;
  // ⛔ 옛 코드: 추가공제 400/200만을 무조건 뺐다. «분리과세 주택임대소득을 뺀 종합소득금액 2천만원 이하» 일 때만이다(§64의2②).
  //    수입 1,500만·다른 소득 4,000만·등록: 옛 28만 → 법 84만(+지방 92.4만).
  const dedEligible = other <= A.rent_sep_other_cap;
  const ded = dedEligible ? (reg ? A.rent_sep_ded_reg : A.rent_sep_ded_unreg) : 0;
  const base = Math.max(0, rent - expense - ded);
  const calc = r(base * P.rent_sep_rate / 100);
  const cutKey = RENT_CUT_KEYS[String(v.smallCut)] ?? null;
  const cutPct = cutKey ? P[cutKey] : 0;
  const cut = r(calc * cutPct / 100);
  const income = calc - cut;
  const local = r(income * P.int_tax_local / 100);
  return {
    main: { label: '분리과세 세액 (소득세 + 지방소득세)', value: fmt(income + local) },
    details: [
      { label: '주택임대 총수입금액', value: fmt(rent) },
      { label: `필요경비 (${expPct}% · ${reg ? '등록임대주택' : '미등록'})`, value: fmt(r(expense)) },
      { label: '추가공제', value: dedEligible ? fmt(ded) : `없음 — 다른 종합소득금액이 ${fmt(A.rent_sep_other_cap)} 초과` },
      { label: '사업소득금액 (과세표준)', value: fmt(r(base)) },
      { label: `산출세액 (${P.rent_sep_rate}%)`, value: fmt(calc) },
      ...(cutKey ? [{ label: `소형주택 임대사업자 감면 (${cutPct}%)`, value: `−${fmt(cut)}` }] : []),
      { label: '소득세', value: fmt(income) },
      { label: `지방소득세 (${P.int_tax_local}% 근사)`, value: fmt(local) },
      { label: '⚠️ 종합과세 비교', value: '종합과세를 고를 수도 있다. 그 세액은 장부·추계 경비율과 인적공제에 달려 이 계산기는 계산하지 않는다' },
      { label: '⚠️ 등록임대주택', value: '민간임대주택법 임대사업자 등록 + 세무서 사업자등록 + 임대료 증액 5% 이하 — 셋 다 충족해야 60%·400만원(시행령 §122의2)' },
      { label: '⚠️ 미반영', value: '1주택 비과세(기준시가 12억 이하 등)·주택 수 판정·간주임대료(보증금) — 간주임대료 계산기' },
      ...sourceRow(meta, ['rent_sep_rate', 'rent_sep_other_cap', 'rent_sep_revenue_cap', ...(cutKey ? [cutKey] : [])]),
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. 간주임대료 — 소득세법 §25① · 시행령 §53①③ · 시행규칙 §23①
// ═════════════════════════════════════════════════════════════════════════════

export function deemedRent(v: V): CalcResult {
  const L = load(v, ['deemed_rent_rate', 'deemed_rent_ratio'], ['deemed_rent_base', 'deemed_rent_2house_base']);
  if (L.missing.length) return noPolicy('간주임대료 이자율');
  const { P, A, meta } = L;
  const deposit = n(v.deposit);
  const houses = Math.max(0, Math.round(n(v.houseCount)));
  const finIncome = n(v.financialIncome);
  // §25①: 3주택 이상 + 보증금 합계 3억 초과 · 2주택(기준시가 12억 이하 제외) + 12억 초과
  const applies = houses >= 3 ? deposit > A.deemed_rent_base
    : houses === 2 ? deposit > A.deemed_rent_2house_base
    : false;
  if (!applies) {
    return {
      main: { label: '간주임대료', value: `${fmt(0)} — 대상 아님` },
      details: [
        { label: '판정', value: houses >= 3
          ? `3주택 이상이지만 보증금 합계가 ${fmt(A.deemed_rent_base)} 이하`
          : houses === 2
            ? `2주택은 보증금 합계 ${fmt(A.deemed_rent_2house_base)} 초과일 때만`
            : '1주택 이하는 보증금에 간주임대료를 매기지 않는다' },
        { label: '⚠️ 주택 수', value: '전용 40㎡ 이하·기준시가 2억원 이하 주택은 2026-12-31까지 주택 수에서 뺀다. 2주택 판정에서는 기준시가 12억원 이하 주택도 뺀다' },
        ...sourceRow(meta, ['deemed_rent_base', 'deemed_rent_2house_base']),
      ],
    };
  }
  // ⛔ 옛 코드: (보증금 − 입력 기준) × 2.1% — 60% 가 빠졌고 이자율이 옛값이었다. 5억: 옛 420만 → 법 372만.
  const excess = Math.max(0, deposit - A.deemed_rent_base);
  const gross = excess * P.deemed_rent_ratio / 100 * P.deemed_rent_rate / 100;
  const amount = r(Math.max(0, gross - finIncome));
  return {
    main: { label: '총수입금액 산입액 (간주임대료)', value: fmt(amount) },
    details: [
      { label: `보증금 합계 − ${fmt(A.deemed_rent_base)}`, value: fmt(excess) },
      { label: `× ${P.deemed_rent_ratio}% × 정기예금이자율 ${P.deemed_rent_rate}%`, value: fmt(r(gross)) },
      { label: '− 임대사업부분 금융수익 (이자·배당)', value: fmt(finIncome) },
      { label: '⚠️ 성격', value: '세금이 아니라 사업소득 «수입금액» 에 더하는 금액이다. 세액은 임대소득 과세 방식에 따라 따로 계산한다' },
      { label: '⚠️ 기간', value: '보증금을 1년 내내 받았다고 보았다. 실제는 매일 잔액의 적수 ÷ 365(윤년 366)' },
      { label: '⚠️ 이자율', value: `정기예금이자율은 매년 시행규칙으로 고친다 — ${meta.deemed_rent_rate?.date ?? ''} 기준값` },
      ...sourceRow(meta, ['deemed_rent_ratio', 'deemed_rent_rate', 'deemed_rent_2house_base']),
    ],
  };
}
