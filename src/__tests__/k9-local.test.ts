/**
 * K-9 local — 지방세 6계산기 회귀 (2026-09-17).
 * 픽스처 k9-local.policy.json 은 마이그레이션 k9_local_policy_constants_2026-09-17.sql 과 «같은 생성기» 가
 * page.tsx 파서 규칙(numbers 첫 원소 N% / N억원·N만원·N원)으로 만든 주입 꾸러미다(+기존 acq_tax 5행).
 * 각 describe 는 ① 원문값(긍정형) ② 옛 코드 값과의 오차(반증형)를 숫자로 박는다.
 */
import { describe, it, expect } from 'vitest';
import fixture from './k9-local.policy.json';
import {
  acquisitionTax, auctionProfit, registrationCost, registrationLicenseTax, propertyTax, stampTax, vehicleTax,
} from '@/lib/calc/formulas';
import { acquisitionParts, giftHeavyApplies, vehicleAgeReliefPct, stampDutyAmount } from '@/lib/calc/k9/local';
import { acqSurtaxPct, parsePolicyPack } from '@/lib/calc/gov-tables';

const POLICY = JSON.stringify(fixture);
const 억 = 100_000_000;
const TODAY = '2026-09-17';
type R = ReturnType<typeof acquisitionTax>;
const row = (r: R, label: string) => r.details.find((d) => d.label === label)?.value;
const rowStarts = (r: R, label: string) => r.details.find((d) => d.label.startsWith(label))?.value;
const acq = (o: Record<string, unknown>) =>
  acquisitionTax({ price: 5 * 억, type: 'purchase', houseCount: 1, regulated: 'no', area85: 'under', firstTime: 'no', asOf: TODAY, __policy: POLICY, ...o } as any);

describe('취득세 증여 — 중과 판정 축 수리 (지방세법 §13의2② · 시행령 §28의6)', () => {
  it('판정 함수: 조정 × 시가표준액 3억 이상 × 1주택자 가족 증여 아님', () => {
    expect(giftHeavyApplies(true, 3 * 억, 3 * 억, false)).toBe(true);        // 경계: «이상»
    expect(giftHeavyApplies(true, 3 * 억 - 1, 3 * 억, false)).toBe(false);
    expect(giftHeavyApplies(false, 10 * 억, 3 * 억, false)).toBe(false);
    expect(giftHeavyApplies(true, 10 * 억, 3 * 억, true)).toBe(false);
  });

  it('사례 A — 다주택 부모 → 무주택 자녀(조정·시가표준액 5억): 12% · 교육세 0.4%', () => {
    const r = acq({ type: 'gift', regulated: 'yes', standardValue: 5 * 억, giftFrom1House: 'no', houseCount: 1 });
    expect(row(r, '적용 세율')).toBe('12%');
    expect(row(r, '취득세')).toBe('6,000만원');
    expect(row(r, '지방교육세')).toBe('200만원');
    expect(r.main.value).toBe('6,200만원');
    // 옛 코드(houseCount=1 → 3.5% + 취득세×10%): 1,750만 + 175만 = 1,925만. 4,275만 과소였다.
    expect(62_000_000 - (17_500_000 + 1_750_000)).toBe(42_750_000);
  });

  it('사례 B — 1주택 부모 → 자녀(받는 사람 이미 1주택, houseCount=2): 중과 제외 3.5%', () => {
    const r = acq({ type: 'gift', regulated: 'yes', standardValue: 5 * 억, giftFrom1House: 'yes', houseCount: 2 });
    expect(row(r, '적용 세율')).toBe('3.5%');
    expect(row(r, '지방교육세')).toBe('150만원');     // (3.5−2)×20% = 0.30%
    expect(r.main.value).toBe('1,900만원');
    // 옛 코드(houseCount≥2 & 조정 → 12% + 취득세×10%): 6,000만 + 600만 = 6,600만. 4,700만 과대.
    expect(66_000_000 - 19_000_000).toBe(47_000_000);
  });

  it('조정지역이라도 시가표준액 3억 미만이면 3.5% · 3억 정각은 12%', () => {
    expect(row(acq({ type: 'gift', regulated: 'yes', standardValue: 2.99 * 억 }), '적용 세율')).toBe('3.5%');
    expect(row(acq({ type: 'gift', regulated: 'yes', standardValue: 3 * 억 }), '적용 세율')).toBe('12%');
  });

  it('⛔ 조정지역에서 시가표준액을 비우면 판정하지 않는다(지어내지 않음)', () => {
    const r = acq({ type: 'gift', regulated: 'yes', standardValue: 0 });
    expect(r.main.label).toBe('시가표준액 입력 필요');
    expect(r.main.value).toBe('—');
  });

  it('비중과 증여 교육세는 0.30% — 옛 0.35%(취득세×10%) 대비 5억에서 25만 과대였다', () => {
    const r = acq({ type: 'gift' });
    expect(row(r, '지방교육세')).toBe('150만원');
    expect(Math.round(17_500_000 * 0.1) - 1_500_000).toBe(250_000);
  });

  it('85㎡ 초과 증여 농특세: 표준 0.2%(100만) · 중과 1.0%(500만) — 옛 코드는 둘 다 0원', () => {
    expect(row(acq({ type: 'gift', area85: 'over' }), '농어촌특별세')).toBe('100만원');
    const h = acq({ type: 'gift', area85: 'over', regulated: 'yes', standardValue: 5 * 억 });
    expect(row(h, '농어촌특별세')).toBe('500만원');
    expect(h.main.value).toBe('6,700만원');
    expect(h.details.some((d) => d.label === '⚠️ 해석')).toBe(true);
  });

  it('85㎡ 이하 0 은 «사유» 로 쓴다 — 면제 ≠ 빠뜨림', () => {
    expect(row(acq({ type: 'gift' }), '농어촌특별세')).toContain('비과세');
  });
});

