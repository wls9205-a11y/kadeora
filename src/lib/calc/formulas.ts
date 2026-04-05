// 카더라 계산기 — 전체 계산 공식 모음
import {
  INCOME_TAX_BRACKETS, ACQUISITION_TAX_RATES, CAPITAL_GAINS_TAX,
  GIFT_TAX_BRACKETS, GIFT_EXEMPTIONS, SOCIAL_INSURANCE_RATES,
  BROKERAGE_RATES, JEONSE_CONVERSION_RATE, PROPERTY_TAX_RATES,
  calcProgressiveTax, formatKRW,
} from './tax-tables';

type V = Record<string, number | string>;

export interface CalcResult {
  main: { label: string; value: string; color?: string };
  details: { label: string; value: string }[];
  chart?: { labels: string[]; data: number[]; label?: string };
}

// ── 공통 유틸 ──
const n = (v: unknown) => Number(v) || 0;
const fmt = (v: number) => formatKRW(v);
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ═══ 부동산 ═══

export function brokerageFee(v: V): CalcResult {
  const price = n(v.price);
  const monthlyRent = n(v.monthlyRent);
  const type = v.dealType as string;
  let base = price;
  if (type === 'monthly') base = price + (monthlyRent * 100); // 보증금+월세×100
  if (type === 'monthly' && base < price) base = price;
  const table = type === 'trade' ? BROKERAGE_RATES.trade : BROKERAGE_RATES.lease;
  let rate = 0, maxFee: number | null = null;
  for (const r of table) { if (base <= r.max) { rate = r.rate; maxFee = r.maxFee; break; } }
  let fee = Math.round(base * rate);
  if (maxFee && fee > maxFee) fee = maxFee;
  return {
    main: { label: '중개수수료', value: fmt(fee) },
    details: [
      { label: '거래금액', value: fmt(base) },
      { label: '적용 요율', value: pct(rate) },
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

export function jeonseWolse(v: V): CalcResult {
  const dir = v.direction as string;
  const jeonse = n(v.jeonse);
  const deposit = n(v.deposit);
  const rate = n(v.rate) / 100 || JEONSE_CONVERSION_RATE;
  if (dir === 'toWolse') {
    const monthly = Math.round((jeonse - deposit) * rate / 12);
    return { main: { label: '월세', value: fmt(monthly) }, details: [{ label: '보증금', value: fmt(deposit) }, { label: '전월세전환율', value: pct(rate) }] };
  } else {
    const monthly = n(v.monthlyRent) || 0;
    const converted = Math.round(deposit + (monthly * 12 / rate));
    return { main: { label: '전세 보증금', value: fmt(converted) }, details: [{ label: '현재 월세', value: fmt(monthly) }, { label: '전월세전환율', value: pct(rate) }] };
  }
}

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
  const market = v.market as string;
  const buyTotal = buy * qty * (1 + fee);
  const sellTotal = sell * qty * (1 - fee);
  const secTax = market === 'kr' ? sell * qty * 0.0018 : 0; // 증권거래세 0.18% (국내)
  const profit = sellTotal - buyTotal - secTax;
  const roi = buyTotal > 0 ? profit / buyTotal : 0;
  return {
    main: { label: '수익률', value: pct(roi), color: profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
    details: [
      { label: '매수 총액 (수수료 포함)', value: fmt(Math.round(buyTotal)) },
      { label: '매도 총액 (수수료 차감)', value: fmt(Math.round(sellTotal)) },
      { label: '증권거래세', value: fmt(Math.round(secTax)) },
      { label: '순수익', value: fmt(Math.round(profit)) },
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

export function dividendCalc(v: V): CalcResult {
  const inv = n(v.investment);
  const y = n(v.yieldRate) / 100;
  const market = v.market as string;
  const taxRate = market === 'kr' ? 0.154 : 0.15;
  const gross = inv * y;
  const net = gross * (1 - taxRate);
  return {
    main: { label: '세후 연간 배당금', value: fmt(Math.round(net)) },
    details: [
      { label: '세전 배당금', value: fmt(Math.round(gross)) },
      { label: '배당소득세', value: fmt(Math.round(gross * taxRate)) },
      { label: '월 배당금 (세후)', value: fmt(Math.round(net / 12)) },
    ],
  };
}

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

export function currencyConvert(v: V): CalcResult {
  // 고정 환율 (실시간은 API 연동 필요)
  const rates: Record<string, number> = { USD: 1, KRW: 1380, JPY: 150, EUR: 0.92, CNY: 7.25 };
  const amount = n(v.amount);
  const from = v.from as string;
  const to = v.to as string;
  const inUsd = amount / (rates[from] || 1);
  const result = inUsd * (rates[to] || 1);
  return {
    main: { label: `${to} 변환 결과`, value: `${result.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${to}` },
    details: [{ label: '적용 환율', value: `1 ${from} = ${(rates[to] / rates[from]).toFixed(4)} ${to}` }, { label: '참고', value: '고시환율 기준 (실시간 아님)' }],
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

export function withholding33(v: V): CalcResult {
  const amount = n(v.amount);
  if (v.direction === 'afterTax') {
    const tax = Math.round(amount * 0.033);
    return { main: { label: '세후 수령액', value: fmt(amount - tax) }, details: [{ label: '원천징수세액 (3.3%)', value: fmt(tax) }] };
  } else {
    const gross = Math.round(amount / 0.967);
    const tax = gross - amount;
    return { main: { label: '세전 금액', value: fmt(gross) }, details: [{ label: '원천징수세액', value: fmt(Math.round(tax)) }] };
  }
}

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

export function depositInterest(v: V): CalcResult {
  const amount = n(v.amount);
  const rate = n(v.rate) / 100;
  const months = n(v.months);
  const taxType = v.taxType as string;
  const taxRate = taxType === 'general' ? 0.154 : taxType === 'preferential' ? 0.095 : 0;
  let interest = 0;
  if (v.type === 'deposit') {
    interest = amount * rate * (months / 12);
  } else { // savings (적금)
    interest = amount * rate * (months + 1) / 2 / 12;
  }
  const tax = interest * taxRate;
  const net = interest - tax;
  const total = (v.type === 'deposit' ? amount : amount * months) + net;
  return {
    main: { label: '세후 수령액', value: fmt(Math.round(total)) },
    details: [
      { label: '세전 이자', value: fmt(Math.round(interest)) },
      { label: '이자소득세', value: fmt(Math.round(tax)) },
      { label: '세후 이자', value: fmt(Math.round(net)) },
    ],
  };
}

// ═══ 세금 ═══

export function acquisitionTax(v: V): CalcResult {
  const price = n(v.price);
  const type = v.type as string;
  const houseCount = n(v.houseCount);
  const regulated = v.regulated === 'yes';
  const firstTime = v.firstTime === 'yes';
  let rate = 0.01;
  if (type === 'purchase') {
    if (houseCount >= 3) rate = regulated ? 0.12 : 0.04;
    else if (houseCount === 2) rate = regulated ? 0.08 : 0.01;
    else {
      if (price <= 600000000) rate = 0.01;
      else if (price <= 900000000) rate = 0.01 + (price - 600000000) / 300000000 * 0.02;
      else rate = 0.03;
    }
  } else if (type === 'gift') {
    rate = 0.035;
    if (houseCount >= 2 && regulated) rate = 0.12;
  } else { rate = 0.028; } // 상속
  const acqTax = Math.round(price * rate);
  const eduTax = Math.round(acqTax * 0.1); // 지방교육세
  const farmTax = type === 'purchase' && price > 600000000 ? Math.round(acqTax * 0.02) : 0; // 농특세
  let total = acqTax + eduTax + farmTax;
  let discount = 0;
  if (firstTime && houseCount === 1 && price <= 1200000000) {
    discount = Math.min(2000000, total);
    total -= discount;
  }
  return {
    main: { label: '취득세 합계', value: fmt(total) },
    details: [
      { label: '취득세', value: fmt(acqTax) },
      { label: '적용 세율', value: pct(rate) },
      { label: '지방교육세', value: fmt(eduTax) },
      { label: '농어촌특별세', value: fmt(farmTax) },
      ...(discount > 0 ? [{ label: '생애최초 감면', value: `-${fmt(discount)}` }] : []),
    ],
  };
}

export function capitalGainsHousing(v: V): CalcResult {
  const sell = n(v.sellPrice);
  const buy = n(v.buyPrice);
  const exp = n(v.expenses);
  const hold = n(v.holdYears);
  const live = n(v.liveYears);
  const houses = n(v.houseCount);
  const gain = sell - buy - exp;
  if (gain <= 0) return { main: { label: '양도소득세', value: '0원 (차익 없음)' }, details: [] };
  // 1세대1주택 비과세
  if (houses === 1 && hold >= 2 && sell <= CAPITAL_GAINS_TAX.exemption) {
    return { main: { label: '양도소득세', value: '0원 (비과세)', color: 'var(--accent-green)' }, details: [{ label: '사유', value: '1세대1주택 비과세 (12억 이하)' }] };
  }
  // 장기보유특별공제
  let ltdRate = 0;
  if (houses === 1) {
    const holdRate = Math.min(0.40, Math.max(0, (hold - 2) * 0.04));
    const liveRate = Math.min(0.40, Math.max(0, (live - 2) * 0.04));
    ltdRate = holdRate + liveRate; // 최대 80%
  } else {
    for (const r of CAPITAL_GAINS_TAX.longTermDeduction) { if (hold >= r.years) ltdRate = r.rate; }
  }
  let taxableGain = gain;
  if (houses === 1 && sell > CAPITAL_GAINS_TAX.exemption) {
    taxableGain = Math.round(gain * (sell - CAPITAL_GAINS_TAX.exemption) / sell);
  }
  taxableGain = Math.round(taxableGain * (1 - ltdRate));
  const taxBase = Math.max(0, taxableGain - 2500000); // 기본공제 250만
  const tax = Math.round(calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS));
  const localTax = Math.round(tax * 0.1);
  return {
    main: { label: '양도소득세', value: fmt(tax + localTax) },
    details: [
      { label: '양도차익', value: fmt(gain) },
      { label: '장특공제율', value: pct(ltdRate) },
      { label: '과세표준', value: fmt(taxBase) },
      { label: '소득세', value: fmt(tax) },
      { label: '지방소득세', value: fmt(localTax) },
    ],
  };
}

export function giftTax(v: V): CalcResult {
  const amount = n(v.amount);
  const rel = v.relationship as string;
  const prior = n(v.priorGifts);
  const exemption = GIFT_EXEMPTIONS[rel as keyof typeof GIFT_EXEMPTIONS] as number || 0;
  const taxBase = Math.max(0, amount + prior - exemption);
  let tax = 0;
  for (const b of GIFT_TAX_BRACKETS) {
    if (taxBase <= b.max) { tax = taxBase * b.rate - b.deduction; break; }
  }
  if (rel === 'grandchild') tax = Math.round(tax * GIFT_EXEMPTIONS.generationSkip);
  tax = Math.max(0, Math.round(tax));
  return {
    main: { label: '증여세', value: fmt(tax) },
    details: [
      { label: '증여 재산', value: fmt(amount) },
      { label: '면제한도', value: fmt(exemption) },
      { label: '과세표준', value: fmt(taxBase) },
      ...(rel === 'grandchild' ? [{ label: '세대생략 할증', value: '30%' }] : []),
    ],
  };
}

export function overseasCgt(v: V): CalcResult {
  const profit = n(v.profit) + n(v.otherProfit) - n(v.otherLoss);
  const taxBase = Math.max(0, profit - 2500000);
  const tax = Math.round(taxBase * 0.22);
  return {
    main: { label: '양도소득세', value: fmt(tax) },
    details: [
      { label: '순 양도차익', value: fmt(profit) },
      { label: '기본공제', value: fmt(2500000) },
      { label: '과세표준', value: fmt(taxBase) },
      { label: '세율', value: '22% (소득세 20% + 지방소득세 2%)' },
    ],
  };
}

export function financialIncomeTax(v: V): CalcResult {
  const interest = n(v.interest);
  const dividend = n(v.dividend);
  const other = n(v.otherIncome);
  const total = interest + dividend;
  if (total <= 20000000) {
    return { main: { label: '추가 납부세액', value: '0원 (2천만 이하 분리과세)' }, details: [{ label: '금융소득 합계', value: fmt(total) }, { label: '원천징수 (15.4%)', value: fmt(Math.round(total * 0.154)) }] };
  }
  const excess = total - 20000000;
  const comprehensiveTax = calcProgressiveTax(other + excess, INCOME_TAX_BRACKETS);
  const otherTax = calcProgressiveTax(other, INCOME_TAX_BRACKETS);
  const separateTax = 20000000 * 0.14;
  const additionalTax = Math.max(0, Math.round(comprehensiveTax - otherTax + separateTax - total * 0.14));
  return {
    main: { label: '추가 납부세액 (추정)', value: fmt(additionalTax) },
    details: [
      { label: '금융소득 합계', value: fmt(total) },
      { label: '2천만 초과분', value: fmt(excess) },
    ],
  };
}

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

export function dueDate(v: V): CalcResult {
  const lmp = v.lastPeriod as string;
  if (!lmp) return { main: { label: '출산 예정일', value: '날짜를 입력하세요' }, details: [] };
  const cycle = n(v.cycleLength) || 28;
  const date = new Date(lmp);
  date.setDate(date.getDate() + 280 + (cycle - 28));
  const today = new Date();
  const weeks = Math.floor((today.getTime() - new Date(lmp).getTime()) / (7 * 86400000));
  return {
    main: { label: '출산 예정일', value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` },
    details: [{ label: '현재 임신 주수', value: weeks > 0 ? `${weeks}주` : '임신 전' }, { label: 'D-Day', value: `${Math.ceil((date.getTime() - today.getTime()) / 86400000)}일` }],
  };
}

export function electricityBill(v: V): CalcResult {
  const usage = n(v.usage);
  // 주택용 누진세 (2026년 기준)
  const tiers = [
    { max: 200, rate: 120.0 }, { max: 400, rate: 214.6 }, { max: Infinity, rate: 307.3 },
  ];
  let charge = 0, base = 910; // 기본요금
  let remaining = usage;
  let prev = 0;
  for (const t of tiers) {
    const tierUsage = Math.min(remaining, t.max - prev);
    charge += tierUsage * t.rate;
    remaining -= tierUsage;
    prev = t.max;
    if (remaining <= 0) break;
  }
  const subtotal = base + charge;
  const climateFund = Math.round(usage * 9); // 기후환경요금
  const fuelAdj = Math.round(usage * 5); // 연료비조정
  const vat = Math.round((subtotal + climateFund + fuelAdj) * 0.1);
  const fundTax = Math.round((subtotal + climateFund + fuelAdj) * 0.037);
  const total = Math.round(subtotal + climateFund + fuelAdj + vat + fundTax);
  return {
    main: { label: '전기요금 (부가세 포함)', value: fmt(total) },
    details: [
      { label: '전력량요금', value: fmt(Math.round(charge)) },
      { label: '기본요금', value: fmt(base) },
      { label: '부가세 (10%)', value: fmt(vat) },
    ],
  };
}

export function dischargeDate(v: V): CalcResult {
  const dateStr = v.enlistDate as string;
  if (!dateStr) return { main: { label: '전역 예정일', value: '입대일을 입력하세요' }, details: [] };
  const months: Record<string, number> = { army: 18, marine: 18, navy: 20, airforce: 21, social: 21 };
  const branch = v.branch as string;
  const m = months[branch] || 18;
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + m);
  date.setDate(date.getDate() - 1);
  const today = new Date();
  const dday = Math.ceil((date.getTime() - today.getTime()) / 86400000);
  const totalDays = m * 30;
  const served = totalDays - Math.max(0, dday);
  const pct2 = Math.min(100, Math.round(served / totalDays * 100));
  return {
    main: { label: '전역 예정일', value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` },
    details: [
      { label: 'D-Day', value: dday > 0 ? `D-${dday}` : '전역 완료!' },
      { label: '복무 진행률', value: `${pct2}%` },
      { label: '복무기간', value: `${m}개월` },
    ],
  };
}

// ═══ 연금/은퇴 ═══

export function nationalPension(v: V): CalcResult {
  const salary = Math.min(n(v.monthlySalary), 5900000);
  const years = n(v.years);
  // 국민연금 예상 수령액 간이 공식 (A값 기준)
  const aValue = 2989000; // 2026년 A값 (전체 가입자 평균 소득월액)
  const bValue = salary;
  const basicAmount = (aValue + bValue) * 0.012 * Math.min(years, 20) +
                      (aValue + bValue) * 0.01 * Math.max(0, years - 20);
  return {
    main: { label: '예상 월 수령액', value: fmt(Math.round(basicAmount)) },
    details: [
      { label: '월 납부액', value: fmt(Math.round(salary * 0.045)) },
      { label: '총 납부액', value: fmt(Math.round(salary * 0.045 * years * 12)) },
      { label: '가입기간', value: `${years}년` },
    ],
  };
}

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

export function irpDeduction(v: V): CalcResult {
  const salary = n(v.annualSalary);
  const pension = Math.min(n(v.pensionSavings), 6000000);
  const irp = Math.min(n(v.irp), 9000000 - pension);
  const total = pension + irp;
  const rate = salary <= 55000000 ? 0.165 : 0.132;
  const deduction = Math.round(total * rate);
  return {
    main: { label: '세액공제 환급액', value: fmt(deduction) },
    details: [
      { label: '연금저축', value: fmt(pension) },
      { label: 'IRP', value: fmt(irp) },
      { label: '공제율', value: pct(rate) },
    ],
  };
}

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
};

// ═══ 추가 공식 ═══

export function calorie(v: V): CalcResult {
  const g = v.gender as string; const a = n(v.age); const h = n(v.height); const w = n(v.weight); const act = Number(v.activity);
  const bmrVal = g === 'male' ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
  const tdee = Math.round(bmrVal * act);
  return { main: { label: '일일 권장 칼로리', value: `${tdee} kcal` }, details: [{ label: '기초대사량 (BMR)', value: `${Math.round(bmrVal)} kcal` }, { label: '다이어트 목표', value: `${Math.round(tdee * 0.8)} kcal (-20%)` }] };
}
export function bodyFat(v: V): CalcResult {
  const g = v.gender as string; const a = n(v.age); const h = n(v.height)/100; const w = n(v.weight);
  const bmiVal = w/(h*h);
  const bf = g === 'male' ? 1.20*bmiVal + 0.23*a - 16.2 : 1.20*bmiVal + 0.23*a - 5.4;
  const grade = g === 'male' ? (bf < 14 ? '마른 체형' : bf < 20 ? '정상' : bf < 25 ? '약간 과체중' : '비만') : (bf < 21 ? '마른 체형' : bf < 28 ? '정상' : bf < 32 ? '약간 과체중' : '비만');
  return { main: { label: `체지방률 ${bf.toFixed(1)}%`, value: grade }, details: [{ label: 'BMI', value: bmiVal.toFixed(1) }] };
}
export function bmr(v: V): CalcResult {
  const g = v.gender as string; const a = n(v.age); const h = n(v.height); const w = n(v.weight);
  const val = g === 'male' ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
  return { main: { label: '기초대사량', value: `${Math.round(val)} kcal/일` }, details: [{ label: '공식', value: 'Mifflin-St Jeor' }] };
}
export function ageCalc(v: V): CalcResult {
  const bd = new Date(v.birthDate as string); const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--;
  return { main: { label: '만 나이', value: `${age}세` }, details: [{ label: '다음 생일까지', value: (() => { const next = new Date(bd); next.setFullYear(today.getFullYear()); if (next <= today) next.setFullYear(today.getFullYear()+1); return `${Math.ceil((next.getTime()-today.getTime())/86400000)}일`; })() }] };
}
export function dDay(v: V): CalcResult {
  const s = v.startDate as string; const e = v.endDate as string;
  if (!s || !e) return { main: { label: 'D-Day', value: '날짜를 입력하세요' }, details: [] };
  const diff = Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86400000);
  return { main: { label: 'D-Day', value: diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day!' : `D+${Math.abs(diff)}` }, details: [{ label: '일수 차이', value: `${Math.abs(diff)}일` }] };
}
export function ovulation(v: V): CalcResult {
  const lmp = v.lastPeriod as string; const cycle = n(v.cycleLength) || 28;
  if (!lmp) return { main: { label: '배란 예정일', value: '날짜를 입력하세요' }, details: [] };
  const d = new Date(lmp); d.setDate(d.getDate() + cycle - 14);
  const start = new Date(d); start.setDate(start.getDate() - 3);
  const end = new Date(d); end.setDate(end.getDate() + 1);
  const fmt2 = (dt: Date) => `${dt.getMonth()+1}/${dt.getDate()}`;
  return { main: { label: '배란 예정일', value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }, details: [{ label: '가임기', value: `${fmt2(start)} ~ ${fmt2(end)}` }] };
}
export function vehicleTax(v: V): CalcResult {
  const cc = n(v.cc); const type = v.type as string; const age = n(v.age);
  if (type === 'ev') return { main: { label: '자동차세', value: fmt(100000) }, details: [{ label: '전기차 고정', value: '연 10만원' }] };
  const rate = cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200;
  let tax = cc * rate;
  const discount = Math.min(0.5, age * 0.05); // 연식 할인 최대 50%
  tax = Math.round(tax * (1 - discount));
  const edu = Math.round(tax * 0.3);
  return { main: { label: '연간 자동차세', value: fmt(tax + edu) }, details: [{ label: '자동차세', value: fmt(tax) }, { label: '지방교육세 (30%)', value: fmt(edu) }, { label: '연식 할인', value: pct(discount) }] };
}
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
export function customsDuty(v: V): CalcResult {
  const price = n(v.price); const ship = n(v.shipping);
  const rates: Record<string, number> = { general: 0.08, clothing: 0.13, electronics: 0.04, food: 0.08, cosmetics: 0.065 };
  const total = price + ship;
  if (total <= 150000) return { main: { label: '관세', value: '0원 (면세)' }, details: [{ label: '과세가격', value: fmt(total) }, { label: '면세 한도', value: '15만원 이하 면세' }] };
  const rate = rates[v.category as string] || 0.08;
  const duty = Math.round(total * rate);
  const vat = Math.round((total + duty) * 0.1);
  return { main: { label: '관세+부가세', value: fmt(duty + vat) }, details: [{ label: '관세', value: fmt(duty) }, { label: '부가세 (10%)', value: fmt(vat) }, { label: '적용 세율', value: pct(rate) }] };
}
export function subscriptionTotal(v: V): CalcResult {
  const subs = [n(v.sub1), n(v.sub2), n(v.sub3), n(v.sub4), n(v.sub5)].filter(s => s > 0);
  const monthly = subs.reduce((a,b) => a+b, 0);
  return { main: { label: '월 구독 합계', value: fmt(monthly) }, details: [{ label: '연간 총액', value: fmt(monthly * 12) }, { label: '구독 수', value: `${subs.length}개` }] };
}
export function militaryPay(v: V): CalcResult {
  const pays: Record<string, { label: string; amount: number }> = {
    private: { label: '이병', amount: 640000 },
    pfc: { label: '일병', amount: 800000 },
    corporal: { label: '상병', amount: 1000000 },
    sergeant: { label: '병장', amount: 1250000 },
  };
  const p = pays[v.rank as string] || pays.private;
  return { main: { label: `${p.label} 월급`, value: fmt(p.amount) }, details: [{ label: '기준', value: '2026년 국방부 병 봉급표 (예상)' }] };
}
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
export function propertyTax(v: V): CalcResult {
  const pub = n(v.publicPrice);
  const taxBase = Math.round(pub * PROPERTY_TAX_RATES.fairMarketRatio);
  let tax = 0;
  for (const r of PROPERTY_TAX_RATES.housing) {
    if (taxBase <= r.max) { tax = taxBase * r.rate - (r.deduction || 0); break; }
  }
  tax = Math.max(0, Math.round(tax));
  const edu = Math.round(tax * 0.2);
  const city = Math.round(taxBase * 0.0014);
  return { main: { label: '재산세 합계', value: fmt(tax + edu + city) }, details: [{ label: '재산세', value: fmt(tax) }, { label: '지방교육세', value: fmt(edu) }, { label: '도시지역분', value: fmt(city) }] };
}
export function registrationCost(v: V): CalcResult {
  const price = n(v.price);
  const regTax = Math.round(price * 0.02); // 등록면허세 2%
  const eduTax = Math.round(regTax * 0.2);
  const acqResult = acquisitionTax(v);
  const acqTotal = Number(acqResult.main.value.replace(/[^0-9]/g, '')) || 0;
  const lawyerFee = price > 500000000 ? 800000 : price > 200000000 ? 500000 : 300000;
  const stampTax = price > 1000000000 ? 350000 : price > 500000000 ? 150000 : price > 100000000 ? 70000 : 0;
  return { main: { label: '등기비용 합계', value: fmt(regTax + eduTax + acqTotal + lawyerFee + stampTax) }, details: [{ label: '등록면허세', value: fmt(regTax) }, { label: '지방교육세', value: fmt(eduTax) }, { label: '취득세 (별도)', value: fmt(acqTotal) }, { label: '법무사 수수료 (추정)', value: fmt(lawyerFee) }, { label: '인지세', value: fmt(stampTax) }] };
}
export function dsrCalc(v: V): CalcResult {
  const income = n(v.annualIncome);
  const loan = n(v.newLoan); const rate = n(v.newRate)/100/12; const years = n(v.newYears);
  const months = years * 12;
  const monthlyRepay = rate > 0 ? loan * rate * Math.pow(1+rate, months) / (Math.pow(1+rate, months)-1) : loan / months;
  const annualRepay = monthlyRepay * 12 + n(v.existingAnnualRepay);
  const dsr = income > 0 ? (annualRepay / income) * 100 : 0;
  const ok = dsr <= 40;
  return { main: { label: 'DSR', value: `${dsr.toFixed(1)}%`, color: ok ? 'var(--accent-green)' : 'var(--accent-red)' }, details: [{ label: '연간 원리금 상환액', value: fmt(Math.round(annualRepay)) }, { label: '판정', value: ok ? '대출 가능 (40% 이하)' : '대출 초과 (40% 초과)' }] };
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
export function yearEndRefund(v: V): CalcResult {
  const salary = n(v.annualSalary);
  const taxBase = Math.max(0, salary - n(v.incomeDeduction) - Math.min(salary * 0.7, salary <= 5000000 ? salary * 0.7 : 15000000 + (salary - 5000000) * 0.15)); // 근로소득공제 근사
  const determined = Math.max(0, Math.round(calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS)) - n(v.taxCredit));
  const paid = n(v.alreadyPaid);
  const refund = paid - determined;
  return { main: { label: refund >= 0 ? '예상 환급액' : '추가 납부액', value: fmt(Math.abs(Math.round(refund))), color: refund >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }, details: [{ label: '결정세액', value: fmt(Math.round(determined)) }, { label: '기납부세액', value: fmt(paid) }] };
}
export function creditCardDeduction(v: V): CalcResult {
  const salary = n(v.annualSalary);
  const threshold = salary * 0.25;
  const credit = n(v.credit); const debit = n(v.debit); const trad = n(v.traditional);
  const totalSpend = credit + debit + trad;
  if (totalSpend <= threshold) return { main: { label: '소득공제', value: '0원' }, details: [{ label: '사유', value: `총급여 25% (${fmt(threshold)}) 미달` }] };
  const excess = totalSpend - threshold;
  const creditExcess = Math.max(0, Math.min(credit, excess));
  const debitExcess = Math.max(0, Math.min(debit, excess - creditExcess));
  const tradExcess = Math.max(0, Math.min(trad, excess - creditExcess - debitExcess));
  const deduction = Math.round(creditExcess * 0.15 + debitExcess * 0.30 + tradExcess * 0.40);
  const maxDeduction = salary <= 70000000 ? 3000000 : salary <= 120000000 ? 2500000 : 2000000;
  const final = Math.min(deduction, maxDeduction);
  return { main: { label: '소득공제 금액', value: fmt(final) }, details: [{ label: '25% 문턱 초과분', value: fmt(excess) }, { label: '공제 한도', value: fmt(maxDeduction) }] };
}
export function monthlyRentDeduction(v: V): CalcResult {
  const salary = n(v.annualSalary); const rent = n(v.annualRent);
  if (salary > 80000000) return { main: { label: '세액공제', value: '0원' }, details: [{ label: '사유', value: '총급여 8천만원 초과 → 공제 불가' }] };
  const base = Math.min(rent, 10000000);
  const rate = salary <= 55000000 ? 0.17 : 0.15;
  return { main: { label: '월세 세액공제', value: fmt(Math.round(base * rate)) }, details: [{ label: '공제 대상', value: fmt(base) }, { label: '공제율', value: pct(rate) }] };
}
export function inheritanceTax(v: V): CalcResult {
  const estate = n(v.totalEstate) - n(v.debts);
  const hasSpouse = v.hasSpouse === 'yes';
  const lumpDeduction = 500000000; // 일괄공제 5억
  const spouseDeduction = hasSpouse ? Math.min(3000000000, Math.max(500000000, estate * 0.3)) : 0;
  const taxBase = Math.max(0, estate - lumpDeduction - spouseDeduction);
  let tax = 0;
  for (const b of GIFT_TAX_BRACKETS) { if (taxBase <= b.max) { tax = taxBase * b.rate - b.deduction; break; } }
  tax = Math.max(0, Math.round(tax));
  return { main: { label: '상속세', value: fmt(tax) }, details: [{ label: '순 상속재산', value: fmt(estate) }, { label: '일괄공제', value: fmt(lumpDeduction) }, { label: '배우자공제', value: fmt(spouseDeduction) }, { label: '과세표준', value: fmt(taxBase) }] };
}
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
export function retirementIncomeTax(v: V): CalcResult {
  const pay = n(v.retirementPay); const years = n(v.years);
  const deduction = Math.min(pay, years <= 5 ? years * 1000000 * 5 : 25000000 + (years - 5) * 2000000 * 5);
  const taxBase = Math.max(0, (pay - deduction) * 0.6 / years);
  const annualTax = calcProgressiveTax(taxBase * 12, INCOME_TAX_BRACKETS);
  const totalTax = Math.round(annualTax / 12 * years);
  return { main: { label: '퇴직소득세', value: fmt(totalTax) }, details: [{ label: '퇴직금', value: fmt(pay) }, { label: '근속연수공제', value: fmt(Math.round(deduction)) }, { label: '실효세율', value: pct(pay > 0 ? totalTax / pay : 0) }] };
}
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
  const taxRate = v.taxType === 'general' ? 0.154 : v.taxType === 'preferential' ? 0.095 : 0;
  const tax = Math.round(interest * taxRate);
  return { main: { label: '이자소득세', value: fmt(tax) }, details: [{ label: '세후 이자', value: fmt(interest - tax) }, { label: '세율', value: pct(taxRate) }] };
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
export function simplifiedVat(v: V): CalcResult {
  const rev = n(v.revenue); const rate = Number(v.industryRate); const purchase = n(v.purchaseVat);
  const vat = Math.max(0, Math.round(rev * rate * 0.1 - purchase * 0.5));
  if (rev <= 48000000) return { main: { label: '납부 부가세', value: '0원 (면제)' }, details: [{ label: '사유', value: '매출 4,800만원 이하 납부 면제' }] };
  return { main: { label: '납부 부가세', value: fmt(vat) }, details: [{ label: '매출세액', value: fmt(Math.round(rev * rate * 0.1)) }, { label: '매입세액 공제', value: fmt(Math.round(purchase * 0.5)) }] };
}
export function corporateTax(v: V): CalcResult {
  const base = n(v.taxBase);
  const brackets = [
    { min: 0, max: 200000000, rate: 0.09, deduction: 0 },
    { min: 200000000, max: 20000000000, rate: 0.19, deduction: 20000000 },
    { min: 20000000000, max: 300000000000, rate: 0.21, deduction: 420000000 },
    { min: 300000000000, max: Infinity, rate: 0.24, deduction: 9420000000 },
  ];
  const tax = Math.round(calcProgressiveTax(base, brackets));
  return { main: { label: '법인세', value: fmt(tax) }, details: [{ label: '과세표준', value: fmt(base) }, { label: '지방소득세 포함', value: fmt(Math.round(tax * 1.1)) }] };
}
export function penaltyTax(v: V): CalcResult {
  const type = v.type as string; const amount = n(v.taxAmount);
  let penalty = 0;
  if (type === 'noFiling') penalty = Math.round(amount * 0.2);
  else if (type === 'underReport') penalty = Math.round(amount * 0.1);
  else penalty = Math.round(amount * n(v.days) * 0.00022); // 1일 0.022%
  return { main: { label: '가산세', value: fmt(penalty) }, details: [{ label: '원 세액', value: fmt(amount) }] };
}
export function expenseRateLookup(v: V): CalcResult {
  const rev = n(v.revenue); const rate = n(v.rate) / 100;
  const income = Math.round(rev * (1 - rate));
  return { main: { label: '추정 소득금액', value: fmt(income) }, details: [{ label: '총 수입', value: fmt(rev) }, { label: '경비율', value: pct(rate) }, { label: '추정 필요경비', value: fmt(Math.round(rev * rate)) }] };
}
export function medicalDeduction(v: V): CalcResult {
  const salary = n(v.annualSalary); const total = n(v.totalMedical); const senior = n(v.seniorMedical);
  const threshold = salary * 0.03;
  const generalDeductible = Math.min(Math.max(0, total - senior - threshold), 7000000);
  const seniorDeductible = Math.max(0, senior);
  const deduction = Math.round((generalDeductible + seniorDeductible) * 0.15);
  return { main: { label: '의료비 세액공제', value: fmt(deduction) }, details: [{ label: '3% 문턱', value: fmt(Math.round(threshold)) }, { label: '공제 대상', value: fmt(generalDeductible + seniorDeductible) }] };
}
export function educationDeduction(v: V): CalcResult {
  const self2 = n(v.selfEdu); const child = Math.min(n(v.childEdu), 3000000 * n(v.childCount));
  const deduction = Math.round((self2 + child) * 0.15);
  return { main: { label: '교육비 세액공제', value: fmt(deduction) }, details: [{ label: '본인 교육비', value: fmt(self2) }, { label: '자녀 교육비', value: fmt(child) }] };
}
export function donationDeduction(v: V): CalcResult {
  const legal = n(v.legalDonation); const designated = n(v.designatedDonation); const religious = n(v.religiousDonation);
  const total = legal + designated + religious;
  const deduction = Math.round(total <= 10000000 ? total * 0.15 : 10000000 * 0.15 + (total - 10000000) * 0.30);
  return { main: { label: '기부금 세액공제', value: fmt(deduction) }, details: [{ label: '기부금 합계', value: fmt(total) }] };
}
export function insuranceDeduction(v: V): CalcResult {
  const premium = Math.min(n(v.premium), 1000000);
  const disability = Math.min(n(v.disabilityPremium), 1000000);
  return { main: { label: '보험료 세액공제', value: fmt(Math.round((premium + disability) * 0.12)) }, details: [{ label: '보장성보험', value: fmt(premium) }, { label: '장애인전용', value: fmt(disability) }] };
}
export function childCredit(v: V): CalcResult {
  const count = n(v.childCount); const newborn = n(v.newborn);
  let credit = 0;
  if (count >= 1) credit += 150000;
  if (count >= 2) credit += 200000;
  if (count >= 3) credit += (count - 2) * 300000;
  let birthCredit = 0;
  if (newborn >= 1) birthCredit += 300000;
  if (newborn >= 2) birthCredit += 500000;
  if (newborn >= 3) birthCredit += (newborn - 2) * 700000;
  return { main: { label: '자녀 세액공제', value: fmt(credit + birthCredit) }, details: [{ label: '기본공제', value: fmt(credit) }, { label: '출산/입양 공제', value: fmt(birthCredit) }] };
}
export function housingFundDeduction(v: V): CalcResult {
  const sub = Math.min(n(v.subscription), 3000000);
  const mortgage = n(v.mortgageInterest);
  return { main: { label: '주택자금 소득공제', value: fmt(sub + mortgage) }, details: [{ label: '주택청약', value: fmt(sub) }, { label: '주담대 이자', value: fmt(mortgage) }] };
}
export function comprehensivePropertyTax(v: V): CalcResult {
  const pub = n(v.publicPrice);
  const exemption = v.oneHouse === 'yes' ? 1200000000 : 900000000;
  const taxBase = Math.max(0, Math.round((pub - exemption) * 0.60));
  const rates = [
    { min: 0, max: 300000000, rate: 0.005, deduction: 0 },
    { min: 300000000, max: 600000000, rate: 0.007, deduction: 600000 },
    { min: 600000000, max: 1200000000, rate: 0.01, deduction: 2400000 },
    { min: 1200000000, max: Infinity, rate: 0.02, deduction: 14400000 },
  ];
  const tax = Math.round(calcProgressiveTax(taxBase, rates));
  if (taxBase <= 0) return { main: { label: '종부세', value: '0원 (비과세)' }, details: [{ label: '공제액', value: fmt(exemption) }] };
  return { main: { label: '종부세', value: fmt(tax) }, details: [{ label: '과세표준', value: fmt(taxBase) }, { label: '공제액', value: fmt(exemption) }] };
}
export function rentalIncomeTax(v: V): CalcResult {
  const rent = n(v.annualRent); const other = n(v.otherIncome);
  const expRate = v.registered === 'yes' ? 0.60 : 0.50;
  const basicDed = v.registered === 'yes' ? 4000000 : 2000000;
  const separateTaxBase = Math.max(0, rent - rent * expRate - basicDed);
  const separateTax = Math.round(separateTaxBase * 0.14);
  const compTaxBase = rent * (1 - expRate);
  const compTax = Math.round(calcProgressiveTax(other + compTaxBase, INCOME_TAX_BRACKETS) - calcProgressiveTax(other, INCOME_TAX_BRACKETS));
  const better = separateTax <= compTax ? '분리과세 유리' : '종합과세 유리';
  return { main: { label: better, value: fmt(Math.min(separateTax, compTax)) }, details: [{ label: '분리과세 (14%)', value: fmt(separateTax) }, { label: '종합과세', value: fmt(compTax) }] };
}
export function cryptoTax(v: V): CalcResult {
  const profit = n(v.profit);
  const taxBase = Math.max(0, profit - 2500000);
  const tax = Math.round(taxBase * 0.22);
  return { main: { label: '가상자산 소득세', value: fmt(tax) }, details: [{ label: '양도차익', value: fmt(profit) }, { label: '기본공제', value: fmt(2500000) }, { label: '세율', value: '22%' }, { label: '참고', value: '2027년 1월 시행 예정' }] };
}
export function etfTax(v: V): CalcResult {
  const profit = n(v.profit);
  if (v.type === 'domestic') {
    const tax = Math.round(profit * 0.154);
    return { main: { label: '배당소득세 (15.4%)', value: fmt(tax) }, details: [{ label: '세후 수익', value: fmt(profit - tax) }] };
  }
  const base = Math.max(0, profit - 2500000);
  const tax = Math.round(base * 0.22);
  return { main: { label: '양도소득세 (22%)', value: fmt(tax) }, details: [{ label: '기본공제 250만원 적용', value: fmt(base) }] };
}
export function isaTaxFree(v: V): CalcResult {
  const profit = n(v.profit);
  const limit = v.type === 'general' ? 2000000 : 4000000;
  const taxFree = Math.min(profit, limit);
  const taxable = Math.max(0, profit - limit);
  const tax = Math.round(taxable * 0.099); // 9.9% 분리과세
  const saved = Math.round(taxFree * 0.154); // 일반 과세 대비 절세
  return { main: { label: '절세 금액', value: fmt(saved) }, details: [{ label: '비과세 한도', value: fmt(limit) }, { label: '초과분 세금 (9.9%)', value: fmt(tax) }] };
}
export function childSupport(v: V): CalcResult {
  const fIncome = n(v.fatherIncome); const mIncome = n(v.motherIncome);
  const total = fIncome + mIncome;
  const age = n(v.childAge); const count = n(v.childCount);
  const baseAmount = total <= 4000000 ? 500000 : total <= 6000000 ? 700000 : total <= 8000000 ? 900000 : 1200000;
  const ageMultiplier = age < 6 ? 0.9 : age < 12 ? 1.0 : 1.2;
  const monthly = Math.round(baseAmount * ageMultiplier * count * (fIncome / total));
  return { main: { label: '월 양육비 (추정)', value: fmt(monthly) }, details: [{ label: '부모 합산 소득', value: fmt(total) }, { label: '부담 비율', value: pct(fIncome / total) }] };
}
export function accidentCompensation(v: V): CalcResult {
  const treat = n(v.treatmentCost); const days = n(v.treatmentDays);
  const wage = n(v.dailyWage); const disGrade = Number(v.disability);
  const consolation = days <= 14 ? 500000 : days <= 30 ? 1000000 : days <= 90 ? 2000000 : 5000000;
  const lostWage = wage * days;
  const disCompensation = disGrade > 0 ? wage * 365 * (15 - disGrade) * 0.05 : 0;
  const total = treat + consolation + lostWage + Math.round(disCompensation);
  return { main: { label: '추정 합의금', value: fmt(total) }, details: [{ label: '치료비', value: fmt(treat) }, { label: '위자료', value: fmt(consolation) }, { label: '휴업손해', value: fmt(lostWage) }, { label: '장해보상', value: fmt(Math.round(disCompensation)) }] };
}
export function prepaymentFee(v: V): CalcResult {
  const amount = n(v.repayAmount); const rate = n(v.feeRate) / 100;
  const remain = n(v.remainMonths); const total = n(v.totalMonths);
  const fee = Math.round(amount * rate * remain / total);
  return { main: { label: '중도상환수수료', value: fmt(fee) }, details: [{ label: '잔여비율 적용', value: `${remain}/${total}개월` }] };
}
export function housingPension(v: V): CalcResult {
  const price = Math.min(n(v.housePrice), 1200000000); const age = n(v.age);
  const ratio = 0.02 + (age - 55) * 0.002;
  const monthly = Math.round(price * ratio / 12);
  return { main: { label: '예상 월 수령액', value: fmt(monthly) }, details: [{ label: '인정 주택가격', value: fmt(price) }, { label: '참고', value: '실제 수령액은 한국주택금융공사 시뮬레이터 확인' }] };
}
export function retirementPensionSim(v: V): CalcResult {
  const total = n(v.totalAmount); const years = n(v.years); const pensionYears = n(v.pensionYears);
  // 일시금 세금
  const deduction = Math.min(total, years * 5000000);
  const lumpTax = Math.round(calcProgressiveTax(Math.max(0, total - deduction), INCOME_TAX_BRACKETS) * 0.6);
  // 연금 세금 (70% 감면)
  const monthlyPension = total / (pensionYears * 12);
  const pensionTaxRate = pensionYears >= 10 ? 0.033 : 0.044;
  const annualPensionTax = Math.round(monthlyPension * 12 * pensionTaxRate);
  const totalPensionTax = annualPensionTax * pensionYears;
  return { main: { label: '연금 수령이 유리', value: fmt(lumpTax - totalPensionTax) + ' 절세' }, details: [{ label: '일시금 세금', value: fmt(lumpTax) }, { label: '연금 총 세금', value: fmt(totalPensionTax) }, { label: '월 연금액', value: fmt(Math.round(monthlyPension)) }] };
}
export function alcoholCalc(v: V): CalcResult {
  const gender = v.gender as string; const w = n(v.weight); const drinks = n(v.drinks);
  const drinkType = v.drinkType as string; const hours = n(v.hours);
  const alcPercent: Record<string, number> = { soju: 0.17, beer: 0.05, wine: 0.13, whiskey: 0.40 };
  const mlPerDrink: Record<string, number> = { soju: 50, beer: 355, wine: 150, whiskey: 30 };
  const totalAlcGrams = drinks * mlPerDrink[drinkType] * alcPercent[drinkType] * 0.789;
  const r = gender === 'male' ? 0.68 : 0.55;
  const bac = Math.max(0, (totalAlcGrams / (w * r * 1000)) * 100 - hours * 0.015);
  const status = bac >= 0.08 ? '면허취소 (0.08%+)' : bac >= 0.03 ? '면허정지 (0.03%+)' : '정상';
  const color = bac >= 0.08 ? 'var(--accent-red)' : bac >= 0.03 ? 'var(--accent-yellow)' : 'var(--accent-green)';
  return { main: { label: `BAC ${bac.toFixed(3)}%`, value: status, color }, details: [{ label: '섭취 알코올', value: `${totalAlcGrams.toFixed(1)}g` }, { label: '경과시간', value: `${hours}시간` }] };
}
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
