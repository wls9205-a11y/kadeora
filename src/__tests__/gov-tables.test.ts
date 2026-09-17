/**
 * K-2 수치 게이트 — 계산기 두 종의 «지어낸 공식» 검거분 회귀 (2026-09-16).
 *
 * 이 파일은 두 가지를 동시에 고정한다:
 *   ① 새 값이 «고시표와 정확히 일치» 하는가 (긍정형)
 *   ② 옛 값이 «얼마나 틀렸는가» (반증형) — 회귀로 되돌아가면 바로 잡히도록 숫자를 박아 둔다
 */
import { describe, it, expect } from 'vitest';
import { bondRatePerMille, pensionMonthly, PENSION_MIN_AGE, brokerageBracket, ltvPolicyKey, acqTaxPolicyKey, acqTaxMidRatePct } from '@/lib/calc/gov-tables';
import { housingBond, housingPension, brokerageFee, currencyConvert, ltvCalc, dsrCalc, acquisitionTax, stockRoi, auctionProfit } from '@/lib/calc/formulas';

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

  it('미반영 항목을 숨기지 않는다', () => {
    expect(row(run({}), '⚠️ 미반영')).toContain('양도소득세');
  });
});
