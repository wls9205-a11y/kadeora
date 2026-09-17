/**
 * K-2 수치 게이트 — 계산기 두 종의 «지어낸 공식» 검거분 회귀 (2026-09-16).
 *
 * 이 파일은 두 가지를 동시에 고정한다:
 *   ① 새 값이 «고시표와 정확히 일치» 하는가 (긍정형)
 *   ② 옛 값이 «얼마나 틀렸는가» (반증형) — 회귀로 되돌아가면 바로 잡히도록 숫자를 박아 둔다
 */
import { describe, it, expect } from 'vitest';
import { bondRatePerMille, pensionMonthly, PENSION_MIN_AGE, brokerageBracket, ltvPolicyKey, acqTaxPolicyKey, acqTaxMidRatePct } from '@/lib/calc/gov-tables';
import { housingBond, housingPension, brokerageFee, currencyConvert, ltvCalc, dsrCalc, acquisitionTax, stockRoi, auctionProfit, depositInterest, shortSelling, prepaymentFee, interestTax } from '@/lib/calc/formulas';
import { formatKRWExact } from '@/lib/calc/tax-tables';
import { PREPAY_RATES } from '@/lib/calc/gov-tables';

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

describe('LTV·DSR — 규제 상수는 DB 가 정본, 코드는 «어느 행인가» 만 안다 (K-9 ⓒ ②)', () => {
  // policy_constants 실측값(2026-09-16 confirmed)을 주입 형태로 재현.
  const POLICY = JSON.stringify({
    pct: {
      ltv_regulated_nonowner: 40, ltv_regulated_owner: 0, ltv_capital_multi_owner: 0,
      ltv_nonregulated_nonowner: 70, ltv_nonregulated_noncapital_owner: 60,
      ltv_first_home_capital_regulated: 70, ltv_first_home_other: 80,
      dsr_bank: 40, dsr_nonbank: 50,
      stress_dsr_capital_regulated: 3.0, stress_dsr_local: 0.75,
    },
    meta: {
      ltv_regulated_nonowner: { item: 'LTV 규제지역 무주택자', source: '금융위', date: '2026-08-13', status: 'confirmed' },
      stress_dsr_local: { item: '지방 2단계', status: 'unverified_current' },
      dsr_bank: { source: '금융위', date: '2026-08-13', status: 'confirmed' },
    },
  });

  it('조건 → 정책 키 매핑이 condition 원문과 맞는다', () => {
    expect(ltvPolicyKey('regulated', 'none')).toBe('ltv_regulated_nonowner');
    expect(ltvPolicyKey('regulated', 'disposal')).toBe('ltv_regulated_nonowner');   // 처분조건부 포함
    expect(ltvPolicyKey('regulated', 'owner')).toBe('ltv_regulated_owner');
    expect(ltvPolicyKey('capital_nonreg', 'multi')).toBe('ltv_capital_multi_owner');
    expect(ltvPolicyKey('local_nonreg', 'owner')).toBe('ltv_nonregulated_noncapital_owner');
    expect(ltvPolicyKey('local_nonreg', 'first_home')).toBe('ltv_first_home_other');
    expect(ltvPolicyKey('regulated', 'first_home')).toBe('ltv_first_home_capital_regulated');
  });

  it('규제지역 무주택 6억 → LTV 40% = 2.4억', () => {
    const r = ltvCalc({ housePrice: 6 * 억, region: 'regulated', owner: 'none', existingLoan: 0, __policy: POLICY });
    expect(r.main.value).toBe('2억 4,000만원');   // 무손실 표기(formatKRWExact)
    expect(r.details.some((d) => d.label === '적용 LTV' && d.value === '40%')).toBe(true);
  });

  it('0% 조건은 「금액」이 아니라 «허용되지 않는다» 고 말한다', () => {
    const r = ltvCalc({ housePrice: 6 * 억, region: 'regulated', owner: 'owner', existingLoan: 0, __policy: POLICY });
    expect(r.details[0].value).toContain('허용되지 않는다');
  });

  it('근거(출처·발표일)를 함께 낸다 — 날짜 없는 규제 수치는 거짓 신선도다', () => {
    const r = ltvCalc({ housePrice: 6 * 억, region: 'regulated', owner: 'none', existingLoan: 0, __policy: POLICY });
    expect(r.details.some((d) => d.label === '근거' && d.value.includes('2026-08-13'))).toBe(true);
  });

  it('⛔ 주입이 없으면 계산하지 않는다 — 퍼센트를 지어내지 않는다', () => {
    expect(ltvCalc({ housePrice: 6 * 억, region: 'regulated', owner: 'none' }).main.label)
      .toBe('규제 기준 미수신');
    expect(dsrCalc({ annualIncome: 6000_0000, newLoan: 3 * 억, newRate: 4.5, newYears: 30 }).main.label)
      .toBe('규제 기준 미수신');
  });

  it('DSR 한도가 업권으로 갈린다 — 은행 40 · 2금융 50', () => {
    const base = { annualIncome: 60_000_000, newLoan: 3 * 억, newRate: 4.5, newYears: 30, existingAnnualRepay: 0, region: 'regulated', __policy: POLICY };
    expect(dsrCalc({ ...base, lender: 'bank' }).details[0].value).toContain('한도 40%');
    expect(dsrCalc({ ...base, lender: 'nonbank' }).details[0].value).toContain('한도 50%');
  });

  it('⛔ 스트레스 금리를 «얹어» 계산한다 — 빼면 낙관을 파는 꼴이다', () => {
    const base = { annualIncome: 60_000_000, newLoan: 3 * 억, newRate: 4.5, newYears: 30, existingAnnualRepay: 0, lender: 'bank' as const, __policy: POLICY };
    const capital = dsrCalc({ ...base, region: 'regulated' });
    const local = dsrCalc({ ...base, region: 'local_nonreg' });
    expect(capital.details.find((d) => d.label === '적용 금리')?.value).toContain('7.50%');  // 4.5 + 3.0
    expect(local.details.find((d) => d.label === '적용 금리')?.value).toContain('5.25%');    // 4.5 + 0.75
    // 가산이 클수록 DSR 도 커진다.
    expect(parseFloat(capital.main.value)).toBeGreaterThan(parseFloat(local.main.value));
  });

  it('⛔ 「대출 가능」이라 단정하지 않는다 — 한도 대조지 심사 결과가 아니다', () => {
    const r = dsrCalc({ annualIncome: 200_000_000, newLoan: 1 * 억, newRate: 4, newYears: 30, existingAnnualRepay: 0, lender: 'bank', region: 'regulated', __policy: POLICY });
    expect(r.details[0].label).toBe('한도 대조');
    expect(JSON.stringify(r)).not.toContain('대출 가능 (');
  });

  it('confirmed 가 아닌 상수는 화면이 그 사실을 말한다', () => {
    const r = dsrCalc({ annualIncome: 60_000_000, newLoan: 3 * 억, newRate: 4.5, newYears: 30, existingAnnualRepay: 0, lender: 'bank', region: 'local_nonreg', __policy: POLICY });
    expect(r.details.some((d) => d.value.includes('unverified_current'))).toBe(true);
  });
});

