// K-9 inh 클러스터 — 상속세·가업상속·부담부증여·세대생략증여·증여공제 조회 (2026-09-17)
//
// 정본: policy_constants (마이그레이션 k9_inh_policy_constants_2026-09-17.sql).
// 원문: 국가법령정보센터 DRF eflaw «현행 시행본» 직접 대조 —
//   상속세 및 증여세법 MST 276123(시행 2026-01-02, 해당 조문은 법률 21219 판과 동일) ·
//   소득세법 MST 280405(시행 2026-07-01) · 지방세법 MST 282559(시행 2026-07-01).
//   세 법 모두 2026-09-17 이후 시행예정 판의 해당 조문이 현행과 같거나(소득세법 §55·§103, 지방세법 §92) 시행예정 판이 없다(상증법).
//
// ⛔ 상속세는 «현행 유산세 방식»(피상속인 기준 합산)이다. 정부 유산취득세 개편안은 공포된 법률이 없다.
// ⛔ 없는 키를 기본값으로 때우지 않는다 — 주입이 없으면 「세율 기준 미수신」.
import type { CalcResult } from '../formulas';
import { parsePolicyPack, type PolicyPack } from '../gov-tables';
import { calcProgressiveTax, formatKRWExact, INCOME_TAX_BRACKETS } from '../tax-tables';

export type V = Record<string, number | string>;
type Row = { label: string; value: string };

export const fmt = (x: number) => formatKRWExact(x);
export const num = (x: unknown) => Number(x) || 0;

/** 정수 금액 × 퍼센트 → 원 미만 절사. 0.7% 같은 이진 부동소수 오차를 피하려고 천분의 일 퍼센트 정수로 곱한다. */
export function pctOf(amount: number, pct: number): number {
  const a = Math.floor(Math.max(0, amount));
  return Math.floor((a * Math.round(pct * 1000)) / 100000);
}

