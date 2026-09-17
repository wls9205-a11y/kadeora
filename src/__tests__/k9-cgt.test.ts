/**
 * K-9 수치층 — 양도소득세 클러스터 6종 회귀 (2026-09-17)
 *   ① 새 값이 원문 산식과 성분별로 맞는가(긍정형)
 *   ② 옛 값이 얼마나 틀렸는가(반증형) — 옛 공식을 식 그대로 옮겨 숫자를 박는다
 *   ③ 공유 로직 교차 회귀 — housing ↔ multi-house-sim(양도세) · housing ↔ one-house-check(비과세 판정)
 *      · multi-house-sim ↔ acquisition-tax(취득세 본세)
 * 수치 근거: scratchpad k9_cgt.md §2~§7 재현값 + DRF eflaw 현행 시행본 재대조.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  capitalGainsHousing, capitalGainsRights, multiHouseSim, oneHouseCheck, majorShareholderCgt, overseasCgt, acquisitionTax,
} from '@/lib/calc/formulas';
import { computeHousingCgt, judgeOneHouse, loadCgtPolicy, CGT_KEYS, ltdTable2Pct, ltdTable1Pct } from '@/lib/calc/k9/cgt';
import { formatKRWExact, calcProgressiveTax, INCOME_TAX_BRACKETS } from '@/lib/calc/tax-tables';

const 억 = 100_000_000;
const 만 = 10_000;
const W = (x: number) => formatKRWExact(x);

/** 마이그레이션과 같은 값(아래 «마이그레이션 파일 대조» 테스트가 둘을 묶는다). */
const PCT: Record<string, number> = {
  cgt_ltd_t1_base: 6, cgt_ltd_t1_step: 2, cgt_ltd_t1_max: 30,
  cgt_ltd_t2_base: 12, cgt_ltd_t2_step: 4, cgt_ltd_t2_max: 40, cgt_ltd_t2_live2: 8,
  cgt_short_house_1y: 70, cgt_short_house_2y: 60, cgt_presale_rate: 60,
  cgt_heavy_2house: 20, cgt_heavy_3house: 30, cgt_local_ratio: 10,
  cgt_major_rate_low: 20, cgt_major_rate_high: 25, cgt_major_short: 30,
  cgt_major_threshold_kospi: 1, cgt_major_threshold_kosdaq: 2, cgt_major_threshold_konex: 4, cgt_major_unlisted_pct: 4,
  cgt_foreign_rate: 20, cgt_foreign_sme_rate: 10, cgt_ria_w1: 100, cgt_ria_w2: 80, cgt_ria_w3: 50,
  // acquisition-tax 행(기존 confirmed) — multi-house-sim 교차용
  acq_tax_1house_6eok_under: 1, acq_tax_1house_6_9eok: 1, acq_tax_1house_9eok_over: 3, acq_tax_heavy_8: 8, acq_tax_heavy_12: 12,
};
const AMT: Record<string, number> = {
  cgt_house_exempt_cap: 12 * 억, cgt_basic_deduction: 250 * 만, cgt_major_bracket: 3 * 억,
  cgt_major_threshold_cap: 50 * 억, cgt_major_unlisted_cap: 10 * 억, cgt_ria_limit: 5000 * 만,
};
const POLICY = JSON.stringify({ pct: PCT, amt: AMT, meta: {} });
const P = loadCgtPolicy(POLICY, CGT_KEYS.housing)!;

const row = (r: { details: { label: string; value: string }[] }, label: string) => r.details.find((d) => d.label.trim().startsWith(label))?.value;

/** 옛 capitalGainsHousing 본문(formulas.ts:661-701, 2026-09-17 이관 전) — 반증용으로 식 그대로 */
function 옛주택(sell: number, buy: number, exp: number, hold: number, live: number, houses: number): number {
  const gain = sell - buy - exp;
  if (gain <= 0) return 0;
  if (houses === 1 && hold >= 2 && sell <= 12 * 억) return 0;
  const T1 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((y, k) => ({ years: y, rate: 0.06 + 0.02 * k }));
  let ltdRate = 0;
  if (houses === 1) {
    ltdRate = Math.min(0.40, Math.max(0, (hold - 2) * 0.04)) + Math.min(0.40, Math.max(0, (live - 2) * 0.04));
  } else { for (const r of T1) { if (hold >= r.years) ltdRate = r.rate; } }
  let tg = gain;
  if (houses === 1 && sell > 12 * 억) tg = Math.round(gain * (sell - 12 * 억) / sell);
  tg = Math.round(tg * (1 - ltdRate));
  const base = Math.max(0, tg - 2500000);
  const tax = Math.round(calcProgressiveTax(base, INCOME_TAX_BRACKETS));
  return tax + Math.round(tax * 0.1);
}