describe('취득세 상속 — 1가구1주택 0.8% (지방세법 §15①2가) · 교육세 0.16%', () => {
  it('5억 무주택 상속인 1가구1주택: 400만 + 80만 = 480만 (옛 1,540만 — 1,060만 과대)', () => {
    const r = acq({ type: 'inherit', inherit1House: 'yes', area85: 'over' });
    expect(row(r, '적용 세율')).toBe('0.8%');
    expect(row(r, '취득세')).toBe('400만원');
    expect(row(r, '지방교육세')).toBe('80만원');
    expect(row(r, '농어촌특별세')).toContain('10의4');     // 85㎡ 초과여도 비과세
    expect(r.main.value).toBe('480만원');
    expect(15_400_000 - 4_800_000).toBe(10_600_000);
  });

  it('5억 일반 상속: 2.8% · 교육세 0.16%(80만, 옛 140만) · 85㎡ 초과 농특세 0.2%', () => {
    const r = acq({ type: 'inherit' });
    expect(row(r, '취득세')).toBe('1,400만원');
    expect(row(r, '지방교육세')).toBe('80만원');
    expect(r.main.value).toBe('1,480만원');
    expect(acq({ type: 'inherit', area85: 'over' }).main.value).toBe('1,580만원');
  });

  it('상속·증여에는 생애최초 감면을 적용하지 않는다(옛 코드는 200만 깎았다)', () => {
    const r = acq({ type: 'inherit', firstTime: 'yes' });
    expect(r.main.value).toBe('1,480만원');
    expect(row(r, '생애최초 감면')).toContain('유상거래');
    expect(acq({ type: 'gift', firstTime: 'yes' }).main.value).toBe('1,900만원');
  });

  it('⛔ 증여·상속 행이 안 오면 미수신 + 「⚠️ 출처」', () => {
    const bare = JSON.stringify({ pct: { acq_tax_1house_6eok_under: 1 }, meta: {} });
    const r = acq({ type: 'inherit', __policy: bare });
    expect(r.main.label).toBe('세율 기준 미수신');
    expect(r.details.some((d) => d.label === '⚠️ 출처')).toBe(true);
  });
});

