/**
 * K-9 수치층 — «대장 밖» 클러스터 ext 8종 (2026-09-17)
 *   jeonse-wolse · gift-tax · minimum-wage · military-pay · industrial-accident
 *   isa-conversion · capital-gains-land · child-credit
 *
 * 정본: policy_constants `ext_*` 행(마이그레이션 k9_ext_policy_constants_2026-09-17.sql) +
 *       재사용 행 — 증여 `inh_rate_*`·`gift_*`(k9 inh) · 양도 `cgt_ltd_t1_*`·`cgt_basic_deduction`·`cgt_local_ratio`(k9 cgt).
 * 원문(국가법령정보센터 DRF eflaw «시행일이 오늘 이전인 최신 판» — MST + 그 판의 시행일자):
 *   주택임대차보호법 MST 276291(2026-01-02) §7의2 · 같은 법 시행령 MST 287183(2026-07-01) §9
 *   상속세 및 증여세법 MST 276123(2026-01-02) §53·§57 (법률 21219 판 280353 과 동일)
 *   산업재해보상보험법 MST 283459(2026-07-01) §52·§57·별표 2 · 같은 법 시행령 MST 287491(2026-07-01) §53⑤
 *   소득세법 MST 280405(2026-07-01) · 285523(법률 21548, 2026-04-21 공포·시행) §59의2·§59의3·§104 — 두 판 조문 동일
 *   소득세법 시행령 MST 286211(2026-07-01) §118의2③ · 근로기준법 MST 283457(2026-08-20) §18③·§55①
 *   조세특례제한법 MST 286597(2026-06-02) §91의18
 *   공무원보수규정 MST 288433(2026-08-01) 별표 13 비고 6 (2026-12-03 시행예정 판도 병 봉급 동일)
 * 행정규칙: 고용노동부고시 제2025-47호(2026년 적용 최저임금, 시급 10,320원) · 제2026-60호(2027년 적용, 10,700원, 2027-01-01 시행)
 * 공시: 한국은행 기준금리 3.00%(2026-08-27 변경) — bok.or.kr 기준금리 추이 표
 *
 * ⛔ 주입(__policy)이 없으면 값을 지어내지 않는다 — 「기준 미수신」.
 * ⚠️ 파서(%·원)가 못 읽는 법정값(장해 일수·주 15시간·나이 기준·60일)은 EXT_LAW 코드 상수 + 근거 조문.
 * ⚠️ 공유 누진표 INCOME_TAX_BRACKETS(tax-tables.ts)는 §55① 과 일치 확인됨 — 이관은 별건.
 */
import { INCOME_TAX_BRACKETS, calcProgressiveTax, formatKRWExact } from '../tax-tables';
import { parsePolicyPack, type PolicyPack } from '../gov-tables';
import type { CalcResult } from '../formulas';
import { packBrackets, transferTaxParts, INH_RATE_KEYS, INH_UPTO_KEYS } from './inh';
import { loadCgtPolicy, ltdTable1Pct } from './cgt';

type V = Record<string, number | string>;
type Row = { label: string; value: string };

const n = (v: unknown) => Number(v) || 0;
const fmt = (v: number) => formatKRWExact(v);

const MISSING = (what: string): CalcResult => ({
  main: { label: '기준 미수신', value: '—', color: 'var(--text-tertiary)' },
  details: [{ label: '사유', value: `${what} 기준을 아직 받지 못했다. 잠시 후 다시 시도한다` }],
});

function need(pack: PolicyPack | null, pct: readonly string[], amt: readonly string[]): Record<string, number> | null {
  if (!pack) return null;
  const out: Record<string, number> = {};
  for (const k of pct) { const x = pack.pct?.[k]; if (typeof x !== 'number') return null; out[k] = x; }
  for (const k of amt) { const x = pack.amt?.[k]; if (typeof x !== 'number') return null; out[k] = x; }
  return out;
}

function basis(pack: PolicyPack | null, ...keys: string[]): Row[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  let date: string | undefined;
  for (const k of keys) {
    const m = pack?.meta?.[k] as { source?: string; date?: string } | undefined;
    if (m?.date && !date) date = m.date;
    if (!m?.source || seen.has(m.source)) continue;
    seen.add(m.source); parts.push(m.source);
  }
  return parts.length ? [{ label: '근거', value: [parts.join(' · '), date ? `기준일 ${date}` : ''].filter(Boolean).join(' · ') }] : [];
}

