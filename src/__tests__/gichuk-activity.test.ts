// H4-4 §5 자물쇠 — 「가격에 평형이 붙어 있는가」.
//
// 이 섹션이 거짓말할 수 있는 지점은 하나다: 평형을 뗀 가격을 내는 것.
// 그러면 단지 «전체» 평균과 구분되지 않고, 단지 평균은 평형 구성이 바뀌면 같이 움직인다
// (실측: 전체 +11.7% 인데 84㎡ +0.7% · 59㎡ −3.4%, 움직인 건 비중 38%→60% 뿐).

import { describe, it, expect } from 'vitest';
import {
  areaLabel, dealDateLabel, eok, gichukRegions, hasQuotablePrice, type GichukRow,
} from '@/lib/apt/gichuk-activity';

const base: GichukRow = {
  slug: 's', name: '단지', region: '부산', sigungu: '서구',
  deals: 105, lastDealDate: '2026-08-18',
  areaM2: 84.9, areaDeals: 24, priceAvg: 59441, priceMin: 52000, priceMax: 72310,
};

describe('hasQuotablePrice — 평형 없는 가격은 «내지 않는다»', () => {
  it('평형 · 표본 · 평균이 다 있어야 참이다', () => {
    expect(hasQuotablePrice(base)).toBe(true);
  });

  it('평형이 없으면 가격이 있어도 거짓', () => {
    expect(hasQuotablePrice({ ...base, areaM2: null })).toBe(false);
  });

  it('평형 표본이 0이면 거짓 — 몇 건에서 나온 값인지 못 밝히면 쓰지 않는다', () => {
    expect(hasQuotablePrice({ ...base, areaDeals: 0 })).toBe(false);
  });

  it('가격이 없으면 거짓 (RPC 가 표본 부족 시 통째로 NULL 을 준다)', () => {
    expect(hasQuotablePrice({ ...base, areaM2: null, areaDeals: null, priceAvg: null })).toBe(false);
  });
});

describe('gichukRegions — 페이지의 지역 규칙을 그대로 따른다', () => {
  it('부울경이면 세 시도를 편다', () => {
    expect(gichukRegions('부울경')).toEqual(['부산', '울산', '경남']);
  });
  it('단일 시도는 그대로 넘긴다 — 다른 섹션과 같은 지역을 말해야 한다', () => {
    expect(gichukRegions('부산')).toEqual(['부산']);
  });
});

describe('표기', () => {
  it('만원 → 억 (price_min/max 와 같은 단위다)', () => {
    expect(eok(59441)).toBe('5.9억');
    expect(eok(7283)).toBe('0.7억');
    expect(eok(null)).toBe('');
    expect(eok(0)).toBe('');
  });

  it('㎡ 는 반올림해서 낸다 — 84.9㎡ 는 길고 의미가 없다', () => {
    expect(areaLabel(84.9)).toBe('85㎡');
    expect(areaLabel(59.4)).toBe('59㎡');
    expect(areaLabel(null)).toBe('');
  });

  it('거래일은 연도를 뗀다', () => {
    expect(dealDateLabel('2026-08-18')).toBe('8/18');
    expect(dealDateLabel(null)).toBe('');
  });
});
