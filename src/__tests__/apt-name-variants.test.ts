import { describe, it, expect } from 'vitest';
import { generateNameVariants } from '@/lib/apt-name-variants';

/**
 * CV-B ① — 변형 생성기 조각·중복 차단.
 *
 * 실측 배경: 활성 359현장에 「1글자 첫 토큰」 조각 변형 377개(부울경 118)가 쌓여 있었다.
 * sa.py `name_pool()` 이 별칭을 «짧은 순» 으로 채택하므로 조각이 그 현장의 1순위
 * 키워드가 된다 — 소비자 필터가 아니라 여기서 막는다.
 */
describe('CV-B ① 조각 별칭 차단', () => {
  const gimhae = () => generateNameVariants({
    name: '김해 외동 재건축사업',
    sigungu: '김해시', dong: '외동', builder: '태영건설',
  });

  it('「외 데시앙」 — 두 글자 동에서 「동」을 떼어 만든 조각을 내지 않는다', () => {
    expect(gimhae()).not.toContain('외 데시앙');
  });

  it('한 글자 한글 토큰이 든 변형은 하나도 없다', () => {
    for (const v of gimhae()) {
      expect(v.split(/\s+/).some((t) => t.length === 1 && /[가-힣]/.test(t))).toBe(false);
    }
  });

  it('브랜드 결합형은 «자르지 않은» 동명으로 낸다', () => {
    const vs = gimhae();
    expect(vs).toContain('외동 데시앙');
    expect(vs).toContain('김해 외동 데시앙');
  });

  it('단지명이 이미 시군구를 달고 있으면 시군구를 또 붙이지 않는다', () => {
    const vs = gimhae();
    expect(vs).not.toContain('김해김해외동재건축사업');
    expect(vs.some((v) => v.replace(/\s+/g, '').startsWith('김해김해'))).toBe(false);
  });
});

describe('되살려야 할 결합형은 그대로 산다', () => {
  it('s261 마산 자산 데시앙 케이스 — 시군구 끼워넣기 유지', () => {
    const vs = generateNameVariants({
      name: '메트로시티 자산 데시앙',
      sigungu: '마산합포구', dong: '자산동', builder: '태영건설',
    });
    expect(vs).toContain('마산 메트로시티 자산 데시앙');
    expect(vs).toContain('메트로시티 마산 자산 데시앙');
  });

  it('두 글자 이상 토큰의 지역+브랜드 결합은 유지 (「서면 롯데캐슬」 형)', () => {
    const vs = generateNameVariants({
      name: '양정3 재건축', sigungu: '부산진구', dong: '양정동', builder: '롯데건설',
    });
    expect(vs).toContain('서면 롯데캐슬');
    expect(vs).toContain('양정 롯데캐슬');
  });

  it('세 글자 동은 「동」을 뗀 형태도 낸다', () => {
    const vs = generateNameVariants({
      name: '거제2 재개발', sigungu: '연제구', dong: '거제동', builder: '포스코이앤씨',
    });
    expect(vs).toContain('거제동 더샵');
    expect(vs).toContain('거제 더샵');
  });
});

describe('한 글자 «구» 이름 조각 (실측 최다 유형)', () => {
  it('「중구」를 「중」으로 잘라 붙이지 않는다', () => {
    const vs = generateNameVariants({
      name: '유천1구역 지역주택조합', sigungu: '중구', dong: '유천동', builder: '태영건설',
    });
    expect(vs).not.toContain('중 유천1구역 지역주택조합');
    expect(vs).toContain('중구 유천1구역 지역주택조합');
    expect(vs).not.toContain('중 데시앙');
    expect(vs).toContain('유천동 데시앙');
  });
});

describe('원래 이름에 있는 한 글자 토큰은 살린다', () => {
  it('「더」·「린」 류를 죽이지 않는다 — 실측 685건 중 189건이 이 형태다', () => {
    const vs = generateNameVariants({ name: 'DS 더 웰가', sigungu: '해운대구' });
    expect(vs).toContain('DS 더 웰가');
    expect(vs).toContain('해운대 DS 더 웰가');
  });

  it('우미 린 — 브랜드 자체가 한 글자 토큰이어도 유지', () => {
    const vs = generateNameVariants({ name: '강릉 우미 린 더 프리미어', sigungu: '강릉시' });
    expect(vs).toContain('강릉 우미 린 더 프리미어');
    expect(vs.every((v) => v.includes('우미'))).toBe(true);
  });
});

describe('붙여쓴 대표명의 띄어쓴 변형은 조각이 아니다', () => {
  it('『가평센트럴파크더스카이』의 「가평 센트럴파크 더 스카이」를 죽이지 않는다', () => {
    const vs = generateNameVariants({ name: '가평 센트럴파크 더 스카이', sigungu: '가평군' });
    expect(vs).toContain('가평 센트럴파크 더 스카이');
    expect(vs).toContain('가평센트럴파크더스카이');
  });
});