/** 파서 밖 법정값 — 근거 조문과 같이 둔다. */
export const EXT_LAW = {
  /** 산재법 별표 2 장해급여표(평균임금 기준 일수). [연금, 일시금] — 8급 이하는 연금 없음. */
  disabilityDays: {
    1: [329, 1474], 2: [291, 1309], 3: [257, 1155], 4: [224, 1012], 5: [193, 869], 6: [164, 737], 7: [138, 616],
    8: [0, 495], 9: [0, 385], 10: [0, 297], 11: [0, 220], 12: [0, 154], 13: [0, 99], 14: [0, 55],
  } as Record<number, readonly [number, number]>,
  /** 산재법 시행령 §53⑤ — 1~3급은 장해보상연금만(법 §57③ 단서). */
  pensionOnlyMaxGrade: 3,
  /** 산재법 §52 단서 — 취업하지 못한 기간 3일 이내면 휴업급여 없음. */
  restPayMinDaysExclusive: 3,
  /** 근로기준법 §18③ — 4주 평균 1주 소정근로 15시간 미만이면 §55(주휴) 미적용. */
  weeklyHolidayMinHours: 15,
  /** 근로기준법 §50① 1주 40시간 · §55① 1주 평균 1회 유급휴일(시행령 §30① 개근 요건). */
  statutoryWeeklyHours: 40,
  /** 소득세법 부칙(법률 21548) §2②1 — 2026 과세기간 자녀세액공제 대상 나이. 본칙 §59의2① 은 13세. */
  childCreditAge2026: 9,
  childCreditAgeStatute: 13,
  /** 소득세법 시행령 §118의2③ — ISA 만기일부터 60일 이내 연금계좌 납입. */
  isaTransferWindowDays: 60,
  /** 한국은행 기준금리 변경일(ext_bok_base_rate 행과 같이 갱신). */
  url: {
    rentConv: 'https://www.law.go.kr/법령/주택임대차보호법/제7조의2',
    rentConvDecree: 'https://www.law.go.kr/법령/주택임대차보호법시행령/제9조',
    bok: 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643',
    iaci: 'https://www.law.go.kr/법령/산업재해보상보험법/별표2',
  },
  verifiedAt: '2026-09-17',
} as const;

// ═══ 1. jeonse-wolse — 주택임대차보호법 §7의2 · 시행령 §9 ═══

export const RENT_KEYS = { pct: ['ext_rent_conv_cap', 'ext_rent_conv_add', 'ext_bok_base_rate'], amt: [] as string[] } as const;

/** 법정 전환율 상한(%) = min(시행령 §9① 연 10%, 한국은행 기준금리 + §9② 연 2%). */
export function rentConvCapPct(P: Record<string, number>): number {
  return Math.min(P.ext_rent_conv_cap, Math.round((P.ext_bok_base_rate + P.ext_rent_conv_add) * 100) / 100);
}

