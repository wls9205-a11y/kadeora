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
  /**
   * 절대값이 «기지 결측» 이라 임계를 늘 넘는 지표. 심각도를 «전일 대비 증가분» 으로만 낸다.
   *
   * ⚠️ 절대값을 숨기는 것이 아니다 — 다이제스트 본문에는 그대로 실린다. 다만 그 숫자로
   *    빨강을 켜지 않는다. 매일 켜지는 빨강은 이틀이면 «배경» 이 되고, 그때부터는 진짜
   *    사고가 나도 같은 색이라 안 보인다. 빨강은 아껴 써야 빨강이다(RULES#145).
   * ⛔ 이건 임계를 «완화» 하는 게 아니다. 재는 축을 «양» 에서 «변화» 로 바꾸는 것이고,
   *    그래서 완화가 아니라 교정이다 — 줄지 않는 큰 값은 다이제스트가 계속 들고 있다.
   */
  deltaOnly?: { warnAt: number; critAt: number };
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
    // ⛔ 절대 임계(warnAt 200 · critAt 1000)를 걷었다. 이 값은 «기지 결측» 이라
    //    첫 회전부터 critical 이었고, 매일 같은 빨강이 나갔다.
    //    실측 2026-09-02~09-08 — 1465 → 1361 → 1361 → 1361 → 1283 → 1283 → 1283 → 1283.
    //    일주일 동안 «한 번도 늘지 않았다»(-104 · 0 · 0 · -78 · 0 · 0 · 0). 줄기만 했다.
    //    내역도 정체가 아니다: no_target 953 · review 330 · pending 0 —
    //    permits-match 는 돌았고, 남은 것은 «붙을 현장이 아직 없는» 몫(CV 백로그)이다.
    //    할 일이 매일 있는 게 아니라 백로그가 소화되기를 기다리는 상태다.
    // ⚠️ 그래서 «늘 때만» 운다. +25 는 관측된 잡음(0)보다 확실히 크고,
    //    +100 은 하루치 인허가 유입이 통째로 붙을 곳을 못 찾은 수준이다.
    deltaOnly: { warnAt: 25, critAt: 100 },
    action: 'detail.by_status 를 먼저 본다 — pending 이면 PV-3b(permits-match)가 안 돈 것이고, unmatched 면 «붙을 현장이 없는» 것이라 신규 시드 후보다',
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
    key: 'ad_landing_on_inactive',
    label: '비활성 레코드 착지(가동 키워드)',
    direction: 'lower_is_better',
    // ⚠️ critical 을 두지 않는다. 이 지표는 «어제 스냅샷» 을 읽으므로, 오늘 착지를 옮기고
    //    레코드를 내린 당일에는 그 수가 통째로 잡힌다 — 실제로는 이미 고쳐진 것이다.
    //    2026-09-08 실측: 교체·비활성 직후 29 였고 다음 스냅샷이면 0 이다.
    //    첫날부터 거짓 빨강을 내면 그 순간 「빨강의 상시화」가 시작된다(RULES#145).
    //    ⛔ 그래서 warning 까지만 낸다. detail.snapshot_date 가 기준일을 들고 있다.
    warnAt: 1,
    action: '레코드를 내렸는데 광고 착지를 안 옮긴 것이다 — 돈이 죽은 페이지로 흐른다. '
      + 'sa.py relink --map "<구슬러그>=<정본슬러그>" 로 옮기고 308 을 켠다. '
      + '⚠️ 값은 «가동(ELIGIBLE)» 만 센다. detail.paused 는 꺼져 있어 비용이 안 나가는 잔여라 '
      + '급하지 않다 — 둘을 한 숫자로 뭉치면 「돈이 새는 17건」과 「조용한 25건」이 구분되지 않는다.',
  },
  {
    key: 'nv5_lead_time_days',
    label: '발행→첫 진입 리드타임(웹앱 중앙값, 일)',
    direction: 'lower_is_better',
    warnAt: 30, critAt: 45,
    blindNote: '표본이 얇다. 2026-09-08 기준 깨끗한 관측은 「동래 자이 더 헤리티지」 하나뿐이고 '
      + '기준선 20일(발행 8/15 → webkr 9/4)이 그 한 건에서 나왔다. '
      + '표본이 5건을 넘기 전에는 증감을 신호로 읽지 않는다.',
    action: '선점의 목줄은 발행 속도가 아니라 색인 속도다. 늘면 서치어드바이저 수집 요청(아침 5분 루틴)이 '
      + '실제로 나가고 있는지부터 본다. ⚠️ 네이버 블로그 변환본은 «다른 채널» 이라 따로 잰다 — '
      + '같은 글이 blog 8일 · webkr 20일로 갈렸다.',
  },
  {
    key: 'cvn_name_preempt',
    label: '예정명 선점률(최근 20건 %)',
    direction: 'higher_is_better',
    warnAt: 40, critAt: 15,
    action: '첫 보도 때 이미 그 이름을 갖고 있던 비율이다. 낮으면 워처가 늦은 것 — cvn-name-watch 의 targets·budget 을 본다',
  },
  {
    key: 'cvn_brand_alias_coverage',
    label: '브랜드 별칭 커버리지(시공사有 정비 %)',
    direction: 'higher_is_better',
    warnAt: 25, critAt: 10,
    action: '시공사가 정해졌는데 브랜드 이름이 없는 현장의 뒷면이다. 오르지 않으면 N-1 브랜드관 목록(brand_tokens.registry_url)이 마른 것이다',
  },
  {
    key: 'cvn_alias_heal',
    label: '별칭 자가치유 재주입',
    direction: 'lower_is_better',
    warnAt: 1, critAt: 20,
    action: '원장은 applied 인데 별칭이 사라져 되살린 건수다. 0 이 정상 — 1 이상이면 어떤 쓰기가 name_variants 를 덮고 있다(트리거 통째 교체 의심)',
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
  if (def.deltaOnly) {
    // ⚠️ 직전 관측이 없으면 «증가분» 이라는 말 자체가 성립하지 않는다. 지어내지 않는다.
    if (prev == null) return 'ok';
    const d = value - prev;
    if (d >= def.deltaOnly.critAt) return 'critical';
    if (d >= def.deltaOnly.warnAt) return 'warning';
    return 'ok';
  }
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
  /**
   * «이번 회전에» 잴 수 없었던 이유. blindNote 가 지표의 «구조적» 실명이라면
   * 이건 그날치 실명이다 — 표본이 0건이라 계산이 성립하지 않은 경우가 대표다.
   *
   * ⚠️ 이걸 두는 이유: 분모가 0 인 비율 지표는 0% 로 떨어지고, 0% 는 임계를 지나
   *    critical 이 된다. 「재보니 최악」과 「아예 못 쟀다」가 같은 빨강이 되는 것이다.
   *    실측 2026-09-08: cvn_name_preempt 가 critical 이었는데
   *    news: 계열 후보가 0건이라 애초에 잰 것이 없었다.
   */
  unmeasured?: string;
}