const house = (o: Record<string, unknown>) => capitalGainsHousing({
  sellPrice: 9 * 억, buyPrice: 6 * 억, expenses: 1500 * 만, holdYears: 5, liveYears: 3, houseCount: 1,
  acqRegulated: 'no', saleRegulated: 'no', saleTiming: 'after', temporary2: 'no', __policy: POLICY, ...o,
} as any);

describe('capital-gains-housing — 조정 시점 분리 · 중과 재적용 · 단기세율 · 표 2 (K-9 cgt)', () => {
  it('기본값(9억·1주택·보유 5·거주 3·비조정)은 비과세 — 옛값과 같다', () => {
    expect(house({}).main.value).toBe('0원 (비과세)');
    expect(옛주택(9 * 억, 6 * 억, 1500 * 만, 5, 3, 1)).toBe(0);
  });

  it('H1 ⛔ 취득 당시 조정 · 거주 0 → 과세 84,238,000 (옛 코드 0원 비과세)', () => {
    const r = house({ liveYears: 0, acqRegulated: 'yes' });
    expect(r.main.value).toBe(W(84_238_000));
    expect(옛주택(9 * 억, 6 * 억, 1500 * 만, 5, 0, 1)).toBe(0);
    // 성분: 차익 2억8,500만 · 표 1 10% 2,850만 · 과표 2억5,400만 · 소득세 7,658만 · 지방 765.8만
    expect(row(r, '장기보유특별공제 표 1')).toBe(W(28_500_000));
    expect(row(r, '과세표준')).toBe(W(254_000_000));
    expect(row(r, '양도소득세')).toBe(W(76_580_000));
    expect(row(r, '지방소득세')).toBe(W(7_658_000));
    expect(row(r, '비과세 불가 사유')).toContain('취득 당시 조정대상지역');
  });

  it('조정은 «취득 당시» 만 거주요건 — 양도 당시만 조정이면 1주택 비과세 유지', () => {
    expect(house({ liveYears: 0, saleRegulated: 'yes' }).main.value).toBe('0원 (비과세)');
  });

  it('H2 ⛔ 양도 당시 조정 2주택 → +20%p · 장특 배제 158,301,000 (옛 84,238,000)', () => {
    const r = house({ houseCount: 2, saleRegulated: 'yes', liveYears: 0 });
    expect(r.main.value).toBe(W(158_301_000));
    expect(옛주택(9 * 억, 6 * 억, 1500 * 만, 5, 0, 2)).toBe(84_238_000);
    expect(row(r, '장기보유특별공제')).toBe('0원');
    expect(r.details.some((d) => d.label.includes('중과 대상이라 배제'))).toBe(true);
    expect(row(r, '양도소득세')).toBe(W(143_910_000));
  });

  it("H2' ⛔ 조정 3주택 → +30%p 189,376,000 (옛 84,238,000)", () => {
    expect(house({ houseCount: 3, saleRegulated: 'yes', liveYears: 0 }).main.value).toBe(W(189_376_000));
    expect(옛주택(9 * 억, 6 * 억, 1500 * 만, 5, 0, 3)).toBe(84_238_000);
  });

  it('H3 ⛔ 비조정 2주택 · 보유 0.5년 → 단기 70% 217,525,000 (옛 96,151,000)', () => {
    const r = house({ houseCount: 2, holdYears: 0.5, liveYears: 0 });
    expect(r.main.value).toBe(W(217_525_000));
    expect(옛주택(9 * 억, 6 * 억, 1500 * 만, 0.5, 0, 2)).toBe(96_151_000);
    expect(row(r, '적용 세율')).toContain('단기 70%');
  });

  it('보유 1.5년 1주택(비과세 못 탐)도 단기 60%', () => {
    const r = house({ holdYears: 1.5, liveYears: 1.5 });
    expect(r.main.value).toBe(W(Math.round(282_500_000 * 0.6) + Math.round(Math.round(282_500_000 * 0.6) * 0.1)));
  });

  it('조정 2주택 · 보유 1.5년 → 중과(기본+20%p)와 단기 60% 중 큰 쪽', () => {
    const base = 282_500_000;
    const heavy = calcProgressiveTax(base, INCOME_TAX_BRACKETS) + base * 0.2; // 143,910,000
    const short = base * 0.6;                                                  // 169,500,000
    const r = house({ houseCount: 2, saleRegulated: 'yes', holdYears: 1.5, liveYears: 0 });
    expect(row(r, '양도소득세')).toBe(W(Math.round(Math.max(heavy, short))));
    expect(row(r, '비교')).toContain('큰 쪽');
  });

  it('H4 ⛔ 15억 · 보유 5 · 거주 3 → 표 2 32% · 안분 28,392,100 (옛 39,295,300, 16%)', () => {
    const r = house({ sellPrice: 15 * 억 });
    expect(r.main.value).toBe(W(28_392_100));
    expect(옛주택(15 * 억, 6 * 억, 1500 * 만, 5, 3, 1)).toBe(39_295_300);
    expect(row(r, '12억 초과분 안분')).toBe(W(177_000_000));
    expect(r.details.some((d) => d.label.includes('보유 20% + 거주 12%'))).toBe(true);
  });

  it("H4' 최대치 보유 10 · 거주 10 → 80% 4,042,500 (옛 9,826,080, 64%)", () => {
    expect(house({ sellPrice: 15 * 억, holdYears: 10, liveYears: 10 }).main.value).toBe(W(4_042_500));
    expect(옛주택(15 * 억, 6 * 억, 1500 * 만, 10, 10, 1)).toBe(9_826_080);
  });

  it('H5 거주 2년 미만 1주택은 표 1 → 43,608,400 (옛 42,128,680)', () => {
    expect(house({ sellPrice: 15 * 억, liveYears: 1 }).main.value).toBe(W(43_608_400));
    expect(옛주택(15 * 억, 6 * 억, 1500 * 만, 5, 1, 1)).toBe(42_128_680);
  });

  it('표 2 경계 — 거주 2년 8%는 보유 3년 이상 한정 · 10년 40% 상한', () => {
    expect(ltdTable2Pct(3, 2, P)).toEqual({ hold: 12, live: 8 });
    expect(ltdTable2Pct(2.9, 2, P)).toEqual({ hold: 0, live: 0 });
    expect(ltdTable2Pct(4, 3, P)).toEqual({ hold: 16, live: 12 });
    expect(ltdTable2Pct(20, 20, P)).toEqual({ hold: 40, live: 40 });
    expect(ltdTable1Pct(2.99, P)).toBe(0);
    expect(ltdTable1Pct(3, P)).toBe(6);
    expect(ltdTable1Pct(15, P)).toBe(30);
    expect(ltdTable1Pct(30, P)).toBe(30);
  });

  it('12억 경계 — 12억 «이하» 비과세, 1원 초과부터 안분 과세(§89①3 「초과」)', () => {
    expect(house({ sellPrice: 12 * 억 }).main.value).toBe('0원 (비과세)');
    expect(house({ sellPrice: 12 * 억 + 1 }).main.value).not.toBe('0원 (비과세)');
  });

  it('중과 유예(2026-05-09까지 양도) 입력 시 중과 없음 · 표 1 — 보유 2년 미만은 유예 대상 아님', () => {
    const g = house({ houseCount: 2, saleRegulated: 'yes', liveYears: 0, saleTiming: 'grace' });
    // 표 1 10% → H1 과 같은 산식
    expect(g.main.value).toBe(W(84_238_000));
    const g2 = house({ houseCount: 2, saleRegulated: 'yes', liveYears: 0, holdYears: 1.5, saleTiming: 'grace' });
    expect(row(g2, '⚠️ 유예')).toContain('보유 2년 이상');
  });

  it('일시적 2주택 · 요건 충족 → 비과세 · 중과 제외(시행령 §167의10①13)', () => {
    expect(house({ houseCount: 2, temporary2: 'yes', saleRegulated: 'yes' }).main.value).toBe('0원 (비과세)');
    const r = house({ houseCount: 2, temporary2: 'yes', saleRegulated: 'yes', sellPrice: 15 * 억 });
    expect(r.main.value).toBe(W(28_392_100)); // 1주택 H4 와 같은 값
  });

  it('중과 유예 종료를 화면에 밝힌다 · 판정 안 하는 항목을 말한다', () => {
    const r = house({ houseCount: 2, saleRegulated: 'yes' });
    expect(row(r, '⚠️ 중과 유예')).toContain('2026-05-09');
    expect(row(r, '⚠️ 판정 안 함')).toContain('분양권');
  });

  it('⛔ 주입이 없으면 세율을 지어내지 않는다', () => {
    expect(capitalGainsHousing({ sellPrice: 9 * 억, buyPrice: 6 * 억 } as any).main.label).toBe('세율 기준 미수신');
  });

  it('옛 입력 regulated 만 들어와도 두 시점에 같이 적용된다(공유 URL 호환)', () => {
    const r = capitalGainsHousing({ sellPrice: 9 * 억, buyPrice: 6 * 억, expenses: 1500 * 만, holdYears: 5, liveYears: 0, houseCount: 1, regulated: 'yes', __policy: POLICY } as any);
    expect(r.main.value).toBe(W(84_238_000));
  });
});