export function jeonseWolse(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = need(pack, RENT_KEYS.pct, RENT_KEYS.amt);
  if (!P) return MISSING('전월세전환율 상한');
  const cap = rentConvCapPct(P);
  const typed = n(v.rate);
  const ratePct = typed > 0 ? typed : cap;
  const bokDate = (pack?.meta?.ext_bok_base_rate as { from?: string } | undefined)?.from;
  const capRow: Row = {
    label: '법정 상한 전환율',
    value: `${cap.toFixed(2)}% = min(연 ${P.ext_rent_conv_cap}%, 기준금리 ${P.ext_bok_base_rate.toFixed(2)}%${bokDate ? `(${bokDate} 변경)` : ''} + ${P.ext_rent_conv_add}%p)`,
  };
  const deposit = Math.max(0, n(v.deposit));
  if (v.direction === 'toJeonse') {
    const monthly = Math.max(0, n(v.monthlyRent));
    const converted = Math.round(deposit + monthly * 12 / (ratePct / 100));
    return {
      main: { label: '환산 전세보증금', value: fmt(converted) },
      details: [
        { label: '월세 보증금', value: fmt(deposit) },
        { label: '월세', value: fmt(monthly) },
        { label: '월세 × 12 ÷ 전환율', value: fmt(converted - deposit) },
        { label: '적용 전환율', value: `${ratePct.toFixed(2)}%${typed > 0 ? ' (입력값)' : ' (법정 상한을 역으로 적용)'}` },
        capRow,
        { label: '⚠️ 성격', value: '월세 → 전세 전환은 §7의2 제한 대상이 아니다(법은 보증금 → 월세 전환만 상한을 둔다). 이 값은 같은 전환율로 역산한 참고값이다' },
        ...basis(pack, 'ext_rent_conv_cap', 'ext_bok_base_rate'),
      ],
    };
  }
  const jeonse = Math.max(0, n(v.jeonse));
  const converted = Math.max(0, jeonse - deposit);
  const monthly = Math.round(converted * (ratePct / 100) / 12);
  const capMonthly = Math.round(converted * (cap / 100) / 12);
  const details: Row[] = [
    { label: '전환되는 보증금 (전세 − 월세 보증금)', value: fmt(converted) },
    { label: '적용 전환율', value: `${ratePct.toFixed(2)}%${typed > 0 ? ' (입력값)' : ' (법정 상한)'}` },
    capRow,
    { label: '법정 상한 월세', value: fmt(capMonthly) },
  ];
  if (typed > cap) details.push({ label: '⚠️ 상한 초과', value: `입력 전환율 ${typed.toFixed(2)}% 는 법정 상한 ${cap.toFixed(2)}% 를 넘는다 — 계약 존속 중 전환이면 초과분 월차임은 효력이 없다(§7의2)` });
  details.push({ label: '⚠️ 적용 범위', value: '상한은 «기존 계약» 의 보증금을 월세로 바꿀 때(갱신 포함) 적용된다. 새로 맺는 계약의 월세는 이 상한으로 묶이지 않는다' });
  details.push(...basis(pack, 'ext_rent_conv_cap', 'ext_bok_base_rate'));
  return { main: { label: typed > 0 ? '월세' : '월세 (법정 상한)', value: fmt(monthly) }, details };
}

// ═══ 2. gift-tax — 상증법 §26·§53·§57·§69 (k9 inh 공유 성분 재사용) ═══

export const GIFT_TAX_REL = {
  spouse: { label: '배우자로부터', key: 'gift_ded_spouse', skip: false, minor: false },
  adultChild: { label: '부모 등 직계존속으로부터 — 성년', key: 'gift_ded_ascendant', skip: false, minor: false },
  minorChild: { label: '부모 등 직계존속으로부터 — 미성년', key: 'gift_ded_ascendant_minor', skip: false, minor: true },
  grandchild: { label: '조부모로부터 — 성년 손자녀(세대생략)', key: 'gift_ded_ascendant', skip: true, minor: false },
  /** 화면에서는 grandchild + grandchildMinor=yes 로 들어온다(조건부 입력이 단일 값만 받는다). */
  grandchildMinor: { label: '조부모로부터 — 미성년 손자녀(세대생략)', key: 'gift_ded_ascendant_minor', skip: true, minor: true },
  descendant: { label: '자녀 등 직계비속으로부터', key: 'gift_ded_descendant', skip: false, minor: false },
  otherRelative: { label: '4촌 이내 혈족·3촌 이내 인척', key: 'gift_ded_relative', skip: false, minor: false },
  other: { label: '그 밖의 사람 (친족 아님)', key: null, skip: false, minor: false },
} as const;
export type GiftTaxRel = keyof typeof GIFT_TAX_REL;