/**
 * 관측 하나의 심각도 — «그날 못 잰 것» 까지 반영한다.
 * ⚠️ severityOf 는 순수 함수로 남긴다(테스트가 직접 때린다). 그날치 사정은 여기서 얹는다.
 */
export function readingSeverity(r: GapReading): Severity {
  if (r.unmeasured) return 'ok';
  return severityOf(r.def, r.value, r.prev);
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
  const bad = readings.filter((r) => readingSeverity(r) !== 'ok');
  const lines: string[] = [
    bad.length === 0 ? '갭워치 — 손볼 것 없음' : `갭워치 — 손볼 것 ${bad.length}건`,
  ];
  if (since) lines.push(`직전 관측: ${since}`);
  lines.push('');
  for (const r of readings) {
    const sev = readingSeverity(r);
    lines.push(`${MARK[sev]} ${r.def.label} ${r.value} ${deltaText(r.value, r.prev)}`);
    if (r.unmeasured) lines.push(`    (이번 회전 측정 불가) ${r.unmeasured}`);
    else if (r.def.blindNote) lines.push(`    (측정 불가) ${r.def.blindNote}`);
    else if (sev !== 'ok') lines.push(`    -> ${r.def.action}`);
    // ⚠️ 증가분으로만 우는 지표는 «조용할 때도» 절대값을 한 줄 남긴다.
    //    빨강을 뺀 대신 숫자까지 사라지면 그건 은폐다 — 주간 요약이 이 줄을 들고 있다.
    else if (r.def.deltaOnly) {
      lines.push(`    (누적 ${r.value} · 증가분으로만 판정: +${r.def.deltaOnly.warnAt} 경고 / +${r.def.deltaOnly.critAt} 위험)`);
    }
  }
  return lines.join(String.fromCharCode(10));
}

/** 알림 하나의 심각도 — 가장 나쁜 지표를 따른다. */
export function digestSeverity(readings: GapReading[]): Severity {
  let sev: Severity = 'ok';
  for (const r of readings) {
    const s = readingSeverity(r);
    if (s === 'critical') return 'critical';
    if (s === 'warning') sev = 'warning';
  }
  return sev;
}