describe('one-house-check — 일시적 2주택 · 취득 당시 조정 · 범위 밖 특례 공개 (K-9 cgt)', () => {
  const run = (o: Record<string, unknown>) => oneHouseCheck({ houseCount: 1, holdYears: 3, liveYears: 2, sellPrice: 9 * 억, acqRegulated: 'no', newAfter1y: 'no', within3y: 'no', __policy: POLICY, ...o } as any);

  it('⛔ 일시적 2주택 9억 · 보유 3 · 비조정 → 비과세 (옛 코드 「다주택 보유」 불가)', () => {
    const r = run({ houseCount: 2, newAfter1y: 'yes', within3y: 'yes' });
    expect(r.main.label).toBe('비과세 해당');
    expect(row(r, '주택 수 판정')).toContain('일시적 2주택');
  });

  it('2주택 · 요건 미충족 → 불가 + 범위 밖 특례는 「판정 안 함」', () => {
    const r = run({ houseCount: 2, newAfter1y: 'yes', within3y: 'no' });
    expect(r.main.label).toContain('비과세 불가');
    expect(row(r, '⚠️ 판정 안 함')).toContain('동거봉양');
  });

  it('취득 당시 조정 · 거주 1년 → 불가 / 비조정이면 거주 무관', () => {
    expect(run({ acqRegulated: 'yes', liveYears: 1 }).main.label).toBe('비과세 불가');
    expect(run({ acqRegulated: 'no', liveYears: 0 }).main.label).toBe('비과세 해당');
  });

  it('12억 경계 — 이하 전액 · 초과 초과분 과세', () => {
    expect(run({ sellPrice: 12 * 억 }).main.value).toBe('전액 비과세');
    expect(run({ sellPrice: 12 * 억 + 1 }).main.value).toContain('초과분 과세');
  });

  it('교차 회귀 — 판정기와 주택 양도세 계산기가 «비과세 여부» 에서 같은 답', () => {
    for (const houses of [1, 2]) for (const temp of [false, true]) for (const hold of [1, 2, 5]) for (const live of [0, 2]) for (const reg of [false, true]) {
      const check = run({ houseCount: houses, newAfter1y: temp ? 'yes' : 'no', within3y: temp ? 'yes' : 'no', holdYears: hold, liveYears: live, acqRegulated: reg ? 'yes' : 'no' });
      const calc = house({ houseCount: houses, temporary2: temp ? 'yes' : 'no', holdYears: hold, liveYears: live, acqRegulated: reg ? 'yes' : 'no' });
      expect(check.main.label === '비과세 해당').toBe(calc.main.value === '0원 (비과세)');
      expect(judgeOneHouse({ houses, temporary2: temp, hold, live, acqRegulated: reg }).eligible).toBe(check.main.label === '비과세 해당');
    }
  });
});