export function giftTax(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const br = packBrackets(pack, INH_RATE_KEYS, INH_UPTO_KEYS);
  let rel = (String(v.relationship) in GIFT_TAX_REL ? v.relationship : 'adultChild') as GiftTaxRel;
  if (rel === 'grandchild' && v.grandchildMinor === 'yes') rel = 'grandchildMinor';
  const info = GIFT_TAX_REL[rel];
  const P = pack?.pct ?? {};
  const A = pack?.amt ?? {};
  if (!br || typeof P.gift_filing_credit !== 'number' || typeof P.gift_skip_surcharge !== 'number'
    || typeof P.gift_skip_surcharge_minor !== 'number' || typeof A.gift_skip_minor_threshold !== 'number'
    || (info.key && typeof A[info.key] !== 'number')) return MISSING('증여세율·증여재산공제');

  const amount = Math.max(0, Math.floor(n(v.amount)));
  const prior = Math.max(0, Math.floor(n(v.priorGifts)));
  const dedCap = info.key ? A[info.key] : 0;
  const ded = Math.min(amount + prior, dedCap);
  const taxBase = amount + prior - ded;
  const parentDeceased = info.skip && v.parentDeceased === 'yes';
  const minorHeavy = info.skip && info.minor && amount > A.gift_skip_minor_threshold;
  const surchargePct = !info.skip || parentDeceased ? 0 : minorHeavy ? P.gift_skip_surcharge_minor : P.gift_skip_surcharge;
  const t = transferTaxParts(taxBase, br, P.gift_filing_credit, surchargePct);

  const details: Row[] = [
    { label: '관계', value: info.label },
    { label: '증여재산가액 (이번 + 10년 내 합산분)', value: fmt(amount + prior) },
    { label: '증여재산공제 (§53, 10년 합산 한도)', value: info.key ? fmt(ded) : '없음 — 친족이 아니면 공제가 없다' },
    { label: '과세표준', value: fmt(taxBase) },
    { label: `산출세액 (최고 구간 ${t.ratePct}%)`, value: fmt(t.calc) },
  ];
  if (info.skip) {
    details.push(parentDeceased
      ? { label: '세대생략 할증', value: '없음 — 손자녀의 부모(증여자의 자녀)가 사망한 경우(§57① 단서)' }
      : { label: `세대생략 할증 (${surchargePct}%${minorHeavy ? ` — 미성년·증여재산 ${fmt(A.gift_skip_minor_threshold)} 초과` : ''})`, value: fmt(t.surcharge) });
    if (prior > 0 && !parentDeceased) details.push({ label: '⚠️ 할증 범위', value: '10년 내 합산분이 있으면 할증은 세대생략 증여분에만 붙는데, 이 계산은 산출세액 전체에 붙였다(상한값)' });
  }
  details.push({ label: `신고세액공제 (${P.gift_filing_credit}%, §69 — 기한 내 신고)`, value: `−${fmt(t.credit)}` });
  if (prior > 0) details.push({ label: '⚠️ 미반영', value: '합산한 과거 증여에 이미 낸 증여세(기납부세액공제 §58)를 빼지 않았다 — 그만큼 과대다' });
  details.push({ label: '⚠️ 판단 안 함', value: '혼인·출산 증여재산공제(§53의2)·동일인 판정(§47②)·재산 평가는 계산하지 않는다' });
  details.push(...basis(pack, 'inh_rate_b1', ...(info.key ? [info.key] : []), ...(info.skip ? ['gift_skip_surcharge'] : []), 'gift_filing_credit'));
  return { main: { label: '증여세 (기한 내 신고 시)', value: fmt(t.pay) }, details };
}

// ═══ 3. minimum-wage — 최저임금 고시 · 근로기준법 §18③·§50·§55 ═══

export const MIN_WAGE_KEYS = ['ext_min_wage_hourly_2026', 'ext_min_wage_hourly_2027'] as const;

