/**
 * K-9 ext 클러스터 — «대장 밖» 수식 결함 8종 (2026-09-17).
 *
 * 주입 꾸러미는 «마이그레이션 SQL 파일에서» 만든다(page.tsx 파서와 같은 정규식) — ext 행 + 재사용하는 inh·cgt 행.
 * 각 describe 는 ① 원문 값과의 긍정형 일치 ② 옛 코드 대비 실해(숫자) 를 같이 박는다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  FORMULAS, jeonseWolse, giftTax, minimumWage, militaryPay, industrialAccident, isaConversion, capitalGainsLand, childCredit, generationSkip,
} from '@/lib/calc/formulas';
import { EXT_LAW, rentConvCapPct, computeLandCgt, computeIsaConversion, childCreditParts, LAND_KEYS } from '@/lib/calc/k9/ext';
import { loadCgtPolicy } from '@/lib/calc/k9/cgt';
import { formatKRWExact, calcProgressiveTax, INCOME_TAX_BRACKETS } from '@/lib/calc/tax-tables';
import { CALC_REGISTRY } from '@/lib/calc/registry';

const 억 = 100_000_000;
const 만 = 10_000;
const W = (x: number) => formatKRWExact(x);

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', f), 'utf8');
const EXT_SQL = read('k9_ext_policy_constants_2026-09-17.sql');
const rowsOf = (sql: string) => [...sql.matchAll(/^\('([a-z0-9_]+)','[^']*','[^']*',ARRAY\['([^']*)'/gm)].map((m) => [m[1], m[2]] as const);
const EXT_ROWS = rowsOf(EXT_SQL);
const ALL_ROWS = [...EXT_ROWS, ...rowsOf(read('k9_inh_policy_constants_2026-09-17.sql')), ...rowsOf(read('k9_cgt_policy_constants_2026-09-17.sql'))];
function packOf(rows: readonly (readonly [string, string])[]) {
  const pct: Record<string, number> = {};
  const amt: Record<string, number> = {};
  const meta: Record<string, unknown> = {};
  for (const [key, first] of rows) {
    const m = first.match(/^(-?\d+(?:\.\d+)?)\s*%/);
    if (m) pct[key] = Number(m[1]);
    const w = first.match(/^([\d,]+(?:\.\d+)?)\s*(억원|만원|원)$/);
    if (w) {
      const x = Number(w[1].replace(/,/g, ''));
      amt[key] = Math.round(x * (w[2] === '억원' ? 100_000_000 : w[2] === '만원' ? 10_000 : 1));
    }
    meta[key] = { source: 'test', from: key === 'ext_bok_base_rate' ? '2026-08-27' : undefined };
  }
  return JSON.stringify({ pct, amt, meta });
}
const POLICY = packOf(ALL_ROWS);
const P = JSON.parse(POLICY) as { pct: Record<string, number>; amt: Record<string, number> };
const val = (r: { details: { label: string; value: string }[] }, label: string) => r.details.find((d) => d.label.startsWith(label))?.value;

describe('마이그레이션 행 — 파서가 전부 읽는다', () => {
  it('ext 25행 전부 pct 또는 amt 로 읽힌다', () => {
    expect(EXT_ROWS.length).toBe(25);
    const unread = EXT_ROWS.filter(([k]) => P.pct[k] === undefined && P.amt[k] === undefined).map(([k]) => k);
    expect(unread).toEqual([]);
  });
  it('말미 단언 수 = 실제 행 수, 접두는 ext_ 하나', () => {
    expect(EXT_SQL).toContain(`IF n_ext <> ${EXT_ROWS.length} THEN`);
    expect(EXT_ROWS.every(([k]) => k.startsWith('ext_'))).toBe(true);
  });
  it('주입이 없으면 8종 모두 값을 지어내지 않는다', () => {
    for (const f of [jeonseWolse, giftTax, minimumWage, militaryPay, industrialAccident, isaConversion, capitalGainsLand, childCredit]) {
      expect(f({}).main.value).toBe('—');
    }
  });
  it('FORMULAS 등록 8종 모두 k9 본문이다 — 미등록 4종은 [S] 해제 판정(2026-09-17)으로 등록됐다', () => {
    expect(FORMULAS.jeonseWolse).toBe(jeonseWolse);
    expect(FORMULAS.giftTax).toBe(giftTax);
    expect(FORMULAS.militaryPay).toBe(militaryPay);
    expect(FORMULAS.childCredit).toBe(childCredit);
    for (const k of ['minimumWage', 'industrialAccident', 'isaConversion', 'capitalGainsLand']) expect(typeof FORMULAS[k]).toBe('function');
  });
});

describe('jeonse-wolse — 시행령 §9 상한 · 월세→전세 월세 입력', () => {
  it('상한 = min(10%, 기준금리 3.00% + 2%) = 5%', () => {
    expect(rentConvCapPct({ ext_rent_conv_cap: 10, ext_rent_conv_add: 2, ext_bok_base_rate: 3 })).toBe(5);
    expect(rentConvCapPct({ ext_rent_conv_cap: 10, ext_rent_conv_add: 2, ext_bok_base_rate: 9 })).toBe(10);
  });
  it('전세→월세 (3억, 보증금 5천): 법정 상한 월세 1,041,667원 — 옛 기본 4.5% 는 937,500원(−104,167)', () => {
    const r = jeonseWolse({ direction: 'toWolse', jeonse: 3 * 억, deposit: 5000 * 만, rate: 0, __policy: POLICY });
    expect(r.main.value).toBe(W(1_041_667));
    expect(Math.round(2.5 * 억 * 0.045 / 12)).toBe(937_500);
  });
  it('월세→전세: 월세 100만이 들어간다 — 2억9천만원. 옛 코드는 입력칸이 없어 보증금 5천만원만 냈다', () => {
    const r = jeonseWolse({ direction: 'toJeonse', deposit: 5000 * 만, monthlyRent: 100 * 만, rate: 0, __policy: POLICY });
    expect(r.main.value).toBe(W(2.9 * 억));
  });
  it('상한을 넘는 입력은 경고한다', () => {
    const r = jeonseWolse({ direction: 'toWolse', jeonse: 3 * 억, deposit: 0, rate: 6, __policy: POLICY });
    expect(val(r, '⚠️ 상한 초과')).toContain('5.00%');
  });
});

describe('gift-tax — §53 손자녀 공제 · §57 할증 · §69 신고공제 (inh 공유 성분)', () => {
  it('성년 자녀 2억: 납부 19,400,000원 (산출 2,000만 − 신고공제 60만). 옛 값 20,000,000원', () => {
    const r = giftTax({ amount: 2 * 억, relationship: 'adultChild', priorGifts: 0, __policy: POLICY });
    expect(val(r, '산출세액')).toBe(W(2000 * 만));
    expect(r.main.value).toBe(W(1940 * 만));
  });
  it('성년 손자녀 1억: 공제 5천만 → 산출 500만 + 할증 150만 − 신고공제 19.5만 = 6,305,000원. 옛 값(공제 0 × 1.3) 13,000,000원', () => {
    const r = giftTax({ amount: 1 * 억, relationship: 'grandchild', priorGifts: 0, __policy: POLICY });
    expect(val(r, '증여재산공제')).toBe(W(5000 * 만));
    expect(r.main.value).toBe(W(6_305_000));
    expect(Math.round(1000 * 만 * 1.3)).toBe(13_000_000);
  });
  it('교차 회귀: 같은 입력이면 generation-skip 과 같은 납부액', () => {
    for (const [amount, minor] of [[1 * 억, 'no'], [3 * 억, 'yes'], [25 * 억, 'yes']] as const) {
      const a = giftTax({ amount, relationship: 'grandchild', grandchildMinor: minor, priorGifts: 0, __policy: POLICY });
      const b = generationSkip({ amount, minor, parentDeceased: 'no', marriageBirth: 'no', __policy: POLICY });
      expect(a.main.value).toBe(b.main.value);
    }
  });
  it('미성년 손자녀 25억은 40% 할증, 부모 사망이면 할증 없음', () => {
    const r = giftTax({ amount: 25 * 억, relationship: 'grandchild', grandchildMinor: 'yes', __policy: POLICY });
    expect(r.details.some((d) => d.label.includes('40%'))).toBe(true);
    const d = giftTax({ amount: 1 * 억, relationship: 'grandchild', parentDeceased: 'yes', __policy: POLICY });
    expect(val(d, '세대생략 할증')).toContain('없음');
  });
});

describe('minimum-wage — 고용노동부고시 제2025-47호 10,320원', () => {
  it('주 40시간·주휴 포함: 2,156,880원 = 고시 월 환산액(209시간). 옛 값 10,360×208 = 2,154,880원', () => {
    const r = minimumWage({ weeklyHours: 40, includeHoliday: 'yes', __today: '2026-09-17', __policy: POLICY });
    expect(r.main.value).toBe(W(2_156_880));
    expect(10360 * ((40 + 8) * 52 / 12)).toBe(2_154_880);
  });
  it('주 15시간 미만은 주휴 없음(근로기준법 §18③): 14시간 → 61시간 × 10,320 = 629,520원', () => {
    const r = minimumWage({ weeklyHours: 14, includeHoliday: 'yes', __today: '2026-09-17', __policy: POLICY });
    expect(r.main.value).toBe(W(629_520));
  });
  it('2027-01-01 부터는 제2026-60호 10,700원 → 2,236,300원(고시 월 환산액과 일치)', () => {
    const r = minimumWage({ weeklyHours: 40, includeHoliday: 'yes', __today: '2027-01-01', __policy: POLICY });
    expect(r.main.value).toBe(W(2_236_300));
  });
});

describe('military-pay — 공무원보수규정 별표 13 비고 6', () => {
  it.each([
    ['private', 750_000, 640_000], ['pfc', 900_000, 800_000], ['corporal', 1_200_000, 1_000_000], ['sergeant', 1_500_000, 1_250_000],
  ] as const)('%s: %d원 (옛 %d원)', (rank, now, old) => {
    expect(militaryPay({ rank, __policy: POLICY }).main.value).toBe(W(now));
    expect(now - old).toBeGreaterThan(0);
  });
});

describe('industrial-accident — 산재법 별표 2 · §52 · §57③', () => {
  const lump = { 1: 1474, 2: 1309, 3: 1155, 4: 1012, 5: 869, 6: 737, 7: 616, 8: 495, 9: 385, 10: 297, 11: 220, 12: 154, 13: 99, 14: 55 } as Record<number, number>;
  it('일시금 일수표가 원문과 14칸 모두 같다', () => {
    for (let g = 1; g <= 14; g++) expect(EXT_LAW.disabilityDays[g][1]).toBe(lump[g]);
    expect([1, 2, 3, 4, 5, 6, 7].map((g) => EXT_LAW.disabilityDays[g][0])).toEqual([329, 291, 257, 224, 193, 164, 138]);
  });
  it('10급·일당 15만·휴업 60일: 6,300,000 + 44,550,000 = 50,850,000원. 옛 표(한 칸 밀림 154일) 29,400,000원', () => {
    const r = industrialAccident({ dailyWage: 15 * 만, restDays: 60, disabilityGrade: '10', __policy: POLICY });
    expect(r.main.value).toBe(W(50_850_000));
    expect(15 * 만 * 0.7 * 60 + 15 * 만 * 154).toBe(29_400_000);
  });
  it('옛 표의 밀림: 12급 99(=13급) · 10급 154(=12급) · 7급 297(=10급) · 4급 616(=7급)', () => {
    const old = { 12: 99, 10: 154, 7: 297, 4: 616 } as Record<number, number>;
    expect([12, 10, 7, 4].map((g) => old[g])).toEqual([lump[13], lump[12], lump[10], lump[7]]);
  });
  it('1급은 연금만 — 일시금 1,474일분을 더하지 않고 연 329일분을 따로 보인다', () => {
    const r = industrialAccident({ dailyWage: 15 * 만, restDays: 60, disabilityGrade: '1', __policy: POLICY });
    expect(r.main.value).toBe(W(6_300_000));
    expect(r.details.some((d) => d.value === `연 ${W(15 * 만 * 329)}`)).toBe(true);
  });
  it('휴업 3일 이내는 휴업급여 0', () => {
    expect(industrialAccident({ dailyWage: 15 * 만, restDays: 3, disabilityGrade: '0', __policy: POLICY }).main.value).toBe('0원');
  });
});

describe('isa-conversion — 소득세법 §59의3④ 한도 × 세액공제율', () => {
  const IP = { ext_isa_conv_ratio: 10, ext_isa_conv_cap: 300 * 만, ext_pension_credit_rate: 12, ext_pension_credit_rate_low: 15, ext_pension_savings_cap: 600 * 만, ext_pension_total_cap: 900 * 만 };
  it('기본 한도를 채운 사람(연금저축 600 + IRP 300)이 2천만 전환: 공제대상 +200만 × 12% = 240,000원. 옛 화면은 한도 200만을 세액처럼 냈다', () => {
    const r = isaConversion({ isaBalance: 2000 * 만, transferAmount: 2000 * 만, transferInto: 'irp', pensionSavings: 600 * 만, irpPaid: 300 * 만, incomeLow: 'no', __policy: POLICY });
    expect(r.main.value).toBe(W(240_000));
    expect(Math.min(Math.round(2000 * 만 * 0.1), 300 * 만)).toBe(2_000_000);
  });
  it('납입이 없던 사람: 900만 + 추가 200만 = 1,100만 × 15% = 1,650,000원', () => {
    expect(computeIsaConversion({ transfer: 2000 * 만, savings: 0, irp: 0, into: 'irp', low: true }, IP).credit).toBe(1_650_000);
  });
  it('추가 한도 상한 300만(전환 5천만), 연금저축으로 넣어도 합계 한도는 같다', () => {
    const a = computeIsaConversion({ transfer: 5000 * 만, savings: 600 * 만, irp: 300 * 만, into: 'savings', low: false }, IP);
    expect(a.addLimit).toBe(300 * 만);
    expect(a.increase).toBe(300 * 만);
  });
});

describe('capital-gains-land — §104①8 은 «세율 +10%p», 세액 × 1.1 이 아니다', () => {
  const LP = loadCgtPolicy(POLICY, LAND_KEYS)!;
  it('주입 행이 다 있다', () => { expect(LP).not.toBeNull(); });
  it('기본값(3억−2억−500만, 5년, 비사업용): 소득세 22,460,000 + 지방 2,246,000 = 24,706,000원. 옛 값 17,133,600원(−7,572,400)', () => {
    const r = capitalGainsLand({ sellPrice: 3 * 억, buyPrice: 2 * 억, expenses: 500 * 만, holdYears: 5, nonBusiness: 'yes', __policy: POLICY });
    expect(r.main.value).toBe(W(24_706_000));
    const oldTax = Math.round(Math.round(calcProgressiveTax(8300 * 만, INCOME_TAX_BRACKETS)) * 1.1);
    expect(oldTax + Math.round(oldTax * 0.1)).toBe(17_133_600);
  });
  it('일반 토지는 옛 값과 같다(가산 없음): 15,576,000원', () => {
    const r = capitalGainsLand({ sellPrice: 3 * 억, buyPrice: 2 * 억, expenses: 500 * 만, holdYears: 5, nonBusiness: 'no', __policy: POLICY });
    expect(r.main.value).toBe(W(15_576_000));
  });
  it('단기: 1년 미만 50% · 1~2년 40% 와 비교해 큰 세액(§104① 후단)', () => {
    const a = computeLandCgt({ sell: 3 * 억, buy: 2 * 억, expenses: 500 * 만, hold: 0.5, nonBusiness: false }, LP)!;
    expect(a.useShort).toBe(true);
    expect(a.incomeTax).toBe(Math.round((9500 * 만 - 250 * 만) * 0.5));
    const b = computeLandCgt({ sell: 3 * 억, buy: 2 * 억, expenses: 500 * 만, hold: 1.5, nonBusiness: true }, LP)!;
    expect(b.incomeTax).toBe(Math.max(b.progressiveTax, b.shortTax));
  });
});

describe('child-credit — 소득세법 §59의2 (2024 개정 금액표)', () => {
  const CP = { ext_child_credit_1: 25 * 만, ext_child_credit_2: 55 * 만, ext_child_credit_extra: 40 * 만, ext_child_birth_1: 30 * 만, ext_child_birth_2: 50 * 만, ext_child_birth_3: 70 * 만 };
  it('2명 550,000원(옛 350,000) · 3명 950,000원(옛 650,000) · 1명 250,000원(옛 150,000)', () => {
    expect(childCredit({ childCount: 2, newborn: 0, __policy: POLICY }).main.value).toBe(W(55 * 만));
    expect(childCreditParts(3, 0, 1, CP).total).toBe(95 * 만);
    expect(childCreditParts(1, 0, 1, CP).total).toBe(25 * 만);
  });
  it('출산·입양은 «그 아이의 순위» — 둘째 1명 50만, 첫째부터 쌍둥이 80만', () => {
    expect(childCreditParts(0, 1, 2, CP).birth).toBe(50 * 만);
    expect(childCreditParts(0, 2, 1, CP).birth).toBe(80 * 만);
  });
});

describe('레지스트리(G7) — 옛 틀린 숫자가 문구에 남지 않았다', () => {
  const get = (slug: string) => JSON.stringify(CALC_REGISTRY.find((c) => c.slug === slug));
  it('jeonse-wolse 에 월세 입력칸이 있다', () => {
    expect(get('jeonse-wolse')).toContain('"monthlyRent"');
    expect(get('jeonse-wolse')).not.toContain('입력칸이 없어');
  });
  it('child-credit 은 8세·옛 금액을 말하지 않는다', () => { expect(get('child-credit')).not.toContain('8세'); });
  it('capital-gains-land 는 1.1배 근사를 말하지 않는다', () => { expect(get('capital-gains-land')).not.toContain('1.1배'); });
  it('gift-tax 는 「6촌」·「공제는 현재 미반영」을 말하지 않는다', () => {
    expect(get('gift-tax')).not.toContain('6촌');
    expect(get('gift-tax')).not.toContain('미반영)');
  });
});