describe('생애최초 감면 — 한도는 «취득세» 에만 (지특법 §36의3)', () => {
  it('1억 주택: 취득세 100만 면제 · 교육세 10만은 남는다 (옛 코드는 합계 110만을 통째로 0원)', () => {
    const r = acq({ price: 1 * 억, firstTime: 'yes' });
    expect(rowStarts(r, '생애최초 감면')).toBe('-100만원 (취득세)');
    expect(r.main.value).toBe('10만원');
    expect(r.details.some((d) => d.label === '⚠️ 미확정' && d.value.includes('지방교육세'))).toBe(true);
  });

  it('5억·85㎡ 초과: 300 + 50 + 100 + 감면분 농특세 40 = 490만 (옛 450만 — 40만 과소)', () => {
    const r = acq({ firstTime: 'yes', area85: 'over' });
    expect(row(r, '농어촌특별세 (감면세액분 20%)')).toBe('40만원');
    expect(r.main.value).toBe('490만원');
  });

  it('300만원 트랙(소형 비아파트·인구감소지역): 5억 → 500−300+50 = 250만', () => {
    expect(acq({ firstTime: 'yes', firstTrack: 'small' }).main.value).toBe('250만원');
  });

  it('12억 초과 · 일몰 후 · 취득 후 2주택이면 적용하지 않고 «무엇이 빠졌는지» 말한다', () => {
    const over = acq({ price: 12 * 억 + 1, firstTime: 'yes' });
    expect(rowStarts(over, '⚠️ 생애최초 감면 미적용')).toContain('12억원 이하');
    const late = acq({ firstTime: 'yes', asOf: '2029-01-01' });
    expect(rowStarts(late, '⚠️ 생애최초 감면 미적용')).toContain('2028-12-31');
    expect(late.main.value).toBe('550만원');
    expect(rowStarts(acq({ firstTime: 'yes', houseCount: 2 }), '⚠️ 생애최초 감면 미적용')).toContain('무주택');
  });
});

describe('지방 준공후미분양 — 세율 특례가 아니라 취득세 25% 경감 (지특법 §33의3④)', () => {
  const ok = { unsoldLocal: 'yes', unsoldNonCapital: 'yes', unsoldFirst: 'yes', unsoldIndividual: 'yes', unsoldOccupancy: 'yes' };

  it('지방 5억·84㎡: 취득세 −125만 · 교육세 −12.5만 → 412만 5,000원 (감면 전 550만)', () => {
    const r = acq(ok);
    expect(row(r, '적용 세율')).toBe('1%');                  // 세율은 그대로다
    expect(rowStarts(r, '지방 준공후미분양 경감')).toBe('-125만원 (취득세)');
    expect(rowStarts(r, '지방교육세 감면')).toContain('12만 5,000원');
    expect(r.main.value).toBe('412만 5,000원');
    expect(row(r, '미분양 경감')).toContain('조례 추가분');
  });

  it('조례 추가 25% 입력 시 50%: −250만 −25만 → 275만 · 25 초과 입력은 25로 자른다', () => {
    expect(acq({ ...ok, unsoldOrdinancePct: 25 }).main.value).toBe('275만원');
    expect(acq({ ...ok, unsoldOrdinancePct: 90 }).main.value).toBe('275만원');
  });

  it('요건 미충족이면 빠진 요건을 전부 나열한다', () => {
    const r = acq({ unsoldLocal: 'yes', price: 7 * 억, area85: 'over' });
    const miss = rowStarts(r, '⚠️ 지방 준공후미분양 경감 미적용')!;
    for (const w of ['수도권 외', '85㎡', '6억원', '최초로 유상거래', '법인', '1년 미만']) expect(miss).toContain(w);
  });

  it('기한 2026-12-31 이후 취득이면 적용하지 않는다', () => {
    expect(rowStarts(acq({ ...ok, asOf: '2027-01-01' }), '⚠️ 지방 준공후미분양 경감 미적용')).toContain('2026-12-31');
  });

  it('생애최초와 겹치면 취득세 감면액이 큰 하나만(지특법 §180) — 200만 > 125만', () => {
    const r = acq({ ...ok, firstTime: 'yes' });
    expect(row(r, '중복 감면 배제')).toContain('생애최초');
    expect(r.main.value).toBe('350만원');
  });
});

