/**
 * LB-1/LB-3 L1 — 쿼터 판정·카테고리 태깅 (2026-09-08).
 *
 * ⚠️ AI 도 DB 도 부르지 않는다. 이 층이 틀리면 1:9 가 «조용히» 무너지고,
 *    조용한 실패는 다이제스트가 숫자를 들고 올 때까지 일주일을 간다.
 */
import { describe, expect, it } from 'vitest';
import { llmCategoryOfContent, quotaBlocked, stockCap } from '@/lib/llm/gateway';

describe('LB-3 — 주식계열 상한 산식', () => {
  it('기본값 200 × 0.10 = 20', () => {
    expect(stockCap(200, 0.1)).toBe(20);
  });

  it('내림이다 — 「1할 보장」이 아니라 「9할을 부동산에」가 목표다', () => {
    expect(stockCap(15, 0.1)).toBe(1);
    expect(stockCap(9, 0.1)).toBe(0);
  });

  it('음수·이상값에서 0 밑으로 내려가지 않는다', () => {
    expect(stockCap(-10, 0.1)).toBe(0);
    expect(stockCap(100, -1)).toBe(0);
  });

  it('상한에 «도달하면» 막는다 — 초과가 아니라 도달이다', () => {
    expect(quotaBlocked(19, 20)).toBe(false);
    expect(quotaBlocked(20, 20)).toBe(true);
    expect(quotaBlocked(21, 20)).toBe(true);
  });

  it('상한 0 이면 첫 호출부터 막힌다', () => {
    expect(quotaBlocked(0, 0)).toBe(true);
  });
});

describe('LB-3 — 콘텐츠 카테고리 → 원장 카테고리', () => {
  it('부동산 계열은 realestate 로 모인다', () => {
    for (const c of ['apt', 'realestate', 'unsold']) {
      expect(llmCategoryOfContent(c)).toBe('realestate');
    }
  });

  it('주식은 stock', () => {
    expect(llmCategoryOfContent('stock')).toBe('stock');
  });

  it('⚠️ 부동산이 아닌 콘텐츠는 «쿼터 안» 이다 — 예외로 빼면 1:9 의 취지가 샌다', () => {
    for (const c of ['finance', 'economy', 'tax', 'life', 'general', null, undefined, '']) {
      expect(llmCategoryOfContent(c as any)).toBe('finance');
    }
  });

  it('모르는 값을 realestate 로 흘리지 않는다 — 그러면 9쪽이 조용히 부풀려진다', () => {
    expect(llmCategoryOfContent('알 수 없는 카테고리')).not.toBe('realestate');
  });
});
