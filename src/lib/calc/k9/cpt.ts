// K-9 inh 클러스터 — 종합부동산세(주택분) (2026-09-17)
//
// 정본: policy_constants cpt_* (마이그레이션 k9_inh_policy_constants_2026-09-17.sql).
// 원문: DRF eflaw 현행 시행본 — 종합부동산세법 MST 280417(시행 2026-01-01, 시행예정 판 없음) §8·§9 ·
//   같은 법 시행령 MST 283639(시행 2026-02-27) §2의4 · 농어촌특별세법 MST 285905(시행 2026-05-12) §5①8.
//
// ⛔ 옛 코드는 12억 초과를 2% 단일 구간으로 뭉갰고, 입력받은 주택 수를 버렸다(§9①1·2 구분 없음).
// ⚠️ 재산세 공제(§9③)·세부담상한(§10)은 산식(시행령 §4의3·§5)을 원문 대조하지 않았다 → 계산하지 않고 «미반영» 이라고 화면에 쓴다.
import type { CalcResult } from '../formulas';
import { parsePolicyPack } from '../gov-tables';
import { MISSING, fmt, num, packBrackets, pctOf, progressive, bracketOf, source, type V } from './inh';

export const CPT_UPTO_KEYS = ['cpt_rate_upto_b1', 'cpt_rate_upto_b2', 'cpt_rate_upto_b3', 'cpt_rate_upto_b4', 'cpt_rate_upto_b5', 'cpt_rate_upto_b6'];
export const cptRateKeys = (heavy: boolean) => [1, 2, 3, 4, 5, 6, 7].map((i) => `cpt_rate_${heavy ? '3h' : '2h'}_b${i}`);

const ELDER = { none: null, a60: 'cpt_elder_60', a65: 'cpt_elder_65', a70: 'cpt_elder_70' } as const;
const HOLD = { none: null, h5: 'cpt_hold_5y', h10: 'cpt_hold_10y', h15: 'cpt_hold_15y' } as const;

export function comprehensivePropertyTax(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const houses = Math.max(1, Math.floor(num(v.houseCount)) || 1);
  const oneHouse = v.oneHouse === 'yes';
  const heavy = !oneHouse && houses >= 3;
  const br = packBrackets(pack, cptRateKeys(heavy), CPT_UPTO_KEYS);
  const elderKey = oneHouse ? ELDER[(String(v.elderAge) in ELDER ? v.elderAge : 'none') as keyof typeof ELDER] : null;
  const holdKey = oneHouse ? HOLD[(String(v.holdPeriod) in HOLD ? v.holdPeriod : 'none') as keyof typeof HOLD] : null;
  const dedKey = oneHouse ? 'cpt_ded_one_house' : 'cpt_ded_general';
  if (!br || typeof A[dedKey] !== 'number' || typeof P.cpt_fmv_ratio !== 'number' || typeof P.cpt_nongteuk_rate !== 'number' || typeof P.cpt_credit_cap !== 'number'
    || (elderKey && typeof P[elderKey] !== 'number') || (holdKey && typeof P[holdKey] !== 'number')) return MISSING;

  const pub = Math.max(0, Math.floor(num(v.publicPrice)));
  const ded = A[dedKey];
  // §8①: (공시가격 합계 − 공제) × 공정시장가액비율(시행령 §2의4① 60%)
  const taxBase = pctOf(Math.max(0, pub - ded), P.cpt_fmv_ratio);
  const details: { label: string; value: string }[] = [
    { label: `공제액 (${oneHouse ? '1세대1주택자' : '그 외 개인'})`, value: fmt(ded) },
    { label: `과세표준 (공제 후 × 공정시장가액비율 ${P.cpt_fmv_ratio}%)`, value: fmt(taxBase) },
  ];
  if (taxBase <= 0) {
    details.push({ label: '사유', value: '공시가격 합계가 공제액 이하라 과세표준이 없다' });
    details.push(...source(pack, dedKey, 'cpt_fmv_ratio'));
    return { main: { label: '종합부동산세', value: '과세 대상 아님' }, details };
  }

  const calc = progressive(taxBase, br);
  // §9⑤~⑧: 1세대1주택 고령자·장기보유 공제율 합계 80% 한도
  const creditPct = Math.min(P.cpt_credit_cap, (elderKey ? P[elderKey] : 0) + (holdKey ? P[holdKey] : 0));
  const credit = pctOf(calc, creditPct);
  const cpt = calc - credit;
  const farm = pctOf(cpt, P.cpt_nongteuk_rate);

  details.push({ label: `적용 세율표`, value: heavy ? '3주택 이상 (§9①2)' : '2주택 이하 (§9①1)' });
  details.push({ label: `산출세액 (최고 구간 ${bracketOf(taxBase, br).ratePct}%)`, value: fmt(calc) });
  if (oneHouse) details.push({ label: `1세대1주택 고령자·장기보유 공제 (${creditPct}%, 합계 한도 ${P.cpt_credit_cap}%)`, value: `−${fmt(credit)}` });
  details.push({ label: '종합부동산세 (재산세 공제 전)', value: fmt(cpt) });
  details.push({ label: `농어촌특별세 (종부세의 ${P.cpt_nongteuk_rate}%)`, value: fmt(farm) });
  details.push({ label: '미반영 — 결과보다 낮아진다', value: '재산세로 부과된 세액 중 종부세 과세표준분 공제(§9③)와 세부담상한 150%(§10)는 산식을 원문 대조하지 않아 계산하지 않았다. 실제 고지액은 이 값보다 작다' });
  if (oneHouse && houses > 1) details.push({ label: '⚠️ 주택 수', value: `보유 ${houses}채인데 1세대1주택으로 선택했다 — 일시적 2주택·상속주택 등 특례(§8④) 대상일 때만 12억 공제가 맞다` });
  details.push({ label: '미반영', value: '법인(공제 0원·단일세율 2.7%/5.0%)·합산배제 임대주택·토지분 종부세' });
  details.push(...source(pack, dedKey, 'cpt_fmv_ratio', cptRateKeys(heavy)[0], 'cpt_nongteuk_rate'));
  return { main: { label: '종부세 + 농특세 (재산세 공제 전)', value: fmt(cpt + farm) }, details };
}