describe('취득세 — 이중 진실 해소 + 중과 매핑 3건 오류 고정 (K-9 ⓒ ③)', () => {
  const POLICY = JSON.stringify({
    pct: {
      acq_tax_1house_6eok_under: 1, acq_tax_1house_6_9eok: 1, acq_tax_1house_9eok_over: 3,
      acq_tax_heavy_8: 8, acq_tax_heavy_12: 12,
    },
    meta: {
      acq_tax_heavy_8: { item: '주택 취득세 중과 — 8%', source: '지방세법', date: '2026-07-01', status: 'confirmed' },
      acq_tax_1house_6_9eok: { item: '6억 초과 9억 이하', status: 'confirmed' },
    },
  });
  const buy = (price: number, houseCount: number, regulated: boolean) =>
    acquisitionTax({ price, type: 'purchase', houseCount, regulated: regulated ? 'yes' : 'no', firstTime: 'no', __policy: POLICY });

  it('⛔ 옛 코드가 틀렸던 세 자리 — 비조정 2·3·4주택', () => {
    // 비조정 2주택: 옛 1% 고정 → 실제 «표준세율»(7억이면 사잇세율)
    expect(acqTaxPolicyKey(2, false, 7 * 억)).toBe('acq_tax_1house_6_9eok');
    // 비조정 3주택: 옛 4% → 실제 8%
    expect(acqTaxPolicyKey(3, false, 7 * 억)).toBe('acq_tax_heavy_8');
    // 비조정 4주택 이상: 옛 4% → 실제 12%
    expect(acqTaxPolicyKey(4, false, 7 * 억)).toBe('acq_tax_heavy_12');
    // (4% 는 주택이 아닌 부동산의 표준세율이다 — 주택에 쓰면 안 되는 숫자였다)
  });

  it('조정지역 매핑은 그대로 맞다 — 2주택 8 · 3주택+ 12', () => {
    expect(acqTaxPolicyKey(2, true, 7 * 억)).toBe('acq_tax_heavy_8');
    expect(acqTaxPolicyKey(3, true, 7 * 억)).toBe('acq_tax_heavy_12');
  });

  it('사잇세율 산식이 경계에서 정확히 1%·3% 로 닫힌다', () => {
    expect(acqTaxMidRatePct(6 * 억)).toBeCloseTo(1, 5);
    expect(acqTaxMidRatePct(9 * 억)).toBeCloseTo(3, 5);
    expect(acqTaxMidRatePct(7.5 * 억)).toBeCloseTo(2, 5);
  });

  it('⛔ 6~9억을 «2% 고정» 으로 두지 않는다 — 표와 산식이 갈리던 자리', () => {
    // tax-tables 의 ACQUISITION_TAX_RATES 는 이 구간을 0.02 로 적어 두고 있었다.
    expect(acqTaxMidRatePct(6.5 * 억)).toBeLessThan(2);
    expect(acqTaxMidRatePct(8.5 * 억)).toBeGreaterThan(2);
  });

  it('비조정 3주택 7억: 8% 가 적용된다(옛 4%의 2배)', () => {
    const r = buy(7 * 억, 3, false);
    expect(r.details.find((d) => d.label === '적용 세율')?.value).toBe('8%');
    expect(r.details.some((d) => d.label === '적용 구간' && d.value.includes('중과'))).toBe(true);
  });

  it('조정 2주택에는 «일시적 2주택 제외» 단서를 말한다', () => {
    const r = buy(7 * 억, 2, true);
    expect(r.details.some((d) => d.value.includes('일시적 2주택'))).toBe(true);
  });

  it('⛔ 주입이 없으면 세율을 지어내지 않는다', () => {
    const r = acquisitionTax({ price: 7 * 억, type: 'purchase', houseCount: 1, regulated: 'no', firstTime: 'no' });
    expect(r.main.label).toBe('세율 기준 미수신');
  });

  it('상수표 밖의 값(증여·상속)을 쓰면 «그렇게 말한다»', () => {
    const g = acquisitionTax({ price: 5 * 억, type: 'gift', houseCount: 1, regulated: 'no', firstTime: 'no', __policy: POLICY });
    expect(g.details.some((d) => d.label === '⚠️ 출처')).toBe(true);
    // 유상취득은 표 안이므로 그 경고가 붙지 않는다.
    expect(buy(5 * 억, 1, false).details.some((d) => d.label === '⚠️ 출처')).toBe(false);
  });
});