export function minimumWage(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const today = typeof v.__today === 'string' && v.__today ? v.__today : new Date().toISOString().slice(0, 10);
  const year = today >= '2027-01-01' ? 2027 : 2026;
  const key = `ext_min_wage_hourly_${year}`;
  const wage = pack?.amt?.[key];
  if (typeof wage !== 'number') return MISSING('최저임금 고시액');
  const hours = Math.max(0, n(v.weeklyHours));
  const holidayEligible = hours >= EXT_LAW.weeklyHolidayMinHours;
  const wantHoliday = v.includeHoliday !== 'no';
  const holidayHours = wantHoliday && holidayEligible ? Math.min(hours, EXT_LAW.statutoryWeeklyHours) / 5 : 0;
  const weeklyPaid = hours + holidayHours;
  // 고시의 「월 환산 기준시간 209시간」 = (40 + 8) × 365 ÷ 7 ÷ 12 = 208.57 → 반올림. 같은 방식으로 환산한다.
  const monthHours = Math.round(weeklyPaid * 365 / 7 / 12);
  const monthly = wage * monthHours;
  const m = (pack?.meta?.[key] ?? {}) as { source?: string; from?: string };
  const details: Row[] = [
    { label: `최저시급 (${year}년 적용)`, value: fmt(wage) },
    { label: '주휴시간', value: !wantHoliday ? '미포함 선택' : holidayEligible ? `${holidayHours.toFixed(1)}시간 (소정근로 ${Math.min(hours, 40)}시간 ÷ 5)` : `없음 — 주 ${EXT_LAW.weeklyHolidayMinHours}시간 미만은 주휴 미적용(근로기준법 §18③)` },
    { label: '월 환산 기준시간', value: `${monthHours}시간 (주 ${weeklyPaid.toFixed(1)}시간 × 365 ÷ 7 ÷ 12, 반올림 — 고시 209시간과 같은 방식)` },
    { label: '연 환산 (월 × 12)', value: fmt(monthly * 12) },
  ];
  if (hours > EXT_LAW.statutoryWeeklyHours) details.push({ label: '⚠️ 연장근로', value: `주 40시간 초과분을 기본 시급으로만 셌다 — 연장근로 가산(50%, 근로기준법 §56)은 반영하지 않았다` });
  if (year === 2026 && typeof pack?.amt?.ext_min_wage_hourly_2027 === 'number') {
    details.push({ label: '참고: 2027년 적용', value: `${fmt(pack.amt.ext_min_wage_hourly_2027)} (고용노동부고시 제2026-60호, 2027-01-01부터)` });
  }
  details.push({ label: '⚠️ 미반영', value: '수습 감액(최저임금법 §5②)·산입범위·세금·4대보험 — 세전 금액이다' });
  if (m.source) details.push({ label: '근거', value: m.source });
  return { main: { label: '최저월급 (세전)', value: fmt(monthly) }, details };
}

// ═══ 4. military-pay — 공무원보수규정 별표 13 비고 6 ═══

export const MIL_RANKS = {
  private: { label: '이병', key: 'ext_mil_pay_private' },
  pfc: { label: '일병', key: 'ext_mil_pay_pfc' },
  corporal: { label: '상병', key: 'ext_mil_pay_corporal' },
  sergeant: { label: '병장', key: 'ext_mil_pay_sergeant' },
} as const;

export function militaryPay(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const r = MIL_RANKS[(String(v.rank) in MIL_RANKS ? v.rank : 'private') as keyof typeof MIL_RANKS];
  const amt = pack?.amt?.[r.key];
  if (typeof amt !== 'number') return MISSING('병 봉급표');
  const m = (pack?.meta?.[r.key] ?? {}) as { source?: string; from?: string };
  return {
    main: { label: `${r.label} 월 봉급`, value: fmt(amt) },
    details: [
      { label: '기준', value: `공무원보수규정 별표 13(군인의 봉급표) 비고 6${m.from ? ` · ${m.from} 개정분` : ''}` },
      { label: '⚠️ 미반영', value: '장병내일준비적금 정부 매칭지원금 등 봉급 외 지원·수당은 들어 있지 않다' },
    ],
  };
}

// ═══ 5. industrial-accident — 산재법 §52·§57·별표 2 ═══

