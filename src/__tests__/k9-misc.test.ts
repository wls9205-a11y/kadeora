/**
 * K-9 misc 클러스터 — 공제·기타·시장값 + A2(LTV 가격별 한도) (2026-09-17).
 *
 * ⛔ 주입 꾸러미는 «손으로 적지 않는다» — 이번에 커밋한 마이그레이션 SQL 을 읽어
 *    page.tsx 와 같은 규칙(numbers 첫 원소 → pct / amt)으로 만든다. 시딩 형식이 틀리면 여기서 깨진다.
 * 옛값은 옛 코드(커밋 d01c9cb3 기준)를 같은 입력으로 돌린 값을 숫자로 박았다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  yearEndRefund, creditCardDeduction, monthlyRentDeduction, irpDeduction, medicalDeduction,
  educationDeduction, donationDeduction, insuranceDeduction, simplifiedVat, nationalPension,
  customsDuty, electricityBill, dischargeDate, ageCalc, statuteOfLimitations, accidentCompensation,
  consolationMoney, alcoholCalc, bodyFat, dueDate, dDay, ltvCalc, FORMULAS,
} from '@/lib/calc/formulas';
import { earnedIncomeDeduction, earnedIncomeTaxCredit } from '@/lib/calc/k9/misc';
import { periodEnd } from '@/lib/calc/k9/misc-common';
import { CALC_REGISTRY as CALCULATORS } from '@/lib/calc/registry';
import { parseKRWExact } from '@/lib/calc/tax-tables';

const 만 = 10_000;
const 억 = 100_000_000;

function packFromMigration() {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/k9_misc_policy_constants_2026-09-17.sql'), 'utf8');
  const pct: Record<string, number> = {};
  const amt: Record<string, number> = {};
  const meta: Record<string, unknown> = {};
  const re = /^\('([a-z0-9_]+)','[^']*','[^']*',ARRAY\['([^']*)'\],(?:NULL|'[^']*'),'([^']*)','[^']*',(?:NULL|'[^']*'),(NULL|'[^']*'),'[^']*','([a-z_]+)'/gm;
  let m: RegExpExecArray | null;
  let rows = 0;
  while ((m = re.exec(sql))) {
    rows++;
    const [, key, first, source, from, status] = m;
    const p = first.match(/^(-?\d+(?:\.\d+)?)\s*%/);
    if (p) pct[key] = Number(p[1]);
    const w = first.match(/^([\d,]+(?:\.\d+)?)\s*(억원|만원|원)$/);
    if (w) amt[key] = Math.round(Number(w[1].replace(/,/g, '')) * (w[2] === '억원' ? 억 : w[2] === '만원' ? 만 : 1));
    meta[key] = { source, from: from === 'NULL' ? undefined : from.slice(1, -1), status };
  }
  return { rows, pack: { pct, amt, meta } };
}
const { rows: SEEDED, pack: PACK } = packFromMigration();
// LTV 가격별 한도 — DB 기존 행(mortgage_cap_*) 실측값을 같은 규칙으로 재현
const LTV_PACK = {
  pct: { ltv_regulated_nonowner: 40, ltv_nonregulated_nonowner: 70, ltv_regulated_owner: 0 },
  amt: { mortgage_cap_15eok_under: 6 * 억, mortgage_cap_15_25eok: 4 * 억, mortgage_cap_25eok_over: 2 * 억 },
  meta: { mortgage_cap_15_25eok: { item: '주담대 한도 — 15억원 초과~25억원 이하' } },
};
const P = JSON.stringify(PACK);
const val = (r: { main: { value: string } }) => parseKRWExact(r.main.value.split(' (')[0]);
const detail = (r: { details: { label: string; value: string }[] }, label: string) => r.details.find((d) => d.label.startsWith(label))?.value;

describe('시딩 SQL — 파서 형식 · 개수', () => {
  it('66행 전부가 pct 또는 amt 로 읽힌다(한 행 한 수)', () => {
    expect(SEEDED).toBe(66);
    expect(Object.keys(PACK.pct).length + Object.keys(PACK.amt).length).toBe(66);
  });
  it('대표 행 값', () => {
    expect(PACK.pct.elec_fund_rate).toBe(2.7);
    expect(PACK.pct.nps_benefit_factor).toBe(129);
    expect(PACK.pct.nps_rate_employee_2026).toBe(4.75);
    expect(PACK.amt.nps_income_cap).toBe(659 * 만);
    expect(PACK.pct.simvat_purchase_credit).toBe(0.5);
    expect(PACK.amt.simvat_threshold).toBe(10400 * 만);
    expect(PACK.pct.dui_bac_min).toBe(0.03);
  });
});

describe('FORMULAS 맵 등록 — [S] 해제 판정(2026-09-17)으로 등록됨', () => {
  it('misc 담당 중 옛 미등록 3종이 이제 맵에 있다(라이브 반영일 2026-09-17)', () => {
    const mine = ['ltvCalc', 'consolationMoney', 'statuteOfLimitations'];
    const unregistered = mine.filter((f) => !FORMULAS[f]);
    expect(unregistered).toEqual([]);
    // registry 에 formula 로 쓰이는지도 확인 — 죽은 이름이 아니다
    for (const f of mine) expect(CALCULATORS.some((c) => c.formula === f)).toBe(true);
  });
});

describe('주입 없음 → 「세율 기준 미수신」(지어내지 않는다)', () => {
  it.each([
    ['creditCardDeduction', creditCardDeduction], ['monthlyRentDeduction', monthlyRentDeduction], ['irpDeduction', irpDeduction],
    ['medicalDeduction', medicalDeduction], ['educationDeduction', educationDeduction], ['donationDeduction', donationDeduction],
    ['insuranceDeduction', insuranceDeduction], ['simplifiedVat', simplifiedVat], ['nationalPension', nationalPension],
    ['customsDuty', customsDuty], ['electricityBill', electricityBill],
  ] as const)('%s', (_, fn) => {
    expect(fn({ annualSalary: 5000 * 만, revenue: 1 * 억, usage: 300, priceUsd: 300, monthlySalary: 300 * 만, years: 20 }).main.label).toBe('세율 기준 미수신');
  });
});

describe('year-end-refund — 근로소득공제 §47 5구간 · 근로소득세액공제 §59', () => {
  it('§47 경계값', () => {
    expect(earnedIncomeDeduction(500 * 만)).toBe(350 * 만);
    expect(earnedIncomeDeduction(1500 * 만)).toBe(750 * 만);
    expect(earnedIncomeDeduction(4500 * 만)).toBe(1200 * 만);
    expect(earnedIncomeDeduction(1 * 억)).toBe(1475 * 만);
    expect(earnedIncomeDeduction(5 * 억)).toBe(2000 * 만);         // 한도
    // 옛 근사식 5,000만 → 2,175만 (법정 1,225만)
    expect(earnedIncomeDeduction(5000 * 만)).toBe(1225 * 만);
  });
  it('§59 산식과 한도', () => {
    expect(earnedIncomeTaxCredit(100 * 만, 3000 * 만)).toBe(550_000);
    expect(earnedIncomeTaxCredit(500 * 만, 3000 * 만)).toBe(740_000);   // 산식 1,975,000 → 한도 74만
    expect(earnedIncomeTaxCredit(500 * 만, 9000 * 만)).toBe(500_000);   // 66만 − (2,000만 × 1/2) → 하한 50만
  });
  it('실해 — 총급여 5,000만·소득공제 800만·세액공제 200만·기납부 300만: 옛 3,000,000 → 새 2,457,500', () => {
    const r = yearEndRefund({ annualSalary: 5000 * 만, incomeDeduction: 800 * 만, taxCredit: 200 * 만, alreadyPaid: 300 * 만 });
    expect(r.main.label).toContain('환급');
    expect(val(r)).toBe(2_457_500);
    expect(detail(r, '산출세액')).toBe('320만 2,500원');
    expect(detail(r, '근로소득세액공제')).toBe('66만원');
  });
});

describe('credit-card-deduction — 차감 순서·폐지 한도·자녀·추가한도', () => {
  it('5,000만·신용 2,000만·체크 500만: 옛 1,875,000 → 새 2,625,000', () => {
    expect(val(creditCardDeduction({ annualSalary: 5000 * 만, credit: 2000 * 만, debit: 500 * 만, __policy: P }))).toBe(2_625_000);
  });
  it('기본값(신용 1,000만·체크 800만·전통시장 50만): 옛 900,000 → 새 1,850,000', () => {
    expect(val(creditCardDeduction({ annualSalary: 5000 * 만, credit: 1000 * 만, debit: 800 * 만, traditional: 50 *만, __policy: P }))).toBe(1_850_000);
  });
  it('1.3억: 폐지된 200만 한도 → 250만', () => {
    expect(val(creditCardDeduction({ annualSalary: 13000 * 만, credit: 5000 * 만, __policy: P }))).toBe(2_500_000);
  });
  it('⑪ 추가한도 · ⑩ 자녀', () => {
    const base = { annualSalary: 5000 * 만, debit: 3000 * 만, traditional: 500 * 만, __policy: P };
    expect(val(creditCardDeduction(base))).toBe(500 * 만);                        // 300 + 추가 200
    expect(val(creditCardDeduction({ ...base, childCount: 2 }))).toBe(600 * 만);  // 400 + 200
    expect(val(creditCardDeduction({ annualSalary: 5000 * 만, debit: 3000 * 만, __policy: P }))).toBe(300 * 만);  // 추가 대상 없음
  });
  it('문턱 이하 0원', () => {
    expect(val(creditCardDeduction({ annualSalary: 5000 * 만, credit: 1000 * 만, __policy: P }))).toBe(0);
  });
});

describe('medical-deduction — 3% 미달분을 특정의료비에서 뺀다', () => {
  it('65세 이상 100만만: 옛 150,000 → 새 0', () => {
    expect(val(medicalDeduction({ annualSalary: 5000 * 만, specificMedical: 100 * 만, __policy: P }))).toBe(0);
  });
  it('일반 300만 + 특정 100만 → (150만+100만)×15%', () => {
    expect(val(medicalDeduction({ annualSalary: 5000 * 만, generalMedical: 300 * 만, specificMedical: 100 * 만, __policy: P }))).toBe(375_000);
  });
  it('난임 500만만 → (500만−150만)×30%', () => {
    expect(val(medicalDeduction({ annualSalary: 5000 * 만, ivfMedical: 500 * 만, __policy: P }))).toBe(1_050_000);
  });
  it('일반 한도 700만', () => {
    expect(val(medicalDeduction({ annualSalary: 5000 * 만, generalMedical: 2000 * 만, __policy: P }))).toBe(1_050_000);
  });
});

describe('education · donation · insurance · rent · irp', () => {
  it('대학생 1명 800만: 옛 450,000 → 새 1,200,000', () => {
    expect(val(educationDeduction({ univEdu: 800 * 만, univCount: 1, __policy: P }))).toBe(1_200_000);
  });
  it('기부금 한도: 총급여 3,000만·종교 500만 옛 750,000 → 새 303,750 / 기본값은 225,000 그대로', () => {
    expect(val(donationDeduction({ annualSalary: 3000 * 만, religiousDonation: 500 * 만, __policy: P }))).toBe(303_750);
    expect(val(donationDeduction({ annualSalary: 5000 * 만, generalDonation: 50 * 만, religiousDonation: 100 * 만, __policy: P }))).toBe(225_000);
  });
  it('장애인전용 100만: 옛 120,000 → 새 150,000', () => {
    expect(val(insuranceDeduction({ premium: 0, disabilityPremium: 100 * 만, __policy: P }))).toBe(150_000);
  });
  it('월세 — 숫자는 옛값과 같다(1,632,000) · 8천만 초과 0', () => {
    expect(val(monthlyRentDeduction({ annualSalary: 4500 * 만, annualRent: 960 * 만, __policy: P }))).toBe(1_632_000);
    expect(val(monthlyRentDeduction({ annualSalary: 8000 * 만 + 1, annualRent: 960 * 만, __policy: P }))).toBe(0);
  });
  it('IRP — 옛 16.5%(지방세 포함 실효율) 1,485,000 → 소득세 공제 15% 1,350,000', () => {
    expect(val(irpDeduction({ annualSalary: 5000 * 만, pensionSavings: 600 * 만, irp: 300 * 만, __policy: P }))).toBe(1_350_000);
    expect(val(irpDeduction({ annualSalary: 6000 * 만, pensionSavings: 900 * 만, irp: 900 * 만, __policy: P }))).toBe(1_080_000);
  });
});

describe('simplified-vat — 부가가치율 법정값 · 매입 공급대가 0.5%', () => {
  it('매출 1억·음식점·매입 공급대가 550만(세액 50만): 옛 0 → 새 1,472,500', () => {
    expect(val(simplifiedVat({ revenue: 1 * 억, industry: 'retail_food', purchaseAmount: 550 * 만, __policy: P }))).toBe(1_472_500);
  });
  it('4,800만 «미만» 면제 — 4,800만 정각은 면제 아님', () => {
    expect(simplifiedVat({ revenue: 4800 * 만 - 1, industry: 'retail_food', __policy: P }).main.value).toContain('면제');
    expect(val(simplifiedVat({ revenue: 4800 * 만, industry: 'retail_food', __policy: P }))).toBe(720_000);
  });
  it('공제는 납부세액을 넘지 않는다(§63⑥)', () => {
    expect(val(simplifiedVat({ revenue: 5000 * 만, industry: 'retail_food', purchaseAmount: 100 * 억, __policy: P }))).toBe(0);
  });
});

describe('national-pension — §51 1천분의 1,290 · §63 감액 · 2026 보험료율', () => {
  const base = { monthlySalary: 300 * 만, __policy: P };
  it('월 300만·20년: 옛 1,437,360 → 새 643,818 (A 가정값)', () => {
    const r = nationalPension({ ...base, years: 20 });
    expect(val(r)).toBe(643_818);
    expect(detail(r, 'A값')).toContain('미확정');
    expect(detail(r, '2026년 본인 보험료')).toContain('14만 2,500원');   // 4.75%
  });
  it('10년 미만 — 수급권 없음 / 15년 — 75% / 30년 — 150%', () => {
    expect(nationalPension({ ...base, years: 9 }).main.value).toContain('수급권 없음');
    expect(val(nationalPension({ ...base, years: 15 }))).toBe(Math.round(1.29 * 5_989_000 * 0.75 / 12));
    expect(val(nationalPension({ ...base, years: 30 }))).toBe(Math.round(1.29 * 5_989_000 * 1.5 / 12));
  });
  it('B 상한 659만', () => {
    expect(detail(nationalPension({ ...base, monthlySalary: 1000 * 만, years: 20 }), '기준소득월액')).toBe('659만원');
  });
});

describe('customs-duty — 미화 150달러(운임 제외)', () => {
  it('120달러+배송 20달러: 옛 34,893원 과세 → 새 면세', () => {
    expect(customsDuty({ priceUsd: 120, shippingUsd: 20, exchangeRate: 1380, __policy: P }).main.value).toContain('면세');
  });
  it('200달러+20달러·환율 1,400·일반 → 관세 24,640 + 부가세 33,264', () => {
    expect(val(customsDuty({ priceUsd: 200, shippingUsd: 20, exchangeRate: 1400, category: 'general', __policy: P }))).toBe(57_904);
  });
  it('환율 없으면 지어내지 않는다', () => {
    expect(customsDuty({ priceUsd: 151, __policy: P }).main.value).toBe('과세환율 입력 필요');
  });
});

describe('electricity — 전력기금 2.7% · 기본요금 구간 · 하계 · 슈퍼유저', () => {
  it('500kWh 비하계(기후 9·연료 5원 입력): 옛 120,022 → 새 126,168', () => {
    expect(val(electricityBill({ usage: 500, season: 'other', climateRate: 9, fuelRate: 5, __policy: P }))).toBe(126_168);
  });
  it('400kWh 하계 → 300/450 구간 · 기본 1,600', () => {
    expect(val(electricityBill({ usage: 400, season: 'summer', __policy: P }))).toBe(66_561);
  });
  it('1,200kWh 하계 슈퍼유저', () => {
    const r = electricityBill({ usage: 1200, season: 'summer', __policy: P });
    expect(detail(r, '전력량요금')).toBe('38만 4,445원');
  });
  it('기후환경·연료비 미확정을 말한다', () => {
    expect(detail(electricityBill({ usage: 300, __policy: P }), '⚠️ 미확정')).toContain('기본값 0원');
  });
});

describe('날짜 — 민법 §160 월말 규칙 · 로컬 파싱', () => {
  it('periodEnd', () => {
    const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
    expect(periodEnd(d(2025, 8, 31), 18).getTime()).toBe(d(2027, 2, 28).getTime());
    expect(periodEnd(d(2025, 3, 10), 18).getTime()).toBe(d(2026, 9, 9).getTime());
    expect(periodEnd(d(2025, 3, 1), 1).getTime()).toBe(d(2025, 3, 31).getTime());
  });
  it('discharge-date 2025-08-31 육군: 옛 2027-03-02 → 새 2027-02-28', () => {
    expect(dischargeDate({ enlistDate: '2025-08-31', branch: 'army', __today: '2026-09-17' }).main.value).toBe('2027-02-28');
  });
  it('statute — 초일 불산입 · 윤일 · 「일용직 1년」 제거', () => {
    expect(statuteOfLimitations({ startDate: '2020-01-01', type: 'general', __today: '2026-09-17' }).main.value).toBe('2030-01-01');
    expect(statuteOfLimitations({ startDate: '2020-02-28', type: 'wage', __today: '2026-09-17' }).main.value).toBe('2023-02-28');
    const legacy = statuteOfLimitations({ startDate: '2020-01-01', type: '1', __today: '2026-09-17' });
    expect(detail(legacy, '시효 기간')).toContain('민법 §164');
    expect(JSON.stringify(legacy)).not.toContain('일용직');
  });
  it('age-calc 2월 29일생', () => {
    expect(ageCalc({ birthDate: '2000-02-29', __today: '2026-02-28' }).main.value).toBe('25세');
    expect(ageCalc({ birthDate: '2000-02-29', __today: '2026-03-01' }).main.value).toBe('26세');
  });
  it('due-date · d-day', () => {
    expect(dueDate({ lastPeriod: '2026-01-01', cycleLength: 28, __today: '2026-03-01' }).main.value).toBe('2026-10-08');
    expect(dDay({ startDate: '2026-09-17', endDate: '2026-12-25' }).main.value).toBe('D-99');
  });
});

describe('시장값·비법정 — 공개형', () => {
  it('consolation-money: 소득 계수 제거 — 소득 0 옛 0원 → 새 4,500만원(가정 계수 공개)', () => {
    const r = consolationMoney({ marriageYears: 10, faultDegree: 'medium', income: 0 });
    expect(val(r)).toBe(4500 * 만);
    expect(r.main.label).toContain('예시');
  });
  it('accident-compensation: 계산은 그대로 · 가정임을 말한다', () => {
    const r = accidentCompensation({ treatmentCost: 300 * 만, treatmentDays: 30, dailyWage: 15 * 만, disability: '0' });
    expect(val(r)).toBe(300 * 만 + 100 * 만 + 450 * 만);
    expect(detail(r, '⚠️ 성격')).toContain('가정');
  });
  it('alcohol-calc: 법정 구간 0.2% 신설 · 주입 없으면 기준 미수신', () => {
    const r = alcoholCalc({ gender: 'male', weight: 60, drinks: 14, drinkType: 'soju', hours: 0, __policy: P });
    expect(r.main.value).toContain('0.2% 이상');
    expect(alcoholCalc({ gender: 'male', weight: 70, drinks: 3, drinkType: 'soju', hours: 2 }).main.value).toBe('법정 기준 미수신');
  });
  it('body-fat: 추정식임을 말한다', () => {
    expect(detail(bodyFat({ gender: 'male', age: 30, height: 170, weight: 70 }), '추정식')).toContain('Deurenberg');
  });
});

describe('A2 ltv-calc — 가격별 최대 한도(mortgage_cap_*)', () => {
  it('규제지역 무주택 시가 20억: 옛 8억 → 새 4억', () => {
    const r = ltvCalc({ housePrice: 20 * 억, region: 'regulated', owner: 'none', existingLoan: 0, __policy: JSON.stringify(LTV_PACK) });
    expect(r.main.value).toBe('4억원');
    expect(detail(r, '가격별 최대 한도')).toContain('4억원');
  });
  it('경계 15억 정각은 6억 한도 · 25억 초과는 2억', () => {
    expect(ltvCalc({ housePrice: 15 * 억, region: 'regulated', owner: 'none', __policy: JSON.stringify(LTV_PACK) }).main.value).toBe('6억원');
    expect(ltvCalc({ housePrice: 30 * 억, region: 'regulated', owner: 'none', __policy: JSON.stringify(LTV_PACK) }).main.value).toBe('2억원');
  });
  it('수도권 외 비규제는 가격별 한도 없음 — 20억 × 70% = 14억', () => {
    expect(ltvCalc({ housePrice: 20 * 억, region: 'local_nonreg', owner: 'none', __policy: JSON.stringify(LTV_PACK) }).main.value).toBe('14억원');
  });
  it('한도 행 미수신이면 LTV 만 반영했다고 말한다', () => {
    const r = ltvCalc({ housePrice: 20 * 억, region: 'regulated', owner: 'none', __policy: JSON.stringify({ pct: LTV_PACK.pct, meta: {} }) });
    expect(r.main.value).toBe('8억원');
    expect(detail(r, '⚠️ 가격별 한도')).toContain('받지 못했다');
  });
});
