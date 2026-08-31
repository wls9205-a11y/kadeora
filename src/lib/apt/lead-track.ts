// ADDENDUM §5-3 — 리드폼 진입 슬롯 계측.
//
// ── 왜 필요했나 ──
// 카톡 오픈채팅 CTA 는 이미 슬롯별로(sticky·site_cta·bottom_bar·rail·faq…) 계측되고 있었는데,
// **리드폼 CTA 는 이벤트가 하나도 없었다.** 실측(conversion_events 30일):
//   sticky_signup_bar 474 · login_gate_apt_analysis 173 · popup_signup_modal 131 …
//   리드폼 관련: 0건
// 즉 「노출 516 → 클릭 9(1.7%)」는 가입 유도 CTA 수치이지 리드폼 수치가 아니다.
// 리드폼은 지금까지 **측정된 적이 없다.** 어디를 고쳐야 할지 모르는 게 당연했다.
//
// ── 어디에 쌓나 ──
// talk-banner.ts 와 같은 `user_events` 한 곳으로 보낸다.
// ⚠️ conversion_events 와 섞지 말 것 — 두 테이블에 나뉘면 슬롯별 클릭률을 한 쿼리로 못 낸다.
//    (talk-banner.ts 상단 주석과 같은 규칙이다. 두 벌의 판정을 만들지 않는다.)
//
// ── 축 ──
// 슬롯 × 현장. 어느 자리가 실제로 폼을 채우게 하는지가 유일한 질문이다.

import { track } from '@/lib/analytics';

/**
 * 리드폼으로 들어오는 자리.
 *   rail        데스크탑 우측 레일 진입 카드 (≥1024px)
 *   bottom_bar  모바일 하단 고정 바의 주 버튼
 *   body        본문 안 폼 그 자체 (스크롤로 도달)
 *   jumpbar     상세 상단 점프바 우측 CTA (P0-A′ · 2026-08-31 신설)
 * ⚠️ 값을 «바꾸지» 말 것 — 쌓인 데이터와 축이 어긋난다.
 *    «더하는» 것은 안전하다 — 기존 행은 그대로다. jumpbar 가 그 경우인데,
 *    이 값이 8/31 이전 데이터에 없는 것은 그 자리가 «조용했기» 때문이 아니라
 *    **자가 없었기** 때문이다. 두 사실을 섞어 읽지 말 것.
 */
export type LeadSlot = 'rail' | 'bottom_bar' | 'body' | 'jumpbar';

export type LeadTrackProps = {
  /** 어느 현장이 리드를 만드는지 — 핵심 지표. */
  site_slug?: string;
  /** 단계별 문구가 다르므로 전환 차이를 볼 수 있게 함께 남긴다. */
  lifecycle_stage?: string | null;
  [k: string]: unknown;
};

/* ── P0-A′ · 제출의 «진입 귀속» (2026-08-31) ──────────────────────────────────
 *
 * ── 왜 필요했나 ──
 * 정본(user_events) 실측 8/25~8/31:
 *   bottom_bar  노출 1,006 · 클릭 17 · 제출 **0**
 *   rail        노출     0 · 클릭  1 · 제출 **0**
 *   body        노출   670 ·   —    · 제출  4
 *
 * 「클릭 17에 제출 0」은 퍼널이 죽은 기록으로 읽혔다. 그렇지 않다.
 * trackLeadSubmit 은 저장소 전체에서 «호출 지점이 한 곳» 이고 슬롯이 'body' 로 박혀 있다.
 * 폼 인스턴스는 페이지당 한 벌이므로(SiteDetailRail 주석 — id 두 벌 금지) 제출은 **항상**
 * body 로 찍힌다. 즉 bottom_bar·rail 의 제출은 «구조적으로 0일 수밖에 없었다».
 * 병의 기록이 아니라 «자의 기록» 이었다.
 * ⚠️ P0-C 와 같은 계열이다 — 적재처를 코드에서 확인하기 전엔 DB 실측도 후보다.
 *    여기서는 테이블이 아니라 «열» 을 잘못 읽었다. 같은 교훈이 한 단 아래에도 적용된다.
 *
 * ── 그래서 무엇을 했나 ──
 * 슬롯을 «바꾸지 않고» 축을 하나 더 단다:
 *   slot   폼이 «어디에 있나» — 제출은 앞으로도 'body' 다. 쌓인 4건과 어긋나지 않는다.
 *   entry  그 사람을 폼으로 «보낸» 자리 — 슬롯별 최종 전환은 이 열로 낸다.
 *
 * ⛔ slot 을 진입점으로 갈아타지 않는다. 갈아탔다면 8/25~8/31 의 제출 4건이 소급해서
 *    «본문에서 제출된 4건» 이라는 «틀린 뜻» 을 갖게 된다 — 그때는 진입점을 몰랐다.
 *    모르는 구간을 아는 척 만들지 않는다.
 *
 * ⚠️ 귀속은 «같은 현장 · 같은 시간 창» 에서만 유효하다. 모듈 변수는 SPA 이동 뒤에도
 *    살아 있어, 조건 없이 두면 A현장 클릭이 B현장 제출에 붙는다.
 */