describe('유상 부가세목 — 코드 산식(acqSurtaxPct)과 policy 일반식이 같은 값인가 (교차)', () => {
  const P = parsePolicyPack(POLICY)!.pct;
  it('교육세: 유상 세율×50%×20% · 중과 (4%−2%)×20%', () => {
    expect(acqSurtaxPct(1, 'none', false).eduPct).toBeCloseTo(1 * 0.5 * P.acq_tax_edu_ratio / 100, 10);
    expect(acqSurtaxPct(3, 'none', false).eduPct).toBeCloseTo(3 * 0.5 * P.acq_tax_edu_ratio / 100, 10);
    const base4 = P.acq_tax_heavy_12 - 4 * P.acq_tax_std_rate;
    expect(base4).toBe(4);
    expect(acqSurtaxPct(12, 'heavy12', false).eduPct).toBeCloseTo((base4 - P.acq_tax_std_rate) * P.acq_tax_edu_ratio / 100, 10);
  });
  it('농특세: 표준 2%×10% · 8% 중과 (2%+2%×200%)×10% · 12% 중과 (2%+2%×400%)×10%', () => {
    const s = P.acq_tax_std_rate, f = P.acq_tax_farm_ratio;
    expect(acqSurtaxPct(1, 'none', true).farmPct).toBeCloseTo(s * f / 100, 10);
    expect(acqSurtaxPct(8, 'heavy8', true).farmPct).toBeCloseTo(s * 3 * f / 100, 10);
    expect(acqSurtaxPct(12, 'heavy12', true).farmPct).toBeCloseTo(s * 5 * f / 100, 10);
  });
  it('경매 수익률은 같은 파이프 그대로 — 3.5억 385만 (교차 회귀)', () => {
    const r = auctionProfit({ appraisal: 5 * 억, bidPrice: 3.5 * 억, repairCost: 0.2 * 억, __policy: POLICY } as any);
    expect(r.details.find((d) => d.label === '세금 합계')!.value).toBe('385만원 (낙찰가의 1.10%)');
    expect(acq({ price: 3.5 * 억 }).main.value).toBe('385만원');
  });
});

describe('등기비용 — 취득 원인 등기에 등록면허세 없음 (지방세법 §23 1호)', () => {
  const reg = (o: Record<string, unknown>) =>
    registrationCost({ price: 5 * 억, type: 'purchase', houseCount: 1, regulated: 'no', area85: 'under', asOf: TODAY, __policy: POLICY, ...o } as any);

  it('5억 매매 기본: 취득세 550만 + 인지세 15만 = 565만 (옛 1,257만 — 692만 과대)', () => {
    const r = reg({});
    expect(r.main.value).toBe('565만원');
    expect(row(r, '등록면허세')).toContain('§23');
    expect(row(r, '인지세')).toContain('15만원');
    // 옛: 등록면허세 1,000만 + 교육세 200만 + 취득세 0(미수신 '—' 를 0으로 파싱) + 법무사 50만 + 인지세 7만
    expect(10_000_000 + 2_000_000 + 0 + 500_000 + 70_000 - 5_650_000).toBe(6_920_000);
  });

  it('취득세 부분은 취득세 계산기와 «같은 값» (교차) — 증여·상속·감면 포함', () => {
    for (const o of [{}, { type: 'gift', area85: 'over' }, { type: 'inherit', inherit1House: 'yes' }, { firstTime: 'yes', price: 2 * 억 }]) {
      const a = acquisitionParts({ price: 5 * 억, type: 'purchase', houseCount: 1, regulated: 'no', area85: 'under', asOf: TODAY, __policy: POLICY, ...o } as any);
      expect(row(reg(o), '취득세 합계 (교육세·농특세·감면 반영)')).toBe(a.result.main.value);
    }
  });

  it('법무사 보수는 입력값만 더한다 — 비우면 비었다고 쓴다', () => {
    expect(row(reg({}), '법무사 보수')).toContain('미입력');
    expect(reg({ lawyerFee: 500_000 }).main.value).toBe('615만원');
  });

  it('상속은 인지세가 없다 · 1억 이하 주택 매매는 인지세 비과세', () => {
    expect(row(reg({ type: 'inherit' }), '인지세')).toContain('없음');
    expect(row(reg({ price: 1 * 억 }), '인지세')).toContain('비과세');
  });

  it('⛔ 주입이 없으면 미수신 — 옛 코드는 여기서 취득세 0원으로 합계를 냈다', () => {
    expect(registrationCost({ price: 5 * 억, type: 'purchase' }).main.label).toBe('세율 기준 미수신');
  });
});

