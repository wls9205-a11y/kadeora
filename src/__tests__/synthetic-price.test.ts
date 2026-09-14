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