describe('capital-gains-rights — 분양권은 보유기간 무관 최저 60% (K-9 cgt)', () => {
  const run = (o: Record<string, unknown>) => capitalGainsRights({ sellPrice: 5 * 억, buyPrice: 4 * 억, holdYears: 1, __policy: POLICY, ...o } as any);
  const 옛 = (hold: number) => {
    const base = Math.max(0, 1 * 억 - 2500000);
    const rate = hold < 1 ? 0.70 : hold < 2 ? 0.60 : 0;
    const tax = rate > 0 ? Math.round(base * rate) : Math.round(calcProgressiveTax(base, INCOME_TAX_BRACKETS));
    return Math.round(tax * 1.1);
  };

  it('보유 0.5 → 70% 75,075,000 · 보유 1 → 60% 64,350,000 (옛값과 같다)', () => {
    expect(run({ holdYears: 0.5 }).main.value).toBe(W(75_075_000));
    expect(run({}).main.value).toBe(W(64_350_000));
    expect(옛(0.5)).toBe(75_075_000);
    expect(옛(1)).toBe(64_350_000);
  });

  it('⛔ 보유 3 → 60% 64,350,000 (옛 코드 누진세율 20,553,500 · 4,380만 과소)', () => {
    expect(run({ holdYears: 3 }).main.value).toBe(W(64_350_000));
    expect(옛(3)).toBe(20_553_500);
    expect(64_350_000 - 옛(3)).toBe(43_796_500);
  });

  it('필요경비 입력이 차익에서 빠진다 · 성분 표기', () => {
    const r = run({ holdYears: 3, expenses: 1000 * 만 });
    expect(row(r, '과세표준')).toBe(W(87_500_000));
    expect(row(r, '양도소득세')).toBe(W(52_500_000));
    expect(row(r, '지방소득세')).toBe(W(5_250_000));
    expect(row(r, '⚠️ 조정대상지역')).toContain('무관');
  });
});

