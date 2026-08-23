// 부정공 TALK(오픈채팅) 진입 슬롯 공용 모듈.
//
// 카톡 전환 계측은 user_events 한 곳으로 통일한다.
// conversion_events(cta_view/cta_click)와 혼용하지 말 것 — 두 테이블에 나뉘면
// 슬롯별 클릭률을 한 쿼리로 못 낸다.
//
// ⚠️ 구조적 한계: 오픈채팅 URL 은 쿼리 파라미터를 받지 못한다.
//    방에 들어온 사람이 어느 현장에서 왔는지는 카더라 쪽에서 알 수 없고,
//    계측은 '클릭 시점'까지가 한계다. 그 이후 연결은 방 운영(코드 밖) 영역.
//    이 한계 때문에 리드폼(누가·어느 현장인지 남는 유일한 경로)을 없애면 안 된다.

import { track } from '@/lib/analytics';

export const KAKAO_TALK_URL = 'https://open.kakao.com/o/gk8TBGyh';

/**
 * 오픈채팅 참여자 수 — 수동 갱신.
 * 카카오가 API 를 제공하지 않아 직접 넣는다.
 *
 * ⚠️ 갱신 안 하면 숫자가 낡아 신뢰를 깎는다. 월 1회는 확인할 것.
 *    카톡방 우측 상단 참여자 수를 보고 아래 상수와 이 주석의 날짜를 같이 고친다.
 *
 * 마지막 갱신: 2026-07-18
 */
export const TALK_MEMBER_COUNT = 1240;

/**
 * 배너 슬롯. 어느 자리가 실제로 방으로 사람을 보내는지 판정하는 축이다.
 *   sticky       전역 상단 고정 배너
 *   site_cta     현장 상세 6번 블록 — 현장 맥락 텍스트 CTA
 *   supply_table 공급/위치 정보 표의 `미공개` 칸 인라인 링크
 *   bottom_bar   모바일 하단 고정 바
 *   rail         현장 상세 데스크탑 우측 레일 (v3 커밋4 · ≥1024px 에서만 렌더)
 *   faq          FAQ 마지막 항목
 *   inline       블로그 본문 이미지 배너 (레거시)
 */
export type TalkSlot =
  | 'sticky'
  | 'site_cta'
  | 'supply_table'
  | 'bottom_bar'
  | 'rail'
  | 'faq'
  | 'inline';

export type TalkTrackProps = {
  /** 어느 현장이 방으로 사람을 보내는지 — 핵심 지표. 현장 밖 슬롯은 생략. */
  site_slug?: string;
  [k: string]: unknown;
};

/** 노출은 세션 × 슬롯 × 현장 단위로 1회만 센다. 같은 세션에서 현장을 옮기면 다시 센다. */
function viewKey(slot: TalkSlot, siteSlug?: string) {
  return `kd_bview:${slot}:${siteSlug || '-'}`;
}

/**
 * 배너 노출. 뷰포트 진입 시 1회 호출한다.
 * 노출 이벤트가 없으면 클릭률을 계산할 수 없다 — 클릭만 쌓으면 슬롯 비교가 불가능하다.
 */
export function trackTalkView(slot: TalkSlot, props: TalkTrackProps = {}) {
  if (typeof window === 'undefined') return;
  const key = viewKey(slot, props.site_slug as string | undefined);
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* 프라이빗 모드 등 — 중복 제거를 포기하고 계측은 계속한다 */
  }
  track('banner_view', 'bujeonggong_talk', {
    slot,
    page_path: window.location.pathname,
    ...props,
  });
}

/** 배너 클릭. 중복 제거하지 않는다 — 재클릭도 신호다. */
export function trackTalkClick(slot: TalkSlot, props: TalkTrackProps = {}) {
  if (typeof window === 'undefined') return;
  track('banner_click', 'bujeonggong_talk', {
    slot,
    page_path: window.location.pathname,
    ...props,
  });
}
