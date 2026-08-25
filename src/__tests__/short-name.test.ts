// H3-3 칩 축약 자물쇠 + brand.ts 재사용 판정 기록.
//
// 지시서가 "brand.ts 의 제목 추출을 재사용할 수 있는지 먼저 확인할 것" 이라 했다.
// 아래 첫 describe 가 그 확인을 «실행 가능한 형태로» 남긴 것이다 —
// 나중에 누가 다시 물으면 이 테스트를 보면 된다.

import { describe, it, expect } from 'vitest';
import { shortSiteName } from '@/lib/apt/short-name';
import { titleLines } from '@/lib/og/brand';

describe('brand.ts titleLines 는 칩 축약에 쓸 수 없다 (판정 근거)', () => {
  it('한 줄로 줄이는 게 아니라 여러 줄로 «나눈다»', () => {
    const lines = titleLines('센트레빌 아스테리움 거제');
    expect(lines.length).toBeGreaterThan(1);          // 줄 나눔이지 축약이 아니다
    expect(lines.join(' ')).toContain('아스테리움');   // 가운데를 버리지 않는다
  });

  it('지역 접두어를 지운다 — 칩에서는 지역이 있어야 한다', () => {
    // 어절 4개 이상이면 앞의 지역명을 뗀다
    const lines = titleLines('부산 해운대 힐스테이트 위브 시세');
    expect(lines.join(' ')).not.toContain('부산');
    expect(shortSiteName('부산 해운대 힐스테이트 위브')).toContain('부산');
  });
});

describe('shortSiteName', () => {
  it('12자 이하는 건드리지 않는다', () => {
    for (const n of ['해링턴 마레', '라엘에스', '김해 안동 에피트', '양산자이 파크팰리체', '엄궁역 트라비스 하늘채']) {
      expect(shortSiteName(n)).toBe(n);
    }
  });

  it('지시서 예시 — 첫 어절 + 마지막 어절', () => {
    expect(shortSiteName('센트레빌 아스테리움 거제')).toBe('센트레빌 거제');
  });

  it('둘로 줄여도 길면 첫 어절만', () => {
    expect(shortSiteName('울산 다운2지구 우미린 더 시그니처 본청약')).toBe('울산 본청약');
    expect(shortSiteName('해링턴플레이스 아스테리움 국제금융센터')).toBe('해링턴플레이스');
  });

  it('말줄임표를 만들지 않는다', () => {
    for (const n of ['센트레빌 아스테리움 거제', '울산 다운2지구 우미린 더 시그니처 본청약']) {
      expect(shortSiteName(n)).not.toContain('…');
      expect(shortSiteName(n)).not.toContain('...');
    }
  });

  it('어절이 둘뿐이고 첫 어절이 12자를 넘으면 원문을 지킨다 — 의미를 깨지 않는다', () => {
    const n = '해링턴플레이스아스테리움국제 금융센터';   // 첫 어절 14자
    expect(shortSiteName(n)).toBe(n);
  });

  it('어절이 둘이고 첫 어절이 12자 이내면 그것만 남긴다', () => {
    expect(shortSiteName('해링턴플레이스아스테리움 국제금융센터')).toBe('해링턴플레이스아스테리움');
  });

  it('공백이 흐트러져도 정규화한다', () => {
    expect(shortSiteName('  센트레빌   아스테리움  거제 ')).toBe('센트레빌 거제');
  });

  it('빈 입력에 던지지 않는다', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(shortSiteName(bad as unknown as string)).toBe('');
    }
  });
});
