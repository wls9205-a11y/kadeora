/**
 * K-9 A″ a2 — FORMULAS 맵 미등록 계산기 감사 회귀 (2026-09-17).
 *
 * 규율: 호출은 «정본 경유»(FORMULAS[registry.formula]) — 함수 직접 호출은 맵 갭을 못 본다.
 * 정책 주입은 실 DB 스냅샷(fixtures/policy_constants.snapshot.json)을 페이지와 같은 파서로.
 * 각 계산기는 ① 원문·산식과의 긍정형 일치 ② 옛 코드 대비 실해(숫자) 를 같이 박는다.
 */
import { describe, it, expect } from 'vitest';
import { FORMULAS } from '@/lib/calc/formulas';
import { CALC_REGISTRY } from '@/lib/calc/registry';
import { policyPackFromRows } from '@/lib/calc/gov-tables';
import { formatKRWExact } from '@/lib/calc/tax-tables';
import rows from './fixtures/policy_constants.snapshot.json';
import { noticePayParts, A2_LAW } from '@/lib/calc/k9/a2';

const POLICY = JSON.stringify(policyPackFromRows(rows as any));
const W = (x: number) => formatKRWExact(x);
type R = { main: { label: string; value: string }; details: { label: string; value: string }[] };
const val = (res: R, label: string) => res.details.find((d) => d.label.startsWith(label))?.value;

/** registry 기본 입력 + 덮어쓰기로 «맵 경유» 호출. */
function run(slug: string, over: Record<string, string | number> = {}, policy = true): R {
  const calc = CALC_REGISTRY.find((c) => c.slug === slug)!;
  const fn = (FORMULAS as any)[calc.formula];
  expect(typeof fn, `${slug} 맵 미등록`).toBe('function');
  const v: Record<string, string | number> = policy ? { __policy: POLICY } : {};
  for (const inp of calc.inputs) v[inp.id] = inp.default;
  return fn({ ...v, ...over });
}

describe('jeonse-loan — 단리 이자(순수 산식)', () => {
  it('기본 2억·3.5%: 월 583,333원(옛값과 동일) + 일할 30·31일', () => {
    const res = run('jeonse-loan');
    expect(res.main.value).toBe(W(583_333));
    expect(val(res, '연 이자')).toBe(W(7_000_000));
    expect(val(res, '일할 계산 — 30일')).toBe(W(575_342));
    expect(val(res, '일할 계산 — 31일')).toBe(W(594_521));
  });
  it('경계: 금리 0 → 0원, 음수 금액은 0 으로', () => {
    expect(run('jeonse-loan', { rate: 0 }).main.value).toBe(W(0));
    expect(run('jeonse-loan', { loanAmount: -5 }).main.value).toBe(W(0));
  });
});

describe('severance-calc — 근로기준법 §26 · 시행령 §6', () => {
  it('뼈대 상수 = 조문(30일·3개월·주15시간·주40시간)', () => {
    expect(A2_LAW.noticeDays).toBe(30);
    expect(A2_LAW.noticeMinTenureMonths).toBe(3);
    expect(A2_LAW.weeklyHolidayMinHours).toBe(15);
    expect(A2_LAW.statutoryWeeklyHours).toBe(40);
  });
  it('실해: 월 350만·주40·일8 — 옛 3,500,000원 → 법 4,019,139원(209시간)', () => {
    const res = run('severance-calc');
    expect(res.main.value).toBe(W(4_019_139));
    expect(res.main.value).not.toBe(W(3_500_000));
    const p = noticePayParts(3_500_000, 40, 8);
    expect(p.monthHours).toBe(209);
    expect(p.monthHoursExact).toBeCloseTo(208.5714, 3);
    expect(p.payExact).toBe(Math.round(3_500_000 / (48 * 365 / 7 / 12) * 8 * 30));
  });
  it('단시간: 주 20시간·일 4시간 → 기준시간 104(=(20+4)×365/7/12=104.29 반올림)', () => {
    const p = noticePayParts(1_000_000, 20, 4);
    expect(p.monthHours).toBe(104);
    expect(p.pay).toBe(Math.round(1_000_000 / 104 * 4 * 30));
  });
  it('경계: 주 14시간은 주휴 없음 / 15시간은 주휴 3시간', () => {
    expect(noticePayParts(1, 14, 1).weeklyPaidHours).toBe(14);
    expect(noticePayParts(1, 15, 1).weeklyPaidHours).toBe(18);
    expect(noticePayParts(1, 52, 1).weeklyPaidHours).toBe(60); // 주휴는 40시간 기준 상한 8
  });
  it('근속 3개월 미만 → 0원 + 사유(§26 단서 1호)', () => {
    const res = run('severance-calc', { tenure: 'under3m' });
    expect(res.main.value).toBe(W(0));
    expect(val(res, '사유')).toContain('§26 단서 1호');
  });
  it('G7: FAQ·본문이 «월급 그대로» 를 주장하지 않는다', () => {
    const c = CALC_REGISTRY.find((x) => x.slug === 'severance-calc')!;
    const text = JSON.stringify(c.faqs) + c.seoContent;
    expect(text).not.toContain('그대로 보여줍니다');
    expect(text).toContain('1일 통상임금 × 30일');
  });
});