describe('취득세 2호 전 확인 — 반올림 자리·부가세목 정합', () => {
  const POLICY = JSON.stringify({
    pct: { acq_tax_1house_6eok_under: 1, acq_tax_1house_6_9eok: 1, acq_tax_1house_9eok_over: 3, acq_tax_heavy_8: 8, acq_tax_heavy_12: 12 },
    meta: {},
  });
  const buy = (price: number, houseCount: number, regulated: boolean, area85: 'under' | 'over') =>
    acquisitionTax({ price, type: 'purchase', houseCount, regulated: regulated ? 'yes' : 'no', firstTime: 'no', area85, __policy: POLICY });

  it('①「소수점 다섯째 자리에서 반올림 → 넷째 자리까지」 — 7억은 1.6667%', () => {
    expect(acqTaxMidRatePct(7 * 억)).toBe(1.6667);
    expect(acqTaxMidRatePct(8.3 * 억)).toBe(2.5333);
    // ⛔ 다섯째 자리까지 남기면 1.66667 이 된다. 반올림 «자리» 도 법이 정한 값이다.
    expect(String(acqTaxMidRatePct(7 * 억))).not.toBe('1.66667');
  });

  it('② 중과 지방교육세는 «0.4% 고정» — 취득세액의 10% 가 아니다', () => {
    // 7억·비조정 3주택 → 8% 중과. 옛 코드는 5,600만 × 10% = 560만(0.8%) 을 냈다.
    const r = buy(7 * 억, 3, false, 'under');
    const edu = r.details.find((d) => d.label === '지방교육세')!.value;
    expect(edu).toContain('280만');            // 7억 × 0.4%
    expect(edu).not.toContain('560만');        // 옛 값
  });

  it('② 농특세는 «85㎡ 초과» 에만 — 가액 조건이 아니다', () => {
    expect(buy(7 * 억, 3, false, 'under').details.find((d) => d.label === '농어촌특별세')!.value).toContain('0원');
    // 8% 중과 · 85㎡ 초과 → 0.6% = 420만. 옛 코드는 취득세액×2% = 112만(0.16%) 이었다.
    const over = buy(7 * 억, 3, false, 'over').details.find((d) => d.label === '농어촌특별세')!.value;
    expect(over).toContain('420만');
  });

  it('② 12% 중과 85㎡ 초과 농특세는 1.0%', () => {
    expect(buy(7 * 억, 4, false, 'over').details.find((d) => d.label === '농어촌특별세')!.value).toContain('700만');
  });

  it('② 표준세율 주택의 지방교육세는 세율의 10% 로 유지된다', () => {
    // 5억 · 무주택 → 1%. 지방교육세 0.1% = 50만.
    expect(buy(5 * 억, 1, false, 'under').details.find((d) => d.label === '지방교육세')!.value).toContain('50만');
  });

  it('② 중과 표본 합계가 본세+부가세와 «맞는다»', () => {
    const r = buy(7 * 억, 3, false, 'over');
    // 본세 5,600만 + 교육 280만 + 농특 420만 = 6,300만
    expect(r.main.value).toContain('6,300만');
  });
});

