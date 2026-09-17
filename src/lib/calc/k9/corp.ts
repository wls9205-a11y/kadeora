// K-9 inh 클러스터 — 법인세 (2026-09-17)
//
// 정본: policy_constants corp_tax_* · corp_ltax_ratio (마이그레이션 k9_inh_policy_constants_2026-09-17.sql).
// 원문: DRF eflaw —
//   현행: 법인세법 MST 280349(법률 21217, 시행 2026-01-01·현행판 2026-07-01) §55① · 부칙 §5
//         지방세법 MST 282559(시행 2026-07-01) §103의20① · 부칙 §11
//   종전: 법인세법 MST 276111(법률 21065, 시행 2025-10-01) §55① · 지방세법 MST 276349(시행 2025-10-01) §103의20①
//   시행예정 판(법인세법 2027-01-01·2028-01-01, 지방세법 2027-01-01·2027-09-09)의 §55·§103의20 은 현행과 동일(diff 0).
//
// ⛔ 옛 코드는 2026 개정 전 세율(9/19/21/24%)로 전 구간을 계산하면서 FAQ 에 「2026년 최신 기준 반영」이라고 적었다.
// ⚠️ 새 세율의 적용 기준은 «시행일» 이 아니라 «2026-01-01 이후 개시하는 사업연도»(부칙 §5·지방세법 부칙 §11)다 —
//    그래서 사업연도 개시 시점을 입력으로 받는다.
import type { CalcResult } from '../formulas';
import { parsePolicyPack } from '../gov-tables';
import { MISSING, fmt, num, packBrackets, pctOf, progressive, bracketOf, source, type V } from './inh';

export type CorpPeriod = 'y2026' | 'pre2026';
export type CorpType = 'general' | 'smallRental';

/** 사업연도·법인 구분 → 세율 키·구간 경계 키. */
export function corpTaxKeys(period: CorpPeriod, type: CorpType): { rates: string[]; uptos: string[] } {
  const p = period === 'y2026' ? 'corp_tax' : 'corp_tax_prev';
  if (type === 'smallRental') {
    return { rates: [1, 2, 3].map((i) => `${p}_small_b${i}`), uptos: ['corp_tax_small_upto_b1', 'corp_tax_small_upto_b2'] };
  }
  return { rates: [1, 2, 3, 4].map((i) => `${p}_b${i}`), uptos: ['corp_tax_upto_b1', 'corp_tax_upto_b2', 'corp_tax_upto_b3'] };
}

export function corporateTax(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const period: CorpPeriod = v.fiscalStart === 'pre2026' ? 'pre2026' : 'y2026';
  const type: CorpType = v.corpType === 'smallRental' ? 'smallRental' : 'general';
  const keys = corpTaxKeys(period, type);
  const br = packBrackets(pack, keys.rates, keys.uptos);
  if (!br || typeof P.corp_ltax_ratio !== 'number') return MISSING;

  const base = Math.max(0, Math.floor(num(v.taxBase)));
  const tax = progressive(base, br);
  // 법인지방소득세 표준세율은 법인세율의 정확히 1/10 표다(1.0/2.0/2.2/2.5%, 종전 0.9/1.9/2.1/2.4%).
  const local = pctOf(tax, P.corp_ltax_ratio);

  const details: { label: string; value: string }[] = [
    { label: '과세표준', value: fmt(base) },
    { label: '적용 세율표', value: `${period === 'y2026' ? '2026-01-01 이후 개시 사업연도' : '2025-12-31 이전 개시 사업연도(종전)'} · ${type === 'smallRental' ? '성실신고확인 소규모 법인(§60의2①1, 부동산임대업 주업 등)' : '일반 내국법인'}` },
    { label: `구간 세율 (${bracketOf(base, br).ratePct}%)`, value: br.map((b) => `${b.ratePct}%`).join(' / ') },
    { label: `법인지방소득세 (법인세의 ${P.corp_ltax_ratio}%)`, value: fmt(local) },
    { label: '합계 (법인세 + 지방소득세)', value: fmt(tax + local) },
  ];
  if (period === 'pre2026') {
    details.push({ label: '⚠️ 종전 세율', value: '2025년 개시 사업연도 기준표(법률 21065 판)다. 2024년 이전 개시 사업연도는 대조하지 않았다 — 특히 소규모 법인 표는 2025년부터 있다' });
  }
  details.push({ label: '⚠️ 지방소득세', value: '표준세율이다. 지자체 조례로 50% 범위에서 가감될 수 있다(지방세법 §103의20②)' });
  details.push({ label: '미반영', value: '사업연도 1년 미만 환산(§55②)·토지등 양도소득 법인세(§55의2)·세액공제·감면·최저한세 — 산출세액 기준이다' });
  details.push(...source(pack, keys.rates[0], 'corp_ltax_ratio'));
  return { main: { label: '법인세 (산출세액)', value: fmt(tax) }, details };
}
