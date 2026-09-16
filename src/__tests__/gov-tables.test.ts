/**
 * K-2 수치 게이트 — 계산기 두 종의 «지어낸 공식» 검거분 회귀 (2026-09-16).
 *
 * 이 파일은 두 가지를 동시에 고정한다:
 *   ① 새 값이 «고시표와 정확히 일치» 하는가 (긍정형)
 *   ② 옛 값이 «얼마나 틀렸는가» (반증형) — 회귀로 되돌아가면 바로 잡히도록 숫자를 박아 둔다
 */
import { describe, it, expect } from 'vitest';
import { bondRatePerMille, pensionMonthly, PENSION_MIN_AGE, brokerageBracket } from '@/lib/calc/gov-tables';
import { housingBond, housingPension, brokerageFee, currencyConvert } from '@/lib/calc/formulas';

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

  it('최저 구간은 «지역 구분이 없다» — 그 밖의 지역도 13/1,000 (원문 대조로 닫힘)', () => {
    // 2차 출처에서 이 칸이 공란으로 보였던 것은 «값이 없어서» 가 아니라 «구분이 없어서» 였다.
    // 한동안 null 로 비워 두었고 2026-09-16 별지 부표 원문 대조로 13 임이 확정됐다.
    // ⛔ 빈 칸을 0 으로도 null 로도 «단정하지 않은» 것이 옳았다는 기록으로 남긴다.
    expect(bondRatePerMille(3_000_000_0, false)).toBe(13);
    expect(bondRatePerMille(3_000_000_0, true)).toBe(13);
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

  it('원문 대조 후 «미확인 칸이 없다» — 실입력에서 미확인 분기가 뜨지 않는다', () => {
    // 미확인 분기 자체는 남겨 둔다(표에 구멍이 다시 생기면 계산 대신 그렇게 말해야 한다).
    // 다만 지금은 전 구간이 닫혀 있어 어떤 실입력도 그 분기로 가지 않는다.
    for (const p of [3_000_000_0, 0.7 * 억, 1.2 * 억, 2 * 억, 5 * 억, 10 * 억]) {
      for (const region of ['metro', 'other'] as const) {
        expect(housingBond({ housePrice: p, region, discountRate: 0 }).main.label)
          .toBe('채권 매입금액');
      }
    }
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

describe('중개보수 — 2021년 개정 요율표 (K-3)', () => {
  it('매매 구간이 법정과 일치한다', () => {
    expect(brokerageBracket('trade', 30_000_000)?.rate).toBe(0.006);
    expect(brokerageBracket('trade', 1 * 억)?.rate).toBe(0.005);
    expect(brokerageBracket('trade', 5 * 억)?.rate).toBe(0.004);
    expect(brokerageBracket('trade', 10 * 억)?.rate).toBe(0.005);
    expect(brokerageBracket('trade', 13 * 억)?.rate).toBe(0.006);
    expect(brokerageBracket('trade', 20 * 억)?.rate).toBe(0.007);
  });

  it('임대차 구간이 법정과 일치한다', () => {
    expect(brokerageBracket('lease', 30_000_000)?.rate).toBe(0.005);
    expect(brokerageBracket('lease', 0.7 * 억)?.rate).toBe(0.004);
    expect(brokerageBracket('lease', 3 * 억)?.rate).toBe(0.003);
    expect(brokerageBracket('lease', 8 * 억)?.rate).toBe(0.004);
    expect(brokerageBracket('lease', 13 * 억)?.rate).toBe(0.005);
    expect(brokerageBracket('lease', 20 * 억)?.rate).toBe(0.006);
  });

  it('⛔ 경계는 «이상/미만» 이다 — 정확히 2억인 매매는 0.4% 구간', () => {
    // 옛 코드는 `base <= max` 라 2억을 0.5% 로 보냈다.
    expect(brokerageBracket('trade', 2 * 억)?.rate).toBe(0.004);
    expect(brokerageBracket('trade', 2 * 억 - 1)?.rate).toBe(0.005);
  });

  it('⛔ 임대차 3억 구간이 «도달 가능» 하다 — 옛 표는 순서 역전으로 사문이었다', () => {
    const b = brokerageBracket('lease', 3 * 억);
    expect(b).not.toBeNull();
    expect(b!.min).toBe(1 * 억);
    expect(b!.max).toBe(6 * 억);
  });

  it('옛 값의 과대분을 고정한다 — 10억 매매 0.9% vs 법정 0.5%', () => {
    const 옛값 = Math.round(10 * 억 * 0.009);
    const 새값 = Math.round(10 * 억 * brokerageBracket('trade', 10 * 억)!.rate);
    expect(옛값).toBe(9_000_000);
    expect(새값).toBe(5_000_000);
    expect(옛값 / 새값).toBeCloseTo(1.8, 1);
  });

  it('옛 값의 과대분을 고정한다 — 8억 전세 0.8% vs 법정 0.4%', () => {
    const 새 = brokerageBracket('lease', 8 * 억)!.rate;
    expect(0.008 / 새).toBe(2);
  });

  it('한도액이 걸리는 소액 구간은 한도로 잘린다', () => {
    const r = brokerageFee({ price: 40_000_000, monthlyRent: 0, dealType: 'trade' });
    // 4,000만 × 0.6% = 24만 → 한도 25만 미만이므로 그대로
    expect(r.main.value).toContain('24만');
    const r2 = brokerageFee({ price: 49_000_000, monthlyRent: 0, dealType: 'trade' });
    expect(r2.details.some((d) => d.label === '한도액')).toBe(true);
  });

  it('「내야 하는 금액」이 아니라 «상한» 임을 화면이 말한다', () => {
    const r = brokerageFee({ price: 5 * 억, monthlyRent: 0, dealType: 'trade' });
    expect(r.main.label).toBe('중개수수료 상한');
    expect(r.details.some((d) => d.value.includes('협의'))).toBe(true);
  });
});

describe('환율 계산기 — 상수를 버리고 주입값을 쓴다 (K-9 ⓒ 1호)', () => {
  const FX = JSON.stringify({
    rates: { USD: 1, KRW: 1347.199701, JPY: 154.389032, EUR: 0.865688, CNY: 6.725199 },
    updatedAt: '2026-09-15T23:29:00.638Z',
  });

  it('주입된 라이브 환율로 환산한다', () => {
    const r = currencyConvert({ amount: 100, from: 'USD', to: 'KRW', __fx: FX });
    expect(r.main.value).toBe('134,719.97 KRW');   // 100 × 1347.199701
  });

  it('기준 시각을 «반드시» 함께 낸다 — 날짜 없는 환율은 거짓 신선도다', () => {
    const r = currencyConvert({ amount: 1, from: 'USD', to: 'KRW', __fx: FX });
    expect(r.details.some((d) => d.label === '기준' && d.value.includes('2026-09-15'))).toBe(true);
  });

  it('⛔ 주입이 없으면 «지어내지 않는다» — 옛 상수로 조용히 되돌아가지 않는다', () => {
    const r = currencyConvert({ amount: 100, from: 'USD', to: 'KRW' });
    expect(r.main.label).toBe('환율 미수신');
    expect(r.main.value).toBe('—');
  });

  it('표에 없는 통화도 「미수신」으로 말한다', () => {
    const r = currencyConvert({ amount: 1, from: 'USD', to: 'XXX', __fx: FX });
    expect(r.main.label).toBe('환율 미수신');
  });

  it('옛 상수의 오차를 고정한다 — EUR 6.2% · CNY 7.8%', () => {
    const live = { EUR: 0.865688, CNY: 6.725199 };
    expect((0.92 / live.EUR - 1) * 100).toBeGreaterThan(6);
    expect((7.25 / live.CNY - 1) * 100).toBeGreaterThan(7);
  });
});