describe('취득세 — 잔여 표본 2건 (분기 경계 · 12% 행)', () => {
  const POLICY = JSON.stringify({
    pct: { acq_tax_1house_6eok_under: 1, acq_tax_1house_6_9eok: 1, acq_tax_1house_9eok_over: 3, acq_tax_heavy_8: 8, acq_tax_heavy_12: 12 },
    meta: {},
  });
  const buy = (price: number, houseCount: number, regulated: boolean, area85: 'under' | 'over') =>
    acquisitionTax({ price, type: 'purchase', houseCount, regulated: regulated ? 'yes' : 'no', firstTime: 'no', area85, __policy: POLICY });

  it('표본1 — 표준 경로(1주택·7억·85㎡초과): 농특세 0.2% 고정 · 지교세는 «원식»(세율×10%)', () => {
    const r = buy(7 * 억, 1, false, 'over');
    // 농특세: 7억 × 0.2% = 140만. 옛 «취득세액×2%» 였다면 1,166,690×2% ≈ 23만대로 찍혔다.
    expect(r.details.find((d) => d.label === '농어촌특별세')!.value).toContain('140만');
    // 지교세: 표준 경로는 0.4 고정이 아니라 «세율의 10%» 다 — 1.6667% × 10% = 0.16667%.
    //   ⛔ 0.4 를 전역 치환했다면 여기서 280만이 나온다. 분기 경계가 정확한지 이 한 줄이 증명한다.
    const edu = r.details.find((d) => d.label === '지방교육세')!.value;
    expect(edu).not.toContain('280만');
    expect(Math.round(7 * 억 * (1.6667 / 100) * 0.1)).toBe(1166690);
  });

  it('표본2 — 12% 행(조정 3주택·10억·85㎡초과): 12 + 0.4 + 1.0 = 13.4%', () => {
    const r = buy(10 * 억, 3, true, 'over');
    expect(r.details.find((d) => d.label === '적용 세율')!.value).toBe('12%');
    expect(r.details.find((d) => d.label === '지방교육세')!.value).toContain('400만');   // 10억 × 0.4%
    expect(r.details.find((d) => d.label === '농어촌특별세')!.value).toContain('1,000만'); // 10억 × 1.0%
    // 합계 13.4% = 1억 3,400만. 무손실 표기로 바뀐 뒤에는 머리글 숫자가 «그대로» 보인다.
    //   옛 formatKRW 는 여기서 「1.3억원」을 찍어 400만을 삼켰다(K-9 ⓒ 표시 결함).
    const 본세 = 10 * 억 * 0.12, 교육 = 10 * 억 * 0.004, 농특 = 10 * 억 * 0.01;
    expect(본세 + 교육 + 농특).toBe(134_000_000);
    expect(r.main.value).toBe('1억 3,400만원');
  });

  it('덤 — 「6억 이하·85㎡ 초과」에 농특세 0.2% 가 «붙는다»', () => {
    // 옛 가액 조건(price > 6억)이 이 구간을 무근거로 면제해 주고 있었다.
    expect(buy(5 * 억, 1, false, 'over').details.find((d) => d.label === '농어촌특별세')!.value)
      .toContain('100만');   // 5억 × 0.2%
    expect(buy(5 * 억, 1, false, 'under').details.find((d) => d.label === '농어촌특별세')!.value)
      .toContain('0원');
  });
});

describe('증권거래세 — 시장값이 아니라 «법정값» 이다 (K-9 ⓒ 3군 재분류)', () => {
  const POLICY = JSON.stringify({
    pct: { sec_tax_kospi_trade: 0.05, sec_tax_kospi_farm: 0.15, sec_tax_kosdaq_trade: 0.20 },
    meta: { sec_tax_kospi_trade: { source: '증권거래세법 시행령', date: '2025-12-31' } },
  });
  const roi = (market: string) =>
    stockRoi({ buyPrice: 10000, sellPrice: 12000, quantity: 100, fee: 0, market, __policy: POLICY });

  it('코스피는 «성분» 으로 낸다 — 거래세 0.05 + 농특세 0.15', () => {
    const r = roi('kospi');
    expect(r.details.find((d) => d.label.startsWith('증권거래세'))!.label).toContain('0.05%');
    expect(r.details.find((d) => d.label.startsWith('농어촌특별세'))!.label).toContain('0.15%');
    // 매도 120만 × 0.05% = 600원 · × 0.15% = 1,800원 · 합계 2,400원
    expect(r.details.find((d) => d.label === '세금 합계')!.value).toBe('2,400원');
  });

  it('코스닥은 «단일» 이다 — 농특세 줄이 없다', () => {
    const r = roi('kosdaq');
    expect(r.details.find((d) => d.label.startsWith('증권거래세'))!.label).toContain('0.20%');
    expect(r.details.some((d) => d.label.startsWith('농어촌특별세'))).toBe(false);
    expect(r.details.find((d) => d.label === '세금 합계')!.value).toBe('2,400원');
  });

  it('⛔ 합계가 같다고 같은 게 아니다 — 2026년 한정 우연의 일치', () => {
    // 두 시장의 «합계» 는 0.20% 로 같지만 구성이 다르다.
    // 합계만 맞히고 성분을 뭉개면 다음 개정 때 조용히 틀린다.
    expect(roi('kospi').details.find((d) => d.label === '세금 합계')!.value)
      .toBe(roi('kosdaq').details.find((d) => d.label === '세금 합계')!.value);
    expect(roi('kospi').details.length).not.toBe(roi('kosdaq').details.length);
  });

  it('⛔ 옛 상수 0.18% 의 오차를 고정한다 — 2024년 화석', () => {
    const 옛 = Math.round(12000 * 100 * 0.0018);   // 2,160원
    const 새 = 2400;
    expect(옛).toBe(2160);
    expect(새 - 옛).toBe(240);
  });

  it('해외는 증권거래세가 «없다» — 0원이 아니라 그렇게 말한다', () => {
    const r = roi('us');
    expect(r.details.find((d) => d.label === '증권거래세')!.value).toContain('없다');
    expect(r.details.some((d) => d.label === '세금 합계')).toBe(false);
  });

  it('⛔ 주입이 없으면 세율을 지어내지 않는다', () => {
    const r = stockRoi({ buyPrice: 10000, sellPrice: 12000, quantity: 100, fee: 0, market: 'kospi' });
    expect(r.main.label).toBe('세율 기준 미수신');
  });
});

