// DS-2 · 배지·칩 «톤» 단일 출처.
//
// 왜 컴포넌트 밖으로 뺐나
// -----------------------
// 배지·칩은 이 저장소에서 «대비 사고가 가장 잦은 자리» 다(BlogAptAlertCTA 의
// `#FEE500 은 여기서 대비 1.26 이었다`, MapClient 의 `제 10% 틴트 위 1.24` 주석이
// 그 흔적이다). 색 조합이 컴포넌트 JSX 안에만 있으면 «사람이 눈으로» 확인하는 수밖에 없다.
// 표를 밖으로 빼면 `scripts/contrast-audit.ts` 가 «같은 표» 를 읽고 합성 대비를
// 기계로 잰다 — 설계서 §7 의 「배지·칩 대비 회귀 0건」이 그때 비로소 판정 가능해진다.
//
// ⛔ 여기에 hex 를 적지 않는다. 토큰 이름만 적는다.
//    hex 를 적는 순간 토큰을 바꿔도 배지가 안 따라오고, 그게 이 트랙이 없애려는 병이다.
// ⛔ 배경이 «반투명 틴트» 라는 점이 핵심이다. rgba(...,0.08) 은 그 자체로는 대비를
//    말할 수 없고 «무엇 위에 얹히는지» 를 알아야 한다. 그래서 on(바탕) 을 같이 적는다.

/** 톤 이름. 의미 축이지 색 축이 아니다 — 'green' 이 아니라 'success'. */
export type Tone =
  | 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info'
  // ── DS2 단계 시맨틱 (2026-09-09). 일반 의미 톤과 «섞지 않으려고» 접두를 둔다.
  //    success/info 로 대신하지 않은 이유: 단계는 6개 의미 톤보다 축이 많고(9),
  //    한 톤을 두 뜻으로 쓰면 나중에 한쪽만 바꾸고 싶을 때 못 바꾼다.
  | 'stagePlanned' | 'stagePreSale' | 'stageOpen' | 'stageAward'
  | 'stageBuild' | 'stageMoveIn' | 'stageClosed' | 'stageTerminated' | 'stageUnknown';

export interface ToneTokens {
  /** 글자색 토큰 */
  fg: string;
  /** 배경 토큰. 반투명 틴트일 수 있다. */
  bg: string;
  /** 테두리 토큰. 없으면 투명. */
  border?: string;
  /**
   * 테두리 모양. 기본은 solid.
   * ⚠️ 'dashed' 는 «정보 부재» 전용이다(단계 미확인·미매핑). 대비를 올리면 그 톤이
   *    stageClosed 와 거의 같은 회색이 되어 색으로는 안 갈리는데, 점선이 그 구분을 진다.
   *    장식이 아니라 «색이 못 하는 일을 대신하는» 자리라 토큰 표에 둔다.
   */
  borderStyle?: 'solid' | 'dashed';
  /**
   * 이 배지가 «얹히는» 바탕. 반투명 bg 의 합성 대비를 계산할 때 필요하다.
   * 카드·표 안에 놓이는 것이 기본이라 --bg-surface 를 전제한다.
   * ⚠️ --bg-hover 처럼 더 어두운 바탕에 놓을 자리가 생기면 그 자리를 따로 등록해
   *    감사에 포함시킬 것. 「어디에 놓이는지」를 모르면 대비를 잰 것이 아니다.
   */
  on: string;
}

