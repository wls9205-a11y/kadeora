/**
 * PV-3b — permit 유래 현장의 «수명 판정» (§6 수명 규칙 · 좀비 방지).
 *
 * ── 왜 판정만 하는가 ────────────────────────────────────────────────────────
 * ⛔ H7-2·D3: P1·P2 는 `lifecycle_stage` 를 «직접 덮어쓰지 않는다».
 *    같은 컬럼에 기록자가 둘이 되면 나중에 누가 쓴 값인지 복원할 수 없다.
 *    승격·강등은 stage_source 를 남기고 stage-derive 규약을 «경유» 한다.
 *    그래서 이 파일은 「무엇을 해야 하는가」만 말하고, 쓰지 않는다.
 *
 * ⚠️ 실측(2026-08-29): apt_sites.lifecycle_stage 는 enum 이 아니라 text 이고
 *    관측된 값은 13종이다 — 그리고 그중에 «보류(on_hold)가 없다».
 *    §6 이 말한 「'보류'로 강등」은 어휘를 «신설해야» 성립한다 → 중단점 안건.
 *    여기서는 강등 «대상» 만 판정하고 목표 값은 호출자가 정한다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * 인허가는 무산·장기 지연이 흔하다. 만료 규칙이 없으면 죽은 분양예정이 쌓여
 * 목록 신뢰를 갉는다. 실측으로도 오늘 후보의 82% 가 「최근 36개월」 밖이었다.
 */

/** 분양 축의 시작점. 이 값일 때만 강등을 따진다. */
export const PRE_ANNOUNCEMENT = 'pre_announcement';
/** 기축 축 — 사용승인이 잡히면 여기로 간다(관측된 실제 값). */
export const EXISTING_STAGE = 'post_move_in';
/** §6 이 말한 「보류」. ⚠️ 아직 어휘에 «없다» — 신설 여부는 안건이다. */
export const HOLD_STAGE = 'on_hold';

export const STALE_DAYS = 180;

export interface LifecycleFacts {
  stage?: string | null;
  /** 'permit' 유래인가. 다른 소스가 쓴 값을 PV 가 되돌리지 않는다. */
  stageSource?: string | null;
  /** 착공예정일 (YYYY-MM-DD). 강등의 기산점이다. */
  constructStartExpected?: string | null;
  /** 사용승인(예정)일. 잡히면 기축 축으로 넘어간다. */
  useApproval?: string | null;
  /** 이 현장이 마지막으로 «움직인» 시각. 이후 무변화가 강등 조건이다. */
  stageUpdatedAt?: string | null;
  /** 사람이 잠근 현장은 건드리지 않는다. */
  stageLocked?: boolean | null;
}

export type LifecycleAction = 'promote_existing' | 'demote_hold' | 'hold';

export interface LifecycleVerdict {
  action: LifecycleAction;
  reason: string;
  /** 강등까지 남은 일수. 음수면 이미 지났다. 큐 정렬·관측용. */
  daysToStale?: number;
}

const DAY = 86_400_000;

function ts(d?: string | null): number | null {
  if (!d) return null;
  const t = Date.parse(d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d);
  return Number.isNaN(t) ? null : t;
}

/**
 * 한 현장의 수명 판정.
 *
 * 순서가 규칙이다:
 *   ① 잠금 존중 — 사람이 정한 것을 기계가 되돌리지 않는다
 *   ② 사용승인이 잡히면 «승격» (지어졌다는 사실이 지연 추정보다 강하다)
 *   ③ permit 유래 pre_announcement 만 강등 후보
 *   ④ 착공예정일 + 180일이 지났고, 그 뒤로 «움직임이 없어야» 강등
 *
 * ⛔ 착공예정일을 «모르면» 강등하지 않는다 — 모르는 것과 지연된 것은 다르다.
 *    (원문의 stcnsSchedDay 는 arch 트랙에서 6자리로 오거나 아예 비어 있다.)
 */
export function judgeLifecycle(f: LifecycleFacts, now = new Date()): LifecycleVerdict {
  if (f.stageLocked) return { action: 'hold', reason: 'stage_locked — 사람이 잠갔다' };

  const used = ts(f.useApproval);
  if (used !== null && used <= now.getTime()) {
    return { action: 'promote_existing', reason: `사용승인 ${f.useApproval} — 기축 축으로` };
  }

  if (f.stage !== PRE_ANNOUNCEMENT) {
    return { action: 'hold', reason: `분양 축 시작점이 아니다 (${f.stage ?? 'null'})` };
  }
  if (f.stageSource !== 'permit') {
    // 다른 소스가 세운 값을 PV 가 강등하지 않는다. 되돌릴 근거가 없다.
    return { action: 'hold', reason: `permit 유래가 아니다 (${f.stageSource ?? 'null'})` };
  }

  const start = ts(f.constructStartExpected);
  if (start === null) {
    return { action: 'hold', reason: '착공예정일 미상 — 모르는 것을 지연으로 세지 않는다' };
  }

  const staleAt = start + STALE_DAYS * DAY;
  const daysToStale = Math.ceil((staleAt - now.getTime()) / DAY);
  if (now.getTime() < staleAt) {
    return { action: 'hold', reason: `착공예정 +${STALE_DAYS}일 전`, daysToStale };
  }

  // ⚠️ 기간이 지났어도 «그 사이 움직였으면» 살아 있는 현장이다.
  const moved = ts(f.stageUpdatedAt);
  if (moved !== null && moved > staleAt) {
    return { action: 'hold', reason: `기간은 지났으나 ${f.stageUpdatedAt} 에 갱신됨`, daysToStale };
  }

  return {
    action: 'demote_hold',
    reason: `착공예정 ${f.constructStartExpected} + ${STALE_DAYS}일 경과, 이후 무변화`,
    daysToStale,
  };
}

/** 큐 요약 — 「몇 건이 강등 대상인가」를 한 줄로. 모집단을 함께 낸다(오늘의 공리). */
export function summarize(list: LifecycleFacts[], now = new Date()) {
  const out = { total: list.length, promote: 0, demote: 0, hold: 0, locked: 0, unknown_start: 0 };
  for (const f of list) {
    const v = judgeLifecycle(f, now);
    if (f.stageLocked) out.locked++;
    if (v.action === 'promote_existing') out.promote++;
    else if (v.action === 'demote_hold') out.demote++;
    else {
      out.hold++;
      if (v.reason.startsWith('착공예정일 미상')) out.unknown_start++;
    }
  }
  return out;
}
