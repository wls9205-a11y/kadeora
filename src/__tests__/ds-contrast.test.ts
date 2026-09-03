// RULES#143 적용 — 대비 «판정» 을 scripts 사각지대에서 꺼내 테스트로 고정한다.
//
// ⚠️ 이 계산이 틀리면 게이트가 «틀린 말» 을 한다 — 접근성 미달 색을 통과시켜 놓고
//    「통과했다」고 보고한다. 그래서 알려진 정답(21:1 · 1:1)으로 눈금부터 맞춘다.

import { describe, it, expect } from 'vitest';
import {
  parseColor,
  composite,
  luminance,
  contrastRatio,
  toneContrast,
  AA_NORMAL,
} from '@/lib/ds/contrast';

describe('색 파싱', () => {
  it('#RRGGBB · #RGB · rgb() · rgba() 를 읽는다', () => {
    expect(parseColor('#FFFFFF')).toEqual({ rgb: [255, 255, 255], a: 1 });
    expect(parseColor('#fff')).toEqual({ rgb: [255, 255, 255], a: 1 });
    expect(parseColor('rgb(37, 99, 235)')).toEqual({ rgb: [37, 99, 235], a: 1 });
    expect(parseColor('rgba(37,99,235,0.08)')).toEqual({ rgb: [37, 99, 235], a: 0.08 });
  });

  it('못 읽는 값은 «지어내지 않고» null 이다', () => {
    // ⚠️ 여기서 흰색 같은 기본값을 돌려주면 「읽지 못했다」가 「흰 배경이다」로 둔갑한다.
    for (const v of ['', 'transparent', 'currentColor', 'var(--brand)', 'oklch(0.7 0.1 200)', '#12345']) {
      expect(parseColor(v)).toBeNull();
    }
  });
});

describe('명암비 눈금', () => {
  it('검정 위 흰색은 21:1 이다', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  it('같은 색끼리는 1:1 이다', () => {
    expect(contrastRatio([37, 99, 235], [37, 99, 235])).toBeCloseTo(1, 10);
  });

  it('인자 순서와 무관하다', () => {
    const a: [number, number, number] = [17, 24, 39];
    const b: [number, number, number] = [255, 255, 255];
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it('흰색이 검정보다 휘도가 높다', () => {
    expect(luminance([255, 255, 255])).toBeGreaterThan(luminance([0, 0, 0]));
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 5);
  });
});

describe('알파 합성', () => {
  it('불투명이면 그대로다', () => {
    expect(composite({ rgb: [10, 20, 30], a: 1 }, [255, 255, 255])).toEqual([10, 20, 30]);
  });

  it('완전 투명이면 바탕이 그대로 남는다', () => {
    expect(composite({ rgb: [10, 20, 30], a: 0 }, [200, 100, 50])).toEqual([200, 100, 50]);
  });

  it('반투명은 «그 사이» 로 간다 — 이 한 줄이 없어서 1.24 짜리 배지가 나갔다', () => {
    const r = composite({ rgb: [0, 0, 0], a: 0.5 }, [255, 255, 255]);
    expect(r[0]).toBeCloseTo(127.5, 5);
  });
});

describe('토큰 조합 판정', () => {
  it('틴트를 «합성해서» 잰다 — hex 만 보면 값이 달라진다', () => {
    // --success #065F46 on rgba(5,150,105,0.08) over #FFFFFF (실측 6.98:1)
    const withComposite = toneContrast('#065F46', 'rgba(5,150,105,0.08)', '#FFFFFF');
    expect(withComposite).not.toBeNull();
    expect(withComposite!).toBeGreaterThan(AA_NORMAL);
    expect(withComposite!).toBeCloseTo(6.98, 1);
    // 합성을 «안 하면»(틴트를 흰색으로 착각하면) 값이 달라진다 — 그래서 합성이 필요하다.
    const naive = contrastRatio([6, 95, 70], [255, 255, 255]);
    expect(Math.abs(naive - withComposite!)).toBeGreaterThan(0.1);
  });

  it('바탕이 어두워지면 «건드리지 않은» 조합도 내려간다 (중단점 C-4 가 그랬다)', () => {
    const onLight = toneContrast('#2563EB', 'rgba(37,99,235,0.08)', '#F7F8FA')!;
    const onDarker = toneContrast('#2563EB', 'rgba(37,99,235,0.08)', '#F5F6F8')!;
    expect(onDarker).toBeLessThan(onLight);
  });

  it('색을 하나라도 못 읽으면 null 이다 — 모르면 «통과시키지 않는다»', () => {
    expect(toneContrast('var(--brand)', '#FFFFFF', '#FFFFFF')).toBeNull();
    expect(toneContrast('#000000', 'transparent', '#FFFFFF')).toBeNull();
  });
});
