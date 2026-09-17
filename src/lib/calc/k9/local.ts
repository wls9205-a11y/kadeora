/**
 * K-9 지방세 클러스터 — 취득세(증여·상속·감면) · 등기비용 · 등록면허세 · 재산세 · 인지세 · 자동차세 (2026-09-17).
 *
 * 정본: 국가법령정보센터 DRF eflaw «현행 시행본» XML 을 직접 대조했다(조회일 2026-09-17).
 *   지방세법 MST 282559 (법률 21308, 2026-07-01 시행) · 지방세법 시행령 MST 287223 (대통령령 36445, 2026-07-01)
 *   지방세특례제한법 MST 286607 (법률 21738, 2026-06-02) · 농어촌특별세법 MST 285905 (2026-05-12)
 *   농어촌특별세법 시행령 MST 280835 (2026-01-02) · 인지세법 MST 276139 (2026-01-02)
 *   시행예정판(지방세법 2027-01-01·2027-09-09, 시행령 2026-09-18, 지특법 2027-09-09)의 같은 조문은 현행과 문언이 같았다.
 *
 * ⛔ 수치(세율·한도·문턱)는 policy_constants 가 정본이다. 이 파일은 «어느 행인가» 와 «법이 정한 산식의 모양» 만 안다.
 *    주입이 없으면 지어내지 않고 「세율 기준 미수신」이라고 말한다.
 * ⚠️ 이 모듈은 formulas.ts 를 «값으로» import 하지 않는다(순환 금지). 타입만 가져온다.
 */
import type { CalcResult } from '../formulas';
import { formatKRWExact, PROPERTY_TAX_RATES } from '../tax-tables';
import { parsePolicyPack, acqTaxPolicyKey, acqTaxMidRatePct, acqSurtaxPct, type PolicyPack } from '../gov-tables';

type V = Record<string, number | string>;
type Row = { label: string; value: string };

const n = (v: unknown) => Number(v) || 0;
const fmt = (v: number) => formatKRWExact(v);
/** 세율 표기 — 유효자리만(법정 넷째 자리까지). */
const ratePct = (p: number) => `${Number(p.toFixed(4))}%`;

/** 원문 조문 URL — policy 행의 source_url 과 같은 형식. */
export const LOCAL_TAX_SOURCES = {
  acq11: 'https://www.law.go.kr/법령/지방세법/제11조',
  acq13_2: 'https://www.law.go.kr/법령/지방세법/제13조의2',
  acq15: 'https://www.law.go.kr/법령/지방세법/제15조',
  reg23: 'https://www.law.go.kr/법령/지방세법/제23조',
  reg28: 'https://www.law.go.kr/법령/지방세법/제28조',
  prop110: 'https://www.law.go.kr/법령/지방세법/제110조',
  prop111_2: 'https://www.law.go.kr/법령/지방세법/제111조의2',
  prop109: 'https://www.law.go.kr/법령/지방세법시행령/제109조',
  veh127: 'https://www.law.go.kr/법령/지방세법/제127조',
  edu151: 'https://www.law.go.kr/법령/지방세법/제151조',
  unsold: 'https://www.law.go.kr/법령/지방세특례제한법/제33조의3',
  firstHome: 'https://www.law.go.kr/법령/지방세특례제한법/제36조의3',
  stamp3: 'https://www.law.go.kr/법령/인지세법/제3조',
  /** 원문 대조일(렌더 시각이 아님). */
  checkedAt: '2026-09-17',
} as const;

function missingResult(reason: string, extra: Row[] = []): CalcResult {
  return {
    main: { label: '세율 기준 미수신', value: '—', color: 'var(--text-tertiary)' },
    details: [{ label: '사유', value: reason }, ...extra],
  };
}

