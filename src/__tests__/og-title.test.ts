// 썸네일 제목 추출 자물쇠 (T1 §2 · T2 1부).
//
// ⚠️ 이 파일이 지키는 것:
//    1. 어절을 «의미 경계»에서만 자른다. 글자 수 절반에서 자르면
//       '디엠씨해링턴플레 / 이스엔에이치에프' 가 나온다.
//    2. 숫자 안의 콤마·소수점을 살린다. 8,747편 중 255편이 이걸로 깨진 전례가 있다.
//    3. 630 캔버스에서 60px 미만이 나오지 않는다 — 120px 썸네일에서 판독이 안 된다.
//    4. 어떤 입력에도 던지지 않는다. 8,775편 배치용이다.

import { describe, it, expect } from 'vitest';
import { titleLines, fitFontSize } from '@/lib/og/brand';

const px = (t: unknown) => Math.round(fitFontSize(titleLines(t), 630));

describe('titleLines — 띄어쓰기 없는 단지명 (T2)', () => {
  it('브랜드 경계에서 자른다 — 글자 수 절반이 아니라', () => {
    const lines = titleLines('디엠씨해링턴플레이스엔에이치에프 시세 분석');
    // 반토막 나던 조각이 더는 나오면 안 된다
    expect(lines).not.toContain('디엠씨해링턴플레');
    expect(lines).not.toContain('이스엔에이치에프');
    expect(lines.some((l) => l.includes('해링턴플레이스'))).toBe(true);
  });

  it("'해링턴플레이스' 가 '해링턴' 보다 먼저 잡힌다 — BRANDS 순서가 우선순위다", () => {
    const lines = titleLines('디엠씨해링턴플레이스엔에이치에프');
    expect(lines.some((l) => l === '해링턴' || l.startsWith('해링턴타워'))).toBe(false);
  });

  it('에일린의뜰 — 조사로 시작하는 조각을 만들지 않는다', () => {
    const lines = titleLines('울산뉴시티에일린의뜰1차 단지 분석');
    expect(lines).not.toContain('일린의뜰1차');
    expect(lines.some((l) => l.includes('에일린의뜰'))).toBe(true);
  });

  it('동 나열은 단지명이 아니다 — 통째로 뺀다', () => {
    const lines = titleLines('북한산삼부르네상스205동206동207동 시세 분석');
    expect(lines.join(' ')).not.toMatch(/\d+동/);
  });
});

describe('titleLines — 영문 (T2)', () => {
  it('글자 수로 자르지 않는다 — Lulul / emon 금지', () => {
    const lines = titleLines('Lululemon (LULU) 투자 전망');
    expect(lines).not.toContain('Lulul');
    expect(lines).toContain('Lululemon');
  });

  it('하이픈 경계에서는 자른다', () => {
    const lines = titleLines('Colgate-Palmolive (CL) 목표주가 분석');
    expect(lines).toEqual(expect.arrayContaining(['Colgate', 'Palmolive']));
  });
});

describe('clean — 숫자 콤마·소수점 보존 (T1-1b 회귀 방어)', () => {
  // ⚠️ 숫자가 4번째 어절이면 3줄 상한에서 잘린다. 그건 콤마 처리와 무관하니
  //    여기서는 숫자를 앞쪽에 둔 입력으로 «쪼개짐»만 본다.
  it('천 단위 콤마를 쪼개지 않는다', () => {
    const lines = titleLines('코스피 7,981 돌파');
    expect(lines.join(' ')).toContain('7,981');
    expect(lines).not.toContain('981');   // '7' '981' 로 갈라진 뒤 '7981' 로 붙던 전례
  });

  it('소수점을 쪼개지 않는다', () => {
    const lines = titleLines('전세가율 17.9% 하락 분석');
    expect(lines.join(' ')).toContain('17.9');
    expect(lines).not.toContain('9');
  });
});

describe('splitRedevUnit — 정비구역 표기 (bd309298 회귀 방어)', () => {
  it("'범천1-1' 을 하이픈에서 자르지 않는다", () => {
    expect(titleLines('범천1-1구역 재개발 — 부산').join(' ')).toContain('범천1-1');
  });

  it("'구역' 한 글자만 남는 줄을 만들지 않는다", () => {
    expect(titleLines('범천1-1구역 재개발')).not.toContain('구역');
  });
});

describe('폰트 하한 — 630 캔버스에서 60px 이상', () => {
  const SAMPLES = [
    '디엠씨해링턴플레이스엔에이치에프 시세 분석',
    '소촌동모아엘가에듀퍼스트아파트 실거래가 리포트',
    '북한산삼부르네상스205동206동207동 시세 분석',
    '울산뉴시티에일린의뜰1차 단지 분석',
    '담양양우내안애퍼스트힐2단지 단지 분석',
    '에스아이팰리스강동센텀 시세 분석',
    'Lululemon (LULU) 투자 전망',
    'Colgate-Palmolive (CL) 목표주가 분석',
    '마포로제1구역제19-1지구 재개발',
    '범천1-1구역 재개발 — 부산',
  ];
  for (const s of SAMPLES) {
    it(`${s.slice(0, 24)} — 60px 이상`, () => {
      expect(px(s)).toBeGreaterThanOrEqual(60);
    });
  }
});

describe('실발행 제목에서 나온 결함 2건 (T2 실측 회귀 방어)', () => {
  it("브랜드가 «끝»에 붙어도 머리가 통째로 남지 않는다", () => {
    // 이전: '옥정중앙역중흥S-클래스센텀' + '시티' → 41px
    const t = '옥정중앙역중흥S-클래스센텀시티(1단지) 시세 현황 (2026)';
    expect(titleLines(t).every((l) => l.length <= 10)).toBe(true);
    expect(px(t)).toBeGreaterThanOrEqual(60);
  });

  it("DROP '투자' 가 회사 이름 안을 자르지 않는다", () => {
    // 이전: '…모부동산' + '회사' 로 갈라졌다. DROP 을 '투자 '(뒤 공백)로 좁혀 해결.
    const lines = titleLines('디디아이엘브이씨위탁관리모부동산투자회사 특수관계인 유상증자 참여 공시');
    expect(lines).not.toContain('회사');
    expect(lines.some((l) => l.includes('부동산투자회사'))).toBe(true);
  });

  it("'부동산투자회사' 같은 이름은 살리고 '투자 분석' 접미사는 뗀다", () => {
    expect(titleLines('삼성전자 투자 분석').join(' ')).not.toContain('투자');
  });
});

describe('어떤 입력에도 던지지 않는다', () => {
  for (const bad of ['', null, undefined, 0, {}, [], '   ', '아파트', '동']) {
    it(`${JSON.stringify(bad)} — 폴백`, () => {
      const lines = titleLines(bad as unknown);
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(3);
      expect(lines.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    });
  }
});

describe('줄 수 상한', () => {
  it('4줄 이상을 내지 않는다', () => {
    const long = '부산 해운대구 우동1구역 재개발 힐스테이트 푸르지오 센트럴파크 시세 실거래가';
    expect(titleLines(long).length).toBeLessThanOrEqual(3);
  });
});
