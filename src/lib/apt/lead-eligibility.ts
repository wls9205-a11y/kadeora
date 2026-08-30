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
  // H6-1 — 접수는 마감됐지만 발표 전이다. 관심 등록은 여전히 유효하다
  //   (예비·미계약 물량이 나온다). 접수중과 같은 취급.
  'award_pending',
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

/* ── M5 §A-2 — 기축 매물·시세 상담 폼 ───────────────────────────────────
 *
 * ⚠️ isLeadEligible() 의 «반환값을 바꾸지 않는다». 블로그 하단(P1)·blog-safe-insert·
 *    hero-license 가 같은 판정을 쓴다. 바꾸면 기축 블로그 글에 분양 문구 폼이 붙고
 *    canUseHeroImage 의 광고 게이트 판정까지 함께 흔들린다.
 *    그래서 «새 함수를 하나 더» 둔다.
 *
 * 왜 필요한가: 부울경 폼 없는 662곳이 전부 기축이다. 광고 279곳은 기축 제외
 * 집합이라 광고비가 새고 있지는 않지만, 662곳은 검색으로 들어오는 페이지다.
 * `더샵 남양산센텀포레` 를 검색하는 사람은 매매·전세를 알아보는 사람이고 그것도 리드다.
 */

/** 준공돼 매매·전세가 도는 단계. 분양이 아니라 «매물» 을 묻는 자리다. */
export const RESALE_STAGES = ['post_move_in', 'landmark_active'] as const;

export type LeadKind = 'presale' | 'resale';

/**
 * 이 현장에 어떤 폼을 붙일지.
 *
 *   presale : LEAD_ELIGIBLE_STAGES 13단계 — 분양·진행상황
 *   resale  : post_move_in · landmark_active — 매물·시세
 *   null    : 그 외. 폼을 붙이지 않는다
 *
 * ⚠️ lifecycle_stage 가 비어 있으면 null 이다. 단계를 «추정해 채우지 않는다» (M5 §F-21).
 */
export function leadKind(stage?: string | null): LeadKind | null {
  if (!stage) return null;
  if (isLeadEligible(stage)) return 'presale';
  if ((RESALE_STAGES as readonly string[]).includes(stage)) return 'resale';
  return null;
}

/* ── V4-D P0-A — 「폼이 실제로 서는가」의 «단일 소스» ─────────────────────
 *
 * ⚠️ 이 사실을 «넷이 따로» 계산하고 있었고 그중 «둘이 틀렸다»(2026-08-30 실측):
 *     LeadForm      showLeadForm && site  + 내부 `if (!ENDPOINT) return null`   ✅
 *     하단 액션바   showLeadForm && !!ENDPOINT                                  ✅
 *     점프바 CTA    showLeadForm            ← ENDPOINT 를 «안 봤다»             ❌
 *     우측 레일     showLeadForm            ← 같음                              ❌
 *   그래서 ENDPOINT 가 비면 폼은 null 이 되어 DOM 에서 사라지는데 점프바·레일은
 *   그대로 남아 «사라진 #lead-form 을 가리키는 유령 앵커» 가 된다.
 *   눌러도 아무 일이 없다 — 하단 바의 침묵 반환과 «같은 병의 다른 표면» 이다.
 *
 * ⛔ 이 판정을 다시 손으로 조합하지 말 것. 폼 유무를 묻는 곳은 여기를 부른다.
 *   이름에 의미를 담았다 — 「폼이 붙을 자격이 있는가」(leadKind)가 아니라
 *   «실제로 화면에 서는가» 다. 자격이 있어도 엔드포인트가 없으면 서지 않는다.
 */
export const LEAD_ENDPOINT = process.env.NEXT_PUBLIC_LEAD_ENDPOINT || '';

export function leadFormAvailable(
  stage?: string | null,
  slug?: string | null,
): boolean {
  return !!slug && leadKind(stage) !== null && !!LEAD_ENDPOINT;
}