describe('business-income-tax · freelancer-tax — 공유 코어 bizTaxParts (§50①·§55①·§59의4⑨2나)', () => {
  const pack = policyPackFromRows(rows as any);
  it('재사용 행이 실 DB 값: 기본공제 150만원 · 표준세액공제 7만원 · 지방 10%', () => {
    expect(pack.amt!.pension_basic_ded).toBe(1_500_000);
    expect(pack.amt!.pension_std_credit).toBe(70_000);
    expect(pack.pct!.int_tax_local).toBe(10);
  });
  it('실해 business 기본(1억−6천만): 옛 4,389,000원(500만 근사 공제·×1.1) → 4,889,500원', () => {
    // 과표 38,500,000 → 840,000 + 24,500,000×15% = 4,515,000 − 70,000 = 4,445,000 + 지방 444,500
    const res = run('business-income-tax');
    expect(res.main.value).toBe(W(4_889_500));
    expect(val(res, '과세표준')).toBe(W(38_500_000));
    expect(val(res, '산출세액')).toBe(W(4_515_000));
    expect(val(res, '종합소득세 (결정세액)')).toBe(W(4_445_000));
    expect(val(res, '지방소득세')).toBe(W(444_500));
  });
  it('실해 freelancer 기본(5천만·64.1%·기납부 165만): 옛 환급 795,300원 → 398,750원', () => {
    // 소득 17,950,000 − 150만 = 16,450,000 → 840,000 + 2,450,000×15% = 1,207,500 − 70,000 = 1,137,500 + 113,750 = 1,251,250
    const res = run('freelancer-tax');
    expect(res.main.label).toBe('예상 환급');
    expect(res.main.value).toBe(W(398_750));
    expect(val(res, '세금 합계')).toBe(W(1_251_250));
  });
  it('교차 회귀: 같은 소득이면 두 계산기의 세금 합계가 같다', () => {
    const b = run('business-income-tax', { revenue: 17_950_000, expenses: 0 });
    const f = run('freelancer-tax', { annualRevenue: 17_950_000, expenseRate: 0, withheld: 0 });
    expect(b.main.value).toBe(val(f, '세금 합계'));
  });
  it('경계: 과표 1,400만 정확히 → 84만 − 7만 / 산출세액 7만 미만이면 공제는 산출세액까지(음수 없음)', () => {
    expect(val(run('business-income-tax', { revenue: 15_500_000, expenses: 0 }), '산출세액')).toBe(W(840_000));
    const small = run('business-income-tax', { revenue: 2_000_000, expenses: 0 }); // 과표 50만 → 3만
    expect(val(small, '표준세액공제')).toBe(`−${W(30_000)}`);
    expect(small.main.value).toBe(W(0));
  });
  it('인원·그 밖의 소득공제가 과표를 줄인다 / 결손이면 0원 + 결손금 행', () => {
    expect(val(run('business-income-tax', { persons: 3, otherDeductions: 1_000_000 }), '과세표준')).toBe(W(40_000_000 - 4_500_000 - 1_000_000));
    const loss = run('business-income-tax', { revenue: 10_000_000, expenses: 12_000_000 });
    expect(loss.main.value).toBe(W(0));
    expect(val(loss, '결손금')).toBe(W(2_000_000));
  });
  it('주입 없으면 지어내지 않는다 — 「미수신」', () => {
    expect(run('business-income-tax', {}, false).main.label).toMatch(/미수신/);
    expect(run('freelancer-tax', {}, false).main.label).toMatch(/미수신/);
  });
  it('G7: 두 계산기 문구에 «500만원 근사» 가 남지 않았다 · 쓰지 않던 경비 유형 입력 제거', () => {
    for (const slug of ['business-income-tax', 'freelancer-tax']) {
      const c = CALC_REGISTRY.find((x) => x.slug === slug)!;
      expect(JSON.stringify(c.faqs) + c.seoContent + c.description).not.toMatch(/500만/);
    }
    expect(CALC_REGISTRY.find((x) => x.slug === 'freelancer-tax')!.inputs.map((i) => i.id)).not.toContain('expenseType');
  });
});