export const TONE: Record<Tone, ToneTokens> = {
  neutral: { fg: '--text-secondary', bg: '--bg-hover',    border: '--border', on: '--bg-surface' },
  brand:   { fg: '--brand',          bg: '--brand-bg',    border: '--brand-border', on: '--bg-surface' },
  success: { fg: '--success',        bg: '--success-bg',  on: '--bg-surface' },
  warning: { fg: '--warning',        bg: '--warning-bg',  on: '--bg-surface' },
  error:   { fg: '--error',          bg: '--error-bg',    on: '--bg-surface' },
  info:    { fg: '--info',           bg: '--info-bg',     on: '--bg-surface' },

  // ── 단계 시맨틱 ─────────────────────────────────────────────────────────
  // ⚠️ 이 표에 넣는 순간 scripts/contrast-audit.ts 가 «자동으로» 순회한다
  //    (Object.entries(TONE)). 별도 등록처가 없는 것이 의도다 — 등록을 잊을 자리를 안 만든다.
  // ⛔ 값은 tokens.css 에 있고 여기엔 토큰 이름만 적는다. 그 파일 주석에
  //    「왜 설계서 hex 를 그대로 못 썼는가」가 실측과 함께 적혀 있다.
  stagePlanned:    { fg: '--stage-planned',    bg: '--stage-planned-bg',    on: '--bg-surface' },
  stagePreSale:    { fg: '--stage-presale',    bg: '--stage-presale-bg',    on: '--bg-surface' },
  stageOpen:       { fg: '--stage-open',       bg: '--stage-open-bg',       on: '--bg-surface' },
  stageAward:      { fg: '--stage-award',      bg: '--stage-award-bg',      on: '--bg-surface' },
  stageBuild:      { fg: '--stage-build',      bg: '--stage-build-bg',      on: '--bg-surface' },
  stageMoveIn:     { fg: '--stage-movein',     bg: '--stage-movein-bg',     on: '--bg-surface' },
  stageClosed:     { fg: '--stage-closed',     bg: '--stage-closed-bg',     border: '--stage-closed-border', on: '--bg-surface' },
  stageTerminated: { fg: '--stage-terminated', bg: '--stage-terminated-bg', on: '--bg-surface' },
  stageUnknown:    { fg: '--stage-unknown',    bg: '--stage-unknown-bg',    border: '--stage-unknown-border', borderStyle: 'dashed', on: '--bg-surface' },
};

/**
 * lifecycle_stage → 단계 톤.
 *
 * ⛔ 라벨은 여기서 정하지 «않는다». `@/lib/apt/lifecycle-label` 이 한글 라벨의 단일 원본이고,
 *    그 파일은 「라벨 맵이 4곳에 복사돼 값이 갈렸다」는 사고 뒤에 만들어졌다.
 *    설계서 §1 은 칩 라벨을 따로 줬지만(4개 정비 단계를 「공고 전」 하나로 뭉치는 등),
 *    그걸 쓰면 관리처분인가·조합설립 같은 «실무 분기» 가 화면에서 사라진다.
 *    → 색은 여기서 묶고, 글자는 원본을 그대로 쓴다. 스캔축은 얻고 정보는 안 버린다.
 *
 * ⚠️ 여기 없는 값은 stageUnknown 으로 떨어진다. 화면에서는 NULL 과 «같은 칩» 이다 —
 *    사용자에게 「미확인」과 「미매핑」은 같은 정보 부재라서다.
 *    다만 로그·DOM 에서는 갈라 둔다(StageChip 의 data-ds-stage) — 새 stage 가 들어온
 *    신호까지 지우면 인리치 백로그가 돌지 않는다.
 */
export const STAGE_TONE: Record<string, Tone> = {
  // 공고 전 — 아직 모집공고가 없다. 정비 5단계 + 부지계획.
  site_planning: 'stagePlanned',
  union_established: 'stagePlanned',
  constructor_selected: 'stagePlanned',
  plan_approved: 'stagePlanned',
  mgmt_approved: 'stagePlanned',
  redevelopment_active: 'stagePlanned',

  pre_announcement: 'stagePreSale',

  // 지금 신청·계약할 수 있다.
  model_house_open: 'stageOpen',
  special_supply: 'stageOpen',
  subscription_open: 'stageOpen',
  unsold_active: 'stageOpen',

  award_pending: 'stageAward',
  award_announced: 'stageAward',

  construction: 'stageBuild',

  // 입주·기축.
  pre_move_in: 'stageMoveIn',
  move_in_ready: 'stageMoveIn',
  move_in: 'stageMoveIn',
  move_in_started: 'stageMoveIn',
  post_move_in: 'stageMoveIn',
  landmark_active: 'stageMoveIn',
  active_trade: 'stageMoveIn',
  resale: 'stageMoveIn',

  contract_signing: 'stageClosed',
  contract: 'stageClosed',
  // ⚠️ stageTerminated(시공 해지)에 대응하는 lifecycle_stage 는 «아직 없다».
  //    CV-N 워처의 cancel 이벤트 축이라 단계 컬럼이 아니라 사건으로 온다.
  //    톤만 미리 두고 매핑은 비워 둔다 — 쓰이지 않는 톤도 감사는 잰다.
};

