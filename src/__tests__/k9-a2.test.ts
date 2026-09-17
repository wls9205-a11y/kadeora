/**
 * K-9 A″ a2 — FORMULAS 맵 미등록 계산기 감사 회귀 (2026-09-17).
 *
 * 규율: 호출은 «정본 경유»(FORMULAS[registry.formula]) — 함수 직접 호출은 맵 갭을 못 본다.
 * 정책 주입은 실 DB 스냅샷(fixtures/policy_constants.snapshot.json)을 페이지와 같은 파서로.
 * 각 계산기는 ① 원문·산식과의 긍정형 일치 ② 옛 코드 대비 실해(숫자) 를 같이 박는다.
 */
import { describe, it, expect } from 'vitest';
import { FORMULAS } from '@/lib/calc/formulas';
import { CALC_REGISTRY } from '@/lib/calc/registry';
import { policyPackFromRows } from '@/lib/calc/gov-tables';
import { formatKRWExact } from '@/lib/calc/tax-tables';
import rows from './fixtures/policy_constants.snapshot.json';
import { noticePayParts, A2_LAW } from '@/lib/calc/k9/a2';

const POLICY = JSON.stringify(policyPackFromRows(rows as any));
const W = (x: number) => formatKRWExact(x);
type R = { main: { label: string; value: string }; details: { label: string; value: string }[] };
const val = (res: R, label: string) => res.details.find((d) => d.label.startsWith(label))?.value;

/** registry 기본 입력 + 덮어쓰기로 «맵 경유» 호출. */
function run(slug: string, over: Record<string, string | number> = {}, policy = true): R {
  const calc = CALC_REGISTRY.find((c) => c.slug === slug)!;
  const fn = (FORMULAS as any)[calc.formula];
  expect(typeof fn, `${slug} 맵 미등록`).toBe('function');
  const v: Record<string, string | number> = policy ? { __policy: POLICY } : {};
  for (const inp of calc.inputs) v[inp.id] = inp.default;
  return fn({ ...v, ...over });
}

describe('jeonse-loan — 단리 이자(순수 산식)', () => {
  it('기본 2억·3.5%: 월 583,333원(옛값과 동일) + 일할 30·31일', () => {
    const res = run('jeonse-loan');
    expect(res.main.value).toBe(W(583_333));
    expect(val(res, '연 이자')).toBe(W(7_000_000));
    expect(val(res, '일할 계산 — 30일')).toBe(W(575_342));
    expect(val(res, '일할 계산 — 31일')).toBe(W(594_521));
  });
  it('경계: 금리 0 → 0원, 음수 금액은 0 으로', () => {
    expect(run('jeonse-loan', { rate: 0 }).main.value).toBe(W(0));
    expect(run('jeonse-loan', { loanAmount: -5 }).main.value).toBe(W(0));
  });
});

describe('severance-calc — 근로기준법 §26 · 시행령 §6', () => {
  it('뼈대 상수 = 조문(30일·3개월·주15시간·주40시간)', () => {
    expect(A2_LAW.noticeDays).toBe(30);
    expect(A2_LAW.noticeMinTenureMonths).toBe(3);
    expect(A2_LAW.weeklyHolidayMinHours).toBe(15);
    expect(A2_LAW.statutoryWeeklyHours).toBe(40);
  });
  it('실해: 월 350만·주40·일8 — 옛 3,500,000원 → 법 4,019,139원(209시간)', () => {
    const res = run('severance-calc');
    expect(res.main.value).toBe(W(4_019_139));
    expect(res.main.value).not.toBe(W(3_500_000));
    const p = noticePayParts(3_500_000, 40, 8);
    expect(p.monthHours).toBe(209);
    expect(p.monthHoursExact).toBeCloseTo(208.5714, 3);
    expect(p.payExact).toBe(Math.round(3_500_000 / (48 * 365 / 7 / 12) * 8 * 30));
  });
  it('단시간: 주 20시간·일 4시간 → 기준시간 104(=(20+4)×365/7/12=104.29 반올림)', () => {
    const p = noticePayParts(1_000_000, 20, 4);
    expect(p.monthHours).toBe(104);
    expect(p.pay).toBe(Math.round(1_000_000 / 104 * 4 * 30));
  });
  it('경계: 주 14시간은 주휴 없음 / 15시간은 주휴 3시간', () => {
    expect(noticePayParts(1, 14, 1).weeklyPaidHours).toBe(14);
    expect(noticePayParts(1, 15, 1).weeklyPaidHours).toBe(18);
    expect(noticePayParts(1, 52, 1).weeklyPaidHours).toBe(60); // 주휴는 40시간 기준 상한 8
  });
  it('근속 3개월 미만 → 0원 + 사유(§26 단서 1호)', () => {
    const res = run('severance-calc', { tenure: 'under3m' });
    expect(res.main.value).toBe(W(0));
    expect(val(res, '사유')).toContain('§26 단서 1호');
  });
  it('G7: FAQ·본문이 «월급 그대로» 를 주장하지 않는다', () => {
    const c = CALC_REGISTRY.find((x) => x.slug === 'severance-calc')!;
    const text = JSON.stringify(c.faqs) + c.seoContent;
    expect(text).not.toContain('그대로 보여줍니다');
    expect(text).toContain('1일 통상임금 × 30일');
  });
});
