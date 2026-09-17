/**
 * 계산기 레지스트리 ↔ FORMULAS 맵 «양방향» 커버리지 (2026-09-17 · [S] 해제 판정).
 *
 * ⛔ 왜: registry 에 페이지가 있는데 FORMULAS 맵에 공식이 없어 44종이 라이브에서 «결과 없음» 이었다.
 *    계산기 테스트는 함수를 «직접» import 해 불렀기 때문에 1,570 개가 초록인 채로 이 고장을 못 봤다.
 *    규율: 「검증은 정본을 거친다, 사본 금지」 — 여기서는 CalcEngine 과 «같은» 경로(FORMULAS[calc.formula])로 본다.
 *
 * 방향 1 (실패): 페이지 slug 인데 FORMULAS 에 공식 없음 — PENDING(A″ 감사 대기) 밖이면 CI 실패.
 * 방향 2 (경고): FORMULAS 에 있는데 어느 페이지도 쓰지 않는 공식 — console.warn.
 * PENDING 은 «줄어들기만» 한다: 이미 등록된 slug 가 남아 있으면 실패(명단이 거짓말하지 않게).
 */
import { describe, it, expect } from 'vitest';
import { FORMULAS } from '@/lib/calc/formulas';
import { CALC_REGISTRY } from '@/lib/calc/registry';

/** A″ 감사 대기 — 무감사 등록 금지(세금·금액 계산기에서 틀린 숫자는 무결과보다 해롭다). 감사 통과 시 맵 등록과 «같은 커밋» 에서 여기서 뺀다. */
export const PENDING: readonly string[] = [
  "investment-type-test",
  "freelancer-tax",
  "telecom-compare",
  "graduation-year",
  "business-income-tax",
  "foreign-dividend-credit",
  "simple-bookkeeping",
  "far-bcr",
  "drip-sim",
  "rebalance-calc",
  "refinance-compare",
  "credit-loan-est",
  "retirement-expense",
  "pension-vs-lump",
  "fuel-saving",
  "inflation-calc",
  "property-division",
  "csat-grade",
  "point-convert"
];

describe('registry ↔ FORMULAS 커버리지', () => {
  it('방향 1 — 모든 페이지 slug 의 공식이 맵에 있다(PENDING 제외)', () => {
    const missing = CALC_REGISTRY.filter((c) => !PENDING.includes(c.slug) && typeof FORMULAS[c.formula] !== 'function')
      .map((c) => `${c.slug}(${c.formula})`);
    expect(missing, `맵 미등록 — 라이브 무결과: ${missing.join(', ')}`).toEqual([]);
  });

  it('PENDING 은 줄어들기만 한다 — 이미 등록됐거나 없는 slug 가 남아 있으면 실패', () => {
    const stale = PENDING.filter((s) => {
      const c = CALC_REGISTRY.find((x) => x.slug === s);
      return !c || typeof FORMULAS[c.formula] === 'function';
    });
    expect(stale, `PENDING 에서 빼야 할 slug: ${stale.join(', ')}`).toEqual([]);
  });

  it('방향 2 — 페이지 없는 공식은 경고', () => {
    const used = new Set(CALC_REGISTRY.map((c) => c.formula));
    const orphans = Object.keys(FORMULAS).filter((k) => !used.has(k));
    if (orphans.length) console.warn(`[calc-coverage] 페이지 없는 공식 ${orphans.length}: ${orphans.join(', ')}`);
    expect(Array.isArray(orphans)).toBe(true);
  });
});