export function industrialAccident(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const restPct = pack?.pct?.ext_iaci_rest_pay;
  if (typeof restPct !== 'number') return MISSING('휴업급여 지급률');
  const wage = Math.max(0, n(v.dailyWage));
  const days = Math.max(0, Math.floor(n(v.restDays)));
  const grade = Math.floor(n(v.disabilityGrade));
  const restPay = days > EXT_LAW.restPayMinDaysExclusive ? Math.round(wage * restPct / 100 * days) : 0;
  const row = EXT_LAW.disabilityDays[grade];
  const details: Row[] = [
    { label: `휴업급여 (평균임금 × ${restPct}% × ${days}일)`, value: days > EXT_LAW.restPayMinDaysExclusive ? fmt(restPay) : `0원 — 요양 기간 ${EXT_LAW.restPayMinDaysExclusive}일 이내는 지급하지 않는다(§52 단서)` },
  ];
  if (!row) {
    details.push({ label: '장해급여', value: '장해 없음' });
    details.push({ label: '⚠️ 미반영', value: '저소득 근로자 휴업급여(§54)·최저보상기준(§54)·고령자 감액(§55)·요양급여' });
    return { main: { label: '보상금 추정 (휴업급여)', value: fmt(restPay) }, details };
  }
  const [pensionDays, lumpDays] = row;
  const pensionOnly = grade <= EXT_LAW.pensionOnlyMaxGrade;
  const choosePension = pensionOnly || (pensionDays > 0 && v.payout === 'pension');
  if (choosePension) {
    const annual = Math.round(wage * pensionDays);
    details.push({ label: `장해보상연금 (${grade}급 · 연 ${pensionDays}일분)`, value: `연 ${fmt(annual)}` });
    details.push({ label: '지급 방식', value: pensionOnly ? `${grade}급은 연금으로만 받는다(§57③ 단서·시행령 §53⑤ — 외국 거주 외국인 제외)` : '연금 선택(4~7급은 연금·일시금 중 선택, §57③)' });
    details.push({ label: '참고: 일시금 일수', value: `${lumpDays}일분 — 연금 수급권이 소멸할 때 받은 연금 일수가 이보다 적으면 차액을 일시금으로 준다(§57⑤)` });
    details.push({ label: '⚠️ 미반영', value: '연금 선급(§57④)·최저보상기준(§54)·고령자 감액(§55)·요양급여' });
    return { main: { label: '휴업급여 (장해연금 연액은 아래 별도)', value: fmt(restPay) }, details };
  }
  const lump = Math.round(wage * lumpDays);
  details.push({ label: `장해보상일시금 (${grade}급 · ${lumpDays}일분)`, value: fmt(lump) });
  if (pensionDays > 0) details.push({ label: '선택 가능', value: `${grade}급은 연금(연 ${pensionDays}일분)으로도 받을 수 있다(§57③)` });
  details.push({ label: '⚠️ 미반영', value: '최저보상기준(§54)·고령자 감액(§55)·요양급여' });
  return { main: { label: '보상금 추정 (휴업급여 + 장해일시금)', value: fmt(restPay + lump) }, details };
}

// ═══ 6. isa-conversion — 소득세법 §59의3①③④ · 시행령 §118의2③ ═══

export const ISA_KEYS = {
  pct: ['ext_isa_conv_ratio', 'ext_pension_credit_rate', 'ext_pension_credit_rate_low'],
  amt: ['ext_isa_conv_cap', 'ext_pension_savings_cap', 'ext_pension_total_cap'],
} as const;

export interface IsaConvOut {
  addLimit: number; baseline: number; withTransfer: number; increase: number; ratePct: number; credit: number;
}

export function computeIsaConversion(i: { transfer: number; savings: number; irp: number; into: 'savings' | 'irp'; low: boolean }, P: Record<string, number>): IsaConvOut {
  const T = Math.max(0, i.transfer); const S = Math.max(0, i.savings); const R = Math.max(0, i.irp);
  // §59의3① 단서 — 연금저축 600만 · 합계 900만
  const capOf = (s: number, r: number) => Math.min(Math.min(s, P.ext_pension_savings_cap) + r, P.ext_pension_total_cap);
  const baseline = capOf(S, R);
  // §59의3④ — 전환금액이 있으면 ①단서 대신 「min(전환금액 10%, 300만) + ①단서로 인정되는 금액」 초과분을 없는 것으로 본다
  const addLimit = Math.min(Math.floor(T * P.ext_isa_conv_ratio / 100), P.ext_isa_conv_cap);
  const cappedWith = i.into === 'savings' ? capOf(S + T, R) : capOf(S, R + T);
  const withTransfer = Math.min(S + R + T, cappedWith + addLimit);
  const increase = Math.max(0, withTransfer - baseline);
  const ratePct = i.low ? P.ext_pension_credit_rate_low : P.ext_pension_credit_rate;
  return { addLimit, baseline, withTransfer, increase, ratePct, credit: Math.floor(increase * ratePct / 100) };
}

