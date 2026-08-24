// V17 G — 시공사 브랜드 사이트 목록 파서 테스트.
//
// ⚠️ 고정 자료는 **실제로 받아온 HTML** 이다
//    (`fixtures/hanulche-sale-list.html` — ihanulche.co.kr/sale/list?currentPage=2, 2026-08-24).
//    파서를 사본에 대고 검증하면 사본만 통과한다. 이번에도 임시 스크립트에서
//    백슬래시가 하나 빠져 "0건 파싱" 을 한참 쫓았다 — 진짜 모듈을 진짜 HTML 에 돌린다.
//
// 지키려는 것: **총 세대수 셀의 앞뒤 숫자를 뒤집지 않는다.**
// `1,670세대 중 일반분양 1,061세대` 에서 뒤 숫자를 단지 전체로 잡으면
// 화면이 1,061세대 단지라고 말한다 — 실제로 그렇게 나가고 있던 값이다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAddress, parseBuilderList, parseUnitsCell } from '@/lib/builder-sites/parse';

const html = readFileSync(join(__dirname, 'fixtures', 'hanulche-sale-list.html'), 'utf8');
const cards = parseBuilderList(html, 'https://www.ihanulche.co.kr/sale/list');

describe('총 세대수 셀 — 실측 3형식', () => {
  it('숫자 하나면 단지 전체다', () => {
    expect(parseUnitsCell('466세대')).toEqual({ complex: 466, supply: null });
  });

  it('"A세대 중 일반분양 B세대" 는 A가 단지 전체, B가 분양 공급이다', () => {
    // 이 케이스가 이 파일의 존재 이유다.
    expect(parseUnitsCell('1,670세대 중 일반분양 1,061세대')).toEqual({
      complex: 1670,
      supply: 1061,
    });
  });

  it('접두어가 붙어도 단지 전체로 읽는다', () => {
    expect(parseUnitsCell('아파트 총 1,242세대')).toEqual({ complex: 1242, supply: null });
  });

  it('일반분양만 적혀 있으면 단지 전체는 모른다 — 지어내지 않는다', () => {
    expect(parseUnitsCell('일반분양 320세대')).toEqual({ complex: null, supply: 320 });
  });

  it('빈 값·숫자 없음은 둘 다 null', () => {
    expect(parseUnitsCell('')).toEqual({ complex: null, supply: null });
    expect(parseUnitsCell('미정')).toEqual({ complex: null, supply: null });
  });
});

describe('현장 위치 → 지역', () => {
  it('시·도와 시군구를 뽑는다', () => {
    expect(parseAddress('경북 상주시 냉림동 53번지 일원')).toEqual({
      region: '경북',
      sigungu: '상주시',
    });
  });
  it('시군구 형태가 아니면 null — 억지로 만들지 않는다', () => {
    expect(parseAddress('부산 일원').sigungu).toBeNull();
    expect(parseAddress(null)).toEqual({ region: null, sigungu: null });
  });
});

describe('실측 HTML 파싱', () => {
  it('카드를 뽑아낸다 — 0건이면 파서가 죽은 것이다', () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it('같은 단지가 두 번 실려도 한 번만 센다', () => {
    // 실측: 금정산 하늘채 루미엘이 두 번 나온다.
    const names = cards.map((c) => c.name.replace(/\s+/g, ''));
    expect(new Set(names).size).toBe(names.length);
  });

  it('네비게이션 <li> 를 카드로 오인하지 않는다', () => {
    // '분양정보'·'분양단지' 같은 제목 블록에는 위치·세대수가 없다.
    for (const c of cards) expect(c.address || c.units.complex || c.units.supply).toBeTruthy();
  });

  it('엄궁역 트라비스 하늘채 — 총 1,670 / 일반분양 1,061', () => {
    const c = cards.find((x) => x.name.includes('엄궁역 트라비스'));
    expect(c).toBeDefined();
    expect(c!.units).toEqual({ complex: 1670, supply: 1061 });
    expect(parseAddress(c!.address).region).toBe('부산');
  });

  it('상주북천 하늘채 파크원 — 위치·세대수·조감도·전용 홈페이지', () => {
    const c = cards.find((x) => x.name.includes('상주북천'));
    expect(c).toBeDefined();
    expect(c!.address).toContain('상주시');
    expect(c!.units.complex).toBe(466);
    // 이미지 URL 은 절대경로로 바뀌어 나와야 한다 (목록은 /resources/… 상대경로다).
    expect(c!.imageUrl).toMatch(/^https:\/\/www\.ihanulche\.co\.kr\/resources\//);
    expect(c!.homepage).toMatch(/^https?:\/\//);
  });
});
