/**
 * 전 계산기 × «실제 DB 행 모양» 정책 주입 — 라이브 「미수신」 회귀 (2026-09-17).
 *
 * ⛔ 왜: 계산기 테스트들이 pct 를 손으로 적은 픽스처를 썼고, DB 행의 실제 모양과 달랐다.
 *    - acq_tax_1house_6_9eok 첫 원소가 「6억원」 → 취득세 6~9억이 라이브 「세율 기준 미수신」
 *    - stress_dsr_local 첫 원소 「1.5%」 → 픽스처는 0.75 를 적어 통과, 라이브 dsr-calc 는 지방 가산 2배
 *    이 테스트는 policy_constants 스냅샷(DB 조회 그대로)을 페이지와 «같은» 파서(policyPackFromRows)로 넣고
 *    registry 기본 입력으로 전 계산기를 돌려 「미수신」·예외가 없는지 본다.
 *
 * 스냅샷 갱신: policy_constants 를 바꾸는 마이그레이션과 «같은 커밋» 에서 fixtures/policy_constants.snapshot.json 을 다시 뜬다
 *   (SELECT json_agg(json_build_object('key',key,'numbers',numbers,'status',status) ORDER BY key) FROM policy_constants).
 */
import { describe, it, expect } from 'vitest';
import { FORMULAS } from '@/lib/calc/formulas';
import { PENDING } from './calc-registry-coverage.test';
import { CALC_REGISTRY } from '@/lib/calc/registry';
import { policyPackFromRows } from '@/lib/calc/gov-tables';
import rows from './fixtures/policy_constants.snapshot.json';

const POLICY = JSON.stringify(policyPackFromRows(rows as any));
// currency-convert 는 policy 가 아니라 환율(__fx) 파이프라 여기서 뺀다.
const SKIP = new Set(['currency-convert', ...PENDING]);

describe('전 계산기 — 실제 정책 행으로 기본 입력 계산 시 「미수신」 없음', () => {
  for (const calc of CALC_REGISTRY) {
    if (SKIP.has(calc.slug)) continue;
    it(`${calc.slug} (${calc.formula})`, () => {
      // ⛔ 정본 경유 — CalcEngine 과 같은 FORMULAS[calc.formula]. 함수 직접 호출은 맵 갭을 못 본다.
      const fn = (FORMULAS as any)[calc.formula];
      expect(typeof fn, `FORMULAS 미등록(라이브 무결과): ${calc.formula}`).toBe('function');
      const v: Record<string, string | number> = { __policy: POLICY };
      for (const inp of calc.inputs) v[inp.id] = inp.default;
      const r = fn(v);
      expect(r?.main?.label ?? '').not.toMatch(/미수신/);
    });
  }
});

// ⚠️ 기본 입력만으로는 닿지 않는 분기가 있다 — 라이브 결함이 났던 구간을 표본으로 고정한다.
describe('분기 표본 — 기본 입력 밖 구간도 실제 행으로 「미수신」 없음', () => {
  const run = (formula: string, overrides: Record<string, string | number>) => {
    const calc = CALC_REGISTRY.find((c) => c.formula === formula)!;
    const v: Record<string, string | number> = { __policy: POLICY };
    for (const inp of calc.inputs) v[inp.id] = inp.default;
    return (FORMULAS as any)[formula]({ ...v, ...overrides });
  };
  it.each([
    ['acquisitionTax', { price: 750_000_000 }],             // 6~9억 매매 — 첫 원소 「6억원」 행
    ['acquisitionTax', { price: 1_000_000_000 }],
    ['acquisitionTax', { houseCount: 2, regulated: 'yes' }],
    ['auctionProfit', { bidPrice: 750_000_000, appraisal: 900_000_000, marketPrice: 900_000_000 }],
    ['dsrCalc', { region: 'local_nonreg' }],
    ['dsrCalc', { region: 'regulated' }],
  ])('%s %o', (formula, overrides) => {
    expect(run(formula as string, overrides as any)?.main?.label ?? '').not.toMatch(/미수신/);
  });
});
