// 「일정」 — 현장의 «절차 일정» 전체. (U-1b 판정 · 2026-08-30)
//
// ── 왜 한 섹션인가 ────────────────────────────────────────────────────────
// 이 페이지는 현장의 «일대기» 다. 시간 정보의 귀속처는 하나여야 한다.
// 흩어져 있으면 같은 날짜가 히어로·공급표·공고요약에서 «세 번» 나오고,
// 한 곳만 고치는 날 서로 다른 말을 하기 시작한다.
//
// ── 판정부를 lib 에 두는 이유 (Rule #116) ──────────────────────────────────
// 「지났는가 / 다음은 어디인가 / D-day 를 어디에 붙일 것인가」는 판정이다.
// 화면에 흩뿌리면 두 벌이 되고, scripts/ 는 tsc 사각지대라 거기 두지 않는다.
//
// ⛔ 없는 날짜를 «지어내지 않는다». 값이 없으면 행 자체가 없다(조건부 렌더).
// ⛔ 지난 행을 «지우지 않는다» — 지우면 일대기가 아니다. 완료 톤으로 남긴다.

import { salePeriodDisplay } from '@/lib/apt/sale-period';

export type ScheduleState = 'past' | 'current' | 'future';

export interface ScheduleRow {
  key: string;
  label: string;
  /** 화면에 그대로 쓰는 문구. */
  text: string;
  state: ScheduleState;
  /** 도래 «전» 최근접 행 1곳에만 붙는다. 나머지는 null. */
  dday: number | null;
  /** 출처 라벨. 없으면 null — 「어디서 왔는지」를 지어내지 않는다. */
  source: string | null;
  /** 기준일(YYYY-MM-DD). 출처가 «말한 날» 이다. */
  asof: string | null;
  /** 확신도. VerifiedBadge 가 그대로 받는다. */
  confidence: string | null;
}

export interface ScheduleInput {
  site: {
    expected_sale_period?: string | null;
    expected_sale_source?: string | null;
    expected_sale_period_asof?: string | null;
    confidence?: string | null;
    move_in_date?: string | null;
    model_house_open_date?: string | null;
    model_house_close_date?: string | null;
  } | null;
  sub: {
    announcement_date?: string | null;
    spsply_rcept_bgnde?: string | null;
    spsply_rcept_endde?: string | null;
    rcept_bgnde?: string | null;
    rcept_endde?: string | null;
    przwner_presnatn_de?: string | null;
    cntrct_cncls_bgnde?: string | null;
    cntrct_cncls_endde?: string | null;
    mvn_prearnge_ym?: string | null;
  } | null;
  /** 오늘(YYYY-MM-DD). ⚠️ 렌더마다 Date.now() 를 부르면 한 화면 안에서 기준이 갈린다. */
  today: string;
}

