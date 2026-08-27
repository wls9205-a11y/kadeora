// V13 A-2 — lifecycle_stage 한글 라벨 단일 원본.
//
// 왜 모듈로 뺐나: 라벨 맵이 4곳(AptHero · AptHeroLarge · apt/[id] · api/og-apt)에
// 복사돼 있었고 값도 서로 달랐다('분양 예고' vs '분양예정'). 공고 전 단계를 새로
// 다루려면 4곳에 같은 걸 또 붙여야 했다. 원본을 하나로 모은다.
//
// ⚠️ 키는 apt_sites.lifecycle_stage 의 CHECK 허용값과 같아야 한다.
//    2026-08-23 DB 담당이 CHECK 를 확장해 PIPELINE_STAGES 5개가 실제로 저장된다.
//    모르는 값이 와도 라벨이 없으면 원문을 그대로 내보내므로 화면은 깨지지 않는다.

/**
 * 공고 전 파이프라인 5단계. get_apt_pipeline 이 status 로 실어 보낸다.
 * 배열 순서 = 진행 순서(조합설립 → … → 착공). 화면 정렬은 RPC 의 weight 를 따른다.
 *
 * mgmt_approved(관리처분인가)는 V13 원안 4단계에 없었다 — 이주·철거 직전이자
 * 조합원 분양이 확정되는 단계라 실무에서 가장 중요한 분기 중 하나다 (2026-08-23 추가).
 */
export const PIPELINE_STAGES = [
  'union_established',
  'constructor_selected',
  'plan_approved',
  'mgmt_approved',
  'construction',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * 단계 → 한글 라벨.
 * 공고 전 5단계 → 청약 라인 → 입주 이후 → 축이 다른 상태 순으로 적는다.
 */
export const LIFECYCLE_LABEL: Record<string, string> = {
  // 공고 전 — V13 A-2
  union_established: '조합설립',
  constructor_selected: '시공사 선정',
  plan_approved: '사업시행인가',
  mgmt_approved: '관리처분인가',
  construction: '착공',

  // 청약 라인
  site_planning: '부지계획',
  pre_announcement: '분양 예고',
  model_house_open: '모델하우스',
  special_supply: '특별공급',
  subscription_open: '청약 진행',
  // H6-1 — 접수 마감 ~ 발표 전. 「청약 진행」으로 두면 «지원할 수 있다» 로 읽힌다.
  award_pending: '당첨자 발표 대기',
  award_announced: '당첨자 발표',
  contract_signing: '계약',
  contract: '계약',

  // 입주 이후
  pre_move_in: '입주 예정',
  // ⚠️ move_in_ready 는 이름과 달리 "입주 준비" 가 아니라 "계약 체결 기간 종료" 다.
  //    실측 720건 전부 입주예정 202609~203104(과거 0건) — 입주는 아직 미래다.
  //    이 단계는 리드폼 노출 대상이라 파워링크 랜딩에도 뜬다. '입주 준비' 로 쓰면
  //    광고 랜딩에서 사실과 다른 말을 하게 된다 (lib/apt/lead-eligibility.ts 참조).
  move_in_ready: '입주 예정',
  move_in: '입주',
  move_in_started: '입주중',
  post_move_in: '입주 후',

  // 축이 다른 상태
  active_trade: '실거래',
  resale: '실거래',
  unsold_active: '미분양',
  landmark_active: '랜드마크',
  redevelopment_active: '재개발',
};

/**
 * 라벨을 돌려준다. 모르는 값은 원문 그대로 — 빈 칸을 만들지 않는다.
 * (라벨 맵보다 DB CHECK 가 먼저 늘어나는 상황을 화면이 견뎌야 한다.)
 */
export function lifecycleLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return LIFECYCLE_LABEL[stage] ?? stage;
}

export function isPipelineStage(stage: string | null | undefined): stage is PipelineStage {
  return !!stage && (PIPELINE_STAGES as readonly string[]).includes(stage);
}