export const MISSING: CalcResult = {
  main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
  details: [{ label: '사유', value: '법정 세율·공제 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
};

export interface Bracket { lower: number; upto: number; ratePct: number; base: number }

/**
 * 누진표를 주입값으로 조립한다. 구간 경계(uptoKeys)·세율(rateKeys) 모두 policy_constants 행이다.
 * 각 구간의 «기본세액»(법조문의 「1천만원 + 초과분 20%」 의 1천만원)은 연속성으로 유도한다 —
 * 원문 표에 적힌 금액과 같은지 테스트가 지킨다.
 */
export function packBrackets(pack: PolicyPack | null, rateKeys: string[], uptoKeys: string[]): Bracket[] | null {
  if (!pack || rateKeys.length !== uptoKeys.length + 1) return null;
  const out: Bracket[] = [];
  let lower = 0;
  let base = 0;
  for (let i = 0; i < rateKeys.length; i++) {
    const ratePct = pack.pct?.[rateKeys[i]];
    const upto = i < uptoKeys.length ? pack.amt?.[uptoKeys[i]] : Infinity;
    if (typeof ratePct !== 'number' || typeof upto !== 'number') return null;
    out.push({ lower, upto, ratePct, base });
    if (upto !== Infinity) base += pctOf(upto - lower, ratePct);
    lower = upto;
  }
  return out;
}

export function progressive(amount: number, br: Bracket[]): number {
  const x = Math.floor(Math.max(0, amount));
  for (const b of br) if (x <= b.upto) return b.base + pctOf(x - b.lower, b.ratePct);
  return 0;
}

export const bracketOf = (amount: number, br: Bracket[]) => br.find((b) => Math.max(0, amount) <= b.upto)!;

export function source(pack: PolicyPack | null, ...keys: string[]): Row[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const k of keys) {
    const m = pack?.meta?.[k];
    if (!m?.source || seen.has(m.source)) continue;
    seen.add(m.source);
    parts.push(m.source);
  }
  const date = keys.map((k) => pack?.meta?.[k]?.date).find(Boolean);
  return parts.length ? [{ label: '근거', value: [parts.join(' · '), date ? `공포 ${date}` : ''].filter(Boolean).join(' · ') }] : [];
}

// ── 상속·증여세 공통 누진표 (상증법 §26, 증여는 §56 이 §26 을 준용) ──
export const INH_RATE_KEYS = ['inh_rate_b1', 'inh_rate_b2', 'inh_rate_b3', 'inh_rate_b4', 'inh_rate_b5'];
export const INH_UPTO_KEYS = ['inh_rate_upto_b1', 'inh_rate_upto_b2', 'inh_rate_upto_b3', 'inh_rate_upto_b4'];

/** 과세표준 → 산출세액 · (할증) · 신고세액공제(§69) · 납부세액. 공유 성분이라 네 계산기가 같은 함수를 쓴다. */
export function transferTaxParts(taxBase: number, br: Bracket[], creditPct: number, surchargePct = 0) {
  const calc = progressive(taxBase, br);
  const surcharge = pctOf(calc, surchargePct);
  // §69: (산출세액 + 할증) − 징수유예·공제감면 의 100분의 3. 이 계산기에는 징수유예·감면 입력이 없다.
  const credit = pctOf(calc + surcharge, creditPct);
  return { calc, surcharge, credit, pay: calc + surcharge - credit, ratePct: bracketOf(taxBase, br).ratePct };
}

// ═══ 1. 상속세 (inheritance-tax) ═══

export function inheritanceTax(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const br = packBrackets(pack, INH_RATE_KEYS, INH_UPTO_KEYS);
  const need = ['inh_ded_basic', 'inh_ded_child', 'inh_ded_minor_yr', 'inh_ded_senior', 'inh_ded_lump', 'inh_ded_spouse_min', 'inh_ded_spouse_max', 'inh_ded_fin_floor', 'inh_ded_fin_max', 'inh_taxfloor'];
  if (!br || need.some((k) => typeof A[k] !== 'number') || typeof P.inh_ded_fin_rate !== 'number' || typeof P.inh_filing_credit !== 'number') return MISSING;

  const net = Math.max(0, Math.floor(num(v.totalEstate) - num(v.debts)));
  const hasSpouse = v.hasSpouse === 'yes';
  const children = Math.max(0, Math.floor(num(v.childCount)));
  const minorYears = Math.max(0, Math.floor(num(v.minorYears)));
  const seniors = Math.max(0, Math.floor(num(v.seniorCount)));
  const finNet = Math.max(0, Math.floor(num(v.netFinancial)));
  const spouseSole = hasSpouse && children === 0;

  // §18 기초 + §20① 인적공제(자녀 1인 5천만 · 미성년 1천만×19세까지 연수 · 65세 이상 5천만). §20① 후단: 자녀이면서 미성년이면 합산.
  const personal = A.inh_ded_basic + A.inh_ded_child * children + A.inh_ded_minor_yr * minorYears + A.inh_ded_senior * seniors;
  // §21①: 기초+인적공제 합과 5억 중 큰 금액. §21②: 배우자 단독상속이면 합계로만.
  const lump = spouseSole ? personal : Math.max(personal, A.inh_ded_lump);

  // §19①: 실제 상속받은 금액 — 한도 min[(상속재산−유증+사전증여)×법정상속분 − 사전증여 과세표준, 30억]. §19④: 5억 미만이면 5억.
  //   법정상속분(민법 §1009): 배우자 1.5 : 자녀 각 1 → 3/(3+2n). 자녀가 없으면 단독상속으로 본다.
  let spouseDed = 0;
  let spouseLimit = 0;
  let spouseActual = 0;
  if (hasSpouse) {
    spouseLimit = Math.min(Math.floor((net * 3) / (3 + 2 * children)), A.inh_ded_spouse_max);
    spouseActual = v.spouseMode === 'custom' ? Math.max(0, Math.floor(num(v.spouseAmount))) : spouseLimit;
    spouseDed = Math.max(A.inh_ded_spouse_min, Math.min(spouseActual, spouseLimit));
  }

  // §22①: 순금융재산 2천만 이하 전액 · 초과 시 max(20%, 2천만) · 한도 2억.
  const finDed = finNet <= A.inh_ded_fin_floor ? finNet : Math.min(A.inh_ded_fin_max, Math.max(pctOf(finNet, P.inh_ded_fin_rate), A.inh_ded_fin_floor));

  // §24 공제 적용 한도 — 이 계산기에는 비상속인 유증·사전증여 입력이 없으므로 한도 = 과세가액.
  const totalDed = Math.min(net, lump + spouseDed + finDed);
  const taxBase = Math.max(0, net - totalDed);
  // §25②: 과세표준 50만원 미만이면 부과하지 아니한다.
  const exempt = taxBase < A.inh_taxfloor;
  const t = transferTaxParts(exempt ? 0 : taxBase, br, P.inh_filing_credit);

  const details: Row[] = [
    { label: '과세가액 (재산 − 채무·공과금)', value: fmt(net) },
    spouseSole
      ? { label: '기초·인적공제 (배우자 단독상속 — 일괄공제 불가 §21②)', value: fmt(lump) }
      : { label: lump === A.inh_ded_lump ? `일괄공제 (기초·인적공제 합 ${fmt(personal)} 보다 큼)` : '기초공제 + 인적공제 (일괄공제 5억보다 큼)', value: fmt(lump) },
  ];
  if (hasSpouse) {
    details.push({ label: `배우자상속공제 (한도 ${fmt(spouseLimit)} · 실제 ${fmt(spouseActual)} · 최소 ${fmt(A.inh_ded_spouse_min)})`, value: fmt(spouseDed) });
  }
  if (finNet > 0) details.push({ label: '금융재산상속공제', value: fmt(finDed) });
  details.push({ label: '과세표준', value: fmt(taxBase) });
  if (exempt && taxBase > 0) details.push({ label: '과세최저한', value: `과세표준 ${fmt(A.inh_taxfloor)} 미만 — 부과하지 않는다(§25②)` });
  details.push({ label: `산출세액 (최고 구간 ${t.ratePct}%)`, value: fmt(t.calc) });
  details.push({ label: `신고세액공제 (${P.inh_filing_credit}%)`, value: `−${fmt(t.credit)}` });
  if (hasSpouse) {
    details.push({ label: '⚠️ 배우자공제 가정', value: v.spouseMode === 'custom'
      ? '입력한 금액을 배우자가 실제 상속받는다고 보고 계산했다. 신고기한 다음날부터 9개월 안에 분할(등기 등)해야 인정된다(§19②)'
      : `배우자가 법정상속분(배우자 1.5 : 자녀 각 1)만큼 실제 상속받는다고 가정했다. 덜 받으면 공제가 줄어 세금이 늘어난다. 분할기한: 신고기한 다음날부터 9개월(§19②)` });
  }
  if (spouseSole) details.push({ label: '⚠️ 상속인 가정', value: '자녀가 0명이라 배우자 단독상속으로 봤다. 직계존속(부모)과 공동상속이면 법정상속분·일괄공제가 달라진다' });
  details.push({ label: '방식', value: '현행 유산세 방식(피상속인 재산 전체에 과세) — 상속세 및 증여세법 2026-01-01 시행 판. 유산취득세 개편안은 공포된 법률이 없다' });
  details.push({ label: '미반영', value: '10년 내 사전증여 합산(§13)·동거주택상속공제(§23의2)·장애인공제(§20①4)·세대생략 할증(§27)·감정평가수수료·가업/영농상속공제 — 해당하면 결과가 달라진다' });
  details.push(...source(pack, 'inh_rate_b1', 'inh_ded_spouse_max', 'inh_filing_credit'));
  return { main: { label: '상속세 (기한 내 신고 시 납부세액)', value: fmt(t.pay) }, details };
}

// ═══ 2. 가업상속공제 (family-business) ═══

/** §18의2① 경영기간 문턱(년). 조문 구조(10·20·30년 이상)라 행이 아니라 코드에 둔다. 한도 금액은 policy. */
export const BIZ_YEARS = [
  { minYears: 30, key: 'biz_inh_limit_30y' },
  { minYears: 20, key: 'biz_inh_limit_20y' },
  { minYears: 10, key: 'biz_inh_limit_10y' },
] as const;

export function familyBusiness(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const br = packBrackets(pack, INH_RATE_KEYS, INH_UPTO_KEYS);
  if (!br || BIZ_YEARS.some((b) => typeof A[b.key] !== 'number') || typeof A.biz_inh_rev_cap !== 'number' || typeof P.inh_filing_credit !== 'number') return MISSING;

  const value = Math.max(0, Math.floor(num(v.businessValue)));
  const years = Math.max(0, num(v.years));
  const overCap = v.revenueOver === 'yes';
  const tier = BIZ_YEARS.find((b) => years >= b.minYears);
  const limit = tier ? A[tier.key] : 0;
  const deduction = overCap ? 0 : Math.min(value, limit);

  const before = transferTaxParts(value, br, P.inh_filing_credit);
  const after = transferTaxParts(value - deduction, br, P.inh_filing_credit);
  const saving = before.pay - after.pay;

  const details: Row[] = [];
  if (overCap) details.push({ label: '공제 불가', value: `직전 3개 사업연도 매출액 평균 ${fmt(A.biz_inh_rev_cap)} 이상 기업은 가업에서 제외된다(§18의2①)` });
  else if (!tier) details.push({ label: '공제 불가', value: '피상속인이 10년 이상 계속 경영한 기업이어야 한다(§18의2①)' });
  details.push({ label: `가업상속공제 한도 (경영 ${years}년)`, value: tier ? fmt(limit) : '없음' });
  details.push({ label: '가업상속공제', value: fmt(deduction) });
  details.push({ label: '공제 전 상속세 (신고세액공제 후)', value: fmt(before.pay) });
  details.push({ label: '공제 후 상속세 (신고세액공제 후)', value: fmt(after.pay) });
  details.push({ label: '⚠️ 비교 방식', value: '가업 재산가액만 과세표준으로 놓고 공제 전·후를 비교했다. 일괄·배우자공제와 다른 상속재산은 넣지 않았다 — 실제 절감액은 전체 상속재산의 누진 구간에 따라 달라진다' });
  details.push({ label: '⚠️ 사후관리', value: '상속 후 5년 안에 가업용 자산 40% 이상 처분·가업 미종사·지분 감소·고용 또는 총급여 5년 평균 90% 미달이면 공제액을 추징한다(§18의2⑤)' });
  details.push({ label: '미반영', value: '가업상속 재산가액 범위(사업무관자산 제외, 시행령 §15)·중견기업의 가업 외 상속재산 요건(§18의2②)·피상속인/상속인 요건' });
  details.push(...source(pack, 'biz_inh_limit_10y', 'inh_rate_b1', 'inh_filing_credit'));
  return { main: { label: '상속세 절감액 (가업 재산만 비교)', value: fmt(saving) }, details };
}

// ═══ 3. 증여재산공제 (공유: gift-exemption-lookup · burden-gift · generation-skip) ═══

export const GIFT_REL = {
  spouse: { label: '배우자로부터', key: 'gift_ded_spouse', ascendant: false },
  adultChild: { label: '직계존속으로부터 — 성년 수증자', key: 'gift_ded_ascendant', ascendant: true },
  minorChild: { label: '직계존속으로부터 — 미성년 수증자', key: 'gift_ded_ascendant_minor', ascendant: true },
  descendant: { label: '직계비속으로부터 (자녀 → 부모 등)', key: 'gift_ded_descendant', ascendant: false },
  otherRelative: { label: '4촌 이내 혈족·3촌 이내 인척', key: 'gift_ded_relative', ascendant: false },
  other: { label: '그 밖의 사람 (친족 아님)', key: null, ascendant: false },
} as const;
export type GiftRel = keyof typeof GIFT_REL;

export function giftExemptionLookup(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const A = pack?.amt ?? {};
  const rel = (String(v.relationship) in GIFT_REL ? v.relationship : 'adultChild') as GiftRel;
  const info = GIFT_REL[rel];
  if (info.key && typeof A[info.key] !== 'number') return MISSING;
  if (typeof A.gift_ded_marriage_birth !== 'number') return MISSING;

  if (!info.key) {
    return {
      main: { label: '증여재산공제', value: '공제 없음' },
      details: [
        { label: '관계', value: info.label },
        { label: '사유', value: '§53 공제는 배우자·직계존비속·4촌 이내 혈족·3촌 이내 인척에게만 있다 — 증여재산 전액이 과세가액이다' },
        ...source(pack, 'gift_ded_relative'),
      ],
    };
  }
  const base = A[info.key];
  const withMB = info.ascendant && v.marriageBirth === 'yes';
  const details: Row[] = [
    { label: '관계', value: info.label },
    { label: '증여재산공제 (§53)', value: fmt(base) },
    { label: '기간', value: '수증자 기준 증여 전 10년 안에 같은 공제를 받은 금액과 합산한 한도다' },
  ];
  if (info.ascendant) {
    details.push(withMB
      ? { label: '혼인·출산 증여재산공제 (§53의2, 별개)', value: fmt(A.gift_ded_marriage_birth) }
      : { label: '혼인·출산 공제 (선택 안 함)', value: `혼인신고일 전후 2년 또는 자녀 출생·입양일부터 2년 안의 증여면 ${fmt(A.gift_ded_marriage_birth)} 추가(두 사유 합산 한도)` });
  }
  details.push(...source(pack, info.key, ...(info.ascendant ? ['gift_ded_marriage_birth'] : [])));
  return { main: { label: withMB ? '공제 합계 (§53 + 혼인·출산)' : '증여재산공제 한도', value: fmt(base + (withMB ? A.gift_ded_marriage_birth : 0)) }, details };
}

// ═══ 4. 부담부증여 (burden-gift) ═══

/**
 * 양도세 쪽 성분 — 소득세법 §95②(장기보유특별공제 표1) · §103①(기본공제 250만) · 지방세법 §103의3①1→§92①(소득세의 1/10).
 * ⚠️ 이 셋은 양도세 계산기들과 «공유» 하는 값이라 이번에 cgt_ 행으로 이관하지 않았다(다른 워커 몫·공유표 이관은 별건).
 *    값은 eflaw 현행 시행본(소득세법 MST 280405 · 지방세법 MST 282559, 시행 2026-07-01)과 대조했다.
 */
export const CGT_SHARED = {
  basicDeduction: 2_500_000,
  /** 보유 3년 이상 6%, 1년마다 2%p, 15년 이상 30%. */
  ltsdPct: (years: number) => (years < 3 ? 0 : Math.min(30, 6 + 2 * (Math.floor(years) - 3))),
  localRatioPct: 10,
  source: '소득세법 제95조제2항·제103조제1항 · 지방세법 제103조의3제1항제1호',
} as const;

export function burdenGift(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const br = packBrackets(pack, INH_RATE_KEYS, INH_UPTO_KEYS);
  const rel = (['spouse', 'adultChild', 'minorChild'].includes(String(v.relationship)) ? v.relationship : 'adultChild') as GiftRel;
  const dedKey = GIFT_REL[rel].key!;
  if (!br || typeof A[dedKey] !== 'number' || typeof P.gift_filing_credit !== 'number') return MISSING;

  const value = Math.max(0, Math.floor(num(v.propertyValue)));
  const debt = Math.min(value, Math.max(0, Math.floor(num(v.debt))));
  const buy = Math.max(0, Math.floor(num(v.buyPrice)));
  const hold = Math.max(0, num(v.holdYears));
  const oneHouse = v.cgtCase === 'oneHouseExempt';

  // 증여세: 과세가액 = 재산 − 인수채무(§47①)
  const giftPortion = value - debt;
  const giftBase = Math.max(0, giftPortion - A[dedKey]);
  const g = transferTaxParts(giftBase, br, P.gift_filing_credit);

  // 양도세: 양도차익 = (가액 − 취득가) × 채무/가액 (소득세법 시행령 §159①)
  const gain = value > 0 ? Math.max(0, Math.floor(((value - buy) * debt) / value)) : 0;
  const ltsd = CGT_SHARED.ltsdPct(hold);
  let cgt = 0;
  let local = 0;
  let cgtBase = 0;
  let cgtNote: Row | null = null;
  const oneHouseCap = 1_200_000_000; // 소득세법 §89①3 고가주택 기준(eflaw 현행 대조) — 공유 상수(cgt_ 이관 별건)
  if (oneHouse && value <= oneHouseCap) {
    cgtNote = { label: '양도소득세', value: '비과세 — 1세대1주택(양도가액 12억 이하)으로 선택했다. 보유·거주 요건 충족은 직접 확인한다' };
  } else if (oneHouse) {
    cgtNote = { label: '양도소득세', value: '계산하지 않았다 — 12억 초과 1세대1주택의 과세분 안분·장기보유공제 표2 는 이 계산기에 없다' };
  } else {
    const afterLtsd = gain - pctOf(gain, ltsd);
    cgtBase = Math.max(0, afterLtsd - CGT_SHARED.basicDeduction);
    cgt = Math.floor(calcProgressiveTax(cgtBase, INCOME_TAX_BRACKETS));
    local = pctOf(cgt, CGT_SHARED.localRatioPct);
  }
  const total = g.pay + cgt + local;

  const details: Row[] = [
    { label: '증여 부분 (재산 − 인수채무)', value: fmt(giftPortion) },
    { label: `증여재산공제 (${GIFT_REL[rel].label})`, value: fmt(A[dedKey]) },
    { label: '증여세 산출세액', value: fmt(g.calc) },
    { label: `증여세 신고세액공제 (${P.gift_filing_credit}%)`, value: `−${fmt(g.credit)}` },
    { label: '증여세 (납부)', value: fmt(g.pay) },
    { label: '양도 부분 (인수채무)', value: fmt(debt) },
    { label: '양도차익 (채무 비율)', value: fmt(gain) },
  ];
  if (cgtNote) details.push(cgtNote);
  else {
    details.push({ label: `장기보유특별공제 (보유 ${Math.floor(hold)}년 · ${ltsd}%)`, value: `−${fmt(pctOf(gain, ltsd))}` });
    details.push({ label: '양도소득 기본공제', value: `−${fmt(CGT_SHARED.basicDeduction)}` });
    details.push({ label: '양도소득 과세표준', value: fmt(cgtBase) });
    details.push({ label: '양도소득세 (기본세율)', value: fmt(cgt) });
    details.push({ label: `지방소득세 (양도소득세의 ${CGT_SHARED.localRatioPct}%)`, value: fmt(local) });
    if (hold < 2) details.push({ label: '⚠️ 단기 보유', value: '보유 2년 미만이면 단기세율(주택 1년 미만 70%·2년 미만 60%, 소득세법 §104①)이 적용된다 — 이 계산은 기본세율이라 과소다' });
  }
  details.push({ label: '⚠️ 채무 인정', value: '배우자·직계존비속 간 부담부증여의 채무는 «인수되지 않은 것으로 추정» 한다 — 금융기관 대출 등 객관적으로 입증되는 채무만 빠진다(§47③)' });
  details.push({ label: '미반영', value: '다주택 중과세율·장기보유공제 배제, 10년 내 동일인 증여 합산(§47②), 취득세 — 해당하면 결과가 달라진다' });
  details.push(...source(pack, 'inh_rate_b1', dedKey, 'gift_filing_credit'));
  details.push({ label: '근거 (양도 성분)', value: CGT_SHARED.source });
  return { main: { label: '세금 합계 (증여세 + 양도세 + 지방소득세)', value: fmt(total) }, details };
}

// ═══ 5. 세대생략 증여 할증 (generation-skip) ═══

export function generationSkip(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const br = packBrackets(pack, INH_RATE_KEYS, INH_UPTO_KEYS);
  const minor = v.minor === 'yes';
  const dedKey = minor ? 'gift_ded_ascendant_minor' : 'gift_ded_ascendant';
  if (!br || typeof A[dedKey] !== 'number' || typeof A.gift_ded_marriage_birth !== 'number' || typeof A.gift_skip_minor_threshold !== 'number'
    || typeof P.gift_skip_surcharge !== 'number' || typeof P.gift_skip_surcharge_minor !== 'number' || typeof P.gift_filing_credit !== 'number') return MISSING;

  const amount = Math.max(0, Math.floor(num(v.amount)));
  const parentDeceased = v.parentDeceased === 'yes';
  const mb = v.marriageBirth === 'yes' ? A.gift_ded_marriage_birth : 0;
  const ded = Math.min(amount, A[dedKey] + mb);
  const taxBase = amount - ded;
  // §57①: 30%, 미성년이면서 증여재산가액 20억 초과면 40%. 단서: 최근친 직계비속(손자녀의 부모)이 사망했으면 할증 없음.
  const minorHeavy = minor && amount > A.gift_skip_minor_threshold;
  const surchargePct = parentDeceased ? 0 : minorHeavy ? P.gift_skip_surcharge_minor : P.gift_skip_surcharge;
  const t = transferTaxParts(taxBase, br, P.gift_filing_credit, surchargePct);

  const details: Row[] = [
    { label: `증여재산공제 (조부모 → ${minor ? '미성년' : '성년'} 손자녀)`, value: fmt(A[dedKey]) },
  ];
  if (mb) details.push({ label: '혼인·출산 증여재산공제 (§53의2)', value: fmt(mb) });
  details.push({ label: '과세표준', value: fmt(taxBase) });
  details.push({ label: `기본 증여세 (최고 구간 ${t.ratePct}%)`, value: fmt(t.calc) });
  details.push(parentDeceased
    ? { label: '세대생략 할증', value: '없음 — 손자녀의 부모(증여자의 자녀)가 사망한 경우 할증하지 않는다(§57① 단서)' }
    : { label: `세대생략 할증 (${surchargePct}%${minorHeavy ? ` — 미성년·증여재산 ${fmt(A.gift_skip_minor_threshold)} 초과` : ''})`, value: fmt(t.surcharge) });
  details.push({ label: `신고세액공제 (${P.gift_filing_credit}%, 할증 포함 기준)`, value: `−${fmt(t.credit)}` });
  details.push({ label: '미반영', value: '수증자가 10년 안에 같은 공제를 이미 받았거나 동일인에게 받은 증여 합산(§47②) — 있으면 공제가 줄고 세금이 늘어난다' });
  details.push(...source(pack, 'gift_skip_surcharge', dedKey, 'inh_rate_b1', 'gift_filing_credit'));
  return { main: { label: '증여세 (할증 포함 · 기한 내 신고 시)', value: fmt(t.pay) }, details };
}