/** `20260901` · `2026-09-01` 을 `2026-09-01` 로. 못 읽으면 null — 「미정」을 만들지 않는다. */
export function normDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const m8 = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m8) return `${m8[1]}-${m8[2]}-${m8[3]}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** `202609` → `2026년 9월`. 입주예정은 «월 정밀도» 다 — 일까지 아는 척하지 않는다. */
export function ymText(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4})[-.]?(\d{2})$/.exec(String(v).trim());
  return m ? `${m[1]}년 ${Number(m[2])}월` : null;
}

const dateText = (d: string) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
const rangeText = (a: string, b: string | null) => (b && b !== a ? `${dateText(a)} ~ ${dateText(b)}` : dateText(a));

/** 두 날짜의 일수 차. 시간대 흔들림을 피해 UTC 자정으로 고정해 뺀다. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * 절차 일정을 «위→아래» 로 만든다. 값 없는 행은 아예 없다.
 *
 * ⚠️ 청약홈에서 온 행은 출처가 「청약홈 모집공고」이고 «기준일은 공고일» 이다 —
 *    실측 2,857/2,857 로 채워져 있다. 그 공고가 말한 날이 곧 그 값의 기준일이다.
 * ⚠️ 「분양예정 시기」만 D-2 의 4요소 규칙을 그대로 탄다(한정어·출처·기준일·확신도).
 *    넷이 안 모이면 «행이 없다» — 부분 표시가 더 위험하다.
 * ⚠️ 모델하우스는 실측 «0건» 이다(apt_sites·apt_subscriptions 양쪽). 배선만 해 둔다 —
 *    값이 들어오는 날 저절로 뜬다. ⛔ 자리를 만들어 두지 않는다(빈 행 금지).
 */
export function buildSchedule({ site, sub, today }: ScheduleInput): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const annAsof = normDate(sub?.announcement_date ?? null);
  type Staged = ScheduleRow & { _anchor: string | null };
  const fromNotice = (label: string, key: string, text: string, anchor: string | null): Staged => ({
    key, label, text,
    state: 'future' as ScheduleState,
    dday: null as number | null,
    source: '청약홈 모집공고',
    asof: annAsof,
    confidence: 'verified',
    _anchor: anchor,
  });

  // ① 분양예정 시기 — D-2 규칙 그대로. 넷이 안 모이면 행이 없다.
  const sp = salePeriodDisplay({
    period: site?.expected_sale_period,
    source: site?.expected_sale_source,
    asof: site?.expected_sale_period_asof,
    confidence: site?.confidence,
  });
  const staged: Staged[] = [];
  if (sp) {
    staged.push({
      key: 'expected', label: '분양예정 시기', text: sp.text,
      state: 'future', dday: null,
      source: sp.sourceLabel, asof: sp.asofText.replace(' 기준', ''),
      confidence: sp.confidence, _anchor: null,
    });
  }

  // ② 모델하우스 — 실측 0건. 값이 생기면 저절로 뜬다.
  const mhOpen = normDate(site?.model_house_open_date ?? null);
  if (mhOpen) {
    const mhClose = normDate(site?.model_house_close_date ?? null);
    staged.push({
      key: 'model_house', label: '모델하우스', text: rangeText(mhOpen, mhClose),
      state: 'future', dday: null, source: null, asof: null,
      confidence: site?.confidence ?? null, _anchor: mhOpen,
    });
  }

  // ③~⑦ 청약홈 절차 — 전부 공고가 말한 날이다.
  const ann = normDate(sub?.announcement_date ?? null);
  if (ann) staged.push(fromNotice('모집공고', 'announcement', dateText(ann), ann));

  const spsB = normDate(sub?.spsply_rcept_bgnde ?? null);
  if (spsB) staged.push(fromNotice('특별공급', 'special', rangeText(spsB, normDate(sub?.spsply_rcept_endde ?? null)), spsB));

  const rB = normDate(sub?.rcept_bgnde ?? null);
  const rE = normDate(sub?.rcept_endde ?? null);
  if (rB) staged.push(fromNotice('1·2순위 접수', 'apply', rangeText(rB, rE), rB));

  const win = normDate(sub?.przwner_presnatn_de ?? null);
  if (win) staged.push(fromNotice('당첨자 발표', 'winner', dateText(win), win));

  const cB = normDate(sub?.cntrct_cncls_bgnde ?? null);
  if (cB) staged.push(fromNotice('정당계약', 'contract', rangeText(cB, normDate(sub?.cntrct_cncls_endde ?? null)), cB));

  // ⑧ 입주예정 — 월 정밀도다. 청약홈 값이 있으면 그것을, 없으면 현장 값을 쓴다.
  const mvn = ymText(sub?.mvn_prearnge_ym ?? null);
  if (mvn) {
    staged.push(fromNotice('입주예정', 'move_in', mvn, null));
  } else if (site?.move_in_date) {
    staged.push({
      key: 'move_in', label: '입주예정', text: String(site.move_in_date),
      state: 'future', dday: null, source: null, asof: null,
      confidence: site?.confidence ?? null, _anchor: null,
    });
  }

  // ── 지났는가 / 다음은 어디인가 ─────────────────────────────────────────
  // ⛔ 지난 행을 지우지 않는다. 완료 톤으로 남긴다 — 지우면 일대기가 아니다.
  let nearest: { idx: number; days: number } | null = null;
  // eslint-disable-next-line prefer-const
  staged.forEach((r, idx) => {
    const anchor = r._anchor;
    if (!anchor) return;
    const days = daysBetween(today, anchor);
    if (days < 0) { r.state = 'past'; return; }
    r.state = days === 0 ? 'current' : 'future';
    // 도래 «전» 최근접 1곳만 D-day 를 받는다.
    const cur = nearest;
    if (!cur || days < cur.days) nearest = { idx, days };
  });
  const near = nearest as { idx: number; days: number } | null;
  if (near) staged[near.idx].dday = near.days;

  for (const r of staged) {
    const { _anchor, ...row } = r;
    rows.push(row);
  }
  return rows;
}
