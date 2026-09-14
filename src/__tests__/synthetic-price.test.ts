/** Q-1 F1 1단 — 합성 분양가 표시 격리(판정은 DB, 코드는 비우기만). */
import { describe, expect, it } from 'vitest';
import { isSyntheticPrice, stripSyntheticPrice } from '@/lib/apt/synthetic-price';
import { priceOf } from '@/lib/home/sections';

describe('Q-1 합성 분양가', () => {
  it('synthetic 이면 가격을 비운다 — 다른 필드는 그대로', () => {
    const r = stripSyntheticPrice({ slug: 'x', price_min: 20800, price_max: 55500, price_source: 'synthetic' });
    expect(r.price_min).toBeNull();
    expect(r.price_max).toBeNull();
    expect(r.slug).toBe('x');
  });
  it('판정 대상이 아니면 같은 객체를 돌려준다', () => {
    const row = { price_min: 56600, price_max: 86900, price_source: null };
    expect(stripSyntheticPrice(row)).toBe(row);
    expect(isSyntheticPrice(row)).toBe(false);
  });
  it('홈 priceOf 도 DB 판정을 먼저 따른다', () => {
    expect(priceOf({ price_min: 56600, price_max: 86900, lifecycle_stage: 'pre_announcement', price_source: 'synthetic' }, new Set())).toBeNull();
    expect(priceOf({ price_min: 56600, price_max: 86900, lifecycle_stage: 'pre_announcement', price_source: null }, new Set()))
      .toEqual({ min: 56600, max: 86900 });
  });
});

import { dropAmountFaqs } from '@/lib/apt/synthetic-price';
describe('Q-2 합성가 현장 FAQ', () => {
  const items = [
    { q: '범천1-1구역 재개발 분양가 2.1억원에서 추가 비용이 더 있을까요?', a: '...' },
    { q: '시공사는 어디인가요?', a: '현대건설입니다.' },
    { q: '계약금은?', a: '분양가 21,000만원 기준 10%' },
  ];
  it('synthetic 이면 금액 문항만 뺀다', () => {
    expect(dropAmountFaqs(items, true).map((i) => i.q)).toEqual(['시공사는 어디인가요?']);
  });
  it('synthetic 이 아니면 그대로', () => {
    expect(dropAmountFaqs(items, false)).toHaveLength(3);
  });
});
