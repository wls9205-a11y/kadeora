// S4-4 — 알림 신청 폼 노출 대상 판정.
//
// 상세 페이지(P2)와 블로그 하단(P1)이 같은 판정을 쓴다. 중복 구현하지 않는다.
//
// lifecycle_stage 는 매일 06:23 KST fn_refresh_lifecycle_stage() 가 갱신하므로,
// 현장이 다음 단계로 넘어가면 폼이 자동으로 사라진다. 별도 관리가 필요 없다.
//
// 단계 의미 (fn_refresh_lifecycle_stage 의 CASE 순서 그대로):
//   post_move_in      입주월이 지남
//   move_in_started   입주월이 이번 달
//   move_in_ready     계약 체결 기간 종료 — "입주 준비"가 아니라 "계약 끝". 입주는 아직 미래다
//   contract_signing  계약 기간 중
//   award_announced   당첨자 발표됨
//   pre_announcement  접수 시작 전
//   subscription_open 접수 중
// 위 CASE 에 걸리지 않는 현장은 site_planning / unsold_active / landmark_active 등으로 남는다.

/** 알림 신청 폼을 노출할 생애주기 단계 */
export const LEAD_ELIGIBLE_STAGES = [
  'site_planning',      // 분양예정
  'pre_announcement',   // 모집공고 전
  'subscription_open',  // 청약 접수중
  'award_announced',    // 당첨자 발표
  'unsold_active',      // 미분양·선착순·잔여세대
  // move_in_ready 는 이름과 달리 "계약 체결 기간 종료"일 뿐 입주는 아직 미래다.
  // 실측 720건 전부 입주예정 202609~203104 (과거 0건) — 입주월이 지나면 post_move_in 으로,
  // 이번 달이면 move_in_started 로 먼저 걸리기 때문이다. 분양가·일정 알림이 유효한 구간이라
  // 대상에 포함한다. P0 라이브 검증 현장(엄궁역 트라비스 하늘채)도 이 단계다.
  'move_in_ready',
  // v6-3: 입주월이 이번 달인 현장. 잔여 세대가 남아 있을 수 있어 상담이 유효하다.
  // 1,182 → 1,208 (+26). 그 외 단계는 건드리지 않는다 —
  // landmark_active 는 2단계에서 별도 문구(지역DB)로 다룬다.
  'move_in_started',

  // ── ONESHOT §C0 · 정비사업 단계 ──
  //
  // 이 6단계에 폼이 없어 **유입 1위 페이지가 리드를 못 받고 있었다.**
  // `울산 남구 달동 재개발`(조합설립)은 네이버 유입 48건에 CTA 완료 1건이 난 페이지인데
  // 폼이 없었다. 공고 전이라 분양가도 일정도 없지만 — **그래서** 사람들이 물어본다.
  //
  // ⚠️ 문구를 함께 갈라야 한다. 공고 전에 '분양 정보 안내' 는 어색하다.
  //    lib/apt/lead-copy.ts 가 단계별 문구를 낸다. 폼만 켜고 문구를 두면 전환이 안 난다.
  'union_established',    // 조합설립
  'constructor_selected', // 시공사 선정
  'plan_approved',        // 사업시행인가
  'mgmt_approved',        // 관리처분인가
  'construction',         // 착공
  'contract_signing',     // 계약
] as const;

// landmark_active 는 이름과 달리 분양 현장이 아니라 지역 대장 기축 아파트다(수완자이·명륜자이 등).
// 준공된 아파트에 "분양가·일정 알림 신청"을 붙이지 않는다 — 의도적으로 제외한다.

export function isLeadEligible(stage?: string | null): boolean {
  return !!stage && (LEAD_ELIGIBLE_STAGES as readonly string[]).includes(stage);
}
