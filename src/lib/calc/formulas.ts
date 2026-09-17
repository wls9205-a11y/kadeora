// 카더라 계산기 — 전체 계산 공식 모음
import {
  INCOME_TAX_BRACKETS, ACQUISITION_TAX_RATES, CAPITAL_GAINS_TAX,
  GIFT_TAX_BRACKETS, GIFT_EXEMPTIONS, SOCIAL_INSURANCE_RATES,
  JEONSE_CONVERSION_RATE, PROPERTY_TAX_RATES,
  calcProgressiveTax, formatKRWExact,
} from './tax-tables';
import {
  bondRatePerMille, pensionMonthly, HOUSING_BOND_SOURCE, HOUSING_PENSION_SOURCE,
  PENSION_MIN_AGE, PENSION_MAX_PRICE, brokerageBracket, BROKERAGE_SOURCE,
  parsePolicyPack, ltvPolicyKey, dsrPolicyKey, stressDsrKey, acqTaxPolicyKey, acqTaxMidRatePct, acqSurtaxPct, secTaxKeys, type StockMarket,
  depositTaxRow, type DepositTaxType,
  PREPAY_SOURCE, PREPAY_RATES, CAR_INSURANCE_SOURCE, type PrepayContract, type PrepayLoan, type PrepayRateType,
  type LtvRegion, type LtvOwner,
} from './gov-tables';

type V = Record<string, number | string>;

export interface CalcResult {
  main: { label: string; value: string; color?: string };
  details: { label: string; value: string }[];
  chart?: { labels: string[]; data: number[]; label?: string };
}

// ── 공통 유틸 ──
const n = (v: unknown) => Number(v) || 0;
// ⛔ 계산기 산출액은 «무손실» 로 찍는다. formatKRW(압축 표기)는 이 표면에 쓰지 않는다 —
//    1억 3,400만을 「1.3억원」으로 줄여 400만을 삼켰다(K-9 ⓒ 실측).
const fmt = (v: number) => formatKRWExact(v);
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ═══ 부동산 ═══

export function brokerageFee(v: V): CalcResult {
  const price = n(v.price);
  const monthlyRent = n(v.monthlyRent);
  const type = v.dealType as string;
  let base = price;
  if (type === 'monthly') base = price + (monthlyRent * 100); // 보증금+월세×100
  if (type === 'monthly' && base < price) base = price;
  // K-3 — 2021년 개정 요율표로 교체. 옛 상수는 개정 «전» 값이었고, 구간 순서까지 어긋나
  //        임대차 3억 칸이 사문이었다. 경계는 «이상/미만» 이다(옛 코드는 `<=` 로 이하였다).
  const bracket = brokerageBracket(type === 'trade' ? 'trade' : 'lease', base);
  if (!bracket) {
    return {
      main: { label: '요율 미확인', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '거래금액이 요율표 범위를 벗어났다' }],
    };
  }
  const rate = bracket.rate;
  const maxFee = bracket.maxFee;
  let fee = Math.round(base * rate);
  if (maxFee && fee > maxFee) fee = maxFee;
  return {
    main: { label: '중개수수료 상한', value: fmt(fee) },
    details: [
      { label: '거래금액', value: fmt(base) },
      { label: '상한요율', value: pct(rate) },
      ...(maxFee ? [{ label: '한도액', value: fmt(maxFee) }] : []),
      // ⚠️ 「내야 하는 금액」이 아니다. 상한 안에서 «협의» 로 정한다 — 화면이 그렇게 말해야 한다.
      { label: '성격', value: BROKERAGE_SOURCE.note },
      { label: '기준', value: `${BROKERAGE_SOURCE.law} · ${BROKERAGE_SOURCE.transcribedAt} 기준` },
      { label: '부가세 (법인 시)', value: fmt(Math.round(fee * 0.1)) },
      { label: '수수료+부가세', value: fmt(Math.round(fee * 1.1)) },
    ],
  };
}

export function pyeongToSqm(v: V): CalcResult {
  const val = n(v.value);
  const dir = v.direction as string;
  const result = dir === 'toSqm' ? val * 3.3058 : val / 3.3058;
  return {
    main: { label: dir === 'toSqm' ? '제곱미터 (㎡)' : '평 (坪)', value: `${result.toFixed(2)}${dir === 'toSqm' ? ' ㎡' : ' 평'}` },
    details: [
      { label: '입력값', value: `${val}${dir === 'toSqm' ? ' 평' : ' ㎡'}` },
      { label: '환산 공식', value: '1평 = 3.3058㎡ (400/121)' },
    ],
  };
}

import { jeonseWolse } from './k9/ext'; export { jeonseWolse }; // K-9 ext — 본문은 k9/ext.ts

export function rentalYield(v: V): CalcResult {
  const price = n(v.purchasePrice);
  const deposit = n(v.deposit);
  const rent = n(v.monthlyRent);
  const vacancy = n(v.vacancy) / 100;
  const expenses = n(v.expenses);
  const annualRent = rent * 12 * (1 - vacancy) - expenses;
  const invested = price - deposit;
  const yieldRate = invested > 0 ? annualRent / invested : 0;
  return {
    main: { label: '연 임대수익률', value: pct(yieldRate) },
    details: [{ label: '연간 순수익', value: fmt(annualRent) }, { label: '투자금 (매입가-보증금)', value: fmt(invested) }],
  };
}

// ═══ 주식/투자 ═══

export function compoundInterest(v: V): CalcResult {
  const p = n(v.principal);
  const m = n(v.monthly);
  const r = n(v.rate) / 100;
  const y = n(v.years);
  const monthly = v.compoundType === 'monthly';
  let total = p;
  const chartData: number[] = [];
  const chartLabels: string[] = [];
  for (let i = 1; i <= y; i++) {
    if (monthly) {
      const mr = r / 12;
      total = total * (1 + mr);
      for (let j = 0; j < 12; j++) total = (total + m) * (1 + mr);
      total -= m * (1 + mr); // 첫 달 이중 계산 보정
      // 간소화: 연단위 근사
      total = p * Math.pow(1 + r / 12, i * 12) + m * ((Math.pow(1 + r / 12, i * 12) - 1) / (r / 12));
    } else {
      total = (total + m * 12) * (1 + r);
    }
    chartData.push(Math.round(total));
    chartLabels.push(`${i}년`);
  }
  const totalInvested = p + m * 12 * y;
  const profit = Math.round(total) - totalInvested;
  return {
    main: { label: '최종 자산', value: fmt(Math.round(total)) },
    details: [
      { label: '총 투자금', value: fmt(totalInvested) },
      { label: '수익금', value: fmt(profit) },
      { label: '수익률', value: pct(totalInvested > 0 ? profit / totalInvested : 0) },
    ],
    chart: { labels: chartLabels, data: chartData, label: '자산 추이' },
  };
}