export function isaConversion(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = need(pack, ISA_KEYS.pct, ISA_KEYS.amt);
  if (!P) return MISSING('연금계좌 세액공제');
  const transfer = Math.min(Math.max(0, n(v.transferAmount)), Math.max(0, n(v.isaBalance)));
  const o = computeIsaConversion({
    transfer, savings: n(v.pensionSavings), irp: n(v.irpPaid), into: v.transferInto === 'savings' ? 'savings' : 'irp', low: v.incomeLow === 'yes',
  }, P);
  return {
    main: { label: '전환으로 늘어나는 세액공제 (소득세)', value: fmt(o.credit) },
    details: [
      { label: '전환 금액 (만기 잔액 이내)', value: fmt(transfer) },
      { label: `추가 한도 = min(전환액 ${P.ext_isa_conv_ratio}%, ${fmt(P.ext_isa_conv_cap)})`, value: fmt(o.addLimit) },
      { label: '공제대상 납입액 — 전환 없이', value: fmt(o.baseline) },
      { label: '공제대상 납입액 — 전환 포함', value: fmt(o.withTransfer) },
      { label: '늘어난 공제대상 납입액', value: fmt(o.increase) },
      { label: '세액공제율', value: `${o.ratePct}% (종합소득금액 4,500만원 이하 · 근로소득만 있으면 총급여 5,500만원 이하면 15%)` },
      { label: '요건', value: `ISA 계약기간 만료일부터 ${EXT_LAW.isaTransferWindowDays}일 이내 연금계좌 납입(시행령 §118의2③)` },
      { label: '⚠️ 미반영', value: '지방소득세 공제분·결정세액 한도(산출세액보다 많이 공제되지 않는다)·직전 과세기간에 나눠 납입한 경우의 한도 차감(§59의3④ 괄호)' },
      ...basis(pack, 'ext_isa_conv_ratio', 'ext_pension_credit_rate'),
    ],
  };
}

// ═══ 7. capital-gains-land — 소득세법 §95②·§103·§104①2·3·8 ═══

export const LAND_KEYS = {
  pct: ['cgt_ltd_t1_base', 'cgt_ltd_t1_step', 'cgt_ltd_t1_max', 'cgt_local_ratio', 'ext_land_nonbiz_add', 'ext_land_short_1y', 'ext_land_short_2y'],
  amt: ['cgt_basic_deduction'],
} as const;

export interface LandCgtOut {
  gain: number; ltdPct: number; ltdAmount: number; base: number; addPct: number; shortPct: number;
  progressiveTax: number; shortTax: number; useShort: boolean; incomeTax: number; localTax: number; total: number;
}

export function computeLandCgt(i: { sell: number; buy: number; expenses: number; hold: number; nonBusiness: boolean }, P: Record<string, number>): LandCgtOut | null {
  const gain = i.sell - i.buy - i.expenses;
  if (gain <= 0) return null;
  const ltdPct = ltdTable1Pct(i.hold, P);
  const ltdAmount = Math.round(gain * ltdPct / 100);
  const base = Math.max(0, gain - ltdAmount - P.cgt_basic_deduction);
  const addPct = i.nonBusiness ? P.ext_land_nonbiz_add : 0;
  // §104①8 — 기본세율에 10%p «가산» (세액 × 1.1 이 아니다)
  const progressiveTax = Math.round(calcProgressiveTax(base, INCOME_TAX_BRACKETS) + base * addPct / 100);
  const shortPct = i.hold < 1 ? P.ext_land_short_1y : i.hold < 2 ? P.ext_land_short_2y : 0;
  const shortTax = Math.round(base * shortPct / 100);
  // §104① 후단 — 둘 이상 해당하면 산출세액 중 큰 것
  const useShort = shortTax > progressiveTax;
  const incomeTax = useShort ? shortTax : progressiveTax;
  const localTax = Math.round(incomeTax * P.cgt_local_ratio / 100);
  return { gain, ltdPct, ltdAmount, base, addPct, shortPct, progressiveTax, shortTax, useShort, incomeTax, localTax, total: incomeTax + localTax };
}

