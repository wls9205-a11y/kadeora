/**
 * K-9 A″ 감사 — a2 클러스터: FORMULAS 맵 미등록(라이브 «결과 없음») 무감사 계산기 21종 (2026-09-17).
 *
 * 감사 규율: 법령·시행령 값은 policy_constants(서버 `__policy` 주입, 없으면 「미수신」) ·
 *   파서(%·원)가 못 읽는 조문 뼈대(30일·3개월·10년·연차 경계)는 A2_LAW 코드 상수 + 근거 조문 ·
 *   시장·사업자·행정지도 값은 *_SOURCE 공개형(대표값 + 기준일 + 검증 단계) · 순수 산식은 경계값 회귀.
 *
 * 원문: 국가법령정보센터 DRF `target=eflaw` 현행 판(시행일 ≤ 2026-09-17, 조회 2026-09-17)
 *   근로기준법 MST 283457 @2026-08-20 · 근로기준법 시행령 270551 @2025-10-23
 *   소득세법 280405 @2026-07-01 · 소득세법 시행령 286211 @2026-07-01 · 지방세법 282559 @2026-07-01
 *   초·중등교육법 283903 @2026-09-11 (옛 판 76654 @2007-01-03 · 79961 @2007-08-03 대조) · 건축법 273437 @2026-02-27
 *
 * ⚠️ 공유 누진표(INCOME_TAX_BRACKETS, 소득세법 §55①)는 tax-tables.ts 그대로 쓴다 — 공유 누진표 이관은 별건.
 */
import { INCOME_TAX_BRACKETS, calcProgressiveTax, formatKRWExact } from '../tax-tables';
import { parsePolicyPack } from '../gov-tables';
import type { CalcResult } from '../formulas';

type V = Record<string, number | string>;
type Row = { label: string; value: string };
type Meta = Record<string, { item?: string; source?: string; date?: string; status?: string; from?: string; url?: string }>;

const n = (v: unknown) => Number(v) || 0;
const fmt = (v: number) => formatKRWExact(v);
const r = Math.round;