/** 진입 귀속 유효 창. analytics.ts 의 세션 타임아웃(30분)과 «같은 값» 을 쓴다. */
const ENTRY_TTL_MS = 30 * 60 * 1000;

let lastEntry: { slot: LeadSlot; siteSlug: string; at: number } | null = null;

/** 폼으로 보낸 자리를 기록한다. 진입점 클릭이 곧 귀속이라 trackLeadClick 이 «자동으로» 부른다. */
function markEntry(slot: LeadSlot, siteSlug?: string) {
  lastEntry = { slot, siteSlug: siteSlug || '-', at: Date.now() };
}

/** 제출 시점의 귀속. 현장이 다르거나 창을 넘겼으면 «없는 것» 으로 본다. */
function readEntry(siteSlug?: string): LeadSlot | null {
  if (!lastEntry) return null;
  if (lastEntry.siteSlug !== (siteSlug || '-')) return null;
  if (Date.now() - lastEntry.at > ENTRY_TTL_MS) return null;
  return lastEntry.slot;
}

/** 노출은 세션 × 슬롯 × 현장 단위로 1회만. 클릭률 분모가 부풀지 않게. */
function viewKey(slot: LeadSlot, siteSlug?: string) {
  return `kd_lview:${slot}:${siteSlug || '-'}`;
}

/**
 * 리드폼 진입점 노출. 뷰포트에 들어온 순간 1회 호출한다.
 * ⚠️ 마운트 시점에 부르지 말 것 — 화면 밖에 있는 것도 노출로 세면 클릭률이 가짜가 된다.
 */
export function trackLeadView(slot: LeadSlot, props: LeadTrackProps = {}) {
  if (typeof window === 'undefined') return;
  const key = viewKey(slot, props.site_slug as string | undefined);
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* 프라이빗 모드 등 — 중복 제거를 포기하고 계측은 계속한다 */
  }
  track('lead_form_view', 'apt_lead_form', { slot, ...props });
}

/**
 * 진입점 클릭. 중복 제거하지 않는다 — 재클릭도 신호다.
 * ⚠️ 귀속을 «여기서» 남긴다. 진입점마다 markEntry 를 따로 부르게 두면 한 곳을 빠뜨리고,
 *    빠뜨린 슬롯만 조용히 'direct' 로 새어 나간다 — 그것이 지금 고치는 병의 형태다.
 */
export function trackLeadClick(slot: LeadSlot, props: LeadTrackProps = {}) {
  if (typeof window === 'undefined') return;
  markEntry(slot, props.site_slug as string | undefined);
  track('lead_form_click', 'apt_lead_form', { slot, ...props });
}

/**
 * 실제 제출 성공. 노출·클릭과 같은 축에 남겨야 슬롯별 최종 전환을 한 쿼리로 낸다.
 * ⚠️ 서버(Apps Script) 응답이 recorded 일 때만 부를 것 — skipped 를 성공으로 세지 않는다.
 */
export function trackLeadSubmit(slot: LeadSlot, props: LeadTrackProps = {}) {
  if (typeof window === 'undefined') return;
  /* ⚠️ entry 가 없을 수 있다 — 진입점을 «거치지 않고» 스크롤로 폼에 닿은 사람이다.
     null 로 뭉치지 않고 'direct' 로 남긴다. 「측정되지 않음」과 「진입점 없이 도달」은
     다른 사실이고, 뭉치면 나중에 둘을 다시 못 가른다(§2-5 와 같은 계열). */
  const entry = readEntry(props.site_slug as string | undefined) ?? 'direct';
  track('lead_form_submit', 'apt_lead_form', { slot, entry, ...props });
}