/** 판정 기준일(KST). 테스트·재현용으로 v.asOf(YYYY-MM-DD)를 받는다. */
export function asOfKst(v: V): string {
  const s = String(v.asOf ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** policy 행 item 에 박힌 「YYYY-MM-DD까지」 — 일몰일. 행이 정본이다. */
export function sunsetFromItem(pack: PolicyPack | null, key: string): string | null {
  const m = String(pack?.meta?.[key]?.item ?? '').match(/(\d{4}-\d{2}-\d{2})\s*까지/);
  return m ? m[1] : null;
}

function srcLine(pack: PolicyPack | null, key: string): string | null {
  const m = pack?.meta?.[key];
  if (!m?.source && !m?.date) return null;
  return [m.source, m.date].filter(Boolean).join(' · ');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. 취득세 — 매매(유상)·증여(무상)·상속 + 감면(생애최초 §36의3 · 지방 준공후미분양 §33의3④)
// ═══════════════════════════════════════════════════════════════════════════

export interface AcqParts {
  acqTax: number;
  eduTax: number;
  farmTax: number;
  total: number;
}

const GIFT_KEYS = ['acq_tax_gift', 'acq_tax_gift_heavy_12', 'acq_tax_std_rate', 'acq_tax_edu_ratio', 'acq_tax_farm_ratio'] as const;
const INHERIT_KEYS = ['acq_tax_inherit', 'acq_tax_inherit_1house', 'acq_tax_std_rate', 'acq_tax_edu_ratio', 'acq_tax_farm_ratio'] as const;

/**
 * 증여 중과 판정 — 지방세법 §13의2② · 시행령 §28의6.
 * ⛔ 옛 코드는 «받는 사람의 주택 수(houseCount≥2)» 로 판정했다. 원문 요건이 아니다.
 *    원문: ① 조정대상지역 ② 시가표준액 3억원 이상 ③ 1세대1주택자의 주택을 배우자·직계존비속이 받으면 제외.
 */
export function giftHeavyApplies(regulated: boolean, standardValue: number, minValue: number, from1HouseFamily: boolean): boolean {
  return regulated && standardValue >= minValue && !from1HouseFamily;
}

type ReliefEval = { eligible: boolean; missing: string[]; acqRelief: number; eduRelief: number; farmOnRelief: number; label: string; notes: Row[] };

function evalFirstHome(v: V, pack: PolicyPack | null, price: number, acqTax: number, houseCount: number, over85: boolean, asOf: string): ReliefEval {
  const small = v.firstTrack === 'small';
  const capKey = small ? 'acq_tax_firsthome_cap_300' : 'acq_tax_firsthome_cap';
  const cap = pack?.amt?.[capKey];
  const max = pack?.amt?.acq_tax_firsthome_max;
  const farmRel = pack?.pct?.acq_tax_farm_relief;
  const sunset = sunsetFromItem(pack, capKey);
  const out: ReliefEval = { eligible: false, missing: [], acqRelief: 0, eduRelief: 0, farmOnRelief: 0, label: '생애최초 감면', notes: [] };
  if (typeof cap !== 'number' || typeof max !== 'number' || typeof farmRel !== 'number' || !sunset) {
    out.missing.push('감면 기준(한도·가액·일몰) 미수신 — 감면을 적용하지 않았다');
    return out;
  }
  if (houseCount !== 1) out.missing.push('취득 후 보유 주택수가 1이 아니다 — 본인·배우자 모두 무주택이어야 한다');
  if (price > max) out.missing.push(`취득당시가액 ${fmt(max)} 이하가 아니다`);
  if (asOf > sunset) out.missing.push(`일몰(${sunset}) 이후다`);
  if (out.missing.length) return out;
  out.eligible = true;
  // ⛔ 한도는 «산출 취득세액» 에만 건다(§36의3①). 옛 코드는 교육세·농특세까지 합친 합계에서 깎았다.
  out.acqRelief = Math.min(cap, acqTax);
  // 85㎡ 초과는 서민주택 비과세 밖 — 감면세액의 20% 가 농특세(농특세법 §5①1).
  out.farmOnRelief = over85 ? Math.round(out.acqRelief * farmRel / 100) : 0;
  out.label = `생애최초 감면 (한도 ${fmt(cap)})`;
  out.notes.push({ label: '생애최초 요건', value: `본인·배우자 무주택 · 본인 거주 목적 · 유상거래(부담부증여 제외) · 미성년자 제외 · ${sunset}까지 — 3년 안에 매각·증여·임대하면 추징(지특법 §36의3)` });
  return out;
}

function evalUnsold(v: V, pack: PolicyPack | null, price: number, acqTax: number, eduTax: number, over85: boolean, asOf: string): ReliefEval {
  const pct = pack?.pct?.acq_tax_unsold_local;
  const max = pack?.amt?.acq_tax_unsold_local_max;
  const sunset = sunsetFromItem(pack, 'acq_tax_unsold_local');
  const out: ReliefEval = { eligible: false, missing: [], acqRelief: 0, eduRelief: 0, farmOnRelief: 0, label: '지방 준공후미분양 경감', notes: [] };
  if (typeof pct !== 'number' || typeof max !== 'number' || !sunset) {
    out.missing.push('경감 기준(경감률·가액·일몰) 미수신 — 경감을 적용하지 않았다');
    return out;
  }
  if (v.unsoldNonCapital !== 'yes') out.missing.push('수도권 외 지역이어야 한다');
  if (over85) out.missing.push('전용 85㎡ 이하여야 한다');
  if (price > max) out.missing.push(`취득당시가액 ${fmt(max)} 이하가 아니다`);
  if (v.unsoldFirst !== 'yes') out.missing.push('사업주체로부터 최초로 유상거래(부담부증여 제외)로 취득해야 한다');
  if (v.unsoldIndividual !== 'yes') out.missing.push('법인·단체 취득은 제외된다');
  if (v.unsoldOccupancy !== 'yes') out.missing.push('실제 입주한 기간이 1년 미만이어야 한다');
  if (asOf > sunset) out.missing.push(`기한(${sunset}) 이후다`);
  if (out.missing.length) return out;
  const ord = Math.max(0, Math.min(pct, n(v.unsoldOrdinancePct)));   // 조례 추가 경감은 같은 폭(25%) 범위 안
  const rate = pct + ord;
  out.eligible = true;
  out.acqRelief = Math.round(acqTax * rate / 100);
  // 지방교육세도 같은 감면율로 줄인다 — 지방세법 §151①1다1)
  out.eduRelief = Math.round(eduTax * rate / 100);
  out.farmOnRelief = 0;   // 요건상 늘 85㎡ 이하 — 서민주택 비과세(농특세법 §4 9호)
  out.label = `지방 준공후미분양 경감 (${ratePct(rate)})`;
  out.notes.push({ label: '미분양 경감', value: `취득세 ${ratePct(pct)} 경감(지특법 §33의3④) · 조례 추가분 ${ord > 0 ? ratePct(ord) + ' 입력 반영' : '미반영 — 지자체 조례로 최대 ' + ratePct(pct) + ' 추가 가능(§33의3⑤)'} · ${sunset}까지` });
  return out;
}

/** 취득세 성분 계산. registration-cost 가 «같은» 계산을 쓴다(이중 진실 금지). */
export function acquisitionParts(v: V): { result: CalcResult; parts: AcqParts | null } {
  const price = n(v.price);
  const type = String(v.type ?? 'purchase');
  const houseCount = n(v.houseCount) || 1;
  const regulated = v.regulated === 'yes';
  const firstTime = v.firstTime === 'yes';
  const over85 = v.area85 === 'over';
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const asOf = asOfKst(v);
  const notes: Row[] = [];
  const cautions: Row[] = [];
  let rate = 0;           // %
  let acqTax = 0, eduTax = 0, farmTax = 0;
  let farmNote = '';
  let relief: ReliefEval | null = null;

  if (type === 'purchase') {
    const key = acqTaxPolicyKey(houseCount, regulated, price);
    // ⚠️ 6~9억 행은 numbers 첫 원소가 「6억원」(산식 구간)이라 파서가 pct 에 싣지 않는다 — 라이브에서 이 구간이
    //    「미수신」으로 떨어졌다(2026-09-17 실측). 산식 구간은 «행 존재» 로 판정한다.
    const pctFromDb = key === 'acq_tax_1house_6_9eok' && pack?.meta?.[key] ? 1 : P[key];
    if (typeof pctFromDb !== 'number') {
      return { result: missingResult('이 조건의 취득세율 기준을 아직 받지 못했다. 잠시 후 다시 시도한다'), parts: null };
    }
    rate = key === 'acq_tax_1house_6_9eok' ? acqTaxMidRatePct(price) : pctFromDb;
    const heavy: 'none' | 'heavy8' | 'heavy12' = key === 'acq_tax_heavy_12' ? 'heavy12' : key === 'acq_tax_heavy_8' ? 'heavy8' : 'none';
    const m = pack?.meta?.[key] ?? {};
    if (m.item) notes.push({ label: '적용 구간', value: m.item });
    if (key === 'acq_tax_1house_6_9eok') notes.push({ label: '사잇세율', value: '(취득가액×2/3억−3)×1/100 — 6억 1%에서 9억 3%로 연속' });
    if (key === 'acq_tax_heavy_8' && regulated && houseCount === 2) {
      notes.push({ label: '⚠️ 단서', value: '일시적 2주택은 중과 제외다 — 해당하면 표준세율을 본다' });
    }
    if (m.source || m.date) notes.push({ label: '근거', value: [m.source, m.date].filter(Boolean).join(' · ') });
    // 유상 주택 부가세목: 지방교육세 = 세율×50%×20%(§151①1 괄호) · 중과 0.4%(나목) / 농특세 85㎡ 초과만
    const s = acqSurtaxPct(rate, heavy, over85);
    acqTax = Math.round(price * (rate / 100));
    eduTax = Math.round(price * (s.eduPct / 100));
    farmTax = Math.round(price * (s.farmPct / 100));
    farmNote = over85 ? '' : ' — 전용 85㎡ 이하(서민주택) 비과세 · 농특세법 §4 11호';

    // 감면 — 유상거래에만 있다. 둘 다 해당하면 감면세액이 큰 하나만(지특법 §180).
    const fh = firstTime ? evalFirstHome(v, pack, price, acqTax, houseCount, over85, asOf) : null;
    const us = v.unsoldLocal === 'yes' ? evalUnsold(v, pack, price, acqTax, eduTax, over85, asOf) : null;
    for (const r of [fh, us]) {
      if (r && !r.eligible) cautions.push({ label: `⚠️ ${r.label} 미적용`, value: r.missing.join(' · ') });
    }
    const ok = [fh, us].filter((r): r is ReliefEval => !!r && r.eligible);
    if (ok.length === 2) {
      relief = ok[0].acqRelief >= ok[1].acqRelief ? ok[0] : ok[1];
      cautions.push({ label: '중복 감면 배제', value: `둘 다 해당해 취득세 감면액이 큰 「${relief.label}」 하나만 적용했다(지특법 §180)` });
    } else relief = ok[0] ?? null;
    if (relief === fh && fh) {
      cautions.push({ label: '⚠️ 미확정', value: '정액 감면이 지방교육세를 줄이는지는 원문(§151①1다)만으로 닫히지 않는다 — 교육세는 줄이지 않고 계산했다' });
    }
    if (relief === us && us && heavy !== 'none') {
      cautions.push({ label: '⚠️ 미확정', value: '중과 세율이 적용된 미분양 취득의 교육세 감면 방식과 주택 수 산정 제외 여부는 원문으로 닫지 못했다' });
    }
  } else if (type === 'gift') {
    const miss = GIFT_KEYS.filter((k) => typeof P[k] !== 'number');
    const minValue = A.acq_tax_gift_heavy_min;
    if (miss.length || typeof minValue !== 'number') {
      return { result: missingResult('증여 취득세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다', [
        { label: '⚠️ 출처', value: '증여·상속 세율 행(acq_tax_gift 등)을 받지 못했다 — 코드 값으로 지어내지 않는다' },
      ]), parts: null };
    }
    const std = P.acq_tax_std_rate, edu = P.acq_tax_edu_ratio, farm = P.acq_tax_farm_ratio;
    const standardValue = n(v.standardValue);
    const from1House = v.giftFrom1House === 'yes';
    if (regulated && standardValue <= 0 && !from1House) {
      return { result: {
        main: { label: '시가표준액 입력 필요', value: '—', color: 'var(--text-tertiary)' },
        details: [{ label: '사유', value: `조정대상지역 증여는 시가표준액이 ${fmt(minValue)} 이상이면 ${ratePct(P.acq_tax_gift_heavy_12)} 중과다(지방세법 §13의2② · 시행령 §28의6①) — 공시가격을 넣어야 판정할 수 있다` }],
      }, parts: null };
    }
    const heavy = giftHeavyApplies(regulated, standardValue, minValue, from1House);
    rate = heavy ? P.acq_tax_gift_heavy_12 : P.acq_tax_gift;
    acqTax = Math.round(price * rate / 100);
    if (heavy) {
      // §13의2②: 4%(§11①7나) + 중과기준세율×400%. 교육세는 (4% − 2%)×20%(§151①1나) = 0.4%.
      const base4 = rate - std * 4;
      eduTax = Math.round(price * (base4 - std) / 100 * edu / 100);
      // 농특세 §5①6: 표준세율을 2%로 적용 → (2% + 2%×400%)×10% = 1.0%.
      farmTax = over85 ? Math.round(price * (std * 5) / 100 * farm / 100) : 0;
      notes.push({ label: '적용 구간', value: `조정대상지역 · 시가표준액 ${fmt(minValue)} 이상 무상취득 중과(지방세법 §13의2②)` });
      if (over85) cautions.push({ label: '⚠️ 해석', value: '중과 증여의 농특세 1.0%는 농특세법 §5①6 산식을 중과식에 대입한 값이다(해석 고시 미확인)' });
    } else {
      eduTax = Math.round(price * (rate - std) / 100 * edu / 100);   // (3.5% − 2%)×20% = 0.3%
      farmTax = over85 ? Math.round(price * std / 100 * farm / 100) : 0;
      notes.push({ label: '적용 구간', value: regulated && from1House
        ? '1세대1주택자의 주택을 배우자·직계존비속이 증여받음 — 중과 제외(시행령 §28의6②1)'
        : regulated ? `시가표준액 ${fmt(minValue)} 미만 — 중과 대상 아님` : '무상취득 표준세율(지방세법 §11①2)' });
    }
    farmNote = over85 ? '' : ' — 전용 85㎡ 이하(서민주택) 비과세 · 농특세법 §4 11호';
    notes.push({ label: '과세표준', value: '증여는 시가인정액(매매사례·감정가 등, 지방세법 §10의2①)을 넣는다' });
    const src = srcLine(pack, heavy ? 'acq_tax_gift_heavy_12' : 'acq_tax_gift');
    if (src) notes.push({ label: '근거', value: src });
    if (firstTime) cautions.push({ label: '생애최초 감면', value: '적용하지 않는다 — 유상거래(매매)만 대상이다(지특법 §36의3①)' });
    cautions.push({ label: '미반영', value: '비영리사업자 2.8% · 부담부증여(채무 부분은 유상 과세표준)는 이 계산에 없다' });
  } else {
    const miss = INHERIT_KEYS.filter((k) => typeof P[k] !== 'number');
    if (miss.length) {
      return { result: missingResult('상속 취득세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다', [
        { label: '⚠️ 출처', value: '증여·상속 세율 행(acq_tax_inherit 등)을 받지 못했다 — 코드 값으로 지어내지 않는다' },
      ]), parts: null };
    }
    const std = P.acq_tax_std_rate, edu = P.acq_tax_edu_ratio, farm = P.acq_tax_farm_ratio;
    const oneHouse = v.inherit1House === 'yes';
    rate = oneHouse ? P.acq_tax_inherit_1house : P.acq_tax_inherit;
    acqTax = Math.round(price * rate / 100);
    // 교육세는 §11 세율(2.8%) 기준 — (2.8% − 2%)×20% = 0.16%. 1가구1주택 특례(§15①)도 §151①1 본문 산식이다.
    eduTax = Math.round(price * (P.acq_tax_inherit - std) / 100 * edu / 100);
    if (oneHouse) {
      farmTax = 0;
      farmNote = ' — §15①2 특례 취득은 비과세(농특세법 §4 10의4)';
      notes.push({ label: '적용 구간', value: '상속 1가구1주택 특례 — 세율에서 중과기준세율을 뺀다(지방세법 §15①2가 · 시행령 §29)' });
    } else {
      farmTax = over85 ? Math.round(price * std / 100 * farm / 100) : 0;
      farmNote = over85 ? '' : ' — 전용 85㎡ 이하(서민주택) 비과세 · 농특세법 §4 11호';
      notes.push({ label: '적용 구간', value: '상속(농지 외) 표준세율 — 지방세법 §11①1나' });
    }
    notes.push({ label: '과세표준', value: '상속은 시가표준액(공시가격, 지방세법 §10의2②1)을 넣는다' });
    const src = srcLine(pack, oneHouse ? 'acq_tax_inherit_1house' : 'acq_tax_inherit');
    if (src) notes.push({ label: '근거', value: src });
    if (firstTime) cautions.push({ label: '생애최초 감면', value: '적용하지 않는다 — 유상거래(매매)만 대상이다(지특법 §36의3①)' });
    cautions.push({ label: '미반영', value: '농지 상속(2.3%) · 공동상속 지분 판정(지분 최대 상속인이 1가구1주택 판정 대상, 시행령 §29③)은 이 계산에 없다' });
  }

  const reliefTotal = relief ? relief.acqRelief + relief.eduRelief : 0;
  const farmTotal = farmTax + (relief?.farmOnRelief ?? 0);
  const total = acqTax + eduTax + farmTotal - reliefTotal;
  const parts: AcqParts = { acqTax: acqTax - (relief?.acqRelief ?? 0), eduTax: eduTax - (relief?.eduRelief ?? 0), farmTax: farmTotal, total };

  const details: Row[] = [
    { label: '취득세', value: fmt(acqTax) },
    { label: '적용 세율', value: ratePct(rate) },
    ...notes,
    { label: '지방교육세', value: fmt(eduTax) },
    { label: '농어촌특별세', value: farmTax > 0 ? fmt(farmTax) : `0원${farmNote}` },
  ];
  if (relief) {
    details.push({ label: relief.label, value: `-${fmt(relief.acqRelief)} (취득세)` });
    if (relief.eduRelief > 0) details.push({ label: '지방교육세 감면', value: `-${fmt(relief.eduRelief)} (감면율 연동, §151①1다1)` });
    if (relief.farmOnRelief > 0) details.push({ label: '농어촌특별세 (감면세액분 20%)', value: fmt(relief.farmOnRelief) });
    details.push(...relief.notes);
  }
  details.push(...cautions);
  details.push({ label: '참고', value: `지방세법 ${LOCAL_TAX_SOURCES.checkedAt} 원문 대조 기준. 조례 세율 가감·실제 고지는 지자체 산정에 따른다` });
  return { result: { main: { label: '취득세 합계', value: fmt(total) }, details }, parts };
}

export function acquisitionTaxLocal(v: V): CalcResult {
  return acquisitionParts(v).result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. 인지세 — 인지세법 §3①(구간) · §6(비과세)
// ═══════════════════════════════════════════════════════════════════════════

/** 기재금액 «초과» 문턱(원) → 세액 키. 문턱은 §3① 표의 구간 모양이다. */
const STAMP_BANDS: { over: number; key: string }[] = [
  { over: 1_000_000_000, key: 'stamp_duty_over_10eok' },
  { over: 100_000_000, key: 'stamp_duty_1eok_10eok' },
  { over: 50_000_000, key: 'stamp_duty_5k_1eok' },
  { over: 30_000_000, key: 'stamp_duty_3k_5k' },
  { over: 10_000_000, key: 'stamp_duty_1k_3k' },
];

export type StampDoc = 'house' | 'realty' | 'loan';

/** 인지세 1통 세액. null = 기준 미수신. */
export function stampDutyAmount(amount: number, doc: StampDoc, pack: PolicyPack | null): { tax: number; reason: string } | null {
  const A = pack?.amt ?? {};
  if (doc === 'house') {
    const ex = A.stamp_duty_house_exempt;
    if (typeof ex !== 'number') return null;
    if (amount <= ex) return { tax: 0, reason: `주택 소유권 이전 증서 ${fmt(ex)} 이하 비과세(인지세법 §6 5호)` };
  }
  if (doc === 'loan') {
    const ex = A.stamp_duty_loan_exempt;
    if (typeof ex !== 'number') return null;
    if (amount <= ex) return { tax: 0, reason: `금전소비대차 증서 ${fmt(ex)} 이하 비과세(인지세법 §6 8호)` };
  }
  const band = STAMP_BANDS.find((b) => amount > b.over);
  if (!band) return { tax: 0, reason: '기재금액 1천만원 이하는 과세 구간이 없다(인지세법 §3①1)' };
  const t = A[band.key];
  if (typeof t !== 'number') return null;
  return { tax: t, reason: pack?.meta?.[band.key]?.item ?? '' };
}

export function stampTax(v: V): CalcResult {
  const amount = n(v.contractAmount);
  const doc = (['house', 'realty', 'loan'].includes(String(v.docType)) ? v.docType : 'house') as StampDoc;
  const copies = Math.max(1, Math.floor(n(v.copies) || 1));
  const pack = parsePolicyPack(v.__policy);
  const r = stampDutyAmount(amount, doc, pack);
  if (!r) return missingResult('인지세 구간 기준을 아직 받지 못했다. 잠시 후 다시 시도한다');
  const total = r.tax * copies;
  const details: Row[] = [
    { label: '계약금액', value: fmt(amount) },
    { label: '1통당 인지세', value: r.tax > 0 ? fmt(r.tax) : `0원 — ${r.reason}` },
  ];
  if (r.tax > 0 && r.reason) details.push({ label: '적용 구간', value: r.reason });
  details.push({ label: '통수', value: `${copies}통 — 과세문서 1통마다 납부(인지세법 §3②)` });
  details.push({ label: '참고', value: '작성자가 둘 이상이면 연대 납세(인지세법 §1②) — 누가 얼마를 부담할지는 당사자 약정이다' });
  const src = srcLine(pack, 'stamp_duty_1eok_10eok');
  if (src) details.push({ label: '근거', value: src });
  return { main: { label: '인지세', value: fmt(total) }, details };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 등기비용 — 취득세(같은 계산) + 인지세 + 법무사비(입력)
// ═══════════════════════════════════════════════════════════════════════════

export function registrationCost(v: V): CalcResult {
  const price = n(v.price);
  const type = String(v.type ?? 'purchase');
  const pack = parsePolicyPack(v.__policy);
  const { result: acq, parts } = acquisitionParts(v);
  if (!parts) return acq;   // 미수신·입력 필요는 취득세 계산기와 같은 문장으로
  // 상속은 계약서가 없다 — 인지세 과세문서가 아니다. 매매·증여 계약서는 소유권 이전 증서.
  let stamp = 0;
  let stampNote = '';
  if (type === 'inherit') {
    stampNote = '없음 — 상속은 소유권 이전 «증서» 를 작성하지 않는다';
  } else {
    const s = stampDutyAmount(price, 'house', pack);
    if (!s) return missingResult('인지세 구간 기준을 아직 받지 못했다. 잠시 후 다시 시도한다');
    stamp = s.tax;
    stampNote = s.tax > 0 ? `${fmt(s.tax)} (계약서 1통 기준)` : `0원 — ${s.reason}`;
  }
  const lawyer = Math.max(0, n(v.lawyerFee));
  const total = parts.total + stamp + lawyer;
  const acqDetails = acq.details.filter((d) => ['취득세', '적용 세율', '지방교육세', '농어촌특별세'].includes(d.label)
    || d.label.includes('감면') || d.label.includes('경감') || d.label.startsWith('⚠️'));
  return {
    main: { label: '등기비용 합계', value: fmt(total) },
    details: [
      { label: '취득세 합계 (교육세·농특세·감면 반영)', value: fmt(parts.total) },
      ...acqDetails,
      // ⛔ 옛 코드는 여기에 「등록면허세 2% + 교육세」를 더했다. 취득을 원인으로 한 등기는 과세 대상이 아니다.
      { label: '등록면허세', value: '없음 — 취득을 원인으로 한 소유권 등기는 등록면허세 대상에서 제외(지방세법 §23 1호)' },
      { label: '인지세', value: stampNote },
      { label: '법무사 보수', value: lawyer > 0 ? fmt(lawyer) : '미입력 — 법정 요금이 아니다. 견적을 받아 넣는다' },
      { label: '미반영', value: '국민주택채권 매입(할인) 비용 · 등기신청 수수료 · 대출 근저당 설정비는 이 합계에 없다' },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. 등록면허세 — 취득세가 과세되지 «않는» 등기가 대상이다
// ═══════════════════════════════════════════════════════════════════════════

export type RegLicType = 'mortgage' | 'jeonse' | 'seizure' | 'other' | 'transfer';
const REG_LIC_KEY: Record<Exclude<RegLicType, 'transfer'>, string> = {
  mortgage: 'reg_lic_mortgage', jeonse: 'reg_lic_jeonse', seizure: 'reg_lic_seizure', other: 'reg_lic_other',
};

export function registrationLicenseTax(v: V): CalcResult {
  const t = (['mortgage', 'jeonse', 'seizure', 'other', 'transfer'].includes(String(v.type)) ? v.type : 'mortgage') as RegLicType;
  const base = n(v.price);
  const pack = parsePolicyPack(v.__policy);
  if (t === 'transfer') {
    return {
      main: { label: '등록면허세', value: '0원' },
      details: [
        { label: '사유', value: '매매·증여·상속·신축(보존)처럼 취득세가 과세되는 소유권 등기는 등록면허세 대상이 아니다(지방세법 §23 1호)' },
        { label: '대신 내는 세금', value: '취득세(+지방교육세·농특세) — 취득세 계산기에서 계산한다' },
        { label: '예외', value: '부과제척기간이 지나 취득세를 물리지 못한 경우 등은 §28①1 세율(유상 2% 등)로 과세된다 — 이 계산기에서는 다루지 않는다' },
      ],
    };
  }
  const key = REG_LIC_KEY[t];
  const minTax = pack?.amt?.reg_lic_other;
  const eduPct = pack?.pct?.reg_lic_edu;
  const rate = pack?.pct?.[key];
  if (typeof minTax !== 'number' || typeof eduPct !== 'number' || (t !== 'other' && typeof rate !== 'number')) {
    return missingResult('등록면허세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다');
  }
  let tax: number;
  const rows: Row[] = [];
  if (t === 'other') {
    tax = minTax;
    rows.push({ label: '과세 방식', value: `그 밖의 등기 건당 ${fmt(minTax)}(지방세법 §28①1마)` });
  } else {
    const raw = Math.round(base * (rate as number) / 100);
    tax = Math.max(raw, minTax);
    const baseLabel = t === 'jeonse' ? '전세금액' : '채권금액';
    rows.push({ label: '과세표준', value: `${baseLabel} ${fmt(base)} × ${ratePct(rate as number)} = ${fmt(raw)}` });
    if (raw < minTax) rows.push({ label: '최저세액', value: `산출세액이 ${fmt(minTax)}보다 적어 ${fmt(minTax)}를 낸다(§28① 단서)` });
  }
  const edu = Math.round(tax * eduPct / 100);
  const src = srcLine(pack, key);
  return {
    main: { label: '등록면허세 합계', value: fmt(tax + edu) },
    details: [
      { label: '등록면허세', value: fmt(tax) },
      ...rows,
      { label: `지방교육세 (등록면허세의 ${ratePct(eduPct)})`, value: fmt(edu) },
      ...(src ? [{ label: '근거', value: src }] : []),
      { label: '참고', value: '지자체 조례로 표준세율의 50% 범위에서 가감될 수 있다(§28⑥) · 대도시 법인 중과는 반영하지 않았다' },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. 재산세(주택) — 공정시장가액비율(시행령 §109) · 표준세율(§111①3나) · 1세대1주택 특례세율(§111의2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * §111의2 1세대1주택 특례세율(시가표준액 9억 이하). 누진 «표» 라 행 하나에 수 하나 규칙에 맞지 않아
 * 표준세율표(tax-tables PROPERTY_TAX_RATES)와 같이 코드 표로 둔다 — 공유 누진표 이관은 별건.
 * ⚠️ 법률 17769호 부칙 §2: 2026-12-28까지 성립한 납세의무에만 유효.
 */
export const PROP_TAX_1HOUSE_RATES = [
  { max: 60_000_000, base: 0, over: 0, rate: 0.0005 },
  { max: 150_000_000, base: 30_000, over: 60_000_000, rate: 0.001 },
  { max: 300_000_000, base: 120_000, over: 150_000_000, rate: 0.002 },
  { max: Infinity, base: 420_000, over: 300_000_000, rate: 0.0035 },
] as const;
export const PROP_TAX_1HOUSE_RATES_VALID_UNTIL = '2026-12-28';

function standardHousingTax(taxBase: number): number {
  for (const r of PROPERTY_TAX_RATES.housing) {
    if (taxBase <= r.max) return Math.max(0, Math.round(taxBase * r.rate - (r.deduction || 0)));
  }
  return 0;
}
function specialHousingTax(taxBase: number): number {
  const r = PROP_TAX_1HOUSE_RATES.find((x) => taxBase <= x.max)!;
  return Math.round(r.base + (taxBase - r.over) * r.rate);
}

export function propertyTax(v: V): CalcResult {
  const pub = n(v.publicPrice);
  const oneHouse = v.oneHouse === 'yes';
  const city = v.cityArea !== 'no';
  const pack = parsePolicyPack(v.__policy);
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  const asOf = asOfKst(v);
  const year = Number(asOf.slice(0, 4));
  const need = ['prop_tax_fmv', 'prop_tax_edu', 'prop_tax_city', ...(oneHouse ? ['prop_tax_fmv_1h_3eok', 'prop_tax_fmv_1h_6eok', 'prop_tax_fmv_1h_over'] : [])];
  const needAmt = oneHouse ? ['prop_tax_1h_band_3eok', 'prop_tax_1h_band_6eok', 'prop_tax_1h_rate_cap'] : [];
  if (need.some((k) => typeof P[k] !== 'number') || needAmt.some((k) => typeof A[k] !== 'number')) {
    return missingResult('재산세 기준(공정시장가액비율·세율)을 아직 받지 못했다. 잠시 후 다시 시도한다');
  }
  const cautions: Row[] = [];
  let ratio = P.prop_tax_fmv;
  let ratioLabel = '주택 일반';
  // 1세대1주택 비율 43/44/45% 는 «2026년도» 납세의무분 한정(시행령 §109①2 단서).
  const special2026 = oneHouse && year === 2026;
  if (oneHouse && !special2026) {
    cautions.push({ label: '⚠️ 미확정', value: `1세대1주택 공정시장가액비율 43~45%는 2026년도분 한정이다 — ${year}년도 비율은 아직 정해지지 않아 일반 비율로 계산했다` });
  }
  if (special2026) {
    const key = pub <= A.prop_tax_1h_band_3eok ? 'prop_tax_fmv_1h_3eok' : pub <= A.prop_tax_1h_band_6eok ? 'prop_tax_fmv_1h_6eok' : 'prop_tax_fmv_1h_over';
    ratio = P[key];
    ratioLabel = pack?.meta?.[key]?.item ?? '1세대1주택';
  }
  const taxBase = Math.round(pub * ratio / 100);
  const specialRate = oneHouse && pub <= A.prop_tax_1h_rate_cap && asOf <= PROP_TAX_1HOUSE_RATES_VALID_UNTIL;
  const tax = specialRate ? specialHousingTax(taxBase) : standardHousingTax(taxBase);
  if (oneHouse && pub > A.prop_tax_1h_rate_cap) {
    cautions.push({ label: '특례세율', value: `시가표준액 ${fmt(A.prop_tax_1h_rate_cap)} 초과 — 특례세율(§111의2) 대상이 아니라 표준세율로 계산했다` });
  }
  const edu = Math.round(tax * P.prop_tax_edu / 100);
  const cityTax = city ? Math.round(taxBase * P.prop_tax_city / 100) : 0;
  return {
    main: { label: '재산세 합계', value: fmt(tax + edu + cityTax) },
    details: [
      { label: '과세표준', value: `${fmt(taxBase)} (공시가격 × ${ratePct(ratio)} — ${ratioLabel})` },
      { label: specialRate ? '재산세 (1세대1주택 특례세율 §111의2)' : '재산세 (표준세율 §111①3나)', value: fmt(tax) },
      { label: `지방교육세 (재산세의 ${ratePct(P.prop_tax_edu)})`, value: fmt(edu) },
      { label: '도시지역분', value: city ? `${fmt(cityTax)} (과세표준 × ${ratePct(P.prop_tax_city)})` : '0원 — 도시지역분 적용대상 지역 아님으로 선택' },
      ...cautions,
      { label: '⚠️ 미반영', value: '과세표준상한제(직전연도 과세표준 + 상한율, 지방세법 §110③ — 상한율 미조회) · 조례 세율 가감 · 도시지역분 조례율(최대 0.23%) · 지특법 감면. 상한제가 걸리면 실제 고지는 이보다 적을 수 있다' },
      { label: '참고', value: '과세기준일 6월 1일 · 주택분은 7월·9월에 절반씩 고지된다' },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. 자동차세(비영업용 승용) — 지방세법 §127①1·2·3 · 시행령 §122② · §151①7
// ═══════════════════════════════════════════════════════════════════════════

/** 차령 경감률(%) — 기분세액 = A/2 − (A/2 × 5/100)(n − 2), 2 ≤ n ≤ 12. 차령 3년 미만은 0. */
export function vehicleAgeReliefPct(age: number, stepPct: number): number {
  if (age < 3) return 0;
  return stepPct * (Math.min(age, 12) - 2);
}

export function vehicleTax(v: V): CalcResult {
  const cc = n(v.cc);
  const type = String(v.type ?? 'passenger');
  const age = Math.floor(n(v.age));
  const pack = parsePolicyPack(v.__policy);
  const A = pack?.amt ?? {};
  const P = pack?.pct ?? {};
  const eduPct = P.veh_tax_edu;
  if (typeof eduPct !== 'number') return missingResult('자동차세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다');
  const tail: Row = { label: '⚠️ 미반영', value: '연납 공제(§128③ — 공제 이자율은 대통령령, 미조회) · 조례 세율 가산(§127③) · 10원 미만 끝전 처리 · 영업용' };
  if (type === 'ev') {
    const t = A.veh_tax_other_car;
    if (typeof t !== 'number') return missingResult('자동차세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다');
    const edu = Math.round(t * eduPct / 100);
    return {
      main: { label: '연간 자동차세', value: fmt(t + edu) },
      details: [
        { label: '자동차세', value: `${fmt(t)} — 배기량이 없는 «그 밖의 승용자동차»(전기차 등) 비영업용 정액(§127①3)` },
        // ⛔ 옛 코드는 전기차에 지방교육세를 빼먹었다. 자동차세액의 30%가 붙는다(§151①7).
        { label: `지방교육세 (자동차세의 ${ratePct(eduPct)})`, value: fmt(edu) },
        { label: '차령 경감', value: '해당 없음 — 차령 경감(§127①2)은 배기량 과세 승용차에만 있다' },
        tail,
      ],
    };
  }
  const key = cc <= 1000 ? 'veh_tax_cc_1000' : cc <= 1600 ? 'veh_tax_cc_1600' : 'veh_tax_cc_over';
  const perCc = A[key];
  const step = P.veh_tax_age_step;
  if (typeof perCc !== 'number' || typeof step !== 'number') return missingResult('자동차세 기준을 아직 받지 못했다. 잠시 후 다시 시도한다');
  const annual = cc * perCc;
  const relief = vehicleAgeReliefPct(age, step);
  // 두 기분세액을 따로 구해 더한다 — 원문 산식의 모양 그대로.
  const half = annual / 2;
  const tax = Math.round((half - half * relief / 100) * 2);
  const edu = Math.round(tax * eduPct / 100);
  return {
    main: { label: '연간 자동차세', value: fmt(tax + edu) },
    details: [
      { label: '자동차세', value: fmt(tax) },
      { label: '배기량 세액', value: `${cc.toLocaleString()}cc × ${fmt(perCc)} = ${fmt(annual)}` },
      { label: '차령 경감', value: relief > 0 ? `${ratePct(relief)} — 5% × (차령 ${Math.min(age, 12)} − 2)` : `0% — 차령 ${age}년(3년 이상부터 경감)` },
      { label: `지방교육세 (자동차세의 ${ratePct(eduPct)})`, value: fmt(edu) },
      { label: '차령 계산', value: '과세연도 − 최초 등록(차령기산일) 연도 + 1. 하반기(7~12월) 기산 차량은 1기분 차령이 1 작다(시행령 §122②)' },
      tail,
    ],
  };
}