describe('경매 수익률 — 「등 5%」 분해 (K-9 ⓒ)', () => {
  const POLICY = JSON.stringify({
    pct: {
      acq_tax_1house_6eok_under: 1, acq_tax_1house_6_9eok: 1, acq_tax_1house_9eok_over: 3,
      acq_tax_heavy_8: 8, acq_tax_heavy_12: 12,
    },
    meta: { acq_tax_1house_6eok_under: { item: '주택 취득세(유상) — 6억원 이하', source: '지방세법 제11조', date: '2026-07-01' } },
  });
  const 억 = 100_000_000;
  const run = (o: Record<string, unknown>) =>
    auctionProfit({ appraisal: 5 * 억, bidPrice: 3.5 * 억, repairCost: 0.2 * 억, __policy: POLICY, ...o } as any);
  const row = (r: ReturnType<typeof auctionProfit>, label: string) =>
    r.details?.find((d) => d.label.startsWith(label))?.value;

  it('⛔ 옛 「등 5%」는 기본 입력에서 4.5배 과대였다 — 실제는 1.10%', () => {
    const r = run({});
    // 3.5억 · 1주택 · 비조정 · 85㎡ 이하 → 취득세 1% + 지방교육세 0.1% + 농특세 0 = 1.10%
    expect(row(r, '취득세 (1%)')).toBe('350만원');
    expect(row(r, '지방교육세 (0.1%)')).toBe('35만원');
    expect(row(r, '세금 합계')).toBe('385만원 (낙찰가의 1.10%)');
    // 옛 코드: 3.5억 × 5% = 1,750만원. 실제 385만원. 차 1,365만원.
    expect(3.5 * 억 * 0.05).toBe(17_500_000);
  });

  it('농특세 0 은 「0원」이 아니라 «사유» 로 쓴다 — 면제와 빠뜨림은 다르다', () => {
    expect(row(run({}), '농어촌특별세')).toBe('해당 없음 — 전용 85㎡ 이하는 비과세');
    // 85㎡ 초과면 0.2% 가 붙는다 (표준세율 구간)
    expect(row(run({ area85: 'over' }), '농어촌특별세')).toBe('70만원 (0.2%)');
  });

  it('중과는 취득세 계산기와 «같은 답» 을 낸다 — 조정 2주택 8% + 0.4% + 0.6%', () => {
    const r = run({ houseCount: 2, regulated: 'yes', area85: 'over' });
    expect(row(r, '취득세 (8%)')).toBe('2,800만원');
    expect(row(r, '지방교육세 (0.4%)')).toBe('140만원');
    expect(row(r, '농어촌특별세')).toBe('210만원 (0.6%)');
    expect(row(r, '세금 합계')).toBe('3,150만원 (낙찰가의 9.00%)');
  });

  it('주택 외는 4.6% 이고, 상수표 밖이라고 «화면이 말한다»', () => {
    const r = run({ propertyType: 'other' });
    expect(row(r, '세금 합계')).toBe('1,610만원 (낙찰가의 4.60%)');
    expect(row(r, '⚠️ 근거')).toContain('상수표 밖');
  });

  it('⛔ 기타 부대비용에 «대표값» 을 지어내지 않는다 — 비면 비었다고 쓴다', () => {
    expect(row(run({}), '기타 부대비용')).toContain('직접 넣는다');
    expect(row(run({ otherCosts: 15_000_000 }), '기타 부대비용')).toBe('1,500만원');
  });

  it('⛔ 감정가는 출구가격이 아니다 — 비우면 그 사실을 경고한다', () => {
    expect(row(run({}), '⚠️ 출구가격')).toContain('6~12개월 전');
    // 예상 매도가를 넣으면 경고가 사라지고 수익이 그 값으로 계산된다
    const r = run({ marketPrice: 4.2 * 억 });
    expect(row(r, '⚠️ 출구가격')).toBeUndefined();
    // 총투자비 = 3.5억 + 385만 + 2,000만 = 3억 7,385만
    expect(row(r, '총 투자비')).toBe('3억 7,385만원');
    expect(row(r, '예상 수익')).toBe('4,615만원');
  });

  it('낙찰가율은 정의상 «감정가» 대비다 — 출구가격이 바뀌어도 안 움직인다', () => {
    expect(row(run({ marketPrice: 4.2 * 억 }), '낙찰가율')).toBe('70.0%');
    expect(row(run({ marketPrice: 6 * 억 }), '낙찰가율')).toBe('70.0%');
  });

  it('미반영 항목을 숨기지 않는다 — 인수 권리 포함 5종', () => {
    const r = run({});
    const v = row(r, '⚠️ 미반영') ?? '';
    for (const k of ['양도소득세', '대출이자', '보유세', '인수 권리']) expect(v).toContain(k);
    // ⚠️ 인수 권리는 앞의 셋과 «성질이 다르다» — 취득 이후 비용이 아니라 취득가격 가산분이라
    //    있으면 세금과 총투자비가 둘 다 커진다. 그 사실을 따로 한 줄 쓴다.
    expect(row(r, '⚠️ 인수 권리')).toContain('둘 다');
  });
});