export function capitalGainsLand(v: V): CalcResult {
  const P = loadCgtPolicy(v.__policy, LAND_KEYS);
  if (!P) return MISSING('양도소득세율');
  const nonBusiness = v.nonBusiness === 'yes';
  const o = computeLandCgt({ sell: n(v.sellPrice), buy: n(v.buyPrice), expenses: n(v.expenses), hold: Math.max(0, n(v.holdYears)), nonBusiness }, P);
  if (!o) return { main: { label: '양도소득세', value: '0원' }, details: [{ label: '사유', value: '양도차익이 없다(양도가액 − 취득가액 − 필요경비 ≤ 0)' }] };
  const rate = o.useShort
    ? `단기 ${o.shortPct}% (§104①${o.shortPct === P.ext_land_short_1y ? '3' : '2'})`
    : nonBusiness ? `기본세율 + ${o.addPct}%p (비사업용 토지 §104①8 — 16~55%)` : '기본세율 6~45% (§55①)';
  const details: Row[] = [
    { label: '양도차익', value: fmt(o.gain) },
    { label: o.ltdPct > 0 ? `장기보유특별공제 (${o.ltdPct}%)` : '장기보유특별공제 (보유 3년 미만 — 없음)', value: fmt(o.ltdAmount) },
    { label: '기본공제', value: fmt(P.cgt_basic_deduction) },
    { label: '과세표준', value: fmt(o.base) },
    { label: '적용 세율', value: rate },
  ];
  if (o.shortPct > 0) details.push({ label: '비교', value: `${nonBusiness ? '가산세율' : '기본세율'} 세액 ${fmt(o.progressiveTax)} 과 단기세율 세액 ${fmt(o.shortTax)} 중 큰 쪽(§104① 후단)` });
  details.push({ label: '양도소득세', value: fmt(o.incomeTax) });
  details.push({ label: `지방소득세 (소득세의 ${P.cgt_local_ratio}% 구조)`, value: fmt(o.localTax) });
  details.push({ label: '⚠️ 판단 안 함', value: '비사업용 토지 해당 여부(§104의3)·지정지역 추가 10%p(§104④)·미등기 70%·감면은 계산하지 않는다' });
  return { main: { label: '양도소득세 + 지방소득세', value: fmt(o.total) }, details };
}

// ═══ 8. child-credit — 소득세법 §59의2 · 부칙(법률 21548) §2 ═══

export const CHILD_KEYS = {
  pct: [] as string[],
  amt: ['ext_child_credit_1', 'ext_child_credit_2', 'ext_child_credit_extra', 'ext_child_birth_1', 'ext_child_birth_2', 'ext_child_birth_3'],
} as const;

export function childCreditParts(count: number, newborn: number, startOrder: number, P: Record<string, number>) {
  const c = Math.max(0, Math.floor(count));
  const basic = c === 0 ? 0 : c === 1 ? P.ext_child_credit_1 : P.ext_child_credit_2 + (c - 2) * P.ext_child_credit_extra;
  let birth = 0;
  const s = Math.max(1, Math.floor(startOrder));
  for (let k = 0; k < Math.max(0, Math.floor(newborn)); k++) {
    const order = s + k;
    birth += order === 1 ? P.ext_child_birth_1 : order === 2 ? P.ext_child_birth_2 : P.ext_child_birth_3;
  }
  return { basic, birth, total: basic + birth };
}

export function childCredit(v: V): CalcResult {
  const pack = parsePolicyPack(v.__policy);
  const P = need(pack, CHILD_KEYS.pct, CHILD_KEYS.amt);
  if (!P) return MISSING('자녀세액공제');
  const newborn = n(v.newborn);
  const startOrder = n(v.newbornOrder) || 1;
  const p = childCreditParts(n(v.childCount), newborn, startOrder, P);
  return {
    main: { label: '자녀세액공제', value: fmt(p.total) },
    details: [
      { label: `공제대상 자녀 공제 (2026 귀속: ${EXT_LAW.childCreditAge2026}세 이상)`, value: fmt(p.basic) },
      { label: '금액표', value: `1명 ${fmt(P.ext_child_credit_1)} · 2명 ${fmt(P.ext_child_credit_2)} · 3명 이상은 2명 초과 1명당 ${fmt(P.ext_child_credit_extra)} 추가` },
      { label: '출산·입양 공제', value: fmt(p.birth) },
      { label: '출산·입양 금액', value: `첫째 ${fmt(P.ext_child_birth_1)} · 둘째 ${fmt(P.ext_child_birth_2)} · 셋째 이상 ${fmt(P.ext_child_birth_3)} (그 아이의 출생 순위 기준)` },
      { label: '⚠️ 나이 기준', value: `본칙은 ${EXT_LAW.childCreditAgeStatute}세 이상(2026-04-21 개정)이나 부칙 §2②로 2026년 ${EXT_LAW.childCreditAge2026}세·2027년 10세·2028년 11세·2029년 12세. 2017년생은 경과규정 적용 제외(부칙 §2③) — 해당 자녀는 홈택스·세무서로 확인한다` },
      { label: '⚠️ 판단 안 함', value: '기본공제대상자(소득 요건) 여부·결정세액 한도·자녀장려금 중복' },
      ...basis(pack, 'ext_child_credit_1'),
    ],
  };
}
