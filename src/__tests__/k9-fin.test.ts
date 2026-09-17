/**
 * K-9 fin 수치 게이트 — 금융·소득세 클러스터 16종 (2026-09-17).
 *
 * 정책 꾸러미는 «손으로 만들지 않는다». 커밋된 마이그레이션 SQL 을 읽어 page.tsx 와 같은 파서로 만든다 —
 * 그래서 이 테스트가 통과하면 «DB 에 실린 문자열이 계산기가 읽는 수로 풀린다» 까지 함께 고정된다.
 * 각 표본은 ① 원문대로 손계산한 새 값(긍정형) ② 옛 공식의 값(반증형)을 같이 박는다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORMULAS,
  retirementIncomeTax, retirementPensionSim, pensionIncomeTax, financialIncomeTax,
  dividendCalc, dividendIncomeTax, etfTax, isaTaxFree, withholding33, dailyWorkerTax, withholdingCalc,
  cryptoTax, fisTaxSim, penaltyTax, rentalIncomeTax, deemedRent,
} from '@/lib/calc/formulas';
import { retirementTaxParts, pensionDeduction, piecewise, penaltyCutKey, retirementPensionRatioKey } from '@/lib/calc/k9/fin';
import { formatKRWExact, calcProgressiveTax, INCOME_TAX_BRACKETS } from '@/lib/calc/tax-tables';

const 억 = 100_000_000;
const 만 = 10_000;
const W = formatKRWExact;

// ── page.tsx 와 같은 파서 ───────────────────────────────────────────────────
function buildPack(files: string[]) {
  const pct: Record<string, number> = {};
  const amt: Record<string, number> = {};
  const meta: Record<string, { source?: string; date?: string; from?: string; status?: string }> = {};
  for (const f of files) {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', f), 'utf8');
    const re = /^\('([a-z0-9_]+)','(?:[^']|'')*','(?:[^']|'')*',ARRAY\['([^']*)'\],(?:NULL|'(?:[^']|'')*'),'((?:[^']|'')*)','[^']*','(\d{4}-\d{2}-\d{2})','(\d{4}-\d{2}-\d{2})','2026-09-17','(confirmed|unverified_current)'/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      const [, key, first, source, date, from, status] = m;
      const p = first.match(/^(-?\d+(?:\.\d+)?)\s*%/);
      if (p) pct[key] = Number(p[1]);
      const w = first.match(/^([\d,]+(?:\.\d+)?)\s*(억원|만원|원)$/);
      if (w) {
        const x = Number(w[1].replace(/,/g, ''));
        amt[key] = Math.round(x * (w[2] === '억원' ? 100_000_000 : w[2] === '만원' ? 10_000 : 1));
      }
      meta[key] = { source, date, from, status };
    }
  }
  return { pct, amt, meta };
}
const PACK = buildPack(['k9_fin_policy_constants_2026-09-17.sql', 'k9_deposit_interest_policy_constants_2026-09-17.sql']);
const POLICY = JSON.stringify(PACK);
const detail = (res: { details: { label: string; value: string }[] }, label: string) =>
  res.details.find((d) => d.label.startsWith(label))?.value;

describe('마이그레이션 → 파서 — 실린 문자열이 수로 풀린다', () => {
  it('fin 84행 전부가 pct 또는 amt 로 파싱된다(한 행에 수 하나)', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/k9_fin_policy_constants_2026-09-17.sql'), 'utf8');
    const keys = [...sql.matchAll(/^\('([a-z0-9_]+)',/gm)].map((m) => m[1]);
    expect(keys.length).toBe(84);
    for (const k of keys) expect(typeof PACK.pct[k] === 'number' || typeof PACK.amt[k] === 'number').toBe(true);
    expect(PACK.pct.int_tax_income).toBe(14);
    expect(PACK.pct.int_tax_local).toBe(10);
  });

  it('소수·억·천단위 쉼표 형식이 정확히 풀린다', () => {
    expect(PACK.pct.penalty_late_daily).toBe(0.022);
    expect(PACK.pct.penalty_late_monthly).toBe(0.67);
    expect(PACK.pct.deemed_rent_rate).toBe(3.1);
    expect(PACK.amt.wh_small_exempt).toBe(1000);
    expect(PACK.amt.retinc_conv_t2).toBe(7000 * 만);
    expect(PACK.amt.deemed_rent_2house_base).toBe(12 * 억);
    expect(PACK.meta.crypto_rate.from).toBe('2027-01-01');
    expect(PACK.meta.div_grossup_2027.from).toBe('2027-01-01');
  });

  it('LIKE 충돌 없음 — 가산세 penalty_ / 연금 pension_ 이 서로의 접두를 공유하지 않는다', () => {
    const keys = Object.keys(PACK.meta);
    expect(keys.some((k) => k.startsWith('pen_'))).toBe(false);
    expect(keys.filter((k) => k.startsWith('penalty_')).every((k) => !k.startsWith('pension_'))).toBe(true);
  });

  it('16종 전부 FORMULAS 에 등록돼 있다 — 6종은 등록 누락으로 화면에 결과가 안 떴다', () => {
    for (const k of ['financialIncomeTax', 'pensionIncomeTax', 'retirementPensionSim', 'retirementIncomeTax', 'withholdingCalc',
      'withholding33', 'dividendCalc', 'dividendIncomeTax', 'etfTax', 'isaTaxFree', 'dailyWorkerTax', 'cryptoTax', 'fisTaxSim',
      'penaltyTax', 'rentalIncomeTax', 'deemedRent']) {
      expect(typeof FORMULAS[k]).toBe('function');
    }
  });

  it('주입이 없으면 지어내지 않는다 — 「세율 기준 미수신」', () => {
    const fns = [retirementIncomeTax, retirementPensionSim, pensionIncomeTax, financialIncomeTax, dividendCalc, dividendIncomeTax,
      etfTax, isaTaxFree, withholding33, dailyWorkerTax, cryptoTax, penaltyTax, rentalIncomeTax, deemedRent];
    for (const f of fns) expect(f({ retirementPay: 1 * 억, years: 10, amount: 100 * 만, type: 'business' } as any).main.label).toBe('세율 기준 미수신');
    expect(withholdingCalc({ type: 'business', amount: 100 * 만 }).main.label).toBe('세율 기준 미수신');
  });
});

describe('공통 — 누적 구간식', () => {
  it('기초액을 싣지 않아도 표의 기초액이 복원된다(§47의2① · §48①2)', () => {
    const P = PACK.pct; const A = PACK.amt;
    expect(pensionDeduction(350 * 만, P, A)).toBe(350 * 만);
    expect(pensionDeduction(700 * 만, P, A)).toBeCloseTo(490 * 만, 4);
    expect(pensionDeduction(1400 * 만, P, A)).toBeCloseTo(630 * 만, 4);
    expect(pensionDeduction(3 * 억, P, A)).toBe(900 * 만);      // 한도
    const conv = (x: number) => piecewise(x, [A.retinc_conv_t1, A.retinc_conv_t2, A.retinc_conv_t3, A.retinc_conv_t4],
      [P.retinc_conv_b1, P.retinc_conv_b2, P.retinc_conv_b3, P.retinc_conv_b4, P.retinc_conv_b5]);
    expect(conv(7000 * 만)).toBeCloseTo(4520 * 만, 4);
    expect(conv(1 * 억)).toBeCloseTo(6170 * 만, 4);
    expect(conv(3 * 억)).toBeCloseTo(15170 * 만, 4);
  });
});

describe('퇴직소득세 — 옛 40% 정률공제식 → 현행 환산급여공제식 (§48 · §55② · 지방세법 §92④)', () => {
  const run = (pay: number, years: number) => retirementTaxParts(pay, years, PACK.pct, PACK.amt);
  const old = (pay: number, years: number) => {
    const deduction = Math.min(pay, years <= 5 ? years * 1000000 * 5 : 25000000 + (years - 5) * 2000000 * 5);
    const taxBase = Math.max(0, (pay - deduction) * 0.6 / years);
    return Math.round(calcProgressiveTax(taxBase * 12, INCOME_TAX_BRACKETS) / 12 * years);
  };

  it('1억·10년: 근속공제 1,500만 · 환산급여 1.02억 · 환산공제 6,260만 · 과표 3,940만 → 387.5만(옛 120만, 3.2배 과소)', () => {
    const t = run(1 * 억, 10);
    expect(t.svcDeduction).toBe(1500 * 만);
    expect(t.converted).toBe(10200 * 만);
    expect(t.convDeduction).toBe(6260 * 만);
    expect(t.taxBase).toBe(3940 * 만);
    expect(t.tax).toBe(3_875_000);
    expect(t.local).toBe(387_500);
    expect(old(1 * 억, 10)).toBe(1_200_000);
    const res = retirementIncomeTax({ retirementPay: 1 * 억, years: 10, __policy: POLICY });
    expect(res.main.value).toBe(W(4_262_500));
  });

  it('실해 표본 — 2억·20년 702.5만(옛 90만) · 5억·30년 3,234만(옛 1,800만) · 3천만·3년 128.625만(옛 103.5만)', () => {
    expect(run(2 * 억, 20).tax).toBe(7_025_000);
    expect(old(2 * 억, 20)).toBe(900_000);
    expect(run(5 * 억, 30).tax).toBe(32_340_000);
    expect(old(5 * 억, 30)).toBe(18_000_000);
    expect(run(3000 * 만, 3).tax).toBe(1_286_250);
    expect(old(3000 * 만, 3)).toBe(1_035_000);
  });

  it('근속연수공제 구간 경계 — 5·6·10·11·20·21년', () => {
    expect(run(10 * 억, 5).svcDeduction).toBe(500 * 만);
    expect(run(10 * 억, 6).svcDeduction).toBe(700 * 만);
    expect(run(10 * 억, 10).svcDeduction).toBe(1500 * 만);
    expect(run(10 * 억, 11).svcDeduction).toBe(1750 * 만);
    expect(run(10 * 억, 20).svcDeduction).toBe(4000 * 만);
    expect(run(10 * 억, 21).svcDeduction).toBe(4300 * 만);
  });

  it('퇴직금이 근속공제보다 작으면 공제는 퇴직금까지, 세금 0(§48②) · 1년 미만은 1년', () => {
    const t = run(300 * 만, 5);
    expect(t.svcDeduction).toBe(300 * 만);
    expect(t.tax).toBe(0);
    expect(run(1000 * 만, 0.4).years).toBe(1);
  });
});

describe('퇴직연금 연금 vs 일시금 — §129①5의3 (퇴직소득세와 같은 함수 교차 회귀)', () => {
  it('2억·20년·10년 균등: 일시금 772.75만 · 연금 540.925만 · 차이 231.825만(옛 513.6만, 2.2배 과대)', () => {
    const res = retirementPensionSim({ totalAmount: 2 * 억, years: 20, pensionYears: 10, __policy: POLICY });
    expect(detail(res, '일시금 세금 합계')).toBe(W(7_727_500));
    expect(detail(res, '연금 — 소득세 합계')).toBe(W(4_917_500));
    expect(detail(res, '연금 세금 합계')).toBe(W(5_409_250));
    expect(res.main.value).toBe(`${W(2_318_250)} 차이`);
    // 옛 공식
    const deduction = Math.min(2 * 억, 20 * 5000000);
    const lumpOld = Math.round(calcProgressiveTax(Math.max(0, 2 * 억 - deduction), INCOME_TAX_BRACKETS) * 0.6);
    const pensionOld = Math.round(2 * 억 / 120 * 12 * 0.033) * 10;
    expect(lumpOld - pensionOld).toBe(5_136_000);
  });

  it('교차 회귀 — 일시금 합계가 퇴직소득세 계산기 결과와 «같은 수» 다', () => {
    for (const [pay, yrs] of [[2 * 억, 20], [1 * 억, 10], [5 * 억, 30], [3000 * 만, 3]]) {
      const a = retirementIncomeTax({ retirementPay: pay, years: yrs, __policy: POLICY }).main.value;
      const b = detail(retirementPensionSim({ totalAmount: pay, years: yrs, pensionYears: 10, __policy: POLICY }), '일시금 세금 합계');
      expect(b).toBe(a);
    }
  });

  it('수령연차 경계 — 10년차 70% · 11년차 60% · 21년차 50%', () => {
    expect(retirementPensionRatioKey(10)).toBe('pension_ret_le10');
    expect(retirementPensionRatioKey(11)).toBe('pension_ret_11_20');
    expect(retirementPensionRatioKey(20)).toBe('pension_ret_11_20');
    expect(retirementPensionRatioKey(21)).toBe('pension_ret_gt20');
    // 2억·20년·20년 균등: 연 1,000만 × 3.5125% × (70%×10 + 60%×10) = 4,566,250
    const res = retirementPensionSim({ totalAmount: 2 * 억, years: 20, pensionYears: 20, __policy: POLICY });
    expect(detail(res, '연금 — 소득세 합계')).toBe(W(4_566_250));
  });
});

describe('연금소득세 — 공제표 정정 · 근거 없는 500만 제거 · 1,500만 선택 분기', () => {
  it('공적 1,200만·본인: 공제 590만 → 과표 460만 → 27.6만 − 표준세액공제 7만 = 20.6만(+지방 22.66만). 옛 13.2만', () => {
    const res = pensionIncomeTax({ annualPension: 1200 * 만, age: 65, type: 'public', persons: 1, __policy: POLICY });
    expect(detail(res, '연금소득공제')).toBe(W(590 * 만));
    expect(detail(res, '과세표준')).toBe(W(460 * 만));
    expect(detail(res, '연금소득세 (결정세액)')).toBe(W(206_000));
    expect(res.main.value).toBe(W(226_600));
    const oldDed = Math.min(1200 * 만 * 0.4, 9000000);
    expect(Math.round(calcProgressiveTax(Math.max(0, 1200 * 만 - oldDed - 5000000), INCOME_TAX_BRACKETS))).toBe(132_000);
  });

  it('사적 1,000만·65세: 5% + 지방 = 55만 (분리과세)', () => {
    const res = pensionIncomeTax({ annualPension: 1000 * 만, age: 65, type: 'private', __policy: POLICY });
    expect(res.main.value).toBe(W(550_000));
  });

  it('사적 나이 경계 — 69세 5% · 70세 4% · 80세 3% · 종신계약 3%', () => {
    const v = (age: number, life = 'no') => pensionIncomeTax({ annualPension: 1000 * 만, age, type: 'private', lifeAnnuity: life, __policy: POLICY }).main.value;
    expect(v(69)).toBe(W(550_000));
    expect(v(70)).toBe(W(440_000));
    expect(v(80)).toBe(W(330_000));
    expect(v(65, 'yes')).toBe(W(330_000));
  });

  it('사적 2,000만: 15% 분리 330만 vs 종합 68.86만 — 선택. 옛 110만(5.5% 일괄)', () => {
    const res = pensionIncomeTax({ annualPension: 2000 * 만, age: 65, type: 'private', persons: 1, __policy: POLICY });
    expect(detail(res, '① 분리과세')).toBe(W(3_300_000));
    expect(detail(res, '② 종합과세')).toBe(W(688_600));
    expect(res.main.value).toBe(W(688_600));
    expect(res.main.label).toContain('종합과세');
    expect(Math.round(2000 * 만 * 0.055)).toBe(1_100_000);
  });

  it('경계 — 정확히 1,500만은 분리과세(이하)', () => {
    const res = pensionIncomeTax({ annualPension: 1500 * 만, age: 65, type: 'private', __policy: POLICY });
    expect(res.main.value).toBe(W(825_000));
    expect(detail(res, '과세 방식')).toContain('이하');
  });
});

describe('금융소득종합과세 — Gross-up · 배당세액공제 · 지방세 (§17③ · §56 · §62 · 영 §116의2)', () => {
  it('기본값(이자 1,500·Gross-up 배당 1,000·과표 5,000만): 추가 소득세 194,545 + 지방 19,455. 옛 50만', () => {
    const res = financialIncomeTax({ interest: 1500 * 만, dividend: 1000 * 만, otherDividend: 0, otherIncome: 5000 * 만, __policy: POLICY });
    expect(detail(res, 'Gross-up 가산액')).toBe(W(100 * 만));
    expect(detail(res, '기준금액 초과 금융소득금액')).toBe(W(600 * 만));
    expect(detail(res, '① 종합과세 산출세액')).toBe(W(1048 * 만));
    expect(detail(res, '② 비교 산출세액')).toBe(W(974 * 만));
    expect(detail(res, '배당세액공제')).toBe(W(545_455));
    expect(detail(res, '추가 소득세')).toBe(W(194_545));
    expect(res.main.value).toBe(W(194_545 + 19_455));
    // 옛 공식
    const old = Math.max(0, Math.round(calcProgressiveTax(5000 * 만 + 500 * 만, INCOME_TAX_BRACKETS) - calcProgressiveTax(5000 * 만, INCOME_TAX_BRACKETS) + 20000000 * 0.14 - 2500 * 만 * 0.14));
    expect(old).toBe(500_000);
  });

  it('판정은 총수입금액 — 1,900만 + Gross-up 가산해도 2천만 이하면 분리과세(§14④)', () => {
    const res = financialIncomeTax({ interest: 0, dividend: 1900 * 만, otherDividend: 0, otherIncome: 5000 * 만, __policy: POLICY });
    expect(res.main.value).toBe(W(0));
    expect(detail(res, '판정')).toContain('분리과세');
  });

  it('Gross-up 비대상 배당만이면 가산·배당세액공제가 없다', () => {
    const res = financialIncomeTax({ interest: 1500 * 만, dividend: 0, otherDividend: 1000 * 만, otherIncome: 5000 * 만, __policy: POLICY });
    expect(detail(res, 'Gross-up 가산액')).toBe(W(0));
    // ① = T(5,500만) + 280만 = 744만 + 280만 = 1,024만 · ② = 350만 + 624만 = 974만 → 50만
    // 가산 대상이 없으면 옛 공식과 소득세는 같다 — 옛 결함은 Gross-up·배당세액공제·지방세 «누락» 이었다(합계 55만 vs 옛 50만).
    expect(detail(res, '추가 소득세')).toBe(W(500_000));
    expect(res.main.value).toBe(W(550_000));
  });

  it('2027 가산율 11% 는 계산에 쓰지 않고 «시행예정» 으로 공개한다', () => {
    const res = financialIncomeTax({ interest: 1500 * 만, dividend: 1000 * 만, otherDividend: 0, otherIncome: 5000 * 만, __policy: POLICY });
    expect(detail(res, '⚠️ 시행예정')).toContain('11%');
    expect(detail(res, '⚠️ 시행예정')).toContain('2027-01-01');
  });
});

describe('배당 — 국내 15.4% 성분 · 소액부징수 · 미국 15% 미확정 공개', () => {
  it('국내 500만: 소득세 70만 + 지방 7만', () => {
    const res = dividendIncomeTax({ dividend: 500 * 만, market: 'kr', __policy: POLICY });
    expect(res.main.value).toBe(W(770_000));
  });
  it('소액부징수 — 7,000원 배당: 소득세 980원(1천원 미만) → 0', () => {
    const res = dividendIncomeTax({ dividend: 7000, market: 'kr', __policy: POLICY });
    expect(res.main.value).toBe(W(0));
    expect(dividendIncomeTax({ dividend: 7143, market: 'kr', __policy: POLICY }).main.value).toBe(W(1000 + 100));
  });
  it('미국 — 15% 는 조약값 미확정으로 공개, 국내 추가 0', () => {
    const res = dividendIncomeTax({ dividend: 500 * 만, market: 'us', __policy: POLICY });
    expect(res.main.value).toBe(W(750_000));
    expect(detail(res, '⚠️ 미확정')).toContain('미확정');
  });
  it('배당금 계산기 — 5천만·4%: 세후 169.2만 (재투자는 계산하지 않는다고 말한다)', () => {
    const res = dividendCalc({ investment: 5000 * 만, yieldRate: 4, market: 'kr', __policy: POLICY });
    expect(res.main.value).toBe(W(1_692_000));
    expect(detail(res, '⚠️ 미반영')).toContain('재투자');
  });
});

describe('ETF — 국내 주식형 매매차익 비과세 분기 (영 §26의2④)', () => {
  it('국내 주식형 500만 차익: 0원 (옛 77만)', () => {
    expect(etfTax({ type: 'domesticStock', profit: 500 * 만, __policy: POLICY }).main.value).toBe(W(0));
    expect(etfTax({ type: 'domestic', profit: 500 * 만, __policy: POLICY }).main.value).toBe(W(0));   // 옛 저장값 호환
    expect(Math.round(500 * 만 * 0.154)).toBe(770_000);
  });
  it('국내 상장 기타(해외지수·채권 등) 500만: 70만 + 7만', () => {
    expect(etfTax({ type: 'domesticOther', profit: 500 * 만, __policy: POLICY }).main.value).toBe(W(770_000));
  });
  it('해외 상장 500만: (500−250)만 × 20% = 50만 + 지방 5만', () => {
    expect(etfTax({ type: 'overseas', profit: 500 * 만, __policy: POLICY }).main.value).toBe(W(550_000));
    expect(etfTax({ type: 'overseas', profit: 250 * 만, __policy: POLICY }).main.value).toBe(W(0));
  });
});

describe('ISA — 초과분 차익 누락 수리 (조특법 §91의18)', () => {
  it('일반형 300만: 200만×15.4% + 100만×(15.4−9.9)% = 36.3만 (옛 30.8만)', () => {
    const res = isaTaxFree({ profit: 300 * 만, type: 'general', __policy: POLICY });
    expect(res.main.value).toBe(W(363_000));
    expect(detail(res, '초과분 분리과세')).toBe(W(99_000));
    expect(Math.round(200 * 만 * 0.154)).toBe(308_000);
  });
  it('서민형 300만: 전액 비과세 → 46.2만', () => {
    expect(isaTaxFree({ profit: 300 * 만, type: 'lowIncome', __policy: POLICY }).main.value).toBe(W(462_000));
  });
});

describe('원천징수 — 3.3% · 일용 · 유형별 (과세최저한 · 소액부징수)', () => {
  it('3.3% — 300만 세전→세후 290.1만, 역산 왕복', () => {
    const a = withholding33({ direction: 'afterTax', amount: 300 * 만, __policy: POLICY });
    expect(a.main.value).toBe(W(2_901_000));
    expect(detail(a, '사업소득세')).toBe(W(90_000));
    expect(detail(a, '지방소득세')).toBe(W(9_000));
    const b = withholding33({ direction: 'beforeTax', amount: 2_901_000, __policy: POLICY });
    expect(b.main.value).toBe(W(300 * 만));
    expect(detail(b, '소액부징수')).toContain('적용 안 됨');
  });

  it('일용 — 일당 18.7만: 999원 → 소액부징수 0원 (옛 1,099원) · 20만: 1,485원 · 18.7만×5일: 5,494원', () => {
    expect(dailyWorkerTax({ dailyWage: 187_000, __policy: POLICY }).main.value).toBe(W(0));
    const old = Math.round(37_000 * 0.06 * 0.45) + Math.round(Math.round(37_000 * 0.06 * 0.45) * 0.1);
    expect(old).toBe(1_099);
    expect(dailyWorkerTax({ dailyWage: 200_000, __policy: POLICY }).main.value).toBe(W(1_485));
    expect(dailyWorkerTax({ dailyWage: 187_000, days: 5, __policy: POLICY }).main.value).toBe(W(4_995 + 500));
  });

  it('기타소득 60% 경비형 — 12.5만: 소득금액 5만 → 과세최저한 0원 (옛 8.8% = 1.1만)', () => {
    const res = withholdingCalc({ type: 'other', otherKind: 'exp60', amount: 125_000, __policy: POLICY });
    expect(res.main.value).toBe(W(0));
    expect(detail(res, '과세최저한')).toContain('§84');
    expect(Math.round(125_000 * 0.088)).toBe(11_000);
  });

  it('기타소득 — 100만 60%형 8.8만 · 100만 80%형 4.4만 · 경비 의제 없음 22만', () => {
    expect(withholdingCalc({ type: 'other', otherKind: 'exp60', amount: 100 * 만, __policy: POLICY }).main.value).toBe(W(88_000));
    expect(withholdingCalc({ type: 'other', otherKind: 'exp80', amount: 100 * 만, __policy: POLICY }).main.value).toBe(W(44_000));
    expect(withholdingCalc({ type: 'other', otherKind: 'none', amount: 100 * 만, __policy: POLICY }).main.value).toBe(W(220_000));
    // 경계: 60%형 125,001원 → 소득금액 50,000.4 > 5만 → 과세
    expect(withholdingCalc({ type: 'other', otherKind: 'exp60', amount: 125_001, __policy: POLICY }).main.value).toBe(W(11_000));
  });

  it('사업 3.3% · 이자 15.4% — 소액부징수 대상 아님(작은 금액도 뗀다)', () => {
    expect(withholdingCalc({ type: 'business', amount: 100 * 만, __policy: POLICY }).main.value).toBe(W(33_000));
    expect(withholdingCalc({ type: 'interest', amount: 100 * 만, __policy: POLICY }).main.value).toBe(W(154_000));
    expect(withholdingCalc({ type: 'business', amount: 10_000, __policy: POLICY }).main.value).toBe(W(330));
  });
});

describe('가상자산 — 미시행 시뮬레이션 라벨', () => {
  it('1,000만: (1,000−250)만 × 20% = 150만 (옛 22% = 165만) · 라벨에 시행일', () => {
    const res = cryptoTax({ profit: 1000 * 만, __policy: POLICY });
    expect(res.main.value).toBe(W(1_500_000));
    expect(res.main.label).toContain('미시행 시뮬레이션');
    expect(res.main.label).toContain('2027-01-01');
    expect(detail(res, '⚠️ 지방소득세')).toContain('미확정');
    expect(Math.round(750 * 만 * 0.22)).toBe(1_650_000);
  });
});

describe('금융투자소득세 — 폐지된 제도: 계산을 멈춘다', () => {
  it('금액을 내지 않고 삭제 조문을 말한다 (옛 1억 → 1,210만 «없는 세금»)', () => {
    const res = fisTaxSim();
    expect(res.main.label).toBe('폐지된 제도');
    expect(res.main.value).not.toMatch(/원$/);
    expect(detail(res, '근거')).toContain('2024-12-31');
    const old = Math.round((Math.min(5000 * 만, 3 * 억) * 0.22) * 1.1);
    expect(old).toBe(12_100_000);
  });
});

describe('가산세 — 부정·감면·월 0.67% (국세기본법 §47의2~§48 · 영 §27의4)', () => {
  const P = (o: Record<string, unknown>) => penaltyTax({ taxAmount: 500 * 만, __policy: POLICY, ...o } as any);
  it('무신고 500만: 20% 100만 · 부정 40% 200만 · 기한 후 1개월 이내 50% 감면 50만', () => {
    expect(P({ type: 'noFiling' }).main.value).toBe(W(100 * 만));
    expect(P({ type: 'noFiling', fraud: 'yes' }).main.value).toBe(W(200 * 만));
    expect(P({ type: 'noFiling', monthsLate: 1 }).main.value).toBe(W(50 * 만));
    expect(P({ type: 'noFiling', monthsLate: 7 }).main.value).toBe(W(100 * 만));
  });
  it('과소신고 500만: 10% 50만 · 수정신고 2개월 75% 감면 → 12.5만', () => {
    expect(P({ type: 'underReport' }).main.value).toBe(W(50 * 만));
    expect(P({ type: 'underReport', monthsLate: 2 }).main.value).toBe(W(125_000));
  });
  it('감면 구간 경계', () => {
    expect(penaltyCutKey('late', 1)).toBe('penalty_cut_late_1m');
    expect(penaltyCutKey('late', 6)).toBe('penalty_cut_late_6m');
    expect(penaltyCutKey('late', 7)).toBeNull();
    expect(penaltyCutKey('amend', 24)).toBe('penalty_cut_amend_24m');
    expect(penaltyCutKey('amend', 25)).toBeNull();
  });
  it('납부지연 500만·30일: 3.3만 · 고지 후 3개월 미납: +3% 15만 +월 0.67%×3 10.05만 = 28.35만', () => {
    expect(P({ type: 'latePay', days: 30 }).main.value).toBe(W(33_000));
    expect(P({ type: 'latePay', days: 30, noticed: 'yes', monthsAfterDue: 3 }).main.value).toBe(W(283_500));
  });
  it('150만 미만 고지세액은 월 가산 없음(§47의4⑧)', () => {
    const res = penaltyTax({ type: 'latePay', taxAmount: 100 * 만, days: 0, noticed: 'yes', monthsAfterDue: 12, __policy: POLICY });
    expect(res.main.value).toBe(W(30_000));
  });
});

describe('주택임대소득 — 추가공제 요건 · 2천만 초과 분리과세 불가 · 지방세', () => {
  it('기본값(1,500만·다른 소득 4,000만·등록): 추가공제 없음 → 84만 + 지방 8.4만 (옛 28만, 3배 과소)', () => {
    const res = rentalIncomeTax({ annualRent: 1500 * 만, otherIncome: 4000 * 만, registered: 'yes', __policy: POLICY });
    expect(detail(res, '추가공제')).toContain('없음');
    expect(res.main.value).toBe(W(924_000));
    expect(Math.round(Math.max(0, 1500 * 만 - 1500 * 만 * 0.6 - 4000000) * 0.14)).toBe(280_000);
  });
  it('다른 소득 2,000만(이하) → 추가공제 400만 → 28만 + 2.8만', () => {
    const res = rentalIncomeTax({ annualRent: 1500 * 만, otherIncome: 2000 * 만, registered: 'yes', __policy: POLICY });
    expect(res.main.value).toBe(W(308_000));
  });
  it('수입 2,000만 초과 → 분리과세 불가(계산하지 않음) · 정확히 2,000만은 가능', () => {
    expect(rentalIncomeTax({ annualRent: 2001 * 만, otherIncome: 0, registered: 'no', __policy: POLICY }).main.label).toContain('분리과세 불가');
    expect(rentalIncomeTax({ annualRent: 2000 * 만, otherIncome: 0, registered: 'no', __policy: POLICY }).main.value).toBe(W(Math.round(800 * 만 * 0.14) + Math.round(800 * 만 * 0.14 * 0.1)));
  });
  it('소형주택 1호 감면 30%: 84만 → 58.8만 + 5.88만', () => {
    const res = rentalIncomeTax({ annualRent: 1500 * 만, otherIncome: 4000 * 만, registered: 'yes', smallCut: 'one', __policy: POLICY });
    expect(res.main.value).toBe(W(588_000 + 58_800));
  });
});

describe('간주임대료 — 60% 곱 · 3.1% · 주택 수 요건 (§25① · 영 §53 · 규칙 §23①)', () => {
  it('3주택·보증금 5억: 2억 × 60% × 3.1% = 372만 (옛 420만, +12.9%)', () => {
    expect(deemedRent({ deposit: 5 * 억, houseCount: 3, __policy: POLICY }).main.value).toBe(W(3_720_000));
    expect(Math.round(2 * 억 * 0.021)).toBe(4_200_000);
  });
  it('주택 수·보증금 경계 — 3주택 3억 이하 0 · 2주택 12억 이하 0 · 2주택 13억 1,860만 · 1주택 0', () => {
    expect(deemedRent({ deposit: 3 * 억, houseCount: 3, __policy: POLICY }).main.value).toContain('대상 아님');
    expect(deemedRent({ deposit: 12 * 억, houseCount: 2, __policy: POLICY }).main.value).toContain('대상 아님');
    expect(deemedRent({ deposit: 13 * 억, houseCount: 2, __policy: POLICY }).main.value).toBe(W(18_600_000));
    expect(deemedRent({ deposit: 20 * 억, houseCount: 1, __policy: POLICY }).main.value).toContain('대상 아님');
  });
  it('금융수익 차감, 음수는 0', () => {
    expect(deemedRent({ deposit: 5 * 억, houseCount: 3, financialIncome: 72 * 만, __policy: POLICY }).main.value).toBe(W(300 * 만));
    expect(deemedRent({ deposit: 5 * 억, houseCount: 3, financialIncome: 1 * 억, __policy: POLICY }).main.value).toBe(W(0));
  });
});
