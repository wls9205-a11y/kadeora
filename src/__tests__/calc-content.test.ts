/**
 * B2 콘텐츠층 회귀 (G7) — 계산기 FAQ·본문·description·입력 라벨이 «실제 계산 로직» 만 말하는가 (2026-09-17).
 *
 * 진단: 140종 중 114종에 결함. 카테고리 공통 템플릿이 복붙되며
 *   ① 반영하지 않는 것을 「반영합니다」라고 말했고(물타기 계산기가 「증권거래세와 수수료를 반영합니다」),
 *   ② 다른 주제 문단이 섞였고(단위 환산기에 「성별 선택 시 자동 반영」, 할인율 계산기에 해외직구 면세한도),
 *   ③ 코드·상수에 없는 숫자가 들어갔고(병사 월급 67만원 — 코드는 다른 값),
 *   ④ 「142종」이 실제 수와 어긋난 채 늙었다.
 *
 * ⚠️ EXCLUDED 는 같은 날 다른 워커가 G7 로 문구를 고치는 계산기다 — 여기서 잡으면 남의 작업을 막는다.
 *    그 수리가 끝나면 이 목록에서 빼서 같은 관문 안으로 들인다.
 */
import { describe, it, expect } from 'vitest';
import { CALC_REGISTRY, type CalcMeta } from '@/lib/calc/registry';

const EXCLUDED = new Set(`
capital-gains-housing capital-gains-rights multi-house-sim one-house-check major-shareholder-cgt overseas-cgt
inheritance-tax family-business burden-gift generation-skip gift-exemption-lookup comprehensive-property-tax
corporate-tax income-bracket-lookup acquisition-tax registration-cost registration-license-tax property-tax stamp-tax
vehicle-tax auction-profit financial-income-tax pension-income-tax retirement-pension-sim retirement-income-tax
withholding-calc withholding-3-3 dividend-calc dividend-income-tax etf-tax isa-tax-free daily-worker-tax crypto-tax
fis-tax-sim penalty-tax rental-income-tax deemed-rent year-end-refund credit-card-deduction donation-deduction
monthly-rent-deduction irp-deduction medical-deduction education-deduction insurance-deduction simplified-vat
national-pension customs-duty electricity discharge-date age-calc statute-of-limitations accident-compensation
consolation-money alcohol-calc body-fat due-date d-day ltv-calc
`.split(/\s+/).filter(Boolean));

const TARGETS = CALC_REGISTRY.filter((c) => !EXCLUDED.has(c.slug));

/** 사용자에게 보이는 글 전부 — description · FAQ · 본문 · 입력 라벨/힌트/선택지 */
function visibleText(c: CalcMeta): string {
  const inputs = c.inputs.flatMap((i) => [i.label, i.hint ?? '', ...(i.options ?? []).map((o) => o.label)]);
  return [c.description, ...c.faqs.flatMap((f) => [f.q, f.a]), c.seoContent, ...inputs].join('\n');
}

function offenders(test: (c: CalcMeta, text: string) => string | null): string[] {
  return TARGETS.map((c) => test(c, visibleText(c))).filter((x): x is string => x !== null);
}

describe('계산기 콘텐츠 — 반영하지 않는 것을 반영한다고 말하지 않는다', () => {
  it('제외 목록 slug 는 전부 실재한다 (오타로 관문을 비껴가지 않게)', () => {
    const slugs = new Set(CALC_REGISTRY.map((c) => c.slug));
    expect([...EXCLUDED].filter((s) => !slugs.has(s))).toEqual([]);
  });

  it('「반영합니다」류 단정이 없다 — 반영 항목은 산식으로, 미반영은 「들어 있지 않다」로 쓴다', () => {
    const CLAIM = /반영합니다|반영하여 정확한 결과|최신 기준 반영|성별 선택 시 자동 반영|상환 방식을 비교합니다|정확한 공제액을 계산합니다|실질 수익을 계산합니다/;
    expect(offenders((c, t) => (CLAIM.test(t) ? `${c.slug}: ${t.match(new RegExp(`.{0,30}(?:${CLAIM.source}).{0,10}`))?.[0]}` : null))).toEqual([]);
  });

  it('계산기 개수를 숫자로 박지 않는다 (「142종」은 실제 수와 어긋난 채 늙었다)', () => {
    expect(offenders((c, t) => (/\d+종의 (?:무료 )?계산기/.test(t) ? c.slug : null))).toEqual([]);
  });

  it('카테고리 공통 템플릿의 화석 숫자가 다시 들어오지 않는다', () => {
    const FOSSILS = [
      '3.545%', '0.45%', '9.4%', '최대 900만원', '50%+', '$200', '67만원', '0.4~0.9%', 'DSR 40% 규제',
      '250만원 공제', '250만원 초과 시 22%', '12억까지', '최대 80%', '1.5~4%', '200억 이하 19%', '0.18%',
    ];
    expect(offenders((c, t) => {
      const hit = FOSSILS.find((f) => t.includes(f));
      return hit ? `${c.slug}: ${hit}` : null;
    })).toEqual([]);
  });

  it('주제 금칙어 — 그 계산을 하지 않는 계산기에 다른 주제 전용어가 없다', () => {
    const TOPIC: { word: RegExp; allow: string[] }[] = [
      // 상환 방식을 실제로 계산(또는 입력)하는 계산기만
      { word: /원리금균등|원금균등|만기일시/, allow: ['loan-repayment', 'student-loan', 'tuition-loan', 'car-loan', 'car-installment', 'dsr-calc', 'lease-vs-installment'] },
      { word: /BMI|체질량/, allow: ['bmi'] },
      { word: /병사 월급|이병 \d/, allow: [] },
      { word: /해외직구 면세/, allow: [] },
      { word: /FIRE/, allow: ['fire-calc'] },
      { word: /법인세는/, allow: [] },
      { word: /72법칙|72의 법칙/, allow: ['compound-interest'] },
      { word: /중도상환수수료/, allow: ['prepayment-fee', 'refinance-compare'] },
      { word: /조정대상지역/, allow: ['capital-gains-land'] },
      { word: /간이세액표/, allow: ['net-salary', 'earned-income-tax'] },
      { word: /비과세 급여|자가운전보조금/, allow: ['net-salary'] },
    ];
    expect(offenders((c, t) => {
      const hit = TOPIC.find((x) => x.word.test(t) && !x.allow.includes(c.slug));
      return hit ? `${c.slug}: ${hit.word}` : null;
    })).toEqual([]);
  });

  it('「핵심 정보」 카테고리 공통 문단이 남아 있지 않다 (계산 방식 문단으로 대체)', () => {
    expect(offenders((c, t) => (/<h2>[^<]*핵심 (?:정보|포인트)<\/h2>/.test(t) ? c.slug : null))).toEqual([]);
  });

  it('세금을 계산하지 않는 투자 계산기는 그렇다고 말한다 (긍정형)', () => {
    for (const slug of ['avg-down', 'breakeven', 'dca-simulator', 'drip-sim', 'rebalance-calc', 'per-pbr-value']) {
      const c = CALC_REGISTRY.find((x) => x.slug === slug)!;
      expect(visibleText(c), slug).toMatch(/들어 있지 않|관계없는 계산/);
    }
  });
});