export function stockRoi(v: V): CalcResult {
  const buy = n(v.buyPrice);
  const sell = n(v.sellPrice);
  const qty = n(v.quantity);
  const fee = n(v.fee) / 100;
  // K-9 ⓒ 3군 재분류 — 증권거래세는 «시장값이 아니라 법정값» 이라 policy_constants 에서 온다.
  //   옛 값 0.0018(0.18%)은 2024년 화석이었고 그 사이 두 번 움직였다(2025 최저 0.15% → 2026 인상).
  //   ⚠️ 성분으로 낸다. 총액은 2026년 한정으로 양 시장이 0.20% 로 «우연히» 같아서,
  //      합계만 맞히면 내년 개정 때 조용히 틀린다.
  const market = String(v.market ?? 'kospi') as StockMarket;
  const pack = parsePolicyPack(v.__policy);
  const keys = secTaxKeys(market);
  const tradePct = keys.trade ? pack?.pct?.[keys.trade] : 0;
  const farmPct = keys.farm ? (pack?.pct?.[keys.farm] ?? undefined) : 0;

  if (keys.trade && typeof tradePct !== 'number') {
    return {
      main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '증권거래세율 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }
  if (keys.farm && typeof farmPct !== 'number') {
    return {
      main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '농어촌특별세율 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }

  const sellBase = sell * qty;
  const tradeTax = Math.round(sellBase * ((tradePct ?? 0) / 100));
  const farmTax = Math.round(sellBase * ((farmPct ?? 0) / 100));
  const secTax = tradeTax + farmTax;
  const buyTotal = buy * qty * (1 + fee);
  const sellTotal = sell * qty * (1 - fee);
  const profit = sellTotal - buyTotal - secTax;
  const roi = buyTotal > 0 ? profit / buyTotal : 0;
  const m = keys.trade ? (pack?.meta?.[keys.trade] ?? {}) : {};
  return {
    main: { label: '수익률', value: pct(roi), color: profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
    details: [
      { label: '매수 총액 (수수료 포함)', value: fmt(Math.round(buyTotal)) },
      { label: '매도 총액 (수수료 차감)', value: fmt(Math.round(sellTotal)) },
      // ⛔ 합계 한 줄로 뭉개지 않는다. 성분이 보여야 개정 때 어느 칸이 바뀌었는지 안다.
      ...(keys.trade
        // ⚠️ 법정 표기는 0.20% 다. JS 가 0.20 을 0.2 로 줄이므로 소수 2자리로 고정한다 —
        //    「1만분의 20」의 표기 정합이다.
        ? [{ label: `증권거래세 (${(tradePct ?? 0).toFixed(2)}%)`, value: fmt(tradeTax) }]
        : [{ label: '증권거래세', value: '해외 주식은 증권거래세가 없다 — 양도세는 별도다' }]),
      ...(keys.farm ? [{ label: `농어촌특별세 (${(farmPct ?? 0).toFixed(2)}%)`, value: fmt(farmTax) }] : []),
      ...(keys.trade ? [{ label: '세금 합계', value: fmt(secTax) }] : []),
      { label: '순수익', value: fmt(Math.round(profit)) },
      ...(m.source || m.date ? [{ label: '근거', value: [m.source, m.date].filter(Boolean).join(' · ') }] : []),
    ],
  };
}

export function avgDown(v: V): CalcResult {
  const avg = n(v.avgPrice);
  const qty = n(v.quantity);
  const add = n(v.addPrice);
  const addQty = n(v.addQuantity);
  const newAvg = (avg * qty + add * addQty) / (qty + addQty);
  return {
    main: { label: '새 평균단가', value: fmt(Math.round(newAvg)) },
    details: [
      { label: '기존 평단가', value: fmt(avg) },
      { label: '총 보유 수량', value: `${qty + addQty}주` },
      { label: '평단가 변화', value: `${avg > newAvg ? '▼' : '▲'} ${fmt(Math.abs(Math.round(avg - newAvg)))}` },
    ],
  };
}

export function breakeven(v: V): CalcResult {
  const loss = n(v.lossPercent) / 100;
  const needed = loss / (1 - loss) * 100;
  return {
    main: { label: '본전까지 필요 수익률', value: `+${needed.toFixed(1)}%` },
    details: [{ label: '현재 손실률', value: `-${(loss * 100).toFixed(1)}%` }],
  };
}

import { dividendCalc } from './k9/fin'; export { dividendCalc };

export function dcaSimulator(v: V): CalcResult {
  const m = n(v.monthly);
  const r = n(v.rate) / 100;
  const y = n(v.years);
  const mr = r / 12;
  const total = mr > 0 ? m * ((Math.pow(1 + mr, y * 12) - 1) / mr) : m * y * 12;
  const invested = m * 12 * y;
  return {
    main: { label: '최종 자산', value: fmt(Math.round(total)) },
    details: [{ label: '총 투자금', value: fmt(invested) }, { label: '수익금', value: fmt(Math.round(total - invested)) }],
  };
}

export function perPbrValue(v: V): CalcResult {
  const method = v.method as string;
  if (method === 'per') {
    const eps = n(v.eps), per = n(v.targetPer);
    return { main: { label: 'PER 기준 적정주가', value: fmt(Math.round(eps * per)) }, details: [{ label: 'EPS × PER', value: `${fmt(eps)} × ${per}배` }] };
  } else {
    const bps = n(v.bps), pbr = n(v.targetPbr);
    return { main: { label: 'PBR 기준 적정주가', value: fmt(Math.round(bps * pbr)) }, details: [{ label: 'BPS × PBR', value: `${fmt(bps)} × ${pbr}배` }] };
  }
}

/**
 * K-9 ⓒ 1호 — 고정 환율 상수 축출 (2026-09-16).
 *
 * 검색량 실측 «월 1,541,200» 으로 계산기 140종 중 압도적 1위인데, 환율이 «상수» 였다:
 *   `{ USD:1, KRW:1380, JPY:150, EUR:0.92, CNY:7.25 }`
 * 라이브 대비 오차 — KRW 2.4% · JPY 2.9% · EUR 6.2% · CNY 7.8%.
 * ⛔ 환율은 «매일» 바뀐다. 상수로 박으면 코드가 안 바뀌는 한 영원히 같은 값을
 *    「오늘의 환율」처럼 보인다 — 채권 할인율 0.04 와 정확히 같은 병이다.
 *
 * 그리고 신설할 것이 없었다 — `exchange_rates` 표와 이를 채우는 크론이 «이미 있었다».
 * 라이브 값이 DB 에 있는데 계산기가 그걸 안 보고 있었을 뿐이다.
 *
 * ⚠️ 이 함수는 클라이언트에서 도는 «순수 함수» 라 DB 를 못 본다. 그래서 서버(페이지)가
 *    읽어 `__fx` 로 주입한다. V 가 number|string 만 받으므로 JSON 문자열로 넘긴다.
 * ⛔ 주입이 없으면 «지어내지 않는다» — 옛 상수로 조용히 되돌아가지 않고 못 잰다고 말한다.
 */
export function currencyConvert(v: V): CalcResult {
  let rates: Record<string, number> | null = null;
  let asof = '';
  try {
    const fx = JSON.parse(String(v.__fx ?? '')) as { rates?: Record<string, number>; updatedAt?: string };
    if (fx?.rates && typeof fx.rates === 'object') rates = fx.rates;
    asof = String(fx?.updatedAt ?? '');
  } catch { /* 주입 없음 */ }

  const from = String(v.from ?? '');
  const to = String(v.to ?? '');
  const rFrom = rates?.[from];
  const rTo = rates?.[to];
  if (!rFrom || !rTo) {
    return {
      main: { label: '환율 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '오늘의 고시 환율을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }

  const amount = n(v.amount);
  const result = (amount / rFrom) * rTo;
  const pair = rTo / rFrom;
  return {
    main: {
      label: `${to} 변환 결과`,
      value: `${result.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${to}`,
    },
    details: [
      { label: '적용 환율', value: `1 ${from} = ${pair.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${to}` },
      // ⚠️ 기준 시각을 «반드시» 함께 낸다. 날짜 없는 환율은 거짓 신선도다.
      ...(asof ? [{ label: '기준', value: `${asof.slice(0, 16).replace('T', ' ')} 고시` }] : []),
      { label: '참고', value: '매일 갱신되는 고시 환율이다. 실제 매매기준율·수수료는 은행마다 다르다' },
    ],
  };
}

// ═══ 급여/세금 ═══

export function netSalary(v: V): CalcResult {
  const annual = n(v.annualSalary);
  const nonTax = n(v.nonTaxable) * 12;
  const taxable = annual - nonTax;
  const monthly = taxable / 12;
  // 4대보험
  const np = Math.min(monthly, 5900000) * SOCIAL_INSURANCE_RATES.nationalPension.employee;
  const hi = monthly * SOCIAL_INSURANCE_RATES.healthInsurance.employee;
  const ltc = hi * SOCIAL_INSURANCE_RATES.longTermCare;
  const ei = monthly * SOCIAL_INSURANCE_RATES.employmentInsurance.employee;
  const insurance = np + hi + ltc + ei;
  // 소득세 (간이세액표 근사)
  const tax = calcProgressiveTax(taxable, INCOME_TAX_BRACKETS) / 12;
  const localTax = tax * 0.1;
  const totalDeduction = insurance + tax + localTax;
  const netMonthly = annual / 12 - totalDeduction;
  return {
    main: { label: '월 실수령액', value: fmt(Math.round(netMonthly)) },
    details: [
      { label: '월 급여 (세전)', value: fmt(Math.round(annual / 12)) },
      { label: '국민연금', value: fmt(Math.round(np)) },
      { label: '건강보험', value: fmt(Math.round(hi)) },
      { label: '장기요양', value: fmt(Math.round(ltc)) },
      { label: '고용보험', value: fmt(Math.round(ei)) },
      { label: '소득세', value: fmt(Math.round(tax)) },
      { label: '지방소득세', value: fmt(Math.round(localTax)) },
      { label: '공제 합계', value: fmt(Math.round(totalDeduction)) },
    ],
  };
}

export function fourInsurance(v: V): CalcResult {
  const m = n(v.monthlySalary);
  const np = Math.min(m, 5900000) * SOCIAL_INSURANCE_RATES.nationalPension.employee;
  const hi = m * SOCIAL_INSURANCE_RATES.healthInsurance.employee;
  const ltc = hi * SOCIAL_INSURANCE_RATES.longTermCare;
  const ei = m * SOCIAL_INSURANCE_RATES.employmentInsurance.employee;
  const total = np + hi + ltc + ei;
  return {
    main: { label: '4대보험 합계 (근로자)', value: fmt(Math.round(total)) },
    details: [
      { label: '국민연금 (4.5%)', value: fmt(Math.round(np)) },
      { label: '건강보험 (3.545%)', value: fmt(Math.round(hi)) },
      { label: '장기요양보험 (12.95%)', value: fmt(Math.round(ltc)) },
      { label: '고용보험 (0.9%)', value: fmt(Math.round(ei)) },
    ],
  };
}

export function retirementPay(v: V): CalcResult {
  const avg = n(v.avgSalary);
  const years = n(v.years);
  const months = n(v.months);
  const totalMonths = years * 12 + months;
  const pay = Math.round(avg * totalMonths / 12);
  return {
    main: { label: '퇴직금 (세전)', value: fmt(pay) },
    details: [{ label: '근속기간', value: `${years}년 ${months}개월` }, { label: '월평균임금', value: fmt(avg) }],
  };
}

export function hourlyAnnual(v: V): CalcResult {
  const val = n(v.value);
  const hours = n(v.weeklyHours);
  const holiday = v.includeWeeklyHoliday === 'yes';
  const weeklyHours = holiday ? hours + (hours / 5 * 1) : hours;
  if (v.direction === 'toAnnual') {
    const monthly = val * weeklyHours * (52 / 12);
    const annual = monthly * 12;
    return { main: { label: '연봉', value: fmt(Math.round(annual)) }, details: [{ label: '월급', value: fmt(Math.round(monthly)) }, { label: '주당 유급시간', value: `${weeklyHours.toFixed(1)}시간` }] };
  } else {
    const hourly = val / 12 / (weeklyHours * 52 / 12);
    return { main: { label: '시급', value: fmt(Math.round(hourly)) }, details: [{ label: '연봉', value: fmt(val) }] };
  }
}

import { withholding33 } from './k9/fin'; export { withholding33 };

// ═══ 대출/예적금 ═══

export function loanRepayment(v: V): CalcResult {
  const p = n(v.principal);
  const r = n(v.rate) / 100 / 12;
  const months = n(v.years) * 12;
  const method = v.method as string;
  let monthly = 0, totalInterest = 0;
  if (method === 'equal' && r > 0) {
    monthly = p * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    totalInterest = monthly * months - p;
  } else if (method === 'principal') {
    const principalPay = p / months;
    monthly = principalPay + p * r; // 첫 달
    totalInterest = p * r * (months + 1) / 2;
  } else { // bullet
    monthly = p * r;
    totalInterest = monthly * months;
  }
  return {
    main: { label: method === 'principal' ? '첫 달 상환액' : '월 상환액', value: fmt(Math.round(monthly)) },
    details: [
      { label: '대출 원금', value: fmt(p) },
      { label: '총 이자', value: fmt(Math.round(totalInterest)) },
      { label: '총 상환액', value: fmt(Math.round(p + totalInterest)) },
    ],
  };
}

/**
 * 이자 과세 성분 — deposit-interest · interest-tax 가 «같은» 계산을 쓴다(이중 진실 금지).
 *   genBase: 일반 원천징수 대상 이자 · spBase: 특례(한도 안) 이자
 */
function interestTaxParts(
  genBase: number, spBase: number,
  row: ReturnType<typeof depositTaxRow>, P: Record<string, number>, farmExempt: boolean,
) {
  const incomePct = P.int_tax_income;           // 14 — 소득세법 §129①1라
  const localPct = P.int_tax_local;             // 10 — 원천징수 소득세의 10%
  const farmBase = P.farm_int_base;             // 14 — 농특세법 §5④1가
  const farmRate = P.farm_int_rate;             // 10 — 감면세액의 10%
  const genIncome = Math.round(genBase * incomePct / 100);
  const genLocal = Math.round(genIncome * localPct / 100);
  const spPct = row.incomeKey && row.limitKey ? P[row.incomeKey] : 0;
  const spIncome = Math.round(spBase * spPct / 100);
  const spFarm = row.farm && !farmExempt ? Math.round(spBase * (farmBase - spPct) / 100 * farmRate / 100) : 0;
  const farmPct = (farmBase - spPct) * farmRate / 100;
  return { incomePct, localPct, genIncome, genLocal, spPct, spIncome, spFarm, farmPct,
    tax: genIncome + genLocal + spIncome + spFarm };
}

/** 이자 과세 행에 필요한 policy 키가 전부 왔는가. 안 왔으면 지어내지 않는다. */
function interestPolicyMissing(row: ReturnType<typeof depositTaxRow>, P: Record<string, number>): boolean {
  const need = ['int_tax_income', 'int_tax_local', 'farm_int_base', 'farm_int_rate', ...(row.incomeKey ? [row.incomeKey] : [])];
  return need.some((k) => typeof P[k] !== 'number');
}

/**
 * 이자를 «특례 한도 안» 과 «밖» 으로 가른다. 한도는 원금 기준이다.
 *   예금: 이자가 원금에 비례하므로 비율로 정확히 갈린다.
 *   적금: 회차마다 예치 기간이 달라 비율로 가르면 틀린다 — 앞 회차부터 한도를 채운다.
 */
function splitInterestByLimit(
  type: 'deposit' | 'savings', amount: number, rate: number, months: number, limit: number | null,
): { total: number; inLimit: number } {
  if (type === 'deposit') {
    const total = amount * rate * (months / 12);
    const ratio = limit === null || amount <= 0 ? 1 : Math.min(1, limit / amount);
    return { total, inLimit: total * ratio };
  }
  let total = 0;
  let inLimit = 0;
  for (let k = 1; k <= months; k++) {
    const i = amount * rate * (months - k + 1) / 12;
    const within = limit === null || amount <= 0 ? 1 : Math.max(0, Math.min(1, (limit - amount * (k - 1)) / amount));
    total += i;
    inLimit += i * within;
  }
  return { total, inLimit };
}

export function depositInterest(v: V): CalcResult {
  const amount = n(v.amount);
  const rate = n(v.rate) / 100;
  const months = n(v.months);
  const kind: 'deposit' | 'savings' = v.type === 'deposit' ? 'deposit' : 'savings';
  const taxType = (['general', 'mutual', 'taxFreeSavings'].includes(String(v.taxType)) ? v.taxType : 'general') as DepositTaxType;
  const joinYear = n(v.joinYear) || 2026;
  const eligible = v.eligible !== 'no';
  const farmExempt = v.farmExempt === 'yes';

  // K-9 ⓒ — 세율·한도의 정본은 policy_constants(조특법 §89의3·§88의2 · 소득세법 §129 · 지방세법 §103의13 · 농특세법 §5).
  //   ⛔ 옛 「세금우대 9.5%」는 세금우대종합저축 화석이었다. 선택지에서 뺐다.
  const pack = parsePolicyPack(v.__policy);
  const row = depositTaxRow(taxType, joinYear, eligible);
  const P = pack?.pct ?? {};
  const limit = row.limitKey ? pack?.amt?.[row.limitKey] : null;
  if (interestPolicyMissing(row, P) || (row.limitKey && typeof limit !== 'number')) {
    return {
      main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '이자 과세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }

  // ⛔ 옛 적금 공식은 `amount*rate*(months+1)/2/12` — «× months» 가 빠져 있었다.
  //    월 100만·연 3.5%·12개월: 옛 18,958원 vs 실제 227,500원 — 기본 입력에서 12배 과소.
  const { total: interest, inLimit } = splitInterestByLimit(kind, amount, rate, months, limit ?? null);
  const over = interest - inLimit;

  // 한도 밖(또는 일반 과세 전체)은 일반 원천징수 · 한도 안은 특례
  const genBase = row.limitKey ? over : interest;
  const spBase = row.limitKey ? inLimit : 0;
  const { incomePct, localPct, genIncome, genLocal, spPct, spIncome, spFarm, farmPct, tax } =
    interestTaxParts(genBase, spBase, row, P, farmExempt);
  const net = interest - tax;
  const principal = kind === 'deposit' ? amount : amount * months;
  const total = principal + net;

  const details: { label: string; value: string }[] = [
    { label: '세전 이자', value: fmt(Math.round(interest)) },
    { label: '적용 구분', value: row.label },
  ];
  if (row.limitKey) {
    details.push({ label: `특례 한도 (${fmt(limit as number)})`, value: `한도 안 이자 ${fmt(Math.round(inLimit))}` });
    if (over > 0) details.push({ label: '⚠️ 한도 초과분', value: `${fmt(Math.round(over))} — 특례 밖이라 일반 원천징수로 계산했다(조합에 확인)` });
  }
  if (genBase > 0) {
    details.push({ label: `소득세 (${incomePct}%)`, value: fmt(genIncome) });
    details.push({ label: `지방소득세 (소득세의 ${localPct}%)`, value: fmt(genLocal) });
  }
  if (row.limitKey) {
    // ⛔ 「없다 ≠ 0원」 — 비과세여도 농특세가 붙는 칸이 있다. 무엇이 없는지 말로 적는다.
    details.push(spPct > 0
      ? { label: `특례 소득세 (${spPct}% 분리과세)`, value: fmt(spIncome) }
      : { label: '특례 소득세', value: '비과세' });
    if (taxType === 'mutual') {
      details.push({ label: '특례 지방소득세', value: '부과하지 않는다 — 조특법 §89의3' });
      details.push(farmExempt
        ? { label: '농어촌특별세', value: '면제 — 농어민·임업인·저소득 근로자(농특세령 §4⑦3)' }
        : { label: `농어촌특별세 (${farmPct.toFixed(1)}%)`, value: fmt(spFarm) });
    } else {
      details.push({ label: '농어촌특별세', value: '없음 — 농특세법 §4 비과세 목록(§88의2)' });
    }
  }
  details.push({ label: '세금 합계', value: fmt(tax) });
  details.push({ label: '세후 이자', value: fmt(Math.round(net)) });
  if (taxType === 'mutual') {
    details.push({ label: '⚠️ 판정 기준', value: '가입 «당시» 요건으로 갈린다(이자 발생 시점 아님). 한도 3천만원은 모든 조합 합산' });
    details.push({ label: '⚠️ 확인 필요', value: '만기 재예치·자동연장을 새 가입으로 보는지는 법령에 정의가 없다 — 조합에 확인한다' });
  }
  const src = pack?.meta?.[row.incomeKey ?? row.limitKey ?? 'int_tax_income'];
  if (src?.source || src?.date) details.push({ label: '근거', value: [src.source, src.date].filter(Boolean).join(' · ') });

  return { main: { label: '세후 수령액', value: fmt(Math.round(total)) }, details };
}

// ═══ 세금 ═══

import { acquisitionTaxLocal } from './k9/local';
/**
 * K-9 local (2026-09-17) — 매매·증여·상속·감면 전부 k9/local.ts 의 acquisitionParts 한 계산으로.
 * registration-cost 가 같은 계산을 쓴다(이중 진실 금지). 이 함수의 자리·이름은 그대로 둔다.
 */
export function acquisitionTax(v: V): CalcResult {
  return acquisitionTaxLocal(v);
}

import { capitalGainsHousing } from './k9/cgt'; export { capitalGainsHousing }; // K-9 cgt — 본문 이관

import { giftTax } from './k9/ext'; export { giftTax }; // K-9 ext — 본문은 k9/ext.ts

import { overseasCgt } from './k9/cgt'; export { overseasCgt }; // K-9 cgt — 본문 이관

import { financialIncomeTax } from './k9/fin'; export { financialIncomeTax };

// ═══ 생활 ═══

export function bmi(v: V): CalcResult {
  const h = n(v.height) / 100;
  const w = n(v.weight);
  const bmiVal = w / (h * h);
  const grade = bmiVal < 18.5 ? '저체중' : bmiVal < 23 ? '정상' : bmiVal < 25 ? '과체중' : bmiVal < 30 ? '비만' : '고도비만';
  const color = grade === '정상' ? 'var(--accent-green)' : grade === '저체중' || grade === '과체중' ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const idealWeight = 22 * h * h;
  return {
    main: { label: `BMI ${bmiVal.toFixed(1)}`, value: grade, color },
    details: [{ label: '적정 체중 (BMI 22)', value: `${idealWeight.toFixed(1)} kg` }],
  };
}

import { dueDate } from './k9/misc'; export { dueDate };

import { electricityBill } from './k9/misc'; export { electricityBill };

import { dischargeDate } from './k9/misc'; export { dischargeDate };

// ═══ 연금/은퇴 ═══

import { nationalPension } from './k9/misc'; export { nationalPension };

export function fireCalc(v: V): CalcResult {
  const expense = n(v.monthlyExpense);
  const current = n(v.currentAssets);
  const savings = n(v.monthlySavings);
  const ret = n(v.expectedReturn) / 100;
  const wr = n(v.withdrawalRate) / 100;
  const target = expense * 12 / wr;
  if (current >= target) return { main: { label: 'FIRE 달성!', value: '이미 달성', color: 'var(--accent-green)' }, details: [{ label: '목표 자산', value: fmt(target) }] };
  let assets = current, years = 0;
  while (assets < target && years < 100) {
    assets = (assets + savings * 12) * (1 + ret);
    years++;
  }
  return {
    main: { label: 'FIRE 달성까지', value: `${years}년` },
    details: [
      { label: '목표 자산', value: fmt(Math.round(target)) },
      { label: '현재 자산', value: fmt(current) },
      { label: '부족분', value: fmt(Math.round(target - current)) },
    ],
  };
}

import { irpDeduction } from './k9/misc'; export { irpDeduction };

// ── 공식 매핑 ──
export const FORMULAS: Record<string, (v: V) => CalcResult> = {
  brokerageFee, pyeongToSqm, jeonseWolse, rentalYield,
  compoundInterest, stockRoi, avgDown, breakeven, dividendCalc, dcaSimulator, perPbrValue, currencyConvert,
  netSalary, fourInsurance, retirementPay, hourlyAnnual, withholding33,
  loanRepayment, depositInterest,
  acquisitionTax, capitalGainsHousing, giftTax, overseasCgt, financialIncomeTax,
  bmi, dueDate, electricityBill, dischargeDate,
  nationalPension, fireCalc, irpDeduction,
  // 추가분
  calorie, bodyFat, bmr, ageCalc, dDay, ovulation,
  vehicleTax, fuelCost, carInstallment, evChargeCost,
  discountCalc, installmentInterest, customsDuty, subscriptionTotal,
  militaryPay, gpaConvert,
  comprehensiveIncomeTax, propertyTax, registrationCost, dsrCalc, jeonseVsWolse,
  yearEndRefund, creditCardDeduction, monthlyRentDeduction, inheritanceTax, vatCalc,
  // 2차 배치
  earnedIncomeTax, retirementIncomeTax, otherIncomeTax, interestTax, incomeBracketLookup, localIncomeTax,
  simplifiedVat, corporateTax, penaltyTax, expenseRateLookup,
  medicalDeduction, educationDeduction, donationDeduction, insuranceDeduction, childCredit, housingFundDeduction,
  comprehensivePropertyTax, rentalIncomeTax,
  cryptoTax, etfTax, isaTaxFree,
  childSupport, accidentCompensation,
  prepaymentFee, housingPension, retirementPensionSim,
  alcoholCalc, unitConvert, leaseVsInstallment, overtimePay, annualLeavePay,
  // K-9 inh — registry 에 있는데 이 맵에 없어 결과가 안 뜨던 4종(2026-09-17 실측: 라이브 generation-skip 결과 영역 없음)
  giftExemptionLookup, burdenGift, familyBusiness, generationSkip,
  // 청약 가점 (이전 누락 — registry는 있는데 formula 없어서 결과 안 떴음)
  subscriptionScore,
  // [S] 해제(2026-09-17 세션 A 판정) — registry 에 있는데 맵에 없어 라이브 무결과였던 38종 중 «감사 통과» 17종.
  //   라이브 반영일 = 오늘(커밋일 아님). 나머지 21종은 A″ 감사 통과 시 개별 등록(src/__tests__/calc-registry-coverage.test.ts 의 PENDING).
  ltvCalc, housingBond, auctionProfit, shortSelling, carInsuranceEst, capitalGainsRights, capitalGainsLand, multiHouseSim, oneHouseCheck, majorShareholderCgt, registrationLicenseTax, stampTax, minimumWage, isaConversion, industrialAccident, consolationMoney, statuteOfLimitations,
  // A″ a2 감사 통과(2026-09-17) — 라이브 반영일 = 등록 커밋 배포일.
  jeonseLoan, severanceCalc,
};

// ═══ 청약 가점 계산기 (주택공급에 관한 규칙 별표1) ═══
// 무주택 32점 + 부양가족 35점 + 청약통장 17점 = 84점 만점
// 2024년부터 배우자 통장 가입기간 합산 가능 (최대 3년)

function noHouseScore(years: number): number {
  // 1년 미만 2점, 1년 이상부터 매년 +2, 15년 이상 32점 (만점)
  if (years < 0) return 0;
  if (years < 1) return 2;
  return Math.min(32, 2 + Math.floor(years) * 2);
}

function dependentsScore(n: number): number {
  // 0명 5점, 1명당 +5점, 6명 이상 35점 (만점)
  if (n < 0) return 0;
  return Math.min(35, 5 + Math.min(6, n) * 5);
}

function bankYearsScore(years: number): number {
  // 6개월 미만 1점, 6개월~1년 2점, 1년부터 매년 +1, 15년 이상 17점 (만점)
  if (years < 0.5) return 1;
  if (years < 1) return 2;
  return Math.min(17, 2 + Math.floor(years));
}

export function subscriptionScore(v: V): CalcResult {
  const noHouseYears = n(v.noHouseYears);
  const dependents = Math.floor(n(v.dependents));
  const bankYears = n(v.bankYears);
  // 배우자 통장 합산 — 2024년 신규 정책, 본인 통장 만점(15년) 안 됐을 때만 효과
  const spouseBankYearsRaw = Math.max(0, n(v.spouseBankYears));
  const spouseBankYears = Math.min(3, spouseBankYearsRaw); // 최대 3년 합산

  const effectiveBankYears = bankYears + spouseBankYears;

  const sNoHouse = noHouseScore(noHouseYears);
  const sDependents = dependentsScore(dependents);
  const sBank = bankYearsScore(effectiveBankYears);
  const total = sNoHouse + sDependents + sBank;

  // 가점 등급 진단 (실제 청약 당첨 사례 기반 분포)
  let grade = '하위';
  let advice = '경기 외곽·신도시 중심으로 도전 권장';
  if (total >= 70) {
    grade = '최상위 (상위 5%)';
    advice = '서울 전 지역 강력 도전 가능. 강남4구 인기 단지도 충분';
  } else if (total >= 60) {
    grade = '상위 (상위 15%)';
    advice = '서울 인기 단지 도전 가능. 비서울 지역에서는 1순위급';
  } else if (total >= 50) {
    grade = '중상위';
    advice = '서울 비인기 지역 + 경기 인기 단지 도전 가능';
  } else if (total >= 40) {
    grade = '중간';
    advice = '경기·인천·신도시 중심 권장';
  } else if (total >= 30) {
    grade = '중하위';
    advice = '특별공급(신혼·생애최초·다자녀)을 우선 검토';
  }

  const details: { label: string; value: string }[] = [
    { label: '무주택 기간 점수', value: `${sNoHouse}점 / 32점 (만 ${noHouseYears.toFixed(1)}년)` },
    { label: '부양가족 점수', value: `${sDependents}점 / 35점 (${dependents}명)` },
    { label: '청약통장 점수', value: `${sBank}점 / 17점 (${effectiveBankYears.toFixed(1)}년)` },
  ];
  if (spouseBankYears > 0) {
    details.push({
      label: '배우자 통장 합산 효과',
      value: `+${spouseBankYears.toFixed(1)}년 (입력 ${spouseBankYearsRaw.toFixed(1)}년 중 최대 3년)`,
    });
  }
  details.push({ label: '진단', value: `${grade} — ${advice}` });

  return {
    main: { label: '내 청약 가점', value: `${total}점 / 84점` },
    details,
  };
}


// ═══ 추가 공식 ═══

export function calorie(v: V): CalcResult {
  const g = v.gender as string; const a = n(v.age); const h = n(v.height); const w = n(v.weight); const act = Number(v.activity);
  const bmrVal = g === 'male' ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
  const tdee = Math.round(bmrVal * act);
  return { main: { label: '일일 권장 칼로리', value: `${tdee} kcal` }, details: [{ label: '기초대사량 (BMR)', value: `${Math.round(bmrVal)} kcal` }, { label: '다이어트 목표', value: `${Math.round(tdee * 0.8)} kcal (-20%)` }] };
}
import { bodyFat } from './k9/misc'; export { bodyFat };
export function bmr(v: V): CalcResult {
  const g = v.gender as string; const a = n(v.age); const h = n(v.height); const w = n(v.weight);
  const val = g === 'male' ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
  return { main: { label: '기초대사량', value: `${Math.round(val)} kcal/일` }, details: [{ label: '공식', value: 'Mifflin-St Jeor' }] };
}
import { ageCalc } from './k9/misc'; export { ageCalc };
import { dDay } from './k9/misc'; export { dDay };
export function ovulation(v: V): CalcResult {
  const lmp = v.lastPeriod as string; const cycle = n(v.cycleLength) || 28;
  if (!lmp) return { main: { label: '배란 예정일', value: '날짜를 입력하세요' }, details: [] };
  const d = new Date(lmp); d.setDate(d.getDate() + cycle - 14);
  const start = new Date(d); start.setDate(start.getDate() - 3);
  const end = new Date(d); end.setDate(end.getDate() + 1);
  const fmt2 = (dt: Date) => `${dt.getMonth()+1}/${dt.getDate()}`;
  return { main: { label: '배란 예정일', value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }, details: [{ label: '가임기', value: `${fmt2(start)} ~ ${fmt2(end)}` }] };
}
import { vehicleTax } from './k9/local'; export { vehicleTax };
export function fuelCost(v: V): CalcResult {
  const dist = n(v.distance); const eff = n(v.efficiency); const price = n(v.fuelPrice);
  const monthly = Math.round(dist / eff * price);
  return { main: { label: '월간 유류비', value: fmt(monthly) }, details: [{ label: '연간', value: fmt(monthly * 12) }, { label: '월 소비량', value: `${(dist/eff).toFixed(1)}L` }] };
}
export function carInstallment(v: V): CalcResult {
  const p = n(v.carPrice) - n(v.downPayment); const r = n(v.rate)/100/12; const m = Number(v.months);
  const monthly = r > 0 ? Math.round(p * r * Math.pow(1+r,m) / (Math.pow(1+r,m)-1)) : Math.round(p/m);
  const total = monthly * m;
  return { main: { label: '월 납입금', value: fmt(monthly) }, details: [{ label: '총 이자', value: fmt(total - p) }, { label: '총 납입액', value: fmt(total) }] };
}
export function evChargeCost(v: V): CalcResult {
  const dist = n(v.distance); const eff = n(v.efficiency);
  const price = v.chargeType === 'home' ? 120 : 350;
  const kwh = dist / eff; const cost = Math.round(kwh * price);
  return { main: { label: '월간 충전비', value: fmt(cost) }, details: [{ label: '월 소비 전력', value: `${kwh.toFixed(1)} kWh` }, { label: '단가', value: `${price}원/kWh` }] };
}
export function discountCalc(v: V): CalcResult {
  const orig = n(v.original); const sale = n(v.sale);
  const rate = orig > 0 ? ((orig - sale) / orig) * 100 : 0;
  return { main: { label: '할인율', value: `${rate.toFixed(1)}%` }, details: [{ label: '할인 금액', value: fmt(orig - sale) }] };
}
export function installmentInterest(v: V): CalcResult {
  const amount = n(v.amount); const m = Number(v.months); const r = n(v.rate)/100;
  const interest = Math.round(amount * r * (m + 1) / 24);
  return { main: { label: '총 이자', value: fmt(interest) }, details: [{ label: '월 납입금', value: fmt(Math.round((amount + interest) / m)) }, { label: '실질 부담액', value: fmt(amount + interest) }] };
}
import { customsDuty } from './k9/misc'; export { customsDuty };
export function subscriptionTotal(v: V): CalcResult {
  const subs = [n(v.sub1), n(v.sub2), n(v.sub3), n(v.sub4), n(v.sub5)].filter(s => s > 0);
  const monthly = subs.reduce((a,b) => a+b, 0);
  return { main: { label: '월 구독 합계', value: fmt(monthly) }, details: [{ label: '연간 총액', value: fmt(monthly * 12) }, { label: '구독 수', value: `${subs.length}개` }] };
}
import { militaryPay } from './k9/ext'; export { militaryPay }; // K-9 ext — 본문은 k9/ext.ts
export function gpaConvert(v: V): CalcResult {
  const gpa = n(v.gpa); const scale = Number(v.scale);
  const pct2 = Math.min(100, Math.round((gpa / scale) * 100 * 10) / 10);
  return { main: { label: '백분율', value: `${pct2}점` }, details: [{ label: '환산 기준', value: `${scale} 만점` }] };
}
export function comprehensiveIncomeTax(v: V): CalcResult {
  const income = n(v.totalIncome) - n(v.expenses) - n(v.deductions);
  const tax = Math.max(0, Math.round(calcProgressiveTax(income, INCOME_TAX_BRACKETS)) - n(v.taxCredits));
  const local = Math.round(tax * 0.1);
  return { main: { label: '종합소득세', value: fmt(tax + local) }, details: [{ label: '과세표준', value: fmt(income) }, { label: '소득세', value: fmt(tax) }, { label: '지방소득세', value: fmt(local) }] };
}
import { propertyTax } from './k9/local'; export { propertyTax };
import { registrationCost } from './k9/local'; export { registrationCost };
/**
 * K-9 ⓒ ② — DSR 한도 40% 하드코딩을 걷어내고 «업권별 한도 + 스트레스 금리» 로 (2026-09-16).
 *
 * 예전에는 `ok = dsr <= 40` 하나였다. 두 가지가 틀렸다:
 *   ① 한도는 업권으로 갈린다 — 은행권 40% · 제2금융권 50%(policy_constants confirmed).
 *   ② 스트레스 DSR 을 아예 안 봤다. 실제 심사는 «가산금리를 얹은» 금리로 상환액을 잡는다 —
 *      수도권·규제지역 3.0%p, 지방 비규제 0.75%p. 이걸 빼면 «통과» 라고 말해 놓고
 *      창구에서 거절당한다. 계산기가 낙관을 파는 꼴이다.
 * ⛔ 「대출 가능」이라 단정하지 않는다. 이건 한도 대조지 심사 결과가 아니다.
 */
export function dsrCalc(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const region = (String(v.region ?? 'regulated') as LtvRegion);
  const lender = (String(v.lender ?? 'bank') as 'bank' | 'nonbank');
  const capPct = pack?.pct?.[dsrPolicyKey(lender)];
  // ⛔ 2026-09-17 수리 — 스트레스 가산 = 스트레스 금리 × 적용비율. 지방 2단계는 1.5% × 50% = 0.75%p.
  //    옛 코드는 행의 첫 원소(1.5)만 얹어 지방 가산을 2배로 잡았다. 비율 행이 없으면 100% 로 «가정하지 않고» 미적용으로 말한다.
  const stressRate = pack?.pct?.[stressDsrKey(region)];
  const stressRatio = pack?.pct?.[`${stressDsrKey(region)}_ratio`];
  const stressPct = typeof stressRate === 'number' && typeof stressRatio === 'number'
    ? Math.round(stressRate * stressRatio) / 100 : undefined;

  if (typeof capPct !== 'number') {
    return {
      main: { label: '규제 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: 'DSR 한도 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }

  const income = n(v.annualIncome);
  const loan = n(v.newLoan);
  const years = n(v.newYears);
  const months = years * 12;
  const baseRate = n(v.newRate);
  // ⚠️ 스트레스 금리를 «얹은» 금리로 상환액을 잡는다. 못 받았으면 0 이 아니라 «미적용» 으로 말한다.
  const applied = baseRate + (typeof stressPct === 'number' ? stressPct : 0);
  const r = applied / 100 / 12;
  const monthlyRepay = months <= 0 ? 0
    : r > 0 ? loan * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)
    : loan / months;
  const annualRepay = monthlyRepay * 12 + n(v.existingAnnualRepay);
  const dsr = income > 0 ? (annualRepay / income) * 100 : 0;
  const within = dsr <= capPct;

  const cm = pack?.meta?.[dsrPolicyKey(lender)] ?? {};
  const sm = pack?.meta?.[stressDsrKey(region)] ?? {};
  return {
    main: {
      label: 'DSR',
      value: `${dsr.toFixed(1)}%`,
      color: within ? 'var(--accent-green)' : 'var(--accent-red)',
    },
    details: [
      // ⛔ 「대출 가능」이 아니라 «한도 대조» 다. 심사 결과를 약속하지 않는다.
      { label: '한도 대조', value: `${lender === 'bank' ? '은행권' : '제2금융권'} 한도 ${capPct}% ${within ? '이내' : '초과'}` },
      { label: '연간 원리금 상환액', value: fmt(Math.round(annualRepay)) },
      { label: '월 상환액', value: fmt(Math.round(monthlyRepay)) },
      typeof stressPct === 'number'
        ? { label: '적용 금리', value: `${applied.toFixed(2)}% (입력 ${baseRate}% + 스트레스 ${stressRate}% × 적용비율 ${stressRatio}% = ${stressPct}%p)` }
        : { label: '적용 금리', value: `${baseRate}% — ⚠️ 스트레스 금리 «미적용». 실제 심사는 더 엄격하다` },
      ...(sm.item ? [{ label: '스트레스 기준', value: sm.item }] : []),
      ...(cm.source || cm.date ? [{ label: '근거', value: [cm.source, cm.date].filter(Boolean).join(' · ') }] : []),
      ...(sm.status && sm.status !== 'confirmed'
        ? [{ label: '⚠️ 상태', value: `스트레스 기준이 «${sm.status}» 다 — 최신 여부를 확인할 것` }] : []),
      { label: '참고', value: '한도 대조 결과이며 실제 승인은 은행 심사·담보·소득 인정 방식에 따라 달라진다' },
    ],
  };
}
export function jeonseVsWolse(v: V): CalcResult {
  const js = n(v.jeonse); const jRate = n(v.jeonseRate)/100;
  const own = n(v.jeonseOwn); const loanAmt = js - own;
  const jCost = loanAmt * jRate + own * (n(v.investReturn)/100); // 대출이자 + 기회비용
  const wDep = n(v.wolseDeposit); const wRent = n(v.wolseRent);
  const wCost = wRent * 12 + wDep * (n(v.investReturn)/100 - 0); // 월세 + 보증금 기회비용
  const diff = Math.round(jCost - wCost);
  const better = diff < 0 ? '전세 유리' : '월세 유리';
  return { main: { label: better, value: `연 ${fmt(Math.abs(diff))} 차이` }, details: [{ label: '전세 연간 비용', value: fmt(Math.round(jCost)) }, { label: '월세 연간 비용', value: fmt(Math.round(wCost)) }] };
}
import { yearEndRefund } from './k9/misc'; export { yearEndRefund };
import { creditCardDeduction } from './k9/misc'; export { creditCardDeduction };
import { monthlyRentDeduction } from './k9/misc'; export { monthlyRentDeduction };
import { inheritanceTax } from './k9/inh'; export { inheritanceTax }; // K-9 inh — 본문은 k9/inh.ts
export function vatCalc(v: V): CalcResult {
  const amount = n(v.amount);
  if (v.direction === 'addVat') {
    const vat = Math.round(amount * 0.1);
    return { main: { label: 'VAT 포함 금액', value: fmt(amount + vat) }, details: [{ label: '공급가액', value: fmt(amount) }, { label: 'VAT (10%)', value: fmt(vat) }] };
  } else {
    const supply = Math.round(amount / 1.1);
    const vat = amount - supply;
    return { main: { label: '공급가액', value: fmt(supply) }, details: [{ label: 'VAT', value: fmt(vat) }, { label: 'VAT 포함 금액', value: fmt(amount) }] };
  }
}

// ═══ 추가 공식 (2차 배치) ═══

export function earnedIncomeTax(v: V): CalcResult {
  const m = n(v.monthlySalary); const fam = n(v.family);
  // 간이세액표 근사: 연간 소득세 ÷ 12 × 가족 보정
  const annual = m * 12;
  const taxBase = Math.max(0, annual - (fam * 1500000) - 5000000);
  const tax = Math.round(calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS) / 12);
  const local = Math.round(tax * 0.1);
  return { main: { label: '월 원천징수세액', value: fmt(tax + local) }, details: [{ label: '소득세', value: fmt(tax) }, { label: '지방소득세', value: fmt(local) }] };
}
import { retirementIncomeTax } from './k9/fin'; export { retirementIncomeTax };
export function otherIncomeTax(v: V): CalcResult {
  const gross = n(v.grossIncome);
  const rate = v.expenseRate === 'actual' ? 0 : Number(v.expenseRate) / 100;
  const expense = v.expenseRate === 'actual' ? n(v.actualExpense) : Math.round(gross * rate);
  const income = Math.max(0, gross - expense);
  const tax = Math.round(income * 0.2); const local = Math.round(tax * 0.1);
  if (income <= 3000000) return { main: { label: '기타소득세 (분리과세)', value: fmt(tax + local) }, details: [{ label: '소득금액', value: fmt(income) }, { label: '필요경비', value: fmt(expense) }] };
  return { main: { label: '기타소득세', value: fmt(tax + local) }, details: [{ label: '소득금액', value: fmt(income) }, { label: '주의', value: '300만원 초과 시 종합소득세 합산 가능' }] };
}
export function interestTax(v: V): CalcResult {
  const interest = n(v.interest);
  // K-9 ⓒ — deposit-interest 와 같은 모델·같은 상수(policy_constants)·같은 계산(interestTaxParts).
  //   ⛔ 옛 「세금우대 9.5%」(세금우대종합저축 화석) 제거.
  const taxType = (['general', 'mutual', 'taxFreeSavings'].includes(String(v.taxType)) ? v.taxType : 'general') as DepositTaxType;
  const row = depositTaxRow(taxType, n(v.joinYear) || 2026, v.eligible !== 'no');
  const farmExempt = v.farmExempt === 'yes';
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  if (interestPolicyMissing(row, P)) {
    return {
      main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '이자 과세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }
  // 이 계산기는 «이자» 만 묻는다 — 원금을 모르니 한도를 가를 수 없다. 전액을 한도 안으로 본다고 화면에 쓴다.
  const special = row.limitKey !== null;
  const t = interestTaxParts(special ? 0 : interest, special ? interest : 0, row, P, farmExempt);
  const details: { label: string; value: string }[] = [{ label: '적용 구분', value: row.label }];
  if (!special) {
    details.push({ label: `소득세 (${t.incomePct}%)`, value: fmt(t.genIncome) });
    details.push({ label: `지방소득세 (소득세의 ${t.localPct}%)`, value: fmt(t.genLocal) });
  } else {
    details.push(t.spPct > 0
      ? { label: `특례 소득세 (${t.spPct}% 분리과세)`, value: fmt(t.spIncome) }
      : { label: '특례 소득세', value: '비과세' });
    if (taxType === 'mutual') {
      details.push({ label: '특례 지방소득세', value: '부과하지 않는다 — 조특법 §89의3' });
      details.push(farmExempt
        ? { label: '농어촌특별세', value: '면제 — 농어민·임업인·저소득 근로자(농특세령 §4⑦3)' }
        : { label: `농어촌특별세 (${t.farmPct.toFixed(1)}%)`, value: fmt(t.spFarm) });
    } else {
      details.push({ label: '농어촌특별세', value: '없음 — 농특세법 §4 비과세 목록(§88의2)' });
    }
    details.push({ label: '⚠️ 한도 가정', value: '원금이 특례 한도 안이라고 보고 계산했다 — 넘으면 초과분은 일반 과세다. 원금으로 나눠 보려면 예적금 이자 계산기' });
  }
  details.push({ label: '세후 이자', value: fmt(interest - t.tax) });
  const m = pack?.meta?.[row.incomeKey ?? row.limitKey ?? 'int_tax_income'];
  if (m?.source || m?.date) details.push({ label: '근거', value: [m.source, m.date].filter(Boolean).join(' · ') });
  return { main: { label: '이자 관련 세금 합계', value: fmt(t.tax) }, details };
}
export function incomeBracketLookup(v: V): CalcResult {
  const base = n(v.taxBase);
  const tax = Math.round(calcProgressiveTax(base, INCOME_TAX_BRACKETS));
  const effectiveRate = base > 0 ? tax / base : 0;
  let bracket = '6%';
  if (base > 1000000000) bracket = '45%'; else if (base > 500000000) bracket = '42%';
  else if (base > 300000000) bracket = '40%'; else if (base > 150000000) bracket = '38%';
  else if (base > 88000000) bracket = '35%'; else if (base > 50000000) bracket = '24%';
  else if (base > 14000000) bracket = '15%';
  return { main: { label: '소득세', value: fmt(tax) }, details: [{ label: '적용 최고세율', value: bracket }, { label: '실효세율', value: pct(effectiveRate) }, { label: '지방소득세 포함', value: fmt(Math.round(tax * 1.1)) }] };
}
export function localIncomeTax(v: V): CalcResult {
  const tax = n(v.incomeTax);
  return { main: { label: '지방소득세', value: fmt(Math.round(tax * 0.1)) }, details: [{ label: '소득세', value: fmt(tax) }, { label: '합계 (소득세+지방소득세)', value: fmt(Math.round(tax * 1.1)) }] };
}
import { simplifiedVat } from './k9/misc'; export { simplifiedVat };
import { corporateTax } from './k9/corp'; export { corporateTax }; // K-9 inh — 본문은 k9/corp.ts
import { penaltyTax } from './k9/fin'; export { penaltyTax };
export function expenseRateLookup(v: V): CalcResult {
  const rev = n(v.revenue); const rate = n(v.rate) / 100;
  const income = Math.round(rev * (1 - rate));
  return { main: { label: '추정 소득금액', value: fmt(income) }, details: [{ label: '총 수입', value: fmt(rev) }, { label: '경비율', value: pct(rate) }, { label: '추정 필요경비', value: fmt(Math.round(rev * rate)) }] };
}
import { medicalDeduction } from './k9/misc'; export { medicalDeduction };
import { educationDeduction } from './k9/misc'; export { educationDeduction };
import { donationDeduction } from './k9/misc'; export { donationDeduction };
import { insuranceDeduction } from './k9/misc'; export { insuranceDeduction };
import { childCredit } from './k9/ext'; export { childCredit }; // K-9 ext — 본문은 k9/ext.ts
export function housingFundDeduction(v: V): CalcResult {
  const sub = Math.min(n(v.subscription), 3000000);
  const mortgage = n(v.mortgageInterest);
  return { main: { label: '주택자금 소득공제', value: fmt(sub + mortgage) }, details: [{ label: '주택청약', value: fmt(sub) }, { label: '주담대 이자', value: fmt(mortgage) }] };
}
import { comprehensivePropertyTax } from './k9/cpt'; export { comprehensivePropertyTax }; // K-9 inh — 본문은 k9/cpt.ts
import { rentalIncomeTax } from './k9/fin'; export { rentalIncomeTax };
import { cryptoTax } from './k9/fin'; export { cryptoTax };
import { etfTax } from './k9/fin'; export { etfTax };
import { isaTaxFree } from './k9/fin'; export { isaTaxFree };
export function childSupport(v: V): CalcResult {
  const fIncome = n(v.fatherIncome); const mIncome = n(v.motherIncome);
  const total = fIncome + mIncome;
  const age = n(v.childAge); const count = n(v.childCount);
  const baseAmount = total <= 4000000 ? 500000 : total <= 6000000 ? 700000 : total <= 8000000 ? 900000 : 1200000;
  const ageMultiplier = age < 6 ? 0.9 : age < 12 ? 1.0 : 1.2;
  const monthly = Math.round(baseAmount * ageMultiplier * count * (fIncome / total));
  return { main: { label: '월 양육비 (추정)', value: fmt(monthly) }, details: [{ label: '부모 합산 소득', value: fmt(total) }, { label: '부담 비율', value: pct(fIncome / total) }] };
}
import { accidentCompensation } from './k9/misc'; export { accidentCompensation };
export function prepaymentFee(v: V): CalcResult {
  const amount = n(v.repayAmount);
  const loanMonths = n(v.loanMonths) || 360;
  const elapsed = Math.max(0, n(v.elapsedMonths));
  const periodIn = n(v.feePeriodMonths) || PREPAY_SOURCE.statutoryMonths;
  // 적용기간은 약정이지만 «3년» 이 법정 상한이다 — 약정이 더 길어도 36개월로 자른다.
  const period = Math.min(periodIn, PREPAY_SOURCE.statutoryMonths);
  // ⛔ 옛 공식은 `amount × rate × remain / total` 에 total = 대출기간 전체(기본 360)를 넣었다.
  //    표준 산식은 «대출기간과 적용기간 중 짧은 쪽» 이 분모다 — 기본 입력에서 10배 과소였다.
  const denom = Math.min(loanMonths, period);
  const remaining = Math.max(0, denom - elapsed);

  const contract = (['pre2025', 'y2025', 'y2026'].includes(String(v.contract)) ? v.contract : 'y2026') as PrepayContract;
  const loan = (['secured', 'otherSecured', 'credit'].includes(String(v.loanType)) ? v.loanType : 'secured') as PrepayLoan;
  const rateType = (v.rateType === 'variable' ? 'variable' : 'fixed') as PrepayRateType;
  const table = PREPAY_RATES[contract][loan][rateType];
  const custom = v.rateMode === 'custom';
  const ratePct = custom ? n(v.feeRate) : table.median;

  const details: { label: string; value: string }[] = [];
  if (elapsed >= PREPAY_SOURCE.statutoryMonths) {
    return {
      main: { label: '중도상환수수료', value: '부과 불가' },
      details: [
        { label: '근거', value: '대출계약 성립일부터 3년이 지났다 — 그 뒤 부과는 불공정영업행위다(금융소비자보호법 §20①4나)' },
        { label: '⚠️ 대환·갱신', value: '사실상 같은 계약으로 갈아탔다면 기존 기간을 합산해 3년을 센다' },
      ],
    };
  }
  const fee = Math.round(amount * (ratePct / 100) * remaining / denom);
  details.push({ label: '적용 요율', value: custom
    ? `${ratePct}% (직접 입력)`
    : `${table.median.toFixed(2)}% — 5대 은행 중앙값 (범위 ${table.min.toFixed(2)}~${table.max.toFixed(2)}%, ${table.basis})` });
  details.push({ label: '잔여 비율', value: `${remaining} / ${denom}개월 (분모 = 대출기간과 적용기간 중 짧은 쪽)` });
  if (!custom) {
    details.push({ label: '요율 범위로 본 수수료', value: `${fmt(Math.round(amount * table.min / 100 * remaining / denom))} ~ ${fmt(Math.round(amount * table.max / 100 * remaining / denom))}` });
  }
  if (periodIn > PREPAY_SOURCE.statutoryMonths) {
    details.push({ label: '⚠️ 적용기간', value: '3년을 넘는 약정은 법정 상한(3년)으로 계산했다' });
  }
  details.push({ label: '⚠️ 요율의 성격', value: '법정값이 아니다 — 은행이 매년 실비용으로 산정해 공시하고 «계약일» 기준으로 적용된다. 약정서 요율이 정본이다' });
  details.push({ label: '⚠️ 은행 기준', value: '저축은행·보험·상호금융은 수준이 다르다 — 그 경우 약정 요율을 직접 넣는다' });
  details.push({ label: '⚠️ 근사', value: '표준 산식은 «일수» 기준이다. 여기서는 개월로 근사했다' });
  details.push({ label: '근거', value: `${PREPAY_SOURCE.disclosure} · 옮겨 적은 날 ${PREPAY_SOURCE.transcribedAt}` });
  return { main: { label: '중도상환수수료', value: fmt(fee) }, details };
}
/**
 * K-2 ② — 지어낸 비율식을 걷어내고 «공사 예시표 보간» 으로 바꿨다 (2026-09-16).
 *
 * 예전: `ratio = 0.02 + (age-55)*0.002` → 70세·5억에서 월 208만원.
 * 공사 표: 같은 조건 153.9만원. 약 35% 과대였다.
 * 그 식에는 근거가 없었고, 결과 화면의 「정확한 수령액은 공사 시뮬레이터 확인」이
 * 그 사실을 이미 자백하고 있었다.
 */
export function housingPension(v: V): CalcResult {
  const rawPrice = n(v.housePrice);
  const age = n(v.age);
  const monthly = pensionMonthly(rawPrice, age);
  if (monthly === null) {
    // ⛔ 0 을 돌려주지 않는다 — 「못 받는다」와 「0원 받는다」는 다른 말이다.
    return {
      main: { label: '가입 대상 아님', value: `만 ${PENSION_MIN_AGE}세부터`, color: 'var(--text-tertiary)' },
      details: [{ label: '기준', value: `부부 중 연소자 만 ${PENSION_MIN_AGE}세 이상` }],
    };
  }
  const capped = rawPrice > PENSION_MAX_PRICE;
  return {
    main: { label: '예상 월 수령액', value: fmt(monthly) },
    details: [
      { label: '인정 주택가격', value: fmt(Math.min(rawPrice, PENSION_MAX_PRICE)) + (capped ? ' (표 상한)' : '') },
      { label: '조건', value: HOUSING_PENSION_SOURCE.conditions },
      { label: '기준', value: `${HOUSING_PENSION_SOURCE.issuer} · ${HOUSING_PENSION_SOURCE.effectiveFrom} 적용분` },
      { label: '참고', value: '예시표를 보간한 값이다. 확정액은 한국주택금융공사 시뮬레이터에서 확인' },
    ],
  };
}
import { retirementPensionSim } from './k9/fin'; export { retirementPensionSim };
import { alcoholCalc } from './k9/misc'; export { alcoholCalc };
export function unitConvert(v: V): CalcResult {
  const val = n(v.value); const cat = v.category as string; const dir = v.direction as string;
  const conversions: Record<string, { aName: string; bName: string; aToB: (x: number) => number; bToA: (x: number) => number }> = {
    length: { aName: 'cm', bName: 'inch', aToB: x => x / 2.54, bToA: x => x * 2.54 },
    weight: { aName: 'kg', bName: 'lb', aToB: x => x * 2.20462, bToA: x => x / 2.20462 },
    temperature: { aName: '°C', bName: '°F', aToB: x => x * 9 / 5 + 32, bToA: x => (x - 32) * 5 / 9 },
  };
  const c = conversions[cat];
  const result = dir === 'aToB' ? c.aToB(val) : c.bToA(val);
  const fromUnit = dir === 'aToB' ? c.aName : c.bName;
  const toUnit = dir === 'aToB' ? c.bName : c.aName;
  return { main: { label: `${result.toFixed(2)} ${toUnit}`, value: `${val} ${fromUnit} =` }, details: [] };
}
export function leaseVsInstallment(v: V): CalcResult {
  const price = n(v.carPrice); const leaseM = n(v.leaseMonthly); const leaseMonths = n(v.leaseMonths);
  const residual = n(v.leaseResidual); const rate = n(v.installRate) / 100 / 12;
  const down = n(v.downPayment); const loanAmt = price - down;
  const leaseCost = leaseM * leaseMonths + residual;
  const installMonthly = rate > 0 ? loanAmt * rate * Math.pow(1 + rate, leaseMonths) / (Math.pow(1 + rate, leaseMonths) - 1) : loanAmt / leaseMonths;
  const installCost = down + installMonthly * leaseMonths;
  const diff = Math.round(leaseCost - installCost);
  return { main: { label: diff > 0 ? '할부가 유리' : '리스가 유리', value: fmt(Math.abs(diff)) + ' 차이' }, details: [{ label: '리스 총비용', value: fmt(Math.round(leaseCost)) }, { label: '할부 총비용', value: fmt(Math.round(installCost)) }] };
}
export function overtimePay(v: V): CalcResult {
  const hw = n(v.hourlyWage);
  const ot = n(v.overtimeHours) * hw * 1.5;
  const night = n(v.nightHours) * hw * 0.5;
  const holiday = n(v.holidayHours) * hw * 1.5;
  const total = Math.round(ot + night + holiday);
  return { main: { label: '추가 수당', value: fmt(total) }, details: [{ label: '연장수당 (150%)', value: fmt(Math.round(ot)) }, { label: '야간수당 (50%)', value: fmt(Math.round(night)) }, { label: '휴일수당 (150%)', value: fmt(Math.round(holiday)) }] };
}
export function annualLeavePay(v: V): CalcResult {
  const monthly = n(v.monthlySalary); const days = n(v.unusedDays);
  const hours = n(v.weeklyHours);
  const dailyWage = monthly / (hours * 52 / 12) * (hours / 5);
  const pay = Math.round(dailyWage * days);
  return { main: { label: '연차수당', value: fmt(pay) }, details: [{ label: '1일 통상임금', value: fmt(Math.round(dailyWage)) }, { label: '미사용 연차', value: `${days}일` }] };
}

// ═══ 3차 배치 공식 ═══

import { capitalGainsLand } from './k9/ext'; export { capitalGainsLand }; // K-9 ext — 본문은 k9/ext.ts
import { multiHouseSim } from './k9/cgt'; export { multiHouseSim }; // K-9 cgt — 본문 이관
export function investmentTypeTest(v: V): CalcResult {
  const score = Number(v.q1) + Number(v.q2) + Number(v.q3);
  const type = score <= 4 ? '안전형' : score <= 6 ? '안정추구형' : score <= 8 ? '위험중립형' : '적극투자형';
  const allocation = score <= 4 ? '예금 70% + 채권 20% + 주식 10%' : score <= 6 ? '예금 40% + 채권 30% + 주식 30%' : score <= 8 ? '예금 20% + 채권 20% + 주식 60%' : '주식 80% + 대안투자 20%';
  return { main: { label: '투자 성향', value: type }, details: [{ label: '추천 포트폴리오', value: allocation }, { label: '점수', value: `${score}/9점` }] };
}
import { dailyWorkerTax } from './k9/fin'; export { dailyWorkerTax }; FORMULAS.dailyWorkerTax = dailyWorkerTax; // K-9 fin — FORMULAS 맵에 빠져 화면에 결과가 안 뜨던 계산기
export function freelancerTax(v: V): CalcResult {
  const rev = n(v.annualRevenue); const rate = n(v.expenseRate) / 100;
  const income = rev * (1 - rate);
  const taxBase = Math.max(0, income - 5000000); // 기본공제 근사
  const tax = Math.round(calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS));
  const local = Math.round(tax * 0.1);
  const withheld = n(v.withheld);
  const refund = withheld - tax - local;
  return { main: { label: refund >= 0 ? '예상 환급' : '추가 납부', value: fmt(Math.abs(Math.round(refund))), color: refund >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }, details: [{ label: '종합소득세', value: fmt(tax) }, { label: '지방소득세', value: fmt(local) }, { label: '기납부 (3.3%)', value: fmt(withheld) }] };
}
export function telecomCompare(v: V): CalcResult {
  const current = n(v.currentPlan); const newPlan = n(v.newPlan);
  const monthSave = current - newPlan;
  return { main: { label: '연간 절약액', value: fmt(monthSave * 12) }, details: [{ label: '월 절약', value: fmt(monthSave) }, { label: '2년 절약', value: fmt(monthSave * 24) }] };
}
export function graduationYear(v: V): CalcResult {
  const y = n(v.birthYear); const m = n(v.birthMonth);
  const earlyBirth = m <= 2;
  const elemEntry = earlyBirth ? y + 6 : y + 7;
  const elemGrad = elemEntry + 5; const midGrad = elemGrad + 3; const highGrad = midGrad + 3;
  const uniGrad = highGrad + 4;
  return { main: { label: '대학 졸업 (예상)', value: `${uniGrad}년 2월` }, details: [{ label: '초등 입학', value: `${elemEntry}년` }, { label: '중학 졸업', value: `${midGrad + 1}년` }, { label: '고등 졸업', value: `${highGrad + 1}년` }, { label: '군 전역 (육군)', value: `${uniGrad - 2 + 2}년` }] };
}
import { giftExemptionLookup } from './k9/inh'; export { giftExemptionLookup }; // K-9 inh — 본문은 k9/inh.ts
import { burdenGift } from './k9/inh'; export { burdenGift }; // K-9 inh — 본문은 k9/inh.ts

// ═══ 4차 최종 배치 공식 ═══

import { capitalGainsRights } from './k9/cgt'; export { capitalGainsRights }; // K-9 cgt — 본문 이관
import { registrationLicenseTax } from './k9/local'; export { registrationLicenseTax };
import { deemedRent } from './k9/fin'; export { deemedRent }; FORMULAS.deemedRent = deemedRent; // K-9 fin — FORMULAS 맵에 빠져 화면에 결과가 안 뜨던 계산기
import { oneHouseCheck } from './k9/cgt'; export { oneHouseCheck }; // K-9 cgt — 본문 이관
export function businessIncomeTax(v: V): CalcResult {
  const income = n(v.revenue) - n(v.expenses);
  const taxBase = Math.max(0, income - 5000000);
  const tax = Math.round(calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS));
  return { main: { label: '사업소득세', value: fmt(Math.round(tax * 1.1)) }, details: [{ label: '사업소득', value: fmt(income) }, { label: '과세표준', value: fmt(taxBase) }] };
}
import { pensionIncomeTax } from './k9/fin'; export { pensionIncomeTax }; FORMULAS.pensionIncomeTax = pensionIncomeTax; // K-9 fin — FORMULAS 맵에 빠져 화면에 결과가 안 뜨던 계산기
import { dividendIncomeTax } from './k9/fin'; export { dividendIncomeTax }; FORMULAS.dividendIncomeTax = dividendIncomeTax; // K-9 fin — FORMULAS 맵에 빠져 화면에 결과가 안 뜨던 계산기
import { majorShareholderCgt } from './k9/cgt'; export { majorShareholderCgt }; // K-9 cgt — 본문 이관
export function foreignDividendCredit(v: V): CalcResult {
  const foreign = n(v.foreignTax); const domestic = n(v.domesticTax);
  const credit = Math.min(foreign, domestic);
  return { main: { label: '외국납부세액공제', value: fmt(credit) }, details: [{ label: '외국 원천세', value: fmt(foreign) }, { label: '국내 산출세액', value: fmt(domestic) }, { label: '한도', value: '국내 산출세액 이내' }] };
}
import { fisTaxSim } from './k9/fin'; export { fisTaxSim }; FORMULAS.fisTaxSim = fisTaxSim; // K-9 fin — FORMULAS 맵에 빠져 화면에 결과가 안 뜨던 계산기
import { familyBusiness } from './k9/inh'; export { familyBusiness }; // K-9 inh — 본문은 k9/inh.ts
import { generationSkip } from './k9/inh'; export { generationSkip }; // K-9 inh — 본문은 k9/inh.ts
import { withholdingCalc } from './k9/fin'; export { withholdingCalc }; FORMULAS.withholdingCalc = withholdingCalc; // K-9 fin — FORMULAS 맵에 빠져 화면에 결과가 안 뜨던 계산기
import { stampTax } from './k9/local'; export { stampTax };
export function simpleBookkeeping(v: V): CalcResult {
  const income = n(v.revenue) - n(v.expenses);
  return { main: { label: '소득금액', value: fmt(Math.max(0, income)) }, details: [{ label: '총수입', value: fmt(n(v.revenue)) }, { label: '필요경비', value: fmt(n(v.expenses)) }] };
}
/**
 * K-9 ⓒ ② — LTV 를 «사용자가 입력하는 곱셈기» 에서 «조건으로 정해지는 계산기» 로 (2026-09-16).
 *
 * 예전에는 LTV 퍼센트를 사람이 직접 넣었다. 그러면 정작 사람들이 알고 싶은 것
 * — 「내 조건에서 LTV 가 몇 %인가」 — 은 답하지 않는 곱셈기였다.
 * 검색량 실측 38,200(중간 경쟁). 규제 상수는 policy_constants 에 confirmed 로 이미 있었다.
 *
 * ⛔ 퍼센트를 여기 적지 않는다. 대출 규제는 대책마다 바뀐다 — 서버가 표를 읽어 주입한다.
 * ⛔ 주입이 없거나 해당 조건의 행이 없으면 «지어내지 않는다».
 */
export function ltvCalc(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const region = (String(v.region ?? 'regulated') as LtvRegion);
  const owner = (String(v.owner ?? 'none') as LtvOwner);
  const key = ltvPolicyKey(region, owner);
  const ratePct = pack?.pct?.[key];

  if (typeof ratePct !== 'number') {
    return {
      main: { label: '규제 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '이 조건의 LTV 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }

  const price = n(v.housePrice);
  const existing = n(v.existingLoan);
  const ltvLoan = Math.max(0, Math.round(price * (ratePct / 100) - existing));
  // A2 (2026-09-17) — 수도권·규제지역 주택구입목적 주담대는 «가격별 최대 한도» 가 LTV 와 «별도로» 걸린다
  //   (policy_constants mortgage_cap_*: 15억 이하 6억 / 15억 초과~25억 이하 4억 / 25억 초과 2억, 2025-10-16~).
  //   ⛔ 옛 코드는 이 행을 읽지 않았다 — 규제지역 무주택 시가 20억 → 8억(실제 4억).
  const capKey = region === 'local_nonreg' ? null
    : price <= 1_500_000_000 ? 'mortgage_cap_15eok_under'
    : price <= 2_500_000_000 ? 'mortgage_cap_15_25eok'
    : 'mortgage_cap_25eok_over';
  const capAmt = capKey ? pack?.amt?.[capKey] : undefined;
  const maxLoan = typeof capAmt === 'number' ? Math.min(ltvLoan, capAmt) : ltvLoan;
  const m = pack?.meta?.[key] ?? {};
  const details: { label: string; value: string }[] = [
    { label: '적용 LTV', value: `${ratePct}%` },
    ...(m.item ? [{ label: '적용 기준', value: m.item }] : []),
    { label: '기존 대출 차감', value: fmt(existing) },
  ];
  if (capKey && ratePct > 0) {
    if (typeof capAmt === 'number') {
      const cm = pack?.meta?.[capKey] ?? {};
      details.push({ label: '가격별 최대 한도', value: `${fmt(capAmt)}${cm.item ? ` — ${cm.item}` : ''}${maxLoan < ltvLoan ? ` · LTV 금액 ${fmt(ltvLoan)}보다 작아 이 한도가 적용됐다` : ''}` });
    } else {
      details.push({ label: '⚠️ 가격별 한도', value: '수도권·규제지역 가격별 주담대 최대 한도 기준을 받지 못했다 — 아래 금액은 LTV 만 반영했다' });
    }
  }
  if (ratePct === 0) {
    details.unshift({ label: '판단', value: '이 조건은 주택구입목적 주택담보대출이 «허용되지 않는다»' });
  }
  if (owner === 'disposal') {
    details.push({ label: '조건', value: '처분조건부는 기한 내 기존주택을 처분해야 무주택과 같은 한도가 유지된다' });
  }
  // ⚠️ 기준일·출처를 함께 낸다. 날짜 없는 규제 수치는 거짓 신선도다.
  if (m.source || m.date) {
    details.push({ label: '근거', value: [m.source, m.date].filter(Boolean).join(' · ') });
  }
  if (m.status && m.status !== 'confirmed') {
    details.push({ label: '⚠️ 상태', value: `이 값은 «${m.status}» 다 — 최신 여부를 확인할 것` });
  }
  details.push({ label: '참고', value: 'LTV 한도이며 실제 대출은 DSR·소득·은행 심사에 따라 더 낮을 수 있다' });

  return { main: { label: '대출 가능액(LTV 한도)', value: fmt(maxLoan) }, details };
}
/**
 * K-2 ① — 단일 매입률(수도권 5% / 그 외 3%)을 «구간별 누진표» 로 바꾸고,
 *          고정 할인율 상수(0.04)를 «입력» 으로 바꿨다 (2026-09-16).
 *
 * 예전 값의 오차: 5억·특별시에서 5.0% vs 법정 2.6% — 약 2배 과대였다.
 * 할인율을 상수로 박은 것은 거짓 신선도였다 — 시장금리를 따라 «매일» 고시되는 값이다.
 *
 * 구조: 법으로 «확정되는» 매입금액이 주인공이고, 시장에서 «변하는» 실부담은
 *       오늘의 숫자를 받았을 때만 낸다. 모르는 값을 지어내서 채우지 않는다.
 */
export function housingBond(v: V): CalcResult {
  const price = n(v.housePrice);
  const metro = v.region === 'metro';
  const perMille = bondRatePerMille(price, metro);

  if (perMille === null) {
    return {
      main: { label: '매입률 미확인', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '이 구간·지역의 매입률이 상수표에 없다. 값을 채운 뒤 다시 계산한다' }],
    };
  }
  if (perMille === 0) {
    return {
      main: { label: '채권 매입금액', value: fmt(0) },
      details: [{ label: '사유', value: '시가표준액 2,000만원 미만은 매입 대상이 아니다' }],
    };
  }

  const bondAmount = Math.round(price * perMille / 1000);
  const discountPct = n(v.discountRate);   // 당일 고시 할인율(%). 0 = 미입력
  const details: { label: string; value: string }[] = [
    { label: '적용 매입률', value: `${perMille}/1,000 (${(perMille / 10).toFixed(1)}%)` },
    { label: '지역 구분', value: metro ? '특별시·광역시' : '그 밖의 지역' },
    { label: '전제', value: '매매로 인한 소유권 이전등기 · 주택' },
    { label: '기준', value: `${HOUSING_BOND_SOURCE.law} · ${HOUSING_BOND_SOURCE.transcribedAt} 기준` },
  ];

  if (discountPct > 0) {
    const actualCost = Math.round(bondAmount * discountPct / 100);
    details.unshift({ label: '즉시매도 시 실부담', value: `${fmt(actualCost)} (할인율 ${discountPct}%)` });
  } else {
    // ⛔ 기본값으로 아무 숫자나 채우지 않는다. 모르면 어디서 보는지 알려 준다.
    details.unshift({ label: '즉시매도 실부담', value: '당일 고시 할인율을 입력하면 계산된다 (주택도시기금 홈페이지)' });
  }

  return { main: { label: '채권 매입금액', value: fmt(bondAmount) }, details };
}
export function farBcr(v: V): CalcResult {
  const land = n(v.landArea); const building = n(v.buildingArea); const total = n(v.totalFloorArea);
  const bcr = land > 0 ? (building / land) * 100 : 0;
  const far = land > 0 ? (total / land) * 100 : 0;
  return { main: { label: '건폐율 / 용적률', value: `${bcr.toFixed(1)}% / ${far.toFixed(1)}%` }, details: [{ label: '건폐율', value: `${bcr.toFixed(1)}%` }, { label: '용적률', value: `${far.toFixed(1)}%` }] };
}
/**
 * 경매 수익률 — K-9 ⓒ 「등」 분해 (2026-09-17)
 *
 * ⛔ 옛 코드는 한 줄이었다: `bid * 0.05  // 취득세 등 5%`
 *    문제는 5%가 아니라 «등» 이다. 그 한 글자 안에 취득세·지방교육세·농어촌특별세·
 *    등기비·법무비·명도비·중개비가 뭉쳐 있었고, 무엇이 들었고 무엇이 빠졌는지
 *    코드도 화면도 말하지 않았다. 사용자가 명도비를 따로 더하면 «이중계상»,
 *    안 더하면 «증발» 이다. 둘 중 하나가 반드시 일어나는데 어느 쪽인지 알 수가 없다 —
 *    그게 뭉뚱그림의 실제 값이다. 그래서 «가른다»: 세금은 실값으로, 나머지는 별도 입력으로.
 *    ⚠️ 게다가 5%는 어느 물건에도 맞지 않는다. 주택 1주택 6억 이하 85㎡ 이하면 1.1%,
 *       주택 외면 4.6%, 12% 중과 85㎡ 초과면 13.4% 다. 평균도 아니고 출처도 없다.
 *
 * ⛔ 두 번째 정정 — 감정가는 시세가 아니다.
 *    옛 코드는 `수익 = 감정가 − 총투자비` 였다. 감정평가는 매각기일보다 6~12개월 «전» 에
 *    이뤄지고 유찰이 거듭될수록 그 격차가 벌어진다. 감정가를 출구가격으로 쓰면
 *    상승장에선 수익을 과소, 하락장에선 과대 계상한다. 출구가격은 «따로 묻는다».
 *    ⚠️ 낙찰가율만은 정의상 감정가 대비이므로 그 자리엔 감정가를 그대로 쓴다.
 *
 * ⚠️ 과세표준은 감정가가 아니라 «낙찰가» 다 — 경매는 실제 취득가액이 곧 매각대금이다.
 */
/**
 * 세율 표기 — 유효자리만 남긴다.
 * ⚠️ `toFixed(n)` 을 고정으로 쓰면 1% 가 「1.000%」로, 사잇세율 1.6667% 가 「1.7%」로 나온다.
 *    앞은 지저분하고 뒤는 «틀리다». 법정 자리(넷째)까지 재고 꼬리 0 만 떤다.
 */
function ratePct(p: number): string {
  return String(Number(p.toFixed(4)));
}

export function auctionProfit(v: V): CalcResult {
  const appraisal = n(v.appraisal);
  const bid = n(v.bidPrice);
  // 비워 두면 감정가로 떨어진다 — 옛 동작과 같은 자리라 화면이 갑자기 달라지지 않는다.
  const market = n(v.marketPrice) || appraisal;
  const repair = n(v.repairCost);
  const other = n(v.otherCosts);
  const isHouse = (v.propertyType ?? 'house') === 'house';
  const pack = parsePolicyPack(v.__policy);
  const notes: { label: string; value: string }[] = [];

  let acqPct = 0, eduPct = 0, farmPct = 0;
  let pendingSource = false;
  if (isHouse) {
    const houseCount = n(v.houseCount) || 1;
    const regulated = v.regulated === 'yes';
    // 취득세 계산기와 «같은» 파이프를 탄다. 세율 정본은 policy_constants 하나뿐이다.
    const key = acqTaxPolicyKey(houseCount, regulated, bid);
    // ⚠️ 6~9억 행은 numbers 첫 원소가 「6억원」이라 파서가 pct 가 아니라 amt 로 싣는다 — 산식 구간이므로 «행 존재» 로 판정.
    const fromDb = key === 'acq_tax_1house_6_9eok' && pack?.meta?.[key] ? 1 : pack?.pct?.[key];
    if (typeof fromDb !== 'number') {
      return {
        main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
        details: [{ label: '사유', value: '이 조건의 취득세율 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
      };
    }
    acqPct = key === 'acq_tax_1house_6_9eok' ? acqTaxMidRatePct(bid) : fromDb;
    const heavy: 'none' | 'heavy8' | 'heavy12' =
      key === 'acq_tax_heavy_12' ? 'heavy12' : key === 'acq_tax_heavy_8' ? 'heavy8' : 'none';
    const s = acqSurtaxPct(acqPct, heavy, v.area85 === 'over');
    eduPct = s.eduPct; farmPct = s.farmPct;
    const m = (pack?.meta?.[key] ?? {}) as { item?: string; source?: string; date?: string };
    if (m.item) notes.push({ label: '취득세 구간', value: m.item });
    if (m.source || m.date) notes.push({ label: '세율 근거', value: [m.source, m.date].filter(Boolean).join(' · ') });
  } else {
    // 주택 외(상가·토지·오피스텔) 유상취득 — 아직 policy_constants 에 «행이 없다».
    //   지방세법 §11①⑦ 4% · 지방교육세 §151① 0.4% · 농특세법 §5① 0.2% = 4.6%.
    //   옮겨 적은 값이 아니라 코드 상수이므로, 화면이 그 사실을 말한다.
    pendingSource = true;
    acqPct = 4.0; eduPct = 0.4; farmPct = 0.2;
  }

  const acqTax = Math.round(bid * acqPct / 100);
  const eduTax = Math.round(bid * eduPct / 100);
  const farmTax = Math.round(bid * farmPct / 100);
  const taxTotal = acqTax + eduTax + farmTax;

  const totalCost = bid + taxTotal + repair + other;
  const profit = market - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const details: { label: string; value: string }[] = [
    { label: '총 투자비', value: fmt(totalCost) },
    { label: '예상 수익', value: fmt(profit) },
    { label: '낙찰가', value: fmt(bid) },
    { label: `취득세 (${ratePct(acqPct)}%)`, value: fmt(acqTax) },
    { label: `지방교육세 (${ratePct(eduPct)}%)`, value: fmt(eduTax) },
    {
      label: '농어촌특별세',
      // ⚠️ 0 을 「0원」으로만 쓰면 «면제» 인지 «빠뜨림» 인지 구분되지 않는다. 사유를 쓴다.
      value: farmPct > 0 ? `${fmt(farmTax)} (${farmPct.toFixed(1)}%)`
        : isHouse ? '해당 없음 — 전용 85㎡ 이하는 비과세' : fmt(farmTax),
    },
    { label: '세금 합계', value: `${fmt(taxTotal)} (낙찰가의 ${((taxTotal / (bid || 1)) * 100).toFixed(2)}%)` },
    { label: '수리비', value: fmt(repair) },
    {
      label: '기타 부대비용',
      // ⛔ 여기에 «대표값» 을 넣지 않는다. 명도비는 0원인 물건과 수천만원인 물건이 같이 있고,
      //    평균을 지어내면 그게 바로 옛 「등 5%」와 같은 죄다. 비어 있으면 비었다고 쓴다.
      value: other > 0 ? fmt(other) : '0 — 등기·법무·명도·체납관리비·중개보수는 직접 넣는다',
    },
    { label: '낙찰가율', value: appraisal > 0 ? `${((bid / appraisal) * 100).toFixed(1)}%` : '—' },
    ...notes,
    // ⚠️ 다섯째 항목이 «인수 권리» 다. 앞의 넷과 성질이 다르다 —
    //    양도세·대출이자·보유세는 취득 «이후» 의 비용이라 총투자비 밖에서 새는 값이지만,
    //    대항력 있는 임차보증금·유치권 같은 인수액은 지방세법상 취득가격에 «가산» 된다.
    //    즉 있으면 세금과 투자비가 «둘 다» 커진다. 낙찰가만 보고 세금을 재면 그만큼 과소다.
    //    입력화는 2차 — 지금은 빠졌다는 사실만 정확히 말한다.
    { label: '⚠️ 미반영', value: '양도소득세·대출이자·보유세·인수 권리(대항력 임차보증금·유치권 등)는 이 계산에 들어 있지 않다' },
    { label: '⚠️ 인수 권리', value: '인수액은 취득가격에 가산되므로 있으면 세금과 총투자비가 «둘 다» 커진다 — 매각물건명세서를 확인한다' },
  ];
  if (market === appraisal && n(v.marketPrice) === 0) {
    details.push({ label: '⚠️ 출구가격', value: '예상 매도가를 비워 감정가로 계산했다 — 감정평가는 매각기일 6~12개월 전 시점이다' });
  }
  if (pendingSource) {
    details.push({ label: '⚠️ 근거', value: '주택 외 취득세율은 아직 상수표 밖이다 — 코드 값(4.6%)을 쓰는 중이다' });
  }

  return { main: { label: '예상 수익률', value: `${roi.toFixed(1)}%` }, details };
}
export function dripSim(v: V): CalcResult {
  const inv = n(v.investment); const yr = n(v.yieldRate) / 100; const gr = n(v.growthRate) / 100;
  const years = n(v.years);
  let assets = inv; let currentYield = yr;
  const data: number[] = [];
  for (let i = 1; i <= years; i++) {
    const dividend = assets * currentYield;
    assets += dividend; // 재투자
    currentYield *= (1 + gr);
    data.push(Math.round(assets));
  }
  const totalInvested = inv;
  return { main: { label: '최종 자산', value: fmt(Math.round(assets)) }, details: [{ label: '원금', value: fmt(totalInvested) }, { label: '수익', value: fmt(Math.round(assets - totalInvested)) }, { label: `${years}년 후 배당수익률`, value: pct(currentYield) }] };
}
export function shortSelling(v: V): CalcResult {
  const sell = n(v.sellPrice); const buy = n(v.buyPrice); const qty = n(v.quantity);
  const borrow = n(v.borrowFee) / 100; const days = n(v.days);
  // K-9 ⓒ — 한 계산기에 파이프 «둘» 이 걸린 첫 사례(계산기:파이프 = 1:1 가정 금지).
  //   · 위탁수수료 — 시장값 공개형. 옛 상수 0.00015 는 증권사·매체별로 크게 갈리는 값을 한 숫자로 박은 것이라
  //     입력으로 돌리고, 기본값이 «예시» 임을 화면에 쓴다.
  //   · 증권거래세 — 법정 파이프(sec_tax_*). 옛 코드에는 «아예 없었다». 최대 비용항이 통째로 빠져 있던 것.
  //     ⚠️ 매도 «편도» 만: 공매도 개시 매도에 붙고, 상환(환매) 매수에는 붙지 않는다.
  const feePct = v.fee === undefined || v.fee === '' ? 0.015 : n(v.fee);
  const market = (v.market === 'kosdaq' ? 'kosdaq' : 'kospi') as StockMarket;
  const pack = parsePolicyPack(v.__policy);
  const keys = secTaxKeys(market);
  const tradePct = keys.trade ? pack?.pct?.[keys.trade] : undefined;
  const farmPct = keys.farm ? pack?.pct?.[keys.farm] : 0;
  if (typeof tradePct !== 'number' || typeof farmPct !== 'number') {
    return {
      main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
      details: [{ label: '사유', value: '증권거래세율 기준을 아직 받지 못했다. 잠시 후 다시 시도한다' }],
    };
  }
  const sellBase = sell * qty;
  const gross = (sell - buy) * qty;
  const borrowFee = Math.round(sellBase * borrow * days / 365);
  const sellCommission = Math.round(sellBase * feePct / 100);
  const buyCommission = Math.round(buy * qty * feePct / 100);
  const tradeTax = Math.round(sellBase * tradePct / 100);
  const farmTax = Math.round(sellBase * farmPct / 100);
  const net = gross - borrowFee - sellCommission - buyCommission - tradeTax - farmTax;
  const m = keys.trade ? (pack?.meta?.[keys.trade] ?? {}) : {};
  return {
    main: { label: '공매도 순수익', value: fmt(net), color: net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
    details: [
      { label: '매도차익', value: fmt(gross) },
      { label: '대차료', value: fmt(borrowFee) },
      { label: `위탁수수료 (${feePct}% × 매도·환매)`, value: fmt(sellCommission + buyCommission) },
      // ⛔ 합계 한 줄로 뭉개지 않는다 — stockRoi 와 같은 성분 표기.
      { label: `증권거래세 (${tradePct.toFixed(2)}% · 매도분만)`, value: fmt(tradeTax) },
      ...(keys.farm ? [{ label: `농어촌특별세 (${farmPct.toFixed(2)}%)`, value: fmt(farmTax) }] : []),
      { label: '환매 매수', value: '증권거래세 없음 — 매도에만 붙는다' },
      { label: '⚠️ 수수료율', value: '증권사·매체별로 다르다. 기본값 0.015% 는 예시값이다 — 본인 계좌 약정 요율을 넣는다' },
      ...(m.source || m.date ? [{ label: '근거', value: [m.source, m.date].filter(Boolean).join(' · ') }] : []),
    ],
  };
}
export function rebalanceCalc(v: V): CalcResult {
  const total = n(v.totalAsset);
  const stockCurrent = total * n(v.stock) / 100;
  const stockTarget = total * n(v.stockTarget) / 100;
  const bondCurrent = total * n(v.bond) / 100;
  const bondTarget = total * n(v.bondTarget) / 100;
  const stockDiff = stockTarget - stockCurrent;
  const bondDiff = bondTarget - bondCurrent;
  return { main: { label: '리밸런싱 필요', value: stockDiff > 0 ? `주식 ${fmt(Math.round(stockDiff))} 매수` : `주식 ${fmt(Math.round(Math.abs(stockDiff)))} 매도` }, details: [{ label: '주식 조정', value: `${stockDiff > 0 ? '+' : ''}${fmt(Math.round(stockDiff))}` }, { label: '채권 조정', value: `${bondDiff > 0 ? '+' : ''}${fmt(Math.round(bondDiff))}` }] };
}
import { severanceCalc } from './k9/a2'; export { severanceCalc }; // K-9 A″ a2 — 감사 후 본문 이관
import { minimumWage } from './k9/ext'; export { minimumWage }; // K-9 ext — 본문은 k9/ext.ts
import { jeonseLoan } from './k9/a2'; export { jeonseLoan }; // K-9 A″ a2 — 감사 후 본문 이관
export function refinanceCompare(v: V): CalcResult {
  const bal = n(v.balance); const curr = n(v.currentRate) / 100; const newR = n(v.newRate) / 100;
  const fee = n(v.refinanceFee);
  const annualSaving = Math.round(bal * (curr - newR));
  const breakEvenMonths = annualSaving > 0 ? Math.ceil(fee / (annualSaving / 12)) : 999;
  return { main: { label: '연간 이자 절감', value: fmt(annualSaving) }, details: [{ label: '대환 수수료', value: fmt(fee) }, { label: '손익분기', value: `${breakEvenMonths}개월` }] };
}
export function creditLoanEst(v: V): CalcResult {
  const income = n(v.annualIncome);
  const multiplier: Record<string, number> = { '1': 3.0, '3': 2.5, '5': 2.0, '7': 1.0 };
  const mult = multiplier[v.creditGrade as string] || 2.0;
  const limit = Math.round(income * mult);
  return { main: { label: '추정 한도', value: fmt(limit) }, details: [{ label: '연소득 대비', value: `${mult}배` }, { label: '참고', value: '실제 한도는 은행 심사 기준에 따라 다름' }] };
}
export function retirementExpense(v: V): CalcResult {
  const monthly = n(v.monthlyExpense); const retire = n(v.retireAge);
  const life = n(v.lifeExpectancy); const inf = n(v.inflation) / 100;
  const years = life - retire;
  let total = 0;
  for (let i = 0; i < years; i++) total += monthly * 12 * Math.pow(1 + inf, i);
  return { main: { label: '총 필요자금', value: fmt(Math.round(total)) }, details: [{ label: '은퇴 후 기간', value: `${years}년` }, { label: '월 생활비 (현재)', value: fmt(monthly) }, { label: `${years}년 후 월 생활비`, value: fmt(Math.round(monthly * Math.pow(1 + inf, years))) }] };
}
export function pensionVsLump(v: V): CalcResult {
  const total = n(v.totalAmount); const years = n(v.pensionYears); const ret = n(v.investReturn) / 100;
  const monthlyPension = total / (years * 12);
  const totalPension = monthlyPension * 12 * years;
  const lumpInvested = total * Math.pow(1 + ret, years);
  return { main: { label: lumpInvested > totalPension ? '일시금+투자 유리' : '연금 수령 유리', value: fmt(Math.round(Math.abs(lumpInvested - totalPension))) + ' 차이' }, details: [{ label: '연금 총 수령', value: fmt(Math.round(totalPension)) }, { label: '일시금 투자 후', value: fmt(Math.round(lumpInvested)) }] };
}
import { isaConversion } from './k9/ext'; export { isaConversion }; // K-9 ext — 본문은 k9/ext.ts
export function carInsuranceEst(v: V): CalcResult {
  const carAge = n(v.carAge); const age = n(v.driverAge); const price = n(v.carPrice); const safe = n(v.accidentFree);
  // A1 — 시장값 공개형. 아래 계수는 «카더라 가정» 이다(보험사 요율 아님). 옛 화면은 이 사실을 말하지 않았다.
  const base = price * 0.035;
  const ageFactor = age < 26 ? 1.5 : age < 30 ? 1.2 : age > 65 ? 1.3 : 1.0;
  const carFactor = Math.max(0.5, 1 - carAge * 0.05);
  const safeFactor = Math.max(0.7, 1 - safe * 0.05);
  const est = Math.round(base * ageFactor * carFactor * safeFactor);
  const src = CAR_INSURANCE_SOURCE;
  return {
    main: { label: '추정 보험료 (예시)', value: fmt(est) },
    details: [
      { label: '⚠️ 성격', value: '추정·예시값이다. 실제 보험료는 보험사 언더라이팅(사고 이력·특약·담보·지역 등)으로 정해진다' },
      { label: '가정 계수', value: `차량가의 3.5% × 연령 ${ageFactor} × 연식 ${carFactor.toFixed(2)} × 무사고 ${safeFactor.toFixed(2)} — 카더라 가정, 보험사 요율 아님` },
      { label: '참고: 전국 평균', value: `1대당 ${fmt(src.avgPremium)} — ${src.basis}(원문 대조 전, ${src.reportedAt} 보도 인용)` },
      { label: '실제 견적', value: `${src.quoteName} ${src.quoteUrl}` },
    ],
  };
}
export function fuelSaving(v: V): CalcResult {
  const dist = n(v.distance); const eff1 = n(v.eff1); const eff2 = n(v.eff2); const price = n(v.fuelPrice);
  const cost1 = Math.round(dist / eff1 * price);
  const cost2 = Math.round(dist / eff2 * price);
  return { main: { label: '연간 절감액', value: fmt(Math.abs(cost1 - cost2)) }, details: [{ label: '차량A 유류비', value: fmt(cost1) }, { label: '차량B 유류비', value: fmt(cost2) }] };
}
export function inflationCalc(v: V): CalcResult {
  const amount = n(v.amount); const years = n(v.years); const inf = n(v.inflationRate) / 100;
  const realValue = Math.round(amount / Math.pow(1 + inf, years));
  return { main: { label: `${years}년 후 실질 가치`, value: fmt(realValue) }, details: [{ label: '명목 금액', value: fmt(amount) }, { label: '구매력 감소', value: fmt(amount - realValue) }] };
}
import { consolationMoney } from './k9/misc'; export { consolationMoney };
export function propertyDivision(v: V): CalcResult {
  const total = n(v.totalAssets); const ratio = n(v.ratio) / 100;
  return { main: { label: '분할 금액', value: fmt(Math.round(total * ratio)) }, details: [{ label: '공동재산', value: fmt(total) }, { label: '분할 비율', value: pct(ratio) }] };
}
import { statuteOfLimitations } from './k9/misc'; export { statuteOfLimitations };
import { industrialAccident } from './k9/ext'; export { industrialAccident }; // K-9 ext — 본문은 k9/ext.ts
export function csatGrade(v: V): CalcResult {
  const score = n(v.score);
  // 영어는 절대등급
  if (v.subject === 'english') {
    const grades = [90, 80, 70, 60, 50, 40, 30, 20];
    let grade = 9;
    for (let i = 0; i < grades.length; i++) { if (score >= grades[i]) { grade = i + 1; break; } }
    return { main: { label: '영어 등급', value: `${grade}등급` }, details: [{ label: '원점수', value: `${score}점` }] };
  }
  // 상대평가 근사
  const grade = score >= 92 ? 1 : score >= 85 ? 2 : score >= 77 ? 3 : score >= 67 ? 4 : score >= 55 ? 5 : score >= 43 ? 6 : score >= 30 ? 7 : score >= 18 ? 8 : 9;
  return { main: { label: '예상 등급', value: `${grade}등급` }, details: [{ label: '원점수', value: `${score}점` }, { label: '참고', value: '실제 등급컷은 시험별 상이' }] };
}
export function pointConvert(v: V): CalcResult {
  const points = n(v.points); const ratio = n(v.ratio);
  return { main: { label: '현금 가치', value: fmt(Math.round(points * ratio)) }, details: [{ label: '포인트', value: `${points.toLocaleString()}P` }, { label: '환산 비율', value: `1P = ${ratio}원` }] };
}
