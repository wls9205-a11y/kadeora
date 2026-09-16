/**
 * K-2 수치 게이트 — 계산기 두 종의 «지어낸 공식» 검거분 회귀 (2026-09-16).
 *
 * 이 파일은 두 가지를 동시에 고정한다:
 *   ① 새 값이 «고시표와 정확히 일치» 하는가 (긍정형)
 *   ② 옛 값이 «얼마나 틀렸는가» (반증형) — 회귀로 되돌아가면 바로 잡히도록 숫자를 박아 둔다
 */
import { describe, it, expect } from 'vitest';
import { bondRatePerMille, pensionMonthly, PENSION_MIN_AGE } from '@/lib/calc/gov-tables';
import { housingBond, housingPension } from '@/lib/calc/formulas';

const 억 = 100_000_000;

describe('국민주택채권 — 매입률은 단일값이 아니라 구간별 누진이다', () => {
  it('특별시·광역시 구간표와 정확히 일치한다', () => {
    expect(bondRatePerMille(3_000_000_0, true)).toBe(13);   // 3,000만 → 2천~5천 구간
    expect(bondRatePerMille(0.7 * 억, true)).toBe(19);
    expect(bondRatePerMille(1.2 * 억, true)).toBe(21);
    expect(bondRatePerMille(2 * 억, true)).toBe(23);
    expect(bondRatePerMille(5 * 억, true)).toBe(26);
    expect(bondRatePerMille(10 * 억, true)).toBe(31);
  });

  it('그 밖의 지역 구간표와 정확히 일치한다', () => {
    expect(bondRatePerMille(0.7 * 억, false)).toBe(14);
    expect(bondRatePerMille(5 * 억, false)).toBe(21);
    expect(bondRatePerMille(10 * 억, false)).toBe(26);
  });

  it('경계값은 «이상/미만» 으로 갈린다 — 6억은 위 구간이다', () => {
    expect(bondRatePerMille(5.9999 * 억, true)).toBe(26);
    expect(bondRatePerMille(6 * 억, true)).toBe(31);
  });

  it('2,000만원 미만은 매입 대상이 아니다(0)', () => {
    expect(bondRatePerMille(19_000_000, true)).toBe(0);
  });

  it('⛔ 원문 미확인 칸은 null 이다 — 0 으로 때우지 않는다', () => {
    // 최저 구간의 「그 밖의 지역」은 2차 출처에서 공란이었다. 세션 A 교차 대상.
    expect(bondRatePerMille(3_000_000_0, false)).toBeNull();
  });
});

describe('housingBond — 옛 단일률의 오차를 고정한다', () => {
  it('5억·특별시: 법정 26/1,000 = 1,300만원', () => {
    const r = housingBond({ housePrice: 5 * 억, region: 'metro', discountRate: 0 });
    expect(r.main.label).toBe('채권 매입금액');
    expect(r.main.value).toContain('1,300');
  });

  it('옛 값(5%)은 같은 조건에서 2,500만원이었다 — 약 1.9배 과대', () => {
    const 옛값 = Math.round(5 * 억 * 0.05);
    const 새값 = Math.round(5 * 억 * 26 / 1000);
    expect(옛값).toBe(25_000_000);
    expect(새값).toBe(13_000_000);
    expect(옛값 / 새값).toBeGreaterThan(1.9);
  });

  it('할인율 미입력이면 실부담을 «지어내지 않고» 어디서 보는지 알린다', () => {
    const r = housingBond({ housePrice: 5 * 억, region: 'metro', discountRate: 0 });
    const line = r.details.find((d) => d.label === '즉시매도 실부담');
    expect(line?.value).toContain('당일 고시');
  });

  it('할인율을 입력하면 그때만 실부담이 나온다', () => {
    const r = housingBond({ housePrice: 5 * 억, region: 'metro', discountRate: 10 });
    const line = r.details.find((d) => d.label === '즉시매도 시 실부담');
    expect(line?.value).toContain('130만원');   // 1,300만 × 10% — fmt() 는 만원 단위로 쓴다
    expect(line?.value).toContain('할인율 10%');
  });

  it('매입률을 모르는 칸은 계산하지 않고 그렇게 말한다', () => {
    const r = housingBond({ housePrice: 3_000_000_0, region: 'other', discountRate: 0 });
    expect(r.main.label).toBe('매입률 미확인');
  });
});

describe('주택연금 — 공사 예시표(2026-03-01 적용, 단위 천원)와 일치한다', () => {
  it('격자 위의 값은 표와 «정확히» 같다', () => {
    expect(pensionMonthly(3 * 억, 70)).toBe(923_000);
    expect(pensionMonthly(5 * 억, 70)).toBe(1_539_000);
    expect(pensionMonthly(5 * 억, 65)).toBe(1_264_000);
    expect(pensionMonthly(1 * 억, 55)).toBe(156_000);
    expect(pensionMonthly(8 * 억, 80)).toBe(3_865_000);
  });

  it('격자 사이는 보간한다 — 반드시 양 끝 사이에 든다', () => {
    const v = pensionMonthly(5 * 억, 67)!;
    expect(v).toBeGreaterThan(1_264_000);   // 65세
    expect(v).toBeLessThan(1_539_000);      // 70세
  });

  it('고령·고가의 «평평한» 구간을 직선으로 뚫지 않는다 (대출한도 상한)', () => {
    // 80세는 9억부터 4,060천원에서 멈춘다. 12억도 같아야 한다.
    expect(pensionMonthly(9 * 억, 80)).toBe(4_060_000);
    expect(pensionMonthly(12 * 억, 80)).toBe(4_060_000);
  });

  it('표 상한(12억)을 넘으면 상한에서 잰다', () => {
    expect(pensionMonthly(20 * 억, 70)).toBe(pensionMonthly(12 * 억, 70));
  });

  it(`만 ${PENSION_MIN_AGE}세 미만은 «0원» 이 아니라 «대상 아님» 이다`, () => {
    expect(pensionMonthly(5 * 억, 54)).toBeNull();
    const r = housingPension({ housePrice: 5 * 억, age: 54 });
    expect(r.main.label).toBe('가입 대상 아님');
  });

  it('⛔ 옛 공식 0.02+(age-55)*0.002 의 과대분을 고정한다 (70세·5억)', () => {
    const 옛값 = Math.round(5 * 억 * (0.02 + (70 - 55) * 0.002) / 12);
    expect(옛값).toBe(2_083_333);
    expect(pensionMonthly(5 * 억, 70)).toBe(1_539_000);
    expect(옛값 / pensionMonthly(5 * 억, 70)!).toBeGreaterThan(1.35);  // 약 35% 과대
  });

  it('결과에 조건·기준일이 붙는다 — 어떤 표로 잰 값인지 화면이 말한다', () => {
    const r = housingPension({ housePrice: 5 * 억, age: 70 });
    expect(r.details.some((d) => d.value.includes('2026-03-01'))).toBe(true);
    expect(r.details.some((d) => d.value.includes('종신지급'))).toBe(true);
  });
});
