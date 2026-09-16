/**
 * 계산기 산출액 «무손실» 표기 — K-9 ⓒ (2026-09-16).
 *
 * 무손실의 조작적 정의: 역산이 된다 — parse(format(x)) === x.
 * 말로 「무손실」이라 적지 않고 «식으로» 박는다. 반올림 자릿수 규정을 테스트로 고정한 것과 같은 결이다.
 */
import { describe, it, expect } from 'vitest';
import { formatKRW, formatKRWExact, parseKRWExact } from '@/lib/calc/tax-tables';

describe('formatKRWExact — 왕복(round-trip)이 무손실의 정의다', () => {
  const 표본 = [
    0, 1, 999, 1_000, 9_999, 10_000, 10_001,
    1_166_690,          // 표준 경로 지방교육세 — 원 단위가 살아야 한다
    11_666_900,
    58_800_000, 62_720_000,
    100_000_000,
    134_000_000,        // 12% 행 합계 — formatKRW 는 여기서 400만을 삼켰다
    700_000_000, 1_234_567_890,
    -134_000_000,
  ];

  it('모든 표본에서 parse(format(x)) === x', () => {
    for (const x of 표본) {
      expect(parseKRWExact(formatKRWExact(x))).toBe(x);
    }
  });

  it('무작위 100건에서도 왕복이 성립한다', () => {
    for (let i = 0; i < 100; i++) {
      const x = Math.floor(Math.random() * 5_000_000_000);
      expect(parseKRWExact(formatKRWExact(x))).toBe(x);
    }
  });

  it('한국어 관용 표기를 쓴다 — 억·만 합성', () => {
    expect(formatKRWExact(134_000_000)).toBe('1억 3,400만원');
    expect(formatKRWExact(1_166_690)).toBe('116만 6,690원');
    expect(formatKRWExact(100_000_000)).toBe('1억원');
    expect(formatKRWExact(0)).toBe('0원');
  });

  it('⛔ 옛 압축 표기가 삼키던 금액을 고정한다 — 400만', () => {
    // formatKRW 는 그대로 둔다(카드·차트축처럼 압축이 정답인 표면이 있다).
    // 다만 계산기 산출액에서는 이 손실이 곧 틀린 답이었다.
    expect(formatKRW(134_000_000)).toBe('1.3억원');
    expect(parseKRWExact(formatKRWExact(134_000_000)) - 130_000_000).toBe(4_000_000);
  });

  it('formatKRW 는 «건드리지 않았다» — 기존 표면의 회귀면 0', () => {
    expect(formatKRW(100_000_000)).toBe('1억원');
    expect(formatKRW(50_000)).toBe('5만원');
    expect(formatKRW(999)).toBe('999원');
  });
});
