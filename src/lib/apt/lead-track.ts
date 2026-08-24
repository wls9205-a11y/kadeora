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
 * ⚠️ 값을 바꾸지 말 것 — 쌓인 데이터와 축이 어긋난다.
 */
export type LeadSlot = 'rail' | 'bottom_bar' | 'body';

export type LeadTrackProps = {
  /** 어느 현장이 리드를 만드는지 — 핵심 지표. */
  site_slug?: string;
  /** 단계별 문구가 다르므로 전환 차이를 볼 수 있게 함께 남긴다. */
  lifecycle_stage?: string | null;
  [k: string]: unknown;
};

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

/** 진입점 클릭. 중복 제거하지 않는다 — 재클릭도 신호다. */
export function trackLeadClick(slot: LeadSlot, props: LeadTrackProps = {}) {
  if (typeof window === 'undefined') return;
  track('lead_form_click', 'apt_lead_form', { slot, ...props });
}

/**
 * 실제 제출 성공. 노출·클릭과 같은 축에 남겨야 슬롯별 최종 전환을 한 쿼리로 낸다.
 * ⚠️ 서버(Apps Script) 응답이 recorded 일 때만 부를 것 — skipped 를 성공으로 세지 않는다.
 */
export function trackLeadSubmit(slot: LeadSlot, props: LeadTrackProps = {}) {
  if (typeof window === 'undefined') return;
  track('lead_form_submit', 'apt_lead_form', { slot, ...props });
}
