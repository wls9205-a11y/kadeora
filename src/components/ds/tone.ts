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
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export interface ToneTokens {
  /** 글자색 토큰 */
  fg: string;
  /** 배경 토큰. 반투명 틴트일 수 있다. */
  bg: string;
  /** 테두리 토큰. 없으면 투명. */
  border?: string;
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
};

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
