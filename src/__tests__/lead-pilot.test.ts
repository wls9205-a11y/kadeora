/** E-12 — 현장 해시 배정은 결정적이고 대략 절반이다. 홈(slug 없음)은 파일럿 밖. */
import { describe, expect, it } from 'vitest';
import { leadPilotArm, isBudgetChoice, isCallTimeChoice } from '@/lib/apt/lead-pilot';

describe('leadPilotArm', () => {
  it('같은 slug 는 늘 같은 군', () => {
    expect(leadPilotArm('skyv-센텀')).toBe(leadPilotArm('skyv-센텀'));
  });
  it('slug 없으면 null', () => {
    expect(leadPilotArm('')).toBeNull();
    expect(leadPilotArm(undefined)).toBeNull();
  });
  it('대략 절반 — 1,000개 합성 slug 중 실험군 40~60%', () => {
    const n = Array.from({ length: 1000 }, (_, i) => leadPilotArm(`site-${i}-현장`)).filter((a) => a === 'exp').length;
    expect(n).toBeGreaterThan(400);
    expect(n).toBeLessThan(600);
  });
  it('선택지 밖 값은 받지 않는다', () => {
    expect(isBudgetChoice('3억~5억')).toBe(true);
    expect(isBudgetChoice('4억')).toBe(false);
    expect(isCallTimeChoice('저녁(18~21시)')).toBe(true);
    expect(isCallTimeChoice('<script>')).toBe(false);
  });
});