describe('multi-house-sim — 취득·양도 두 거래 분리 · 공유 함수 교차 (K-9 cgt)', () => {
  const base = {
    acqPrice: 8 * 억, acqHouseCount: 2, acqRegulated: 'yes',
    sellPrice: 8 * 억, sellBuyPrice: 5 * 억, sellExpenses: 0, sellHoldYears: 3, sellLiveYears: 0, sellHouseCount: 2,
    sellRegulated: 'yes', sellAcqRegulated: 'no', saleTiming: 'after', __policy: POLICY,
  };
  const run = (o: Record<string, unknown>) => multiHouseSim({ ...base, ...o } as any);

  it('⛔ 기본값(조정 2주택) — 양도세 167,871,000 (옛 24% 근사 132,000,000) · 취득세 8% 6,400만', () => {
    const r = run({});
    expect(row(r, '② 양도')).toBe(W(167_871_000));
    expect(row(r, '① 취득')).toBe(W(64_000_000));
    expect(r.main.value).toBe(W(64_000_000 + 167_871_000));
    const 옛양도 = Math.round(3 * 억 * (0.24 + 0.20));
    expect(옛양도).toBe(132_000_000);
  });

  it('조정 3주택 양도 200,596,000 (옛 162,000,000)', () => {
    expect(row(run({ sellHouseCount: 3 }), '② 양도')).toBe(W(200_596_000));
    expect(Math.round(3 * 억 * (0.24 + 0.30))).toBe(162_000_000);
  });

  it('비조정 2주택 보유 2년 102,421,000 · 보유 10년 표 1 20% 77,341,000 (옛 둘 다 72,000,000)', () => {
    expect(row(run({ sellRegulated: 'no', sellHoldYears: 2 }), '② 양도')).toBe(W(102_421_000));
    expect(row(run({ sellRegulated: 'no', sellHoldYears: 10 }), '② 양도')).toBe(W(77_341_000));
    expect(Math.round(3 * 억 * 0.24)).toBe(72_000_000);
  });

  it('⛔ 취득세 — 비조정 3주택 8% 6,400만 · 비조정 4주택 12% 9,600만 · 비조정 2주택 8억 사잇세율 (옛 4%·4%·1%)', () => {
    expect(row(run({ acqRegulated: 'no', acqHouseCount: 3 }), '① 취득')).toBe(W(64_000_000));
    expect(row(run({ acqRegulated: 'no', acqHouseCount: 4 }), '① 취득')).toBe(W(96_000_000));
    // (8억×2/3억 − 3) = 2.3333% → 18,666,400 (넷째 자리 반올림 규칙)
    expect(row(run({ acqRegulated: 'no', acqHouseCount: 2 }), '① 취득')).toBe(W(Math.round(8 * 억 * 2.3333 / 100)));
  });

  it('교차 회귀 — 취득세 본세가 acquisition-tax 의 「취득세」 줄과 같다', () => {
    for (const [houses, reg, price] of [[1, false, 5 * 억], [2, false, 8 * 억], [2, true, 8 * 억], [3, false, 10 * 억], [3, true, 7 * 억], [4, false, 9.5 * 억]] as const) {
      const sim = run({ acqHouseCount: houses, acqRegulated: reg ? 'yes' : 'no', acqPrice: price });
      const acq = acquisitionTax({ type: 'purchase', price, houseCount: houses, regulated: reg ? 'yes' : 'no', firstTime: 'no', area85: 'under', __policy: POLICY } as any);
      expect(row(sim, '① 취득')).toBe(acq.details.find((d) => d.label === '취득세')!.value);
    }
  });

  it('교차 회귀 — 양도세가 capital-gains-housing 과 같다(같은 입력 격자)', () => {
    for (const houses of [1, 2, 3]) for (const hold of [0.5, 1.5, 3, 10]) for (const reg of [false, true]) for (const timing of ['after', 'grace']) {
      const sim = run({ sellHouseCount: houses, sellHoldYears: hold, sellRegulated: reg ? 'yes' : 'no', saleTiming: timing, sellLiveYears: 3 });
      const h = capitalGainsHousing({ sellPrice: 8 * 억, buyPrice: 5 * 억, expenses: 0, holdYears: hold, liveYears: 3, houseCount: houses, acqRegulated: 'no', saleRegulated: reg ? 'yes' : 'no', saleTiming: timing, __policy: POLICY } as any);
      const hv = h.main.value === '0원 (비과세)' ? '0원 (비과세)' : h.main.value;
      expect(row(sim, '② 양도')).toBe(hv);
    }
  });

  it('computeHousingCgt 성분 합 = 합계 (서로소: 소득세 + 지방소득세)', () => {
    const o = computeHousingCgt({ sell: 8 * 억, buy: 5 * 억, expenses: 0, hold: 3, live: 0, houses: 2, temporary2: false, acqRegulated: false, saleRegulated: true, grace: false }, P);
    expect(o.incomeTax + o.localTax).toBe(o.total);
    expect(o.ltdAmount).toBe(0);
  });
});

