// ADDENDUM §3-2 — 브랜드 4곳 프로파일 파서.
//
// ⚠️ 고정 자료는 **2026-08-25 실제로 받아온 HTML** 이다. 사본을 만들어 검증하지 않는다 —
//    V17-G 때 임시 스크립트의 정규식 오타로 "0건 파싱" 을 쫓다 시간을 버린 적이 있다.
//    모듈을 직접 import 해서 실제 파일에 물린다.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseUnitsCell,
  parsePlanTable,
  parseDataAttrList,
  parseMobileCardList,
  parseAjaxCardList,
} from '@/lib/builder-sites/parse';

const fixture = (n: string) => readFileSync(join(process.cwd(), 'src/__tests__/fixtures', n), 'utf8');

describe('parseUnitsCell — 두 축을 잃지 않는다', () => {
  it('총 A세대 (일반분양 B세대) — 더샵 모바일 형식', () => {
    // ⚠️ 이 케이스가 이 파일의 존재 이유다. 괄호 형식을 '일반분양만' 으로 읽으면
    //    647세대 단지가 84세대 단지로 나간다.
    expect(parseUnitsCell('총 647세대 (일반분양 84세대)')).toEqual({ complex: 647, supply: 84 });
    expect(parseUnitsCell('총 788세대(일반분양 231세대)')).toEqual({ complex: 788, supply: 231 });
  });

  it('괄호가 없으면 supply 를 지어내지 않는다', () => {
    expect(parseUnitsCell('총 821세대')).toEqual({ complex: 821, supply: null });
  });

  it('기존 형식은 그대로 동작한다', () => {
    expect(parseUnitsCell('1,670세대 중 일반분양 1,061세대')).toEqual({ complex: 1670, supply: 1061 });
    expect(parseUnitsCell('466세대')).toEqual({ complex: 466, supply: null });
  });
});

describe('parsePlanTable — 푸르지오 「분양계획 한눈에 보기」', () => {
  const cards = parsePlanTable(fixture('prugio-plan.html'));

  it('행을 뽑는다', () => {
    expect(cards.length).toBeGreaterThanOrEqual(8);
  });

  it('전체가구수와 공급수를 각각 잡는다', () => {
    const summit = cards.find((c) => c.name.includes('써밋 더힐'));
    expect(summit?.units).toEqual({ complex: 1515, supply: 432 });
    const goejeong = cards.find((c) => c.name.includes('괴정3구역'));
    expect(goejeong?.units).toEqual({ complex: 757, supply: 228 });
  });

  it('오피스텔 행은 제외한다 — 아파트와 규모를 섞지 않는다', () => {
    expect(cards.some((c) => c.name.includes('(OT)'))).toBe(false);
  });

  it('이 표에는 이미지가 없다 — 지어내지 않는다', () => {
    expect(cards.every((c) => c.imageUrl === null)).toBe(true);
  });

  it('전용 홈페이지는 별칭 출처로 남긴다', () => {
    expect(cards.some((c) => (c.homepage ?? '').startsWith('http'))).toBe(true);
  });
});

describe('parseDataAttrList — 롯데캐슬 data 속성', () => {
  const cards = parseDataAttrList(fixture('lottecastle-lots.html'), 'https://www.lottecastle.co.kr/');

  it('카드를 뽑는다', () => {
    expect(cards.length).toBeGreaterThanOrEqual(5);
  });

  it('세대수를 화면 문구가 아니라 속성에서 읽는다', () => {
    const hs = cards.find((c) => c.name.includes('향남'));
    expect(hs?.units.complex).toBe(1542);
    expect(hs?.units.supply).toBe(1542);
    expect(hs?.address).toContain('화성시');
  });

  it('목록 이미지는 실제 URL 이다 (base64 가 아니다)', () => {
    const withImg = cards.filter((c) => c.imageUrl);
    expect(withImg.length).toBeGreaterThan(0);
    expect(withImg[0].imageUrl).toMatch(/^https?:\/\//);
    expect(withImg[0].imageUrl).not.toContain('data:image');
  });
});

describe('parseMobileCardList — 더샵 모바일', () => {
  const cards = parseMobileCardList(fixture('thesharp-mobile-sales.html'));

  it('카드를 뽑고 두 축을 채운다', () => {
    expect(cards.length).toBeGreaterThanOrEqual(5);
    const twoAxis = cards.filter((c) => c.units.complex && c.units.supply);
    expect(twoAxis.length).toBeGreaterThan(0);
  });

  it('이미지를 가져오지 않는다 — robots 가 /upload/ 를 막는다', () => {
    expect(cards.every((c) => c.imageUrl === null)).toBe(true);
  });
});

describe('parseAjaxCardList — 두산위브', () => {
  const cards = parseAjaxCardList(fixture('weve-ajax-list.html'));

  it('이름과 위치를 뽑는다', () => {
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards[0].name.length).toBeGreaterThan(2);
    expect(cards[0].address).toBeTruthy();
  });

  it('⚠️ 세대수를 넣지 않는다 — 라벨이 하나뿐이라 판단 근거가 없다', () => {
    expect(cards.every((c) => c.units.complex === null && c.units.supply === null)).toBe(true);
  });

  it('이미지를 넣지 않는다 — base64 인라인이라 URL 이 없다', () => {
    expect(cards.every((c) => c.imageUrl === null)).toBe(true);
  });
});
