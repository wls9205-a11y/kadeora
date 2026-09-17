/**
 * K-9 inh 클러스터 — 상속·증여·가업상속·종부세·법인세 (2026-09-17).
 *
 * 주입 꾸러미는 «마이그레이션 SQL 파일에서» 만든다 — page.tsx 파서와 같은 정규식으로 numbers 첫 원소를 읽는다.
 * 그래서 행을 잘못 적으면(파서가 못 읽는 「1억5천만원」 등) 계산기가 「세율 기준 미수신」으로 떨어지고 여기서 잡힌다.
 *
 * 각 describe 는 ① 원문 값과의 긍정형 일치 ② 옛 코드 대비 실해(숫자) 를 같이 박는다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  FORMULAS, inheritanceTax, familyBusiness, burdenGift, generationSkip, giftExemptionLookup, comprehensivePropertyTax, corporateTax,
} from '@/lib/calc/formulas';
import { packBrackets, progressive, INH_RATE_KEYS, INH_UPTO_KEYS } from '@/lib/calc/k9/inh';
import { cptRateKeys, CPT_UPTO_KEYS } from '@/lib/calc/k9/cpt';
import { corpTaxKeys } from '@/lib/calc/k9/corp';
import { formatKRWExact, GIFT_TAX_BRACKETS, calcProgressiveTax } from '@/lib/calc/tax-tables';
import { parsePolicyPack } from '@/lib/calc/gov-tables';
import { CALC_REGISTRY as CALCULATORS } from '@/lib/calc/registry';

const 억 = 100_000_000;
const 만 = 10_000;
const W = (x: number) => formatKRWExact(x);

// ── page.tsx 와 같은 파서로 마이그레이션 파일을 읽는다 ──
const SQL = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/k9_inh_policy_constants_2026-09-17.sql'), 'utf8');
const ROWS = [...SQL.matchAll(/^\('([a-z0-9_]+)','[^']*','[^']*',ARRAY\['([^']*)'/gm)].map((m) => [m[1], m[2]] as const);
const POLICY = (() => {
  const pct: Record<string, number> = {};
  const amt: Record<string, number> = {};
  const meta: Record<string, unknown> = {};
  for (const [key, first] of ROWS) {
    const m = first.match(/^(-?\d+(?:\.\d+)?)\s*%/);
    if (m) pct[key] = Number(m[1]);
    const w = first.match(/^([\d,]+(?:\.\d+)?)\s*(억원|만원|원)$/);
    if (w) {
      const x = Number(w[1].replace(/,/g, ''));
      amt[key] = Math.round(x * (w[2] === '억원' ? 100_000_000 : w[2] === '만원' ? 10_000 : 1));
    }
    meta[key] = { source: 'test' };
  }
  return JSON.stringify({ pct, amt, meta });
})();
const PACK = parsePolicyPack(POLICY);
const row = (r: { details: { label: string; value: string }[] }, label: string) => r.details.find((d) => d.label.startsWith(label))?.value;

describe('마이그레이션 행 — 파서가 전부 읽는다', () => {
  it('86행 전부 pct 또는 amt 로 파싱된다 (못 읽는 표기 0)', () => {
    expect(ROWS.length).toBe(86);
    const p = JSON.parse(POLICY);
    const unread = ROWS.filter(([k]) => p.pct[k] === undefined && p.amt[k] === undefined).map(([k]) => k);
    expect(unread).toEqual([]);
  });
  it('말미 단언의 접두별 수가 실제 행과 같다', () => {
    const c = (pre: string) => ROWS.filter(([k]) => k.startsWith(pre)).length;
    expect(SQL).toContain(`n_inh <> ${c('inh_')} OR n_biz <> ${c('biz_inh_')} OR n_gift <> ${c('gift_')} OR n_cpt <> ${c('cpt_')} OR n_corp <> ${c('corp_tax_')} OR n_ltax <> ${c('corp_ltax_')}`);
  });
  it('⛔ 공유표 접두(pit_·cgt_)는 만들지 않았다', () => {
    expect(ROWS.some(([k]) => k.startsWith('pit_') || k.startsWith('cgt_'))).toBe(false);
  });
});

describe('누진표 조립 — 유도한 구간 기본세액이 원문 표 금액과 같다', () => {
  const bases = (rates: string[], uptos: string[]) => packBrackets(PACK, rates, uptos)!.map((b) => b.base);
  it('상증법 §26: 0 · 1천만 · 9천만 · 2억4천만 · 10억4천만', () => {
    expect(bases(INH_RATE_KEYS, INH_UPTO_KEYS)).toEqual([0, 1000 * 만, 9000 * 만, 24000 * 만, 104000 * 만]);
  });
  it('§26 표 = 옛 GIFT_TAX_BRACKETS(누진공제식) — 전 구간 동일 세액', () => {
    const br = packBrackets(PACK, INH_RATE_KEYS, INH_UPTO_KEYS)!;
    for (const x of [0, 5000 * 만, 1 * 억, 3 * 억, 5 * 억, 7 * 억, 10 * 억, 29 * 억, 30 * 억, 250 * 억]) {
      expect(progressive(x, br)).toBe(Math.round(calcProgressiveTax(x, GIFT_TAX_BRACKETS.map((b, i) => ({ ...b, min: i ? GIFT_TAX_BRACKETS[i - 1].max : 0 })))));
    }
  });
  it('종부세 §9①1 (2주택 이하): 150만 · 360만 · 960만 · 2,650만 · 6,400만 · 1억5,200만', () => {
    expect(bases(cptRateKeys(false), CPT_UPTO_KEYS)).toEqual([0, 150 * 만, 360 * 만, 960 * 만, 2650 * 만, 6400 * 만, 15200 * 만]);
  });
  it('종부세 §9①2 (3주택 이상): 960만 · 3,560만 · 1억1,060만 · 2억8,660만', () => {
    expect(bases(cptRateKeys(true), CPT_UPTO_KEYS)).toEqual([0, 150 * 만, 360 * 만, 960 * 만, 3560 * 만, 11060 * 만, 28660 * 만]);
  });
  it('법인세 §55①1 현행: 2천만 · 39억8천만 · 655억8천만 / 종전: 1천800만 · 37억8천만 · 625억8천만', () => {
    const k = corpTaxKeys('y2026', 'general');
    expect(bases(k.rates, k.uptos)).toEqual([0, 2000 * 만, 398000 * 만, 6558000 * 만]);
    const o = corpTaxKeys('pre2026', 'general');
    expect(bases(o.rates, o.uptos)).toEqual([0, 1800 * 만, 378000 * 만, 6258000 * 만]);
  });
  it('법인세 §55①2 소규모 법인 현행: 40억 · 656억 / 종전: 38억 · 626억', () => {
    const k = corpTaxKeys('y2026', 'smallRental');
    expect(bases(k.rates, k.uptos)).toEqual([0, 400000 * 만, 6560000 * 만]);
    const o = corpTaxKeys('pre2026', 'smallRental');
    expect(bases(o.rates, o.uptos)).toEqual([0, 380000 * 만, 6260000 * 만]);
  });
});

describe('FORMULAS 맵 — registry 에 있는데 맵에 없어 결과가 안 뜨던 4종', () => {
  it('giftExemptionLookup · burdenGift · familyBusiness · generationSkip 이 맵에 있다', () => {
    for (const f of ['giftExemptionLookup', 'burdenGift', 'familyBusiness', 'generationSkip', 'inheritanceTax', 'corporateTax', 'comprehensivePropertyTax']) {
      expect(typeof FORMULAS[f]).toBe('function');
    }
  });
});

describe('⛔ 주입이 없으면 지어내지 않는다', () => {
  it('7종 모두 「세율 기준 미수신」', () => {
    for (const fn of [inheritanceTax, familyBusiness, burdenGift, generationSkip, giftExemptionLookup, comprehensivePropertyTax, corporateTax]) {
      expect(fn({ totalEstate: 10 * 억, businessValue: 30 * 억, years: 15, propertyValue: 5 * 억, amount: 2 * 억, publicPrice: 15 * 억, taxBase: 5 * 억 } as any).main.label).toBe('세율 기준 미수신');
    }
  });
});

describe('상속세 — 배우자공제 «순재산×30%» 날조 제거 · 신고세액공제 · 인적/금융재산공제', () => {
  const run = (o: Record<string, unknown>) => inheritanceTax({ totalEstate: 10 * 억, debts: 5000 * 만, hasSpouse: 'yes', childCount: 2, spouseMode: 'legal', __policy: POLICY, ...o } as any);
  const 옛 = (estate: number, spouse: boolean) => {
    const sp = spouse ? Math.min(30 * 억, Math.max(5 * 억, estate * 0.3)) : 0;
    const base = Math.max(0, estate - 5 * 억 - sp);
    return Math.max(0, Math.round(calcProgressiveTax(base, GIFT_TAX_BRACKETS.map((b, i) => ({ ...b, min: i ? GIFT_TAX_BRACKETS[i - 1].max : 0 })))));
  };

  it('기본값(10억·채무 5천·배우자·자녀 2): 옛 0원 = 새 0원', () => {
    expect(옛(9.5 * 억, true)).toBe(0);
    expect(run({}).main.value).toBe('0원');
  });

  it('⛔ 순재산 30억·배우자+자녀 2·법정상속분 취득: 옛 4억 8,000만 → 새 3억 1,594만 2,858원 (1억 6,405만 7,142원 과대였다)', () => {
    const r = run({ totalEstate: 30 * 억, debts: 0 });
    // 배우자공제 = 30억 × 3/7 = 12억 8,571만 4,285원 · 과표 12억 1,428만 5,715원 · 산출 3억 2,571만 4,286원 · 신고공제 977만 1,428원
    expect(row(r, '배우자상속공제')).toBe(W(1_285_714_285));
    expect(row(r, '과세표준')).toBe(W(1_214_285_715));
    expect(row(r, '산출세액')).toBe(W(325_714_286));
    expect(row(r, '신고세액공제')).toBe(`−${W(9_771_428)}`);
    expect(r.main.value).toBe(W(315_942_858));
    expect(옛(30 * 억, true)).toBe(480_000_000);
    expect(옛(30 * 억, true) - 315_942_858).toBe(164_057_142);
  });

  it('배우자가 실제로 덜 받으면(1억) 공제는 최소 5억 — 옛 9억 공제보다 «과소» 방향으로 뒤집힌다', () => {
    const r = run({ totalEstate: 30 * 억, debts: 0, spouseMode: 'custom', spouseAmount: 1 * 억 });
    expect(row(r, '배우자상속공제')).toBe(W(5 * 억));
    // 과표 20억 → 2.4억 + 10억×40% = 6.4억 → 신고공제 1,920만
    expect(r.main.value).toBe(W(620_800_000));
  });

  it('순재산 10억·배우자 없음: 옛 9,000만 → 새 8,730만 (신고세액공제 270만)', () => {
    expect(옛(10 * 억, false)).toBe(90_000_000);
    expect(run({ totalEstate: 10 * 억, debts: 0, hasSpouse: 'no' }).main.value).toBe(W(87_300_000));
  });

  it('childCount 가 계산에 들어간다 — 자녀 7명이면 기초 2억+3.5억 = 5.5억 > 일괄 5억', () => {
    const r = run({ totalEstate: 20 * 억, debts: 0, hasSpouse: 'no', childCount: 7 });
    expect(row(r, '기초공제 + 인적공제')).toBe(W(5.5 * 억));
    expect(row(r, '과세표준')).toBe(W(14.5 * 억));
  });

  it('미성년·연로자 인적공제가 합산된다 (자녀 2·연수 13·65세 1 → 2억+1억+1.3억+5천 = 4.8억 < 5억 → 일괄)', () => {
    const r = run({ totalEstate: 20 * 억, debts: 0, hasSpouse: 'no', minorYears: 13, seniorCount: 1 });
    expect(row(r, '일괄공제')).toBe(W(5 * 억));
    const r2 = run({ totalEstate: 20 * 억, debts: 0, hasSpouse: 'no', minorYears: 13, seniorCount: 2 });
    expect(row(r2, '기초공제 + 인적공제')).toBe(W(5.3 * 억));
  });

  it('§21② 배우자 단독상속(자녀 0)이면 일괄공제 불가 — 기초 2억만', () => {
    const r = run({ totalEstate: 20 * 억, debts: 0, childCount: 0 });
    expect(row(r, '기초·인적공제 (배우자 단독상속')).toBe(W(2 * 억));
    expect(row(r, '배우자상속공제')).toBe(W(20 * 억));
    expect(r.details.some((d) => d.label === '⚠️ 상속인 가정')).toBe(true);
  });

  it('§22 금융재산공제: 1천만 전액 · 5억 20% · 20억 한도 2억 · 5천만 최소 2천만', () => {
    const f = (x: number) => row(run({ totalEstate: 30 * 억, netFinancial: x }), '금융재산상속공제');
    expect(f(1000 * 만)).toBe(W(1000 * 만));
    expect(f(5000 * 만)).toBe(W(2000 * 만));
    expect(f(5 * 억)).toBe(W(1 * 억));
    expect(f(20 * 억)).toBe(W(2 * 억));
  });

  it('§25② 과세표준 50만원 미만이면 부과하지 않는다', () => {
    const r = run({ totalEstate: 5 * 억 + 30 * 만, debts: 0, hasSpouse: 'no' });
    expect(row(r, '과세최저한')).toContain('§25②');
    expect(r.main.value).toBe('0원');
  });

  it('현행 유산세 방식이라고 말한다', () => {
    expect(row(run({}), '방식')).toContain('유산세');
  });
});

describe('가업상속공제 — 10~14년 한도 200억 오류 수리', () => {
  const run = (o: Record<string, unknown>) => familyBusiness({ businessValue: 30 * 억, years: 15, revenueOver: 'no', __policy: POLICY, ...o } as any);
  it('경영기간 경계: 10년 300억 · 19년 300억 · 20년 400억 · 30년 600억', () => {
    expect(row(run({ years: 10 }), '가업상속공제 한도')).toBe(W(300 * 억));
    expect(row(run({ years: 19 }), '가업상속공제 한도')).toBe(W(300 * 억));
    expect(row(run({ years: 20 }), '가업상속공제 한도')).toBe(W(400 * 억));
    expect(row(run({ years: 30 }), '가업상속공제 한도')).toBe(W(600 * 억));
  });
  it('⛔ 가업 250억·경영 12년: 옛 절감 100억(한도 200억) → 새 116억 7,880만 (신고세액공제 반영)', () => {
    // 옛: 공제 전 120.4억 − 공제 후(50억) 20.4억 = 100억
    expect(Math.round(10.4 * 억 + 220 * 억 * 0.5) - Math.round(10.4 * 억 + 20 * 억 * 0.5)).toBe(100 * 억);
    const r = run({ businessValue: 250 * 억, years: 12 });
    expect(r.details.find((d) => d.label === '가업상속공제')!.value).toBe(W(250 * 억));
    expect(r.main.value).toBe(W(11_678_800_000));
  });
  it('기본값(30억·15년): 옛 10억 4,000만 → 새 10억 88만 (신고세액공제 3%만큼)', () => {
    expect(run({}).main.value).toBe(W(1_008_800_000));
  });
  it('매출 평균 5천억 이상이면 공제 0 — 절감 0원', () => {
    const r = run({ revenueOver: 'yes' });
    expect(r.main.value).toBe('0원');
    expect(row(r, '공제 불가')).toContain('5,000억');
  });
});

describe('부담부증여 — 신고세액공제·장기보유특별공제·지방소득세 보강', () => {
  const run = (o: Record<string, unknown>) => burdenGift({ propertyValue: 5 * 억, debt: 2 * 억, buyPrice: 3 * 억, relationship: 'adultChild', holdYears: 10, cgtCase: 'general', __policy: POLICY, ...o } as any);
  it('성분별: 증여세 3,880만 · 양도세 900만(장특 20%) · 지방소득세 90만 = 4,870만', () => {
    const r = run({});
    expect(row(r, '증여세 (납부)')).toBe(W(38_800_000));
    expect(row(r, '양도차익')).toBe(W(80_000_000));
    expect(row(r, '장기보유특별공제')).toBe(`−${W(16_000_000)}`);
    expect(row(r, '양도소득세')).toBe(W(9_000_000));
    expect(row(r, '지방소득세')).toBe(W(900_000));
    expect(r.main.value).toBe(W(48_700_000));
  });
  it('⛔ 옛 5,284만(신고공제·지방세·장특 없음) → 보유 3년 미만이면 새 5,292만 4천원 (지방세 128.4만 누락 − 신고공제 120만)', () => {
    const 옛 = 40_000_000 + Math.round(calcProgressiveTax(80_000_000 - 2_500_000, [{ min: 0, max: 14e6, rate: 0.06, deduction: 0 }, { min: 14e6, max: 5e7, rate: 0.15, deduction: 1_260_000 }, { min: 5e7, max: 8.8e7, rate: 0.24, deduction: 5_760_000 }]));
    expect(옛).toBe(52_840_000);
    expect(run({ holdYears: 2 }).main.value).toBe(W(52_924_000));
  });
  it('장특 표1: 3년 6% · 9년 18% · 15년 이상 30%', () => {
    expect(row(run({ holdYears: 3 }), '장기보유특별공제')).toBe(`−${W(4_800_000)}`);
    expect(row(run({ holdYears: 9 }), '장기보유특별공제')).toBe(`−${W(14_400_000)}`);
    expect(row(run({ holdYears: 40 }), '장기보유특별공제')).toBe(`−${W(24_000_000)}`);
  });
  it('1세대1주택 비과세(12억 이하)면 양도세 0 — 증여세만', () => {
    const r = run({ cgtCase: 'oneHouseExempt' });
    expect(r.main.value).toBe(W(38_800_000));
    expect(row(r, '양도소득세')).toContain('비과세');
  });
  it('12억 초과 1세대1주택은 계산하지 않았다고 말한다', () => {
    expect(row(run({ propertyValue: 15 * 억, cgtCase: 'oneHouseExempt' }), '양도소득세')).toContain('계산하지 않았다');
  });
  it('보유 2년 미만이면 단기세율 미반영을 말한다', () => {
    expect(row(run({ holdYears: 1 }), '⚠️ 단기 보유')).toContain('§104');
  });
});

describe('세대생략 증여 — 근거 §57 · 미성년 공제 2천만 · 20억 초과 40%', () => {
  const run = (o: Record<string, unknown>) => generationSkip({ amount: 2 * 억, minor: 'no', marriageBirth: 'no', parentDeceased: 'no', __policy: POLICY, ...o } as any);
  it('기본값(2억·성년): 옛 2,600만 → 새 2,522만 (신고세액공제 78만)', () => {
    expect(run({}).main.value).toBe(W(25_220_000));
  });
  it('⛔ 2억·미성년: 옛 2,600만(공제 5천만 고정) → 새 3,278만 6천원 (678만 6천원 과소였다)', () => {
    const r = run({ minor: 'yes' });
    expect(row(r, '기본 증여세')).toBe(W(26_000_000));
    expect(row(r, '세대생략 할증')).toBe(W(7_800_000));
    expect(r.main.value).toBe(W(32_786_000));
  });
  it('⛔ 30억·미성년: 옛 13억 2,600만 → 새 14억 145만 6천원 (40% 할증)', () => {
    const r = run({ amount: 30 * 억, minor: 'yes' });
    expect(row(r, '세대생략 할증 (40%')).toBe(W(412_800_000));
    expect(r.main.value).toBe(W(1_401_456_000));
    expect(1_401_456_000 - 1_326_000_000).toBe(75_456_000);
  });
  it('경계: 미성년·정확히 20억은 «초과» 가 아니라 30%', () => {
    expect(row(run({ amount: 20 * 억, minor: 'yes' }), '세대생략 할증 (30%')).toBeDefined();
    expect(row(run({ amount: 20 * 억 + 1, minor: 'yes' }), '세대생략 할증 (40%')).toBeDefined();
  });
  it('부모 사망이면 할증 없음(§57① 단서) · 혼인·출산 공제 1억 추가', () => {
    expect(row(run({ parentDeceased: 'yes' }), '세대생략 할증')).toContain('없음');
    expect(row(run({ marriageBirth: 'yes' }), '과세표준')).toBe(W(5000 * 만));
  });
});

describe('증여재산공제 조회 — 직계비속·혼인출산·그 밖의 사람', () => {
  const run = (o: Record<string, unknown>) => giftExemptionLookup({ relationship: 'adultChild', __policy: POLICY, ...o } as any);
  it('원문 값: 배우자 6억 · 성년 5천 · 미성년 2천 · 직계비속 5천 · 기타친족 1천', () => {
    expect(run({ relationship: 'spouse' }).main.value).toBe(W(6 * 억));
    expect(run({}).main.value).toBe(W(5000 * 만));
    expect(run({ relationship: 'minorChild' }).main.value).toBe(W(2000 * 만));
    expect(run({ relationship: 'descendant' }).main.value).toBe(W(5000 * 만));
    expect(run({ relationship: 'otherRelative' }).main.value).toBe(W(1000 * 만));
  });
  it('성년 자녀 + 혼인·출산: 옛 5천만 → 1억 5천만', () => {
    expect(run({ marriageBirth: 'yes' }).main.value).toBe(W(1.5 * 억));
    expect(run({ relationship: 'spouse', marriageBirth: 'yes' }).main.value).toBe(W(6 * 억));
  });
  it('⛔ 그 밖의 사람은 «0원» 이 아니라 «공제 없음»', () => {
    expect(run({ relationship: 'other' }).main.value).toBe('공제 없음');
  });
});

describe('종부세 — 12억 초과 2% 뭉개기·houseCount 무시·농특세 누락 수리', () => {
  const run = (o: Record<string, unknown>) => comprehensivePropertyTax({ publicPrice: 15 * 억, houseCount: 1, oneHouse: 'yes', elderAge: 'none', holdPeriod: 'none', __policy: POLICY, ...o } as any);
  const 옛 = (pub: number, one: boolean) => {
    const base = Math.max(0, Math.round((pub - (one ? 12 * 억 : 9 * 억)) * 0.6));
    return Math.round(calcProgressiveTax(base, [
      { min: 0, max: 3 * 억, rate: 0.005, deduction: 0 }, { min: 3 * 억, max: 6 * 억, rate: 0.007, deduction: 600_000 },
      { min: 6 * 억, max: 12 * 억, rate: 0.01, deduction: 2_400_000 }, { min: 12 * 억, max: Infinity, rate: 0.02, deduction: 14_400_000 },
    ]));
  };
  it('기본값(15억·1주택): 옛 90만 → 새 108만 (농특세 18만 누락)', () => {
    expect(옛(15 * 억, true)).toBe(900_000);
    const r = run({});
    expect(row(r, '종합부동산세')).toBe(W(900_000));
    expect(row(r, '농어촌특별세')).toBe(W(180_000));
    expect(r.main.value).toBe(W(1_080_000));
  });
  it('⛔ 40억·2주택: 옛 2,280만 → 새 산출 1,818만 (462만 과대였다)', () => {
    expect(옛(40 * 억, false)).toBe(22_800_000);
    expect(row(run({ publicPrice: 40 * 억, houseCount: 2, oneHouse: 'no' }), '산출세액')).toBe(W(18_180_000));
  });
  it('⛔ 100억: 2주택 7,320만(옛 9,480만 과대) · 3주택 1억 2,900만(옛 과소 3,420만)', () => {
    expect(옛(100 * 억, false)).toBe(94_800_000);
    expect(row(run({ publicPrice: 100 * 억, houseCount: 2, oneHouse: 'no' }), '산출세액')).toBe(W(73_200_000));
    expect(row(run({ publicPrice: 100 * 억, houseCount: 3, oneHouse: 'no' }), '산출세액')).toBe(W(129_000_000));
  });
  it('houseCount 가 세율표를 고른다 — 60억 2주택 3,490만 vs 3주택 5,240만', () => {
    expect(row(run({ publicPrice: 60 * 억, houseCount: 2, oneHouse: 'no' }), '산출세액')).toBe(W(34_900_000));
    expect(row(run({ publicPrice: 60 * 억, houseCount: 3, oneHouse: 'no' }), '산출세액')).toBe(W(52_400_000));
  });
  it('1주택 고령 70세+·보유 15년+ = 90% → 한도 80%', () => {
    const r = run({ publicPrice: 30 * 억, elderAge: 'a70', holdPeriod: 'h15' });
    // 과표 10.8억 → 360만 + 4.8억×1% = 840만 → 80% 공제 672만 → 168만 · 농특 33.6만
    expect(row(r, '1세대1주택 고령자·장기보유 공제 (80%')).toBe(`−${W(6_720_000)}`);
    expect(r.main.value).toBe(W(1_680_000 + 336_000));
  });
  it('재산세 공제·세부담상한 미반영을 화면에 말한다 · 공제 이하면 «과세 대상 아님»', () => {
    expect(row(run({}), '미반영 — 결과보다 낮아진다')).toContain('§9③');
    expect(run({ publicPrice: 10 * 억 }).main.value).toBe('과세 대상 아님');
  });
});

describe('법인세 — 2026 개정 세율(10/20/22/25%) · 사업연도 개시일 구분 · 지방소득세 성분', () => {
  const run = (o: Record<string, unknown>) => corporateTax({ taxBase: 5 * 억, fiscalStart: 'y2026', corpType: 'general', __policy: POLICY, ...o } as any);
  it('⛔ 기본값 5억: 옛 법인세 7,500만·지방 포함 8,250만 → 새 8,000만·8,800만 (550만 과소였다)', () => {
    const r = run({});
    expect(r.main.value).toBe(W(80_000_000));
    expect(row(r, '법인지방소득세')).toBe(W(8_000_000));
    expect(row(r, '합계')).toBe(W(88_000_000));
    expect(88_000_000 - Math.round(75_000_000 * 1.1)).toBe(5_500_000);
  });
  it('실해 표본: 1억 1,100만(옛 990만) · 30억 6억 3,800만(옛 6억 500만)', () => {
    expect(row(run({ taxBase: 1 * 억 }), '합계')).toBe(W(11_000_000));
    expect(row(run({ taxBase: 30 * 억 }), '합계')).toBe(W(638_000_000));
  });
  it('종전(2025-12-31 이전 개시) 선택 시 옛 세율 — 5억 7,500만', () => {
    expect(run({ fiscalStart: 'pre2026' }).main.value).toBe(W(75_000_000));
  });
  it('경계: 2억 정확히 10% · 200억 · 3천억', () => {
    expect(run({ taxBase: 2 * 억 }).main.value).toBe(W(20_000_000));
    expect(run({ taxBase: 200 * 억 }).main.value).toBe(W(3_980_000_000));
    expect(run({ taxBase: 3000 * 억 }).main.value).toBe(W(65_580_000_000));
  });
  it('소규모 성실신고확인 법인: 1억부터 20%', () => {
    expect(run({ taxBase: 1 * 억, corpType: 'smallRental' }).main.value).toBe(W(20_000_000));
  });
});

describe('G7 — 문구가 계산 로직만 주장한다', () => {
  const get = (slug: string) => CALCULATORS.find((c) => c.slug === slug)!;
  it('법인세: 「2026년 최신 기준 반영」·9~24% 문구 제거', () => {
    const c = get('corporate-tax');
    const text = JSON.stringify(c);
    expect(text).not.toContain('최신 기준 반영');
    expect(text).not.toContain('9~24%');
    expect(text).not.toContain('2억 이하 9%');
  });
  it('종부세: 조정대상지역 반영 거짓 FAQ 제거 · 새 입력 노출', () => {
    const c = get('comprehensive-property-tax');
    expect(JSON.stringify(c)).not.toContain('조정대상지역 여부에 따른 세율 차이를 반영');
    expect(c.inputs.map((i) => i.id)).toEqual(expect.arrayContaining(['elderAge', 'holdPeriod']));
  });
  it('상속·가업·세대생략 FAQ 에 증여공제 복붙 문구가 없다 · 근거 조문 정정', () => {
    for (const s of ['inheritance-tax', 'family-business', 'generation-skip']) {
      expect(JSON.stringify(get(s).faqs)).not.toContain('면제한도는?');
    }
    expect(get('generation-skip').legalBasis).toContain('제57조');
    expect(get('family-business').legalBasis).toContain('제18조의2');
    expect(JSON.stringify(get('inheritance-tax'))).not.toContain('5년 내 매도 시 이월과세');
  });
  it('계산기가 읽는 입력 id 가 registry 에 모두 있다', () => {
    const ids = (s: string) => get(s).inputs.map((i) => i.id);
    expect(ids('inheritance-tax')).toEqual(expect.arrayContaining(['spouseMode', 'spouseAmount', 'minorYears', 'seniorCount', 'netFinancial', 'childCount']));
    expect(ids('burden-gift')).toEqual(expect.arrayContaining(['holdYears', 'cgtCase']));
    expect(ids('generation-skip')).toEqual(expect.arrayContaining(['minor', 'marriageBirth', 'parentDeceased']));
    expect(ids('gift-exemption-lookup')).toEqual(expect.arrayContaining(['marriageBirth']));
    expect(ids('family-business')).toEqual(expect.arrayContaining(['revenueOver']));
    expect(ids('corporate-tax')).toEqual(expect.arrayContaining(['fiscalStart', 'corpType']));
  });
});

describe('공유 로직 교차 회귀 — 증여세 성분은 계산기가 달라도 같은 값', () => {
  it('부담부증여(채무 0·2억·성년) 증여세 = 세대생략(2억·성년·부모 사망=할증 없음) = 1,940만', () => {
    const a = burdenGift({ propertyValue: 2 * 억, debt: 0, buyPrice: 2 * 억, relationship: 'adultChild', holdYears: 10, __policy: POLICY } as any);
    const b = generationSkip({ amount: 2 * 억, minor: 'no', parentDeceased: 'yes', __policy: POLICY } as any);
    expect(row(a, '증여세 (납부)')).toBe(W(19_400_000));
    expect(b.main.value).toBe(W(19_400_000));
  });
  it('조회기의 공제액 = 부담부증여가 쓰는 공제액 (세 관계)', () => {
    for (const rel of ['spouse', 'adultChild', 'minorChild']) {
      const lookup = giftExemptionLookup({ relationship: rel, __policy: POLICY } as any).main.value;
      const used = burdenGift({ propertyValue: 10 * 억, debt: 0, buyPrice: 10 * 억, relationship: rel, __policy: POLICY } as any)
        .details.find((d) => d.label.startsWith('증여재산공제'))!.value;
      expect(used).toBe(lookup);
    }
  });
  it('가업상속 공제 전 상속세 = 상속세 계산기(공제 0 상황)의 신고 후 세액과 같은 표', () => {
    const fb = familyBusiness({ businessValue: 30 * 억, years: 15, __policy: POLICY } as any);
    const br = packBrackets(PACK, INH_RATE_KEYS, INH_UPTO_KEYS)!;
    const calc = progressive(30 * 억, br);
    expect(row(fb, '공제 전 상속세')).toBe(W(calc - Math.floor(calc * 3 / 100)));
  });
});