describe('major-shareholder-cgt — 지방세 이중 가산 제거 · 과세표준 3억 구간 · 중소기업 (K-9 cgt)', () => {
  const run = (o: Record<string, unknown>) => majorShareholderCgt({ profit: 5000 * 만, holdPeriod: 'long', sme: 'no', deductionUsed: 'no', __policy: POLICY, ...o } as any);
  const 옛 = (profit: number, short: boolean) => {
    if (short) return Math.round(Math.round(profit * 0.33) * 1.1);
    const tax = Math.round(Math.min(profit, 3 * 억) * 0.22 + Math.max(0, profit - 3 * 억) * 0.275);
    return Math.round(tax * 1.1);
  };

  it('⛔ 5,000만 · 1년 이상 → 10,450,000 (옛 12,100,000 · +165만)', () => {
    expect(run({}).main.value).toBe(W(10_450_000));
    expect(옛(5000 * 만, false)).toBe(12_100_000);
  });
  it('⛔ 5억 → 120,312,500 (옛 133,100,000) · 10억 → 257,812,500 (옛 284,350,000)', () => {
    expect(run({ profit: 5 * 억 }).main.value).toBe(W(120_312_500));
    expect(run({ profit: 10 * 억 }).main.value).toBe(W(257_812_500));
    expect(옛(5 * 억, false)).toBe(133_100_000);
    expect(옛(10 * 억, false)).toBe(284_350_000);
  });
  it('⛔ 1년 미만 비중소 30% → 15,675,000 (옛 18,150,000) · 중소기업이면 20% 10,450,000', () => {
    expect(run({ holdPeriod: 'short' }).main.value).toBe(W(15_675_000));
    expect(옛(5000 * 만, true)).toBe(18_150_000);
    expect(run({ holdPeriod: 'short', sme: 'yes' }).main.value).toBe(W(10_450_000));
  });
  it('3억 경계는 «과세표준» 기준 — 차익 3억 250만이면 과표 3억 · 전부 20%', () => {
    const r = run({ profit: 3 * 억 + 250 * 만 });
    expect(row(r, '양도소득세')).toBe(W(60_000_000));
  });
  it('기본공제 이미 사용 · 판정 기준 안내', () => {
    expect(run({ deductionUsed: 'yes' }).main.value).toBe(W(11_000_000));
    expect(row(run({}), '대주주 판정 (상장)')).toContain('50억');
  });
});