/** 파서가 못 읽는 조문 뼈대 — 값 옆에 근거 조문. */
export const A2_LAW = {
  /** 근로기준법 §26 본문 — 30일 전 예고 / 30일분 이상의 통상임금. */
  noticeDays: 30,
  /** 근로기준법 §26 단서 1호 — 계속 근로한 기간이 3개월 미만이면 적용 제외. */
  noticeMinTenureMonths: 3,
  /** 근로기준법 §18③ — 1주 소정근로시간 15시간 미만은 주휴(§55) 미적용. */
  weeklyHolidayMinHours: 15,
  /** 근로기준법 §50① — 1주 법정근로시간(주휴시간 산정 상한). */
  statutoryWeeklyHours: 40,
  /** 소득세법 §57② — 공제한도 초과 외국소득세액 이월공제기간(년). */
  foreignTaxCarryYears: 10,
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// 1. jeonse-loan — 순수 산식(단리 이자) · 금리는 사용자 입력(시장값)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 옛 코드와 월 이자 산식은 같다(금액 × 금리 ÷ 12). 감사에서 고친 것:
 *   · «매월 이자만 내는 만기일시상환» 가정을 화면에 적는다(원리금 상환이면 이 값이 아니다).
 *   · 은행은 일할(연 365일)로 이자를 매긴다 — 30일·31일 달 이자를 같이 보여준다(월 ÷12 값과 다르다).
 *   · 기본 금리 3.5% 는 예시값이다(시장값 — 은행·상품·신용에 따라 다름).
 */
export function jeonseLoan(v: V): CalcResult {
  const amount = Math.max(0, n(v.loanAmount));
  const ratePct = Math.max(0, n(v.rate));
  const rate = ratePct / 100;
  const monthly = r(amount * rate / 12);
  const annual = r(amount * rate);
  const day30 = r(amount * rate * 30 / 365);
  const day31 = r(amount * rate * 31 / 365);
  return {
    main: { label: '월 이자', value: fmt(monthly) },
    details: [
      { label: '연 이자', value: fmt(annual) },
      { label: '일할 계산 — 30일 달 (금액 × 금리 × 30 ÷ 365)', value: fmt(day30) },
      { label: '일할 계산 — 31일 달', value: fmt(day31) },
      { label: '⚠️ 상환 방식 가정', value: '매월 이자만 내고 만기에 원금을 갚는 만기일시상환이다. 원리금·원금 분할상환이면 월 납입액이 이 값보다 크다' },
      { label: '⚠️ 금리', value: `입력 금리 ${ratePct}% 를 만기까지 고정으로 봤다. 기본값 3.5% 는 예시값이다 — 은행·보증기관·우대조건에 따라 다르다` },
      { label: '⚠️ 미반영', value: '보증료(HUG·HF·SGI)·인지세·중도상환수수료는 계산하지 않았다' },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. severance-calc (해고예고수당) — 근로기준법 §26 · 시행령 §6②4호·③
// ═════════════════════════════════════════════════════════════════════════════

export interface NoticePayParts {
  weeklyPaidHours: number;
  /** 고용노동부 실무의 반올림 기준시간(주 40시간 → 209). */
  monthHours: number;
  /** 시행령 §6②4호 식 그대로(반올림 없음, 주 40시간 → 208.57…). */
  monthHoursExact: number;
  hourly: number;
  daily: number;
  pay: number;
  payExact: number;
}

/**
 * ⛔ 옛 코드: 월 통상임금을 그대로 「30일분」 으로 찍었다.
 *    §26 은 «30일분 이상의 통상임금», 시행령 §6③ 일급 = 시간급 × 1일 소정근로시간,
 *    §6②4호 시간급 = 월급 ÷ 월 통상임금 산정 기준시간(주 기준시간 × 1년 평균 주 수 ÷ 12).
 *    월 350만·주 40시간·1일 8시간: 옛 3,500,000원 → 법 4,019,139원(209시간 기준, 14.8% 과소였다).
 */
export function noticePayParts(monthlySalary: number, weeklyHoursIn: number, dailyHoursIn: number): NoticePayParts {
  const weekly = Math.max(0, weeklyHoursIn);
  const holiday = weekly >= A2_LAW.weeklyHolidayMinHours ? Math.min(weekly, A2_LAW.statutoryWeeklyHours) / 5 : 0;
  const weeklyPaidHours = weekly + holiday;
  const monthHoursExact = weeklyPaidHours * 365 / 7 / 12;
  const monthHours = Math.round(monthHoursExact);
  const daily8 = Math.max(0, dailyHoursIn);
  const hourly = monthHours > 0 ? monthlySalary / monthHours : 0;
  const hourlyExact = monthHoursExact > 0 ? monthlySalary / monthHoursExact : 0;
  const daily = hourly * daily8;
  return {
    weeklyPaidHours, monthHours, monthHoursExact, hourly, daily,
    pay: r(daily * A2_LAW.noticeDays),
    payExact: r(hourlyExact * daily8 * A2_LAW.noticeDays),
  };
}

export function severanceCalc(v: V): CalcResult {
  const monthly = Math.max(0, n(v.monthlySalary));
  const weeklyHours = v.weeklyHours === undefined || v.weeklyHours === '' ? 40 : n(v.weeklyHours);
  const dailyHours = v.dailyHours === undefined || v.dailyHours === '' ? 8 : n(v.dailyHours);
  if (v.tenure === 'under3m') {
    return {
      main: { label: '해고예고수당', value: fmt(0) },
      details: [
        { label: '사유', value: `계속 근로기간 ${A2_LAW.noticeMinTenureMonths}개월 미만 — 해고예고 적용 제외(근로기준법 §26 단서 1호)` },
        { label: '근거', value: '근로기준법 제26조 (eflaw 현행 2026-08-20 판 대조)' },
      ],
    };
  }
  const p = noticePayParts(monthly, weeklyHours, dailyHours);
  if (p.monthHours <= 0 || dailyHours <= 0) {
    return { main: { label: '해고예고수당', value: '—', color: 'var(--text-tertiary)' }, details: [{ label: '사유', value: '주·1일 소정근로시간을 0보다 크게 넣는다' }] };
  }
  return {
    main: { label: `해고예고수당 (법정 최소 ${A2_LAW.noticeDays}일분)`, value: fmt(p.pay) },
    details: [
      { label: '월 통상임금', value: fmt(monthly) },
      { label: '월 통상임금 산정 기준시간', value: `${p.monthHours}시간 (주 ${Number(p.weeklyPaidHours.toFixed(2))}시간 × 365 ÷ 7 ÷ 12 = ${p.monthHoursExact.toFixed(2)}, 반올림 — 고용노동부 실무 209시간과 같은 방식)` },
      { label: '시간급 통상임금 (월급 ÷ 기준시간, 시행령 §6②4호)', value: fmt(r(p.hourly)) },
      { label: `1일 통상임금 (시간급 × ${dailyHours}시간, 시행령 §6③)`, value: fmt(r(p.daily)) },
      { label: `× ${A2_LAW.noticeDays}일 (근로기준법 §26)`, value: fmt(p.pay) },
      { label: '참고: 기준시간을 반올림하지 않으면', value: fmt(p.payExact) },
      { label: '⚠️ 30일분 «이상»', value: '법정 최소액이다. 30일 전에 예고했으면 수당 의무가 없다' },
      { label: '⚠️ 적용 제외', value: '계속 근로 3개월 미만(위 선택) · 천재·사변 등으로 사업 계속 불가 · 근로자의 고의로 막대한 손해(고용노동부령 사유) — §26 단서' },
      { label: '⚠️ 미반영', value: '세금·4대보험(세전 금액) · 통상임금에 들어가는 수당 판정 — 월 통상임금은 직접 넣는다' },
      { label: '근거', value: '근로기준법 제26조 · 근로기준법 시행령 제6조 (eflaw 현행 판 대조 2026-09-17)' },
    ],
  };
}