describe('등록면허세 — 취득세 과세 이전은 0원, 저당권·전세권 중심 (지방세법 §28①)', () => {
  const rl = (o: Record<string, unknown>) => registrationLicenseTax({ price: 1 * 억, type: 'mortgage', __policy: POLICY, ...o } as any);

  it('저당권 채권 1억: 20만 + 지방교육세 4만 = 24만', () => {
    const r = rl({});
    expect(row(r, '등록면허세')).toBe('20만원');
    expect(r.main.value).toBe('24만원');
  });

  it('최저세액 6천원: 채권 100만 → 6,000 + 1,200 = 7,200원 (옛 2,400원)', () => {
    const r = rl({ price: 1_000_000 });
    expect(r.main.value).toBe('7,200원');
    expect(row(r, '최저세액')).toBeDefined();
  });

  it('⛔ 매매 소유권이전은 0원 + 사유 (옛 5억 × 2% + 교육세 = 1,200만 가공)', () => {
    const r = rl({ type: 'transfer', price: 5 * 억 });
    expect(r.main.value).toBe('0원');
    expect(row(r, '사유')).toContain('§23');
  });

  it('전세권 0.2% · 그 밖의 등기 건당 6천원', () => {
    expect(rl({ type: 'jeonse', price: 3 * 억 }).main.value).toBe('72만원');
    expect(rl({ type: 'other' }).main.value).toBe('7,200원');
  });
});

describe('재산세 — 2026 1세대1주택 비율 43/44/45% · 특례세율 (시행령 §109 · 지방세법 §111의2)', () => {
  const pt = (o: Record<string, unknown>) => propertyTax({ publicPrice: 5 * 억, oneHouse: 'yes', cityArea: 'yes', asOf: TODAY, __policy: POLICY, ...o } as any);

  it('공시가 5억 1세대1주택: 과표 2.2억 → 26만 + 5.2만 + 30.8만 = 62만 (옛 110.4만 — 48.4만 과대)', () => {
    const r = pt({});
    expect(rowStarts(r, '과세표준')).toContain('2억 2,000만원');
    expect(rowStarts(r, '재산세 (1세대1주택')).toBe('26만원');
    expect(r.main.value).toBe('62만원');
    expect(1_104_000 - 620_000).toBe(484_000);
  });

  it('경계: 3억 정각 43% · 3억 초과 44% · 6억 초과 45%', () => {
    expect(rowStarts(pt({ publicPrice: 3 * 억 }), '과세표준')).toContain('43%');
    expect(rowStarts(pt({ publicPrice: 3 * 억 + 1 }), '과세표준')).toContain('44%');
    expect(rowStarts(pt({ publicPrice: 6 * 억 + 1 }), '과세표준')).toContain('45%');
  });

  it('공시가 12억 1세대1주택: 45% · 표준세율 → 본세 153만 (옛 225만)', () => {
    const r = pt({ publicPrice: 12 * 억 });
    expect(rowStarts(r, '재산세 (표준세율')).toBe('153만원');
    expect(row(r, '특례세율')).toContain('9억원');
  });

  it('다주택(일반) 5억: 60% · 표준세율 — 옛 값과 같다(110만 4,000원)', () => {
    expect(pt({ oneHouse: 'no' }).main.value).toBe('110만 4,000원');
  });

  it('2027년도분은 43~45%를 쓰지 않고 미확정이라고 말한다', () => {
    const r = pt({ asOf: '2027-07-01' });
    expect(row(r, '⚠️ 미확정')).toContain('2026년도분 한정');
    expect(rowStarts(r, '과세표준')).toContain('60%');
  });

  it('도시지역분 비대상 선택 · 과세표준상한제 미반영 공개', () => {
    const r = pt({ cityArea: 'no' });
    expect(r.main.value).toBe('31만 2,000원');
    expect(row(r, '⚠️ 미반영')).toContain('과세표준상한제');
  });
});