describe('예적금 이자 — 세금우대 9.5% 화석 제거 · 상호금융 가입연도×요건 2차원 (K-9 ⓒ)', () => {
  // 법령 원문(DRF) 대조 2026-09-17 — 조특법 §89의3 · §88의2 · 소득세법 §129 · 지방세법 §103의13 · 농특세법 §5
  const POLICY = JSON.stringify({
    pct: { int_tax_income: 14, int_tax_local: 10, mutual_dep_rate_5: 5, mutual_dep_rate_9: 9, farm_int_base: 14, farm_int_rate: 10 },
    amt: { mutual_dep_limit: 30_000_000, taxfree_sav_limit: 50_000_000 },
    meta: { int_tax_income: { source: '소득세법 제129조', date: '2026-01-01' } },
  });
  const W = (x: number) => formatKRWExact(x);
  const run = (o: Record<string, unknown>) =>
    depositInterest({ type: 'deposit', amount: 10_000_000, rate: 3.5, months: 12, taxType: 'general', __policy: POLICY, ...o } as any);
  const row = (r: ReturnType<typeof depositInterest>, label: string) =>
    r.details.find((d) => d.label.startsWith(label))?.value;

  it('일반 과세는 «성분» 으로 — 소득세 14% + 지방소득세(소득세의 10%) = 15.4%', () => {
    const r = run({});
    // 1,000만 × 3.5% × 12/12 = 35만 → 49,000 + 4,900
    expect(row(r, '소득세 (14%)')).toBe(W(49_000));
    expect(row(r, '지방소득세')).toBe(W(4_900));
    expect(row(r, '세금 합계')).toBe(W(53_900));
    expect(r.main.value).toBe(W(10_296_100));
  });

  it('⛔ 옛 적금 공식은 «× 개월» 이 빠져 12배 과소였다', () => {
    const 옛 = Math.round(1_000_000 * 0.035 * 13 / 2 / 12);   // 18,958
    const r = run({ type: 'savings', amount: 1_000_000 });
    expect(옛).toBe(18_958);
    expect(row(r, '세전 이자')).toBe(W(227_500));             // 100만 × 3.5% × 12·13/2 / 12
  });

  it('상호금융 2025년 이전 가입 — 소득세 비과세지만 농특세 1.4% 는 붙는다 («비과세 ≠ 0원»)', () => {
    const r = run({ taxType: 'mutual', joinYear: '2025' });
    expect(row(r, '특례 소득세')).toBe('비과세');
    expect(r.details.find((d) => d.label.startsWith('농어촌특별세'))!.label).toContain('1.4%');
    expect(row(r, '세금 합계')).toBe(W(4_900));
  });

  it('요건 밖 2026 가입 5% · 2027 가입 9% — 지방소득세 없음, 농특세 0.9 / 0.5', () => {
    const a = run({ taxType: 'mutual', joinYear: '2026', eligible: 'no' });
    expect(row(a, '세금 합계')).toBe(W(17_500 + 3_150));
    expect(row(a, '특례 지방소득세')).toContain('부과하지 않는다');
    const b = run({ taxType: 'mutual', joinYear: '2027', eligible: 'no' });
    expect(row(b, '세금 합계')).toBe(W(31_500 + 1_750));
  });

  it('요건 충족은 2028 가입까지 비과세, 2029 가입 5%, 2030 이후 9%', () => {
    expect(row(run({ taxType: 'mutual', joinYear: '2028' }), '세금 합계')).toBe(W(4_900));
    expect(row(run({ taxType: 'mutual', joinYear: '2029' }), '세금 합계')).toBe(W(20_650));
    expect(row(run({ taxType: 'mutual', joinYear: '2030' }), '세금 합계')).toBe(W(33_250));
  });

  it('농특세 면제 대상은 0 — 그리고 «면제» 라고 말한다', () => {
    const r = run({ taxType: 'mutual', joinYear: '2025', farmExempt: 'yes' });
    expect(row(r, '농어촌특별세')).toContain('면제');
    expect(row(r, '세금 합계')).toBe(W(0));
  });

  it('한도 3천만 초과분은 일반 원천징수 — 예금은 비율로 갈린다', () => {
    const r = run({ taxType: 'mutual', joinYear: '2025', amount: 50_000_000 });
    // 이자 175만 → 한도 안 105만(농특 14,700) · 밖 70만(98,000 + 9,800)
    expect(row(r, '⚠️ 한도 초과분')).toContain(W(700_000));
    expect(row(r, '세금 합계')).toBe(W(122_500));
  });

  it('⛔ 적금 한도는 비율로 가르면 틀린다 — 앞 회차부터 채운다', () => {
    // 월 300만 × 12 = 3,600만. 1~10회차가 한도 안, 11·12회차가 밖.
    // 회차 k 이자 = 300만 × 3.6% × (13−k)/12 = 9,000 × (13−k) → 밖 = 18,000 + 9,000 = 27,000
    // 비율(1/6)로 갈랐다면 117,000 — 4배 넘게 틀린다.
    const r = run({ type: 'savings', amount: 3_000_000, rate: 3.6, taxType: 'mutual', joinYear: '2025' });
    expect(row(r, '세전 이자')).toBe(W(702_000));
    expect(row(r, '⚠️ 한도 초과분')).toContain(W(27_000));
  });

  it('비과세종합저축 — 소득세·농특세 모두 «없음» (농특세법 §4 목록)', () => {
    const r = run({ taxType: 'taxFreeSavings', amount: 20_000_000 });
    expect(row(r, '농어촌특별세')).toContain('없음');
    expect(row(r, '세금 합계')).toBe(W(0));
  });

  it('⛔ 주입이 없으면 세율을 지어내지 않는다', () => {
    const r = depositInterest({ type: 'deposit', amount: 10_000_000, rate: 3.5, months: 12, taxType: 'general' });
    expect(r.main.label).toBe('세율 기준 미수신');
  });
});

