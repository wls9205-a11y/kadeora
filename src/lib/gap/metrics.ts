/**
 * CV-4 갭워치 — 「결측을 사람이 발견하는 시대」를 끝내기 위한 지표 정의 (2026-09-02).
 *
 * ── data-quality-monitor 와 무엇이 다른가 ──────────────────────────────────
 * 그쪽은 «필드» 결측이다(PER NULL·인근역 NULL·시총 0). 여기는 «커버리지» 결측이다 —
 * 현장 자체가 없거나, 근거가 있는데 안 붙었거나, 판정이 멈춰 있는 것.
 * 축이 다르므로 지표는 따로 두되, 알림은 `admin_alerts` 하나로 나간다 — 생산자를 늘리지 않는다.
 *
 * ⚠️ 이 파일은 «순수» 다. DB 를 모른다 — 테스트가 여기를 직접 때린다.
 * ⚠️ 0 을 건강으로 읽지 않는다. `blindNote` 가 그 장치다: 아직 «구조적으로 못 재는» 지표는
 *    0 이 나와도 0 으로 자랑하지 않고 「측정 불가」를 함께 적는다.
 */

export type GapDirection = 'lower_is_better' | 'higher_is_better';

export interface GapMetricDef {
  key: string;
  label: string;
  direction: GapDirection;
  /** lower_is_better 면 이 값 «이상», higher_is_better 면 «이하» 에서 warning */
  warnAt?: number;
  /** 같은 방식으로 critical */
  critAt?: number;
  /** 구조적으로 아직 못 재는 상태면 그 이유. 있으면 심각도를 올리지 않는다. */
  blindNote?: string;
  /** 사람이 무엇을 해야 하는지. 다이제스트에 그대로 실린다. */
  action: string;
}

export const GAP_METRICS: GapMetricDef[] = [
  {
    key: 'pre_announcement',
    label: '분양예정 현장 수',
    direction: 'higher_is_better',
    warnAt: 15, critAt: 5,
    action: '줄고 있으면 발견 루프(builder-presale-crawl)가 죽은 것이다 — health 표부터 본다',
  },
  {
    key: 'permits_unmatched',
    label: '미매칭 인허가',
    direction: 'lower_is_better',
    warnAt: 200, critAt: 1000,
    action: '인허가 «근거는 있는데» 현장에 안 붙은 것들 — 백필·매칭 대상 후보다',
  },
  {
    key: 'confidence_conflicting',
    label: '충돌 판정(conflicting)',
    direction: 'lower_is_better',
    warnAt: 5, critAt: 20,
    action: '세대수·시공사가 소스마다 다른 행 — 사람이 한 건씩 끊는다',
  },
  {
    key: 'same_dong_similar_pairs',
    label: '같은 법정동 유사쌍',
    direction: 'lower_is_better',
    warnAt: 150, critAt: 250,
    action: '중복 페이지 후보 — 늘면 시드 직전 유사명 검색이 새고 있다는 뜻이다',
  },
  {
    key: 'redev_stale_180d',
    label: '정비축 180일 정체',
    direction: 'lower_is_better',
    warnAt: 20, critAt: 100,
    blindNote: 'stage_updated_at 이 2026-08-23 에 처음 채워졌다(활성 정비 773 중 374행). 180일 창이 열리는 것은 2027-02 다 — 그때까지 이 0 은 «건강» 이 아니라 «측정 불가» 다',
    action: '창이 열리기 전에는 detail 의 no_stage_ts(타임스탬프 없는 행)를 본다',
  },
  {
    key: 'candidates_queued',
    label: '검수 큐(presale_candidates)',
    direction: 'lower_is_better',
    warnAt: 60, critAt: 150,
    action: '보류·병합 후보가 쌓인 것 — 주 1회 큐를 비운다',
  },
  {
    key: 'source_zero_streak',
    label: '연속 0카드 소스',
    direction: 'lower_is_better',
    warnAt: 1, critAt: 3,
    action: '어댑터 부패 신호다. 그 소스의 목록 URL 을 «눈으로» 연다',
  },
];

export type Severity = 'ok' | 'warning' | 'critical';

/**
 * 지표 하나의 심각도.
 *
 * ⚠️ 절대값과 «증가» 를 함께 본다. 절대값만 보면 원래 큰 값이 매주 critical 로 울어
 *    사람이 알림 자체를 끄게 되고, 증가만 보면 큰 값이 «조용히 유지되는 것» 을 놓친다.
 * ⚠️ blindNote 가 있는 지표는 올리지 않는다 — 못 재는 것을 좋다고도 나쁘다고도 하지 않는다.
 */
export function severityOf(def: GapMetricDef, value: number, prev?: number | null): Severity {
  if (def.blindNote) return 'ok';
  let sev: Severity = 'ok';
  if (def.direction === 'lower_is_better') {
    if (def.critAt != null && value >= def.critAt) sev = 'critical';
    else if (def.warnAt != null && value >= def.warnAt) sev = 'warning';
    if (sev === 'ok' && prev != null && prev > 0 && value > prev * 1.2 && value - prev >= 5) sev = 'warning';
  } else {
    if (def.critAt != null && value <= def.critAt) sev = 'critical';
    else if (def.warnAt != null && value <= def.warnAt) sev = 'warning';
    if (sev === 'ok' && prev != null && prev > 0 && value < prev * 0.8 && prev - value >= 5) sev = 'warning';
  }
  return sev;
}

export interface GapReading {
  def: GapMetricDef;
  value: number;
  prev?: number | null;
  detail?: Record<string, unknown>;
}

const MARK: Record<Severity, string> = { ok: '·', warning: '!', critical: '!!' };

const deltaText = (value: number, prev?: number | null): string => {
  if (prev == null) return '(첫 관측)';
  const d = value - prev;
  return d === 0 ? '(변화 없음)' : `(${d > 0 ? '+' : ''}${d})`;
};

/**
 * 주간 다이제스트 본문. 숫자 옆에 «무엇을 해야 하는지» 까지 적는다 —
 * 숫자만 보내는 알림은 두 주면 읽히지 않는다.
 */
export function formatDigest(readings: GapReading[], since?: string | null): string {
  const bad = readings.filter((r) => severityOf(r.def, r.value, r.prev) !== 'ok');
  const lines: string[] = [
    bad.length === 0 ? '갭워치 — 손볼 것 없음' : `갭워치 — 손볼 것 ${bad.length}건`,
  ];
  if (since) lines.push(`직전 관측: ${since}`);
  lines.push('');
  for (const r of readings) {
    const sev = severityOf(r.def, r.value, r.prev);
    lines.push(`${MARK[sev]} ${r.def.label} ${r.value} ${deltaText(r.value, r.prev)}`);
    if (r.def.blindNote) lines.push(`    (측정 불가) ${r.def.blindNote}`);
    else if (sev !== 'ok') lines.push(`    -> ${r.def.action}`);
  }
  return lines.join(String.fromCharCode(10));
}

/** 알림 하나의 심각도 — 가장 나쁜 지표를 따른다. */
export function digestSeverity(readings: GapReading[]): Severity {
  let sev: Severity = 'ok';
  for (const r of readings) {
    const s = severityOf(r.def, r.value, r.prev);
    if (s === 'critical') return 'critical';
    if (s === 'warning') sev = 'warning';
  }
  return sev;
}