describe('인지세 — 인지세법 §3① 구간 «한 칸 밀림» 수리', () => {
  const pack = parsePolicyPack(POLICY);
  const st = (amount: number, docType = 'realty', copies = 1) =>
    stampTax({ contractAmount: amount, docType, copies, __policy: POLICY } as any);

  it('경계값: 1천만/3천만/5천만/1억/10억은 «이하» 가 아래 구간', () => {
    const t = (a: number) => stampDutyAmount(a, 'realty', pack)!.tax;
    expect(t(10_000_000)).toBe(0);
    expect(t(10_000_001)).toBe(20_000);
    expect(t(30_000_000)).toBe(20_000);
    expect(t(30_000_001)).toBe(40_000);
    expect(t(50_000_001)).toBe(70_000);
    expect(t(1 * 억)).toBe(70_000);
    expect(t(1 * 억 + 1)).toBe(150_000);
    expect(t(10 * 억)).toBe(150_000);
    expect(t(10 * 억 + 1)).toBe(350_000);
  });

  it('5억: 15만 (옛 7만 — 8만 과소) · 비주택 8천만 7만(옛 4만) · 4천만 4만(옛 2만)', () => {
    expect(st(5 * 억).main.value).toBe('15만원');
    expect(st(80_000_000).main.value).toBe('7만원');
    expect(st(40_000_000).main.value).toBe('4만원');
  });

  it('주택 1억 이하 비과세 · 금전소비대차 5천만 이하 비과세 · 통수만큼', () => {
    expect(st(80_000_000, 'house').main.value).toBe('0원');
    expect(st(50_000_000, 'loan').main.value).toBe('0원');
    expect(st(5 * 억, 'house', 2).main.value).toBe('30만원');
  });
});

describe('자동차세 — 차령 경감 5%×(n−2) · 전기차 지방교육세 (지방세법 §127 · §151①7)', () => {
  const vt = (o: Record<string, unknown>) => vehicleTax({ cc: 2000, type: 'passenger', age: 3, __policy: POLICY, ...o } as any);

  it('경감률: 차령 1·2 → 0 · 3 → 5% · 12 → 50% · 15 → 50%', () => {
    expect([1, 2, 3, 12, 15].map((a) => vehicleAgeReliefPct(a, 5))).toEqual([0, 0, 5, 50, 50]);
  });

  it('2,000cc·차령 3: 38만 + 11.4만 = 49.4만 (옛 15% 경감 44.2만 — 5.2만 과소)', () => {
    const r = vt({});
    expect(row(r, '자동차세')).toBe('38만원');
    expect(r.main.value).toBe('49만 4,000원');
    expect(494_000 - 442_000).toBe(52_000);
  });

  it('차령 2년에는 경감이 없다(옛 10%)', () => {
    expect(vt({ age: 2 }).main.value).toBe('52만원');
  });

  it('cc 구간: 1,000 이하 80원 · 1,600 이하 140원', () => {
    expect(row(vt({ cc: 1000, age: 1 }), '자동차세')).toBe('8만원');
    expect(row(vt({ cc: 1600, age: 1 }), '자동차세')).toBe('22만 4,000원');
  });

  it('전기차: 10만 + 교육세 3만 = 13만 (옛 10만 — 교육세 누락)', () => {
    expect(vt({ type: 'ev' }).main.value).toBe('13만원');
  });

  it('⛔ 주입이 없으면 미수신 · 연납 공제 미반영 공개', () => {
    expect(vehicleTax({ cc: 2000, type: 'passenger', age: 3 }).main.label).toBe('세율 기준 미수신');
    expect(row(vt({}), '⚠️ 미반영')).toContain('연납');
  });
});

describe('라이브 파서 실측 — 6~9억 행은 numbers 첫 원소가 「6억원」이라 pct 에 없다', () => {
  // DB 실측(2026-09-17): acq_tax_1house_6_9eok.numbers = ["6억원","9억원","1%","3%"] → 파서는 amt 로 싣는다.
  const live = JSON.stringify({
    pct: { acq_tax_1house_6eok_under: 1, acq_tax_1house_9eok_over: 3, acq_tax_heavy_8: 8, acq_tax_heavy_12: 12 },
    amt: { acq_tax_1house_6_9eok: 600_000_000 },
    meta: { acq_tax_1house_6_9eok: { item: '주택 취득세(유상) — 6억원 초과 9억원 이하' } },
  });
  it('⛔ 7억 매매가 「미수신」으로 떨어지지 않는다 — 사잇세율 1.6667%', () => {
    const r = acquisitionTax({ price: 7 * 억, type: 'purchase', houseCount: 1, regulated: 'no', area85: 'under', __policy: live } as any);
    expect(r.main.label).toBe('취득세 합계');
    expect(r.details.find((d) => d.label === '적용 세율')!.value).toBe('1.6667%');
  });
  it('경매 수익률도 같은 판정 — 7억 낙찰', () => {
    const r = auctionProfit({ appraisal: 8 * 억, bidPrice: 7 * 억, __policy: live } as any);
    expect(r.main.label).toBe('예상 수익률');
  });
});