describe('overseas-cgt — 법조문 정정 · 250만 합산 1회 · RIA 특례 (K-9 cgt)', () => {
  const run = (o: Record<string, unknown>) => overseasCgt({ profit: 1000 * 만, otherProfit: 0, otherLoss: 0, deductionUsed: 'no', ria: 'no', __policy: POLICY, ...o } as any);

  it('기본값 1,000만 → 1,650,000 (옛 22% 단일과 같다) · 성분 20% + 1/10', () => {
    const r = run({});
    expect(r.main.value).toBe(W(1_650_000));
    expect(Math.round(750 * 만 * 0.22)).toBe(1_650_000);
    expect(row(r, '양도소득세')).toBe(W(1_500_000));
    expect(row(r, '지방소득세')).toBe(W(150_000));
  });

  it('⛔ RIA 8~12월 50% × 비율 1 → 550,000 (옛 1,650,000 · −110만)', () => {
    expect(run({ ria: 'yes', riaGain: 1000 * 만, riaPeriod: 'p3', riaRatio: 1 }).main.value).toBe(W(550_000));
  });

  it('RIA 공제는 기본공제 후 금액 범위 안 — 1~5월 100%면 과세표준 0', () => {
    const r = run({ ria: 'yes', riaGain: 1000 * 만, riaPeriod: 'p1', riaRatio: 1 });
    expect(r.main.value).toBe('0원');
    expect(row(r, 'RIA 특례 공제')).toBe(W(7_500_000));
  });

  it('조정비율은 0~1 로 자른다 · 산식 출처를 밝힌다', () => {
    const r = run({ ria: 'yes', riaGain: 1000 * 만, riaPeriod: 'p2', riaRatio: 0.5 });
    expect(row(r, 'RIA 특례 공제')).toBe(W(4_000_000));
    expect(row(r, '⚠️ 조정비율')).toContain('§93조의12④');
    expect(row(run({ ria: 'yes', riaGain: 1000 * 만, riaPeriod: 'p2', riaRatio: 7 }), 'RIA 특례 공제')).toBe(W(7_500_000));
  });

  it('기본공제 이미 사용 → 공제 0', () => {
    expect(run({ deductionUsed: 'yes' }).main.value).toBe(W(2_200_000));
  });
});

describe('policy_constants 마이그레이션 ↔ 테스트 픽스처 대조', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/k9_cgt_policy_constants_2026-09-17.sql'), 'utf8');
  const numbersOf = (key: string) => {
    const m = sql.match(new RegExp(`\\('${key}',[^\\n]*?ARRAY\\['([^']*)'`));
    return m?.[1];
  };
  it('퍼센트 행 첫 원소가 픽스처와 같다', () => {
    for (const k of Object.keys(PCT).filter((x) => x.startsWith('cgt_'))) expect(numbersOf(k), k).toBe(`${PCT[k]}%`);
  });
  it('금액 행 첫 원소가 픽스처와 같다(파서 규칙 억원/만원)', () => {
    const parse = (s: string) => { const w = s.match(/^([\d,]+(?:\.\d+)?)\s*(억원|만원|원)$/)!; return Math.round(Number(w[1].replace(/,/g, '')) * (w[2] === '억원' ? 억 : w[2] === '만원' ? 만 : 1)); };
    for (const k of Object.keys(AMT)) expect(parse(numbersOf(k)!), k).toBe(AMT[k]);
  });
  it('계산기가 요구하는 키가 전부 마이그레이션에 있다', () => {
    for (const set of Object.values(CGT_KEYS)) for (const k of [...set.pct, ...set.amt]) expect(numbersOf(k), k).toBeDefined();
  });
});