/** 모르는 stage·NULL 은 「정보 부재」 한 칸으로 접는다. */
export function stageToneOf(stage: string | null | undefined): Tone {
  if (!stage) return 'stageUnknown';
  return STAGE_TONE[stage] ?? 'stageUnknown';
}

/** 이 stage 가 표에 «없는» 값인가 — 로그·백로그 신호용. NULL 은 미매핑이 아니다. */
export function isUnmappedStage(stage: string | null | undefined): boolean {
  return !!stage && !(stage in STAGE_TONE);
}

/**
 * D6 확신도 → 톤.
 *
 * ⚠️ 원본이 «둘» 이다 — 그래서 아래가 이 파일에서 가장 중요한 주석이다.
 *      DB 제약(apt_permits_match_confidence_chk):
 *        check (match_confidence is null
 *               or match_confidence in ('rumor','estimated','confirmed','verified'))
 *      설계(PV_INSTRUCTION §D6): verified / estimated / conflicting / rumor
 *
 * ⚠️⚠️ **설계와 구현의 어휘가 갈려 있다** (2026-08-29 U-1a 에서 발견 · 정정)
 *    설계(PV_INSTRUCTION §D6): verified(독립 출처 2개 일치) · estimated(단일 출처)
 *                              · **conflicting**(출처 충돌) · rumor
 *    구현(apt_permits DB 제약 · 코드 리터럴): verified · estimated · **confirmed** · rumor
 *    → `confirmed` 는 D6 에 «없고», `conflicting` 은 구현에 «0건» 이다.
 *
 *    ⛔ 나는 DS-2a 에서 「conflicting 은 검수 큐 이름이지 확신도가 아니다」로 «단정했다».
 *       마스터의 「conflicting 큐」만 보고 D6 를 안 본 결과다 — 그 판정은 틀렸다.
 *    → 둘 «다» 렌더한다. 어느 쪽도 「미확인」으로 떨어뜨리지 않는다.
 *       어휘 통일(제약에 conflicting 추가 / D6 에 confirmed 추가)은 PV 트랙 판단이라
 *       여기서 정하지 않는다. 화면은 «오는 값을 정직하게 표시» 하는 것까지가 몫이다.
 *
 * ⚠️ `null` 을 «확정» 으로 칠하지 않는다. ad-safety.ts 가 같은 이유로 isConfirmed(null)=false 다:
 *    「등급을 모르는 것과 고시·공시 원문으로 확인한 것은 다르다」.
 *    그래서 5번째 상태(unknown)를 «만들지 않고» null 자체를 상태로 다룬다.
 */
export type Confidence = 'rumor' | 'estimated' | 'conflicting' | 'confirmed' | 'verified';

export interface ConfidenceMeta {
  label: string;
  tone: Tone;
  /** 「이 표시가 무슨 뜻인가」 — 사용자 언어로. 시스템 용어를 쓰지 않는다(설계서 §2 카피 규칙). */
  hint: string;
}

export const CONFIDENCE: Record<Confidence, ConfidenceMeta> = {
  verified:  { label: '검증',      tone: 'success', hint: '독립된 출처 두 곳이 같은 값을 말합니다' },
  confirmed: { label: '확정',      tone: 'info',    hint: '고시·공시로 확정된 내용입니다' },
  /**
   * D6 「출처 충돌」. ⚠️ estimated 보다 «약한» 상태다 — 값이 없는 게 아니라
   * «서로 다른 값이 둘 이상» 이라서, 하나를 골라 보여 주면 그 순간 거짓이 된다.
   * 그래서 톤도 warning 이 아니라 error 다.
   */
  conflicting: { label: '출처 충돌', tone: 'error', hint: '출처마다 값이 달라 확인 중입니다' },
  estimated: { label: '추정',      tone: 'warning', hint: '단일 출처로 추정한 값입니다' },
  rumor:     { label: '카더라',    tone: 'neutral', hint: '아직 확인되지 않은 이야기입니다' },
};

/** 등급을 «모를 때». 확정으로 오해되지 않아야 한다. */
export const CONFIDENCE_UNKNOWN: ConfidenceMeta = {
  label: '미확인',
  tone: 'neutral',
  hint: '등급이 기록되지 않았습니다',
};

export function confidenceMeta(c: string | null | undefined): ConfidenceMeta {
  if (c && c in CONFIDENCE) return CONFIDENCE[c as Confidence];
  return CONFIDENCE_UNKNOWN;
}