describe('공매도 — 수수료는 시장값 입력 · 증권거래세는 법정 파이프 신규 연결 (K-9 ⓒ)', () => {
  const POLICY = JSON.stringify({
    pct: { sec_tax_kospi_trade: 0.05, sec_tax_kospi_farm: 0.15, sec_tax_kosdaq_trade: 0.20 },
    meta: { sec_tax_kospi_trade: { source: '증권거래세법 시행령', date: '2025-12-31' } },
  });
  const W = (x: number) => formatKRWExact(x);
  const run = (o: Record<string, unknown>) =>
    shortSelling({ sellPrice: 100000, buyPrice: 80000, quantity: 100, borrowFee: 3, days: 30, fee: 0.015, market: 'kospi', __policy: POLICY, ...o } as any);
  const row = (r: ReturnType<typeof shortSelling>, label: string) => r.details.find((d) => d.label.startsWith(label))?.value;

  it('⛔ 옛 코드에는 증권거래세가 «없었다» — 매도 1,000만원에서 2만원이 통째로 빠졌다', () => {
    const r = run({});
    // 매도 1,000만 × 0.05% = 5,000 · × 0.15% = 15,000
    expect(row(r, '증권거래세')).toBe(W(5_000));
    expect(row(r, '농어촌특별세')).toBe(W(15_000));
    // 차익 200만 − 대차료 24,658 − 수수료 2,700 − 세금 20,000
    expect(r.main.value).toBe(W(2_000_000 - 24_658 - 2_700 - 20_000));
    const 옛 = 2_000_000 - Math.round(10_000_000 * 0.03 * 30 / 365) - Math.round(18_000_000 * 0.00015);
    expect(옛 - (2_000_000 - 24_658 - 2_700 - 20_000)).toBe(20_000);
  });

  it('매도 «편도» 만 과세 — 환매가를 바꿔도 거래세는 그대로', () => {
    expect(row(run({ buyPrice: 50000 }), '증권거래세')).toBe(row(run({}), '증권거래세'));
    expect(row(run({}), '환매 매수')).toContain('없음');
  });

  it('코스닥은 단일 0.20% — 농특세 줄이 없다', () => {
    const r = run({ market: 'kosdaq' });
    expect(row(r, '증권거래세')).toBe(W(20_000));
    expect(r.details.some((d) => d.label.startsWith('농어촌특별세'))).toBe(false);
  });

  it('수수료율은 입력이다 — 기본값이 예시값임을 말한다', () => {
    expect(row(run({ fee: 0.1 }), '위탁수수료')).toBe(W(10_000 + 8_000));
    expect(row(run({}), '⚠️ 수수료율')).toContain('예시값');
  });

  it('⛔ 주입이 없으면 세율을 지어내지 않는다', () => {
    const r = shortSelling({ sellPrice: 100000, buyPrice: 80000, quantity: 100, borrowFee: 3, days: 30, market: 'kospi' } as any);
    expect(r.main.label).toBe('세율 기준 미수신');
  });
});