describe('credit-loan-est — 신용대출 한도 차주 연소득 이내(행정지도 공개형)', () => {
  it('실해: 연소득 5천만 — 옛 125,000,000원(3등급 2.5배) → 상한 50,000,000원', () => {
    const res = run('credit-loan-est', { creditGrade: '1' });
    expect(res.main.value).toBe(W(50_000_000));
    expect(val(res, '근거')).toContain('fsc.go.kr');
    expect(val(res, '⚠️ 규제 성격')).toContain('2026-09-17');
  });
  it('등급 입력은 없다(상한을 올리지 못한다) · G7 문구에 «배수» 가정 없음', () => {
    const c = CALC_REGISTRY.find((x) => x.slug === 'credit-loan-est')!;
    expect(c.inputs.map((i) => i.id)).toEqual(['annualIncome']);
    expect(JSON.stringify(c.faqs) + c.seoContent).not.toMatch(/등급별 배수|가정 배수/);
  });
});

describe('foreign-dividend-credit — 소득세법 §57①② · §129④', () => {
  it('실해: 국외 500만·외국세 75만·종합소득 3천만·산출세액 3,015,000 — 옛 750,000원 → 502,500원 + 이월 247,500원', () => {
    const res = run('foreign-dividend-credit');
    expect(res.main.value).toBe(W(502_500));
    expect(res.main.value).not.toBe(W(750_000)); // 옛 min(외국세, 산출세액)
    expect(val(res, '한도 초과분')).toBe(W(247_500));
    expect(val(res, '공제한도')).toBe(W(502_500));
  });
  it('경계: 국외소득 = 종합소득 전부면 옛 산식과 같다 / 외국세 < 한도면 외국세 전액 · 이월 행 없음', () => {
    expect(run('foreign-dividend-credit', { foreignIncome: 30_000_000 }).main.value).toBe(W(750_000));
    const low = run('foreign-dividend-credit', { foreignTax: 100_000 });
    expect(low.main.value).toBe(W(100_000));
    expect(val(low, '한도 초과분')).toBeUndefined();
  });
  it('입력 오류 방어: 종합소득 0 → 한도 0 / 국외소득 > 종합소득 → 비율 1', () => {
    expect(run('foreign-dividend-credit', { totalIncome: 0 }).main.value).toBe(W(0));
    expect(run('foreign-dividend-credit', { foreignIncome: 99_000_000 }).main.value).toBe(W(750_000));
  });
  it('G7: 결과 라벨이 「환급 가능액」 이 아니다 · 본문에 한도식', () => {
    const c = CALC_REGISTRY.find((x) => x.slug === 'foreign-dividend-credit')!;
    expect(c.resultLabel).toBe('외국납부세액공제');
    expect(c.seoContent).toContain('국외원천소득 ÷ 종합소득금액');
  });
});

describe('csat-grade — 영어 절대평가 · 국어·수학 가정 구간 공개', () => {
  it('영어 경계: 90→1 · 89→2 · 20→8 · 19→9', () => {
    const g = (score: number) => run('csat-grade', { subject: 'english', score }).main.value;
    expect([g(90), g(89), g(20), g(19), g(100), g(0)]).toEqual(['1등급', '2등급', '8등급', '9등급', '1등급', '9등급']);
  });
  it('국어 기본 85점: 옛값과 같은 2등급이지만 «가정 구간» 라벨로 공개 · 범위 밖 입력은 0~100 으로', () => {
    const res = run('csat-grade');
    expect(res.main.value).toBe('2등급');
    expect(res.main.label).toContain('가정');
    expect(run('csat-grade', { score: 150 }).main.value).toBe('1등급');
    expect(run('csat-grade', { score: -3 }).main.value).toBe('9등급');
  });
});

describe('investment-type-test — 점수 합산(순수)', () => {
  it('경계: 3·4점 안전형 / 5·6 안정추구형 / 7·8 위험중립형 / 9 적극투자형', () => {
    const t = (a: string, b: string, c: string) => run('investment-type-test', { q1: a, q2: b, q3: c }).main.value;
    expect([t('1', '1', '1'), t('2', '1', '1'), t('2', '2', '1'), t('2', '2', '2'), t('3', '2', '2'), t('3', '3', '2'), t('3', '3', '3')])
      .toEqual(['안전형', '안전형', '안정추구형', '안정추구형', '위험중립형', '위험중립형', '적극투자형']);
  });
  it('범위 밖 값은 1~3 으로 묶는다(옛 코드: q=9 면 27점 적극투자형)', () => {
    expect(val(run('investment-type-test', { q1: '9', q2: '9', q3: '9' }), '점수')).toContain('9/9점');
  });
});
