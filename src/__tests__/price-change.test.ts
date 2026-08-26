// 「평형 없는 %를 못 나가게」 하는 자물쇠.
//
// price_change_1y 는 대표 평형 하나를 고정해 잰 값이다. 평형을 떼면
// 「단지 전체가 그만큼 움직였다」로 읽히고, 실측상 그 오독은 방향까지 반대인 경우가
// 부울경 586 계열 중 140건(23.9%)이다. 그래서 이 파일의 모든 출력에는 평형이 들어 있다.

import { describe, it, expect } from 'vitest';
import {
  canShowPriceChange, pcArea, priceChangeCompact, priceChangeSentence, priceChangeDirection,
} from '@/lib/apt/price-change';

const ok = { price_change_1y: 3.2, price_change_area: 84.9, price_change_n_recent: 12, price_change_n_past: 7 };

describe('canShowPriceChange — 근거 4개가 다 있어야 한다', () => {
  it('네 값이 다 있으면 참', () => expect(canShowPriceChange(ok)).toBe(true));
  it('평형이 없으면 거짓', () => expect(canShowPriceChange({ ...ok, price_change_area: null })).toBe(false));
  it('평형이 0이면 거짓', () => expect(canShowPriceChange({ ...ok, price_change_area: 0 })).toBe(false));
  it('최근 표본이 없으면 거짓', () => expect(canShowPriceChange({ ...ok, price_change_n_recent: null })).toBe(false));
  it('과거 표본이 없으면 거짓', () => expect(canShowPriceChange({ ...ok, price_change_n_past: 0 })).toBe(false));
  it('변동률이 없으면 거짓', () => expect(canShowPriceChange({ ...ok, price_change_1y: null })).toBe(false));
  it('null/undefined 를 그대로 받아도 터지지 않는다', () => {
    expect(canShowPriceChange(null)).toBe(false);
    expect(canShowPriceChange(undefined)).toBe(false);
    expect(canShowPriceChange({})).toBe(false);
  });
  it('0% 는 «있는» 값이다 — 보합을 숨기지 않는다', () => {
    expect(canShowPriceChange({ ...ok, price_change_1y: 0 })).toBe(true);
  });
});

describe('출력에는 «항상» 평형이 들어 있다', () => {
  it('compact 는 부호와 평형을 같이 낸다', () => {
    expect(priceChangeCompact(ok)).toBe('+3.2% · 85㎡');
    expect(priceChangeCompact({ ...ok, price_change_1y: -1.4 })).toBe('-1.4% · 85㎡');
  });

  it('sentence 는 표본까지 밝힌다', () => {
    expect(priceChangeSentence(ok)).toBe('85㎡ 기준 최근 1년 +3.2% (최근 12건 · 1년 전 7건)');
  });

  it('**근거가 없으면 빈 문자열** — 호출부가 그 자리를 통째로 비운다', () => {
    const bad = { ...ok, price_change_area: null };
    expect(priceChangeCompact(bad)).toBe('');
    expect(priceChangeSentence(bad)).toBe('');
  });

  it('어떤 출력에도 평형 없는 % 만 나오는 경로가 없다', () => {
    for (const out of [priceChangeCompact(ok), priceChangeSentence(ok)]) {
      expect(out).toContain('㎡');
    }
  });
});

describe('부수', () => {
  it('pcArea 는 반올림한다', () => {
    expect(pcArea(ok)).toBe('85㎡');
    expect(pcArea({ ...ok, price_change_area: 59.4 })).toBe('59㎡');
  });
  it('방향은 색을 고르는 데 쓴다', () => {
    expect(priceChangeDirection(ok)).toBe('up');
    expect(priceChangeDirection({ ...ok, price_change_1y: -1 })).toBe('down');
    expect(priceChangeDirection({ ...ok, price_change_1y: 0 })).toBe('flat');
    expect(priceChangeDirection({ ...ok, price_change_area: null })).toBeNull();
  });
  it('문자열로 와도(PostgREST numeric) 처리한다', () => {
    expect(canShowPriceChange({ price_change_1y: '3.2', price_change_area: '84.9', price_change_n_recent: '12', price_change_n_past: '7' })).toBe(true);
  });
});