describe('중도상환수수료 — 분모 10배 과소 수리 · 법정 3년 · 요율은 계약연도별 시장값 공개형 (K-9 ⓒ)', () => {
  const W = (x: number) => formatKRWExact(x);
  const run = (o: Record<string, unknown>) =>
    prepaymentFee({ repayAmount: 100_000_000, contract: 'y2026', loanType: 'secured', rateType: 'fixed', rateMode: 'representative', elapsedMonths: 12, loanMonths: 360, feePeriodMonths: 36, ...o } as any);
  const row = (r: ReturnType<typeof prepaymentFee>, label: string) => r.details.find((d) => d.label.startsWith(label))?.value;

  it('⛔ 옛 공식은 분모가 대출기간 전체(360)라 10배 과소였다', () => {
    const 옛 = Math.round(100_000_000 * 0.012 * 24 / 360);            // 80,000
    const 같은요율_새산식 = Math.round(100_000_000 * 0.012 * 24 / 36); // 800,000
    expect(옛).toBe(80_000);
    expect(같은요율_새산식 / 옛).toBe(10);
    expect(run({ rateMode: 'custom', feeRate: 1.2 }).main.value).toBe(W(800_000));
  });

  it('대표값은 2026 공시 5대 은행 중앙값 — 담보 고정 0.65% → 1억·잔여 24/36 = 433,333원', () => {
    expect(run({}).main.value).toBe(W(433_333));
    expect(row(run({}), '적용 요율')).toContain('범위 0.59~0.75%');
  });

  it('중앙값·범위는 5행에서 다시 계산해도 같다 (옮겨 적기 검산)', () => {
    const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[2];
    // 2026 공시 NH·신한·우리·하나·KB
    expect(med([0.63, 0.59, 0.71, 0.65, 0.75])).toBe(PREPAY_RATES.y2026.secured.fixed.median);
    expect(med([0.93, 0.69, 0.95, 0.78, 0.55])).toBe(PREPAY_RATES.y2026.secured.variable.median);
    expect(med([0.93, 0.85, 0.76, 0.59, 0.96])).toBe(PREPAY_RATES.y2026.otherSecured.fixed.median);
    expect(med([0.52, 0.43, 0.35, 0.59, 0.54])).toBe(PREPAY_RATES.y2026.otherSecured.variable.median);
    expect(med([0.01, 0.17, 0.03, 0.20, 0.18])).toBe(PREPAY_RATES.y2026.credit.fixed.median);
    expect(med([0.01, 0.13, 0.03, 0.05, 0.11])).toBe(PREPAY_RATES.y2026.credit.variable.median);
    // 2025 보도자료 국민·농협·신한·우리·하나
    expect(med([0.58, 0.65, 0.61, 0.74, 0.66])).toBe(PREPAY_RATES.y2025.secured.fixed.median);
    expect(med([0.79, 0.53, 0.76, 0.52, 0.61])).toBe(PREPAY_RATES.y2025.otherSecured.fixed.median);
    expect(med([0.59, 0.53, 0.72, 0.37, 0.61])).toBe(PREPAY_RATES.y2025.otherSecured.variable.median);
  });

  it('⛔ 계약 3년 경과면 «부과 불가» — 0원이 아니라 법정 금지라고 말한다', () => {
    const r = run({ elapsedMonths: 36 });
    expect(r.main.value).toBe('부과 불가');
    expect(row(r, '근거')).toContain('§20');
  });

  it('적용기간 약정이 3년을 넘으면 법정 상한 36개월로 자른다', () => {
    const r = run({ feePeriodMonths: 60 });
    expect(r.main.value).toBe(run({}).main.value);
  });

  it('대출기간이 적용기간보다 짧으면 대출기간이 분모다', () => {
    // 24개월 대출 · 12개월 경과 → 12/24
    expect(run({ loanMonths: 24, rateMode: 'custom', feeRate: 1 }).main.value).toBe(W(500_000));
  });

  it('요율은 계약일 기준 — 같은 조건도 개편 전 계약이면 1.40%', () => {
    expect(run({ contract: 'pre2025' }).main.value).toBe(W(Math.round(100_000_000 * 0.014 * 24 / 36)));
  });
});

describe('이자소득세 — deposit-interest 와 같은 모델·같은 계산 (9.5% 화석 형제)', () => {
  const POLICY = JSON.stringify({
    pct: { int_tax_income: 14, int_tax_local: 10, mutual_dep_rate_5: 5, mutual_dep_rate_9: 9, farm_int_base: 14, farm_int_rate: 10 },
    amt: { mutual_dep_limit: 30_000_000, taxfree_sav_limit: 50_000_000 },
    meta: {},
  });
  const W = (x: number) => formatKRWExact(x);
  const run = (o: Record<string, unknown>) => interestTax({ interest: 1_000_000, taxType: 'general', __policy: POLICY, ...o } as any);

  it('일반 15.4% = 14 + 1.4 성분', () => {
    expect(run({}).main.value).toBe(W(154_000));
  });

  it('두 계산기가 같은 답을 낸다 — 이자 35만원·상호금융 2026 요건 밖', () => {
    const a = interestTax({ interest: 350_000, taxType: 'mutual', joinYear: '2026', eligible: 'no', __policy: POLICY } as any);
    const b = depositInterest({ type: 'deposit', amount: 10_000_000, rate: 3.5, months: 12, taxType: 'mutual', joinYear: '2026', eligible: 'no', __policy: POLICY } as any);
    expect(a.main.value).toBe(b.details.find((d) => d.label === '세금 합계')!.value);
  });

  it('⛔ 세금우대 선택지는 없다 — 옛 값이 들어오면 일반으로 떨어진다', () => {
    expect(run({ taxType: 'preferential' }).main.value).toBe(W(154_000));
  });

  it('특례는 한도 가정을 말한다', () => {
    expect(run({ taxType: 'mutual', joinYear: '2025' }).details.some((d) => d.label === '⚠️ 한도 가정')).toBe(true);
  });
});
