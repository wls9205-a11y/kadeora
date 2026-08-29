// §7-1 자물쇠 — 분양예정시기는 «원문이 말한 만큼만» 말한다.
//
// ⚠️ 이 파일이 지키는 것: 화면이 «저장값보다 정밀한 시기» 를 말하지 않는다.
//    「2026년」밖에 모르는 현장에 「2026년 하반기」가 뜨면 근거 없는 시기를 지어낸 것이고,
//    그건 표시광고 리스크다(§7-1).

import { describe, it, expect } from 'vitest';
import { parseSalePeriod, salePeriodText } from '@/lib/apt/sale-period';

describe('가변 정밀도 파싱', () => {
  it('네 정밀도를 그대로 읽는다', () => {
    expect(parseSalePeriod('2026')).toEqual({ label: '2026년', precision: 'year' });
    expect(parseSalePeriod('2026H2')).toEqual({ label: '2026년 하반기', precision: 'half' });
    expect(parseSalePeriod('2026H1')).toEqual({ label: '2026년 상반기', precision: 'half' });
    expect(parseSalePeriod('2026Q3')).toEqual({ label: '2026년 3분기', precision: 'quarter' });
    expect(parseSalePeriod('2026-09')).toEqual({ label: '2026년 9월', precision: 'month' });
  });

  it('앞자리 0 을 떼고 읽는다 — 「2026년 09월」이라고 쓰지 않는다', () => {
    expect(parseSalePeriod('2026-01')!.label).toBe('2026년 1월');
  });

  it('⛔ 정밀도를 «올리지» 않는다 — 연도만 아는 값은 연도까지만 말한다', () => {
    const p = parseSalePeriod('2026')!;
    expect(p.precision).toBe('year');
    expect(p.label).not.toMatch(/반기|분기|월/);
  });

  it('⛔ 정밀도를 «내리지도» 않는다 — 월을 알면 월까지 말한다(아는 정보를 버리지 않는다)', () => {
    expect(parseSalePeriod('2026-09')!.label).toContain('9월');
  });
});

describe('못 읽는 값', () => {
  it('null·undefined·빈 값은 null 이다 — 「미정」을 지어내지 않는다', () => {
    for (const v of [null, undefined, '']) expect(parseSalePeriod(v)).toBeNull();
  });

  it('제약을 벗어난 형식은 null 이다 (DB 제약과 같은 목록을 지킨다)', () => {
    // apt_sites_expected_sale_period_chk: ^[0-9]{4}(H[12]|Q[1-4]|-(0[1-9]|1[0-2]))?$
    for (const v of ['2026H3', '2026Q5', '2026-13', '2026-00', '26-09', '2026년 9월', '미정', '2026-9']) {
      expect(parseSalePeriod(v)).toBeNull();
    }
  });
});

describe('§7-1 한정어', () => {
  it('「분양예정」이 항상 붙는다 — 「분양」만 쓰면 확정으로 읽힌다', () => {
    expect(salePeriodText('2026-09')).toBe('2026년 9월 분양예정');
    expect(salePeriodText('2026')).toBe('2026년 분양예정');
  });

  it('⛔ 표시광고 금지 표현을 만들지 않는다', () => {
    const t = salePeriodText('2026Q3')!;
    for (const banned of ['분양 개시', '분양 시작', '분양가 확정', '확정 분양']) {
      expect(t).not.toContain(banned);
    }
  });

  it('값이 없으면 문구도 없다 — 빈 자리를 문장으로 메우지 않는다', () => {
    expect(salePeriodText(null)).toBeNull();
    expect(salePeriodText('미정')).toBeNull();
  });
});
