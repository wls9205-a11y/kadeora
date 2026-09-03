/**
 * PV-2b — 수집 커서 «판정만» 한다 (안건 ①·⑥·⑦ 확정본).
 *
 * ── 왜 커서가 필요한가 ────────────────────────────────────────────────────
 * bjdongCd 가 필수로 판명되면서 1회 전수가 «2,834동 × 2트랙 = 5,668 호출» 이 됐다.
 * 초당 제한(350ms)과 응답 지연을 더하면 실측 ≈ 99분인데, 라우트의 maxDuration 은
 * 300초다. 즉 «한 번의 호출로 전수는 물리적으로 불가능하다».
 * ⛔ 그래서 파라미터만 고칠 수 없다 — 회전 설계와 «한 벌» 이어야 한다.
 *
 * ── 이 표가 «작업 대장» 이다 ──────────────────────────────────────────────
 * 단일 포인터(「몇 번째까지 했다」)를 쓰지 않는다. 법정동 표는 오늘도 바뀌었고
 * (43코드 → 2,834동), 표가 흔들리면 인덱스형 포인터는 «조용히 다른 곳» 을 가리킨다.
 * 대신 (트랙, 시군구, 법정동)마다 한 행을 두고 「언제 무엇을 봤는지」를 기록한다.
 *
 * ⚠️ RULES#143. 이 파일은 «무엇을 다음에 부를지» 만 정한다. 호출·적재는 라우트가 한다.
 */
import type { PermitTrack } from './hub';

export interface Unit {
  track: PermitTrack;
  sigungu: string;
  bjdong: string;
}

export type UnitStatus = 'ok' | 'empty' | 'error';

/** 작업 대장 한 행. DB 의 apt_permit_cursor 와 1:1 이다. */
export interface CursorRow extends Unit {
  lastRunAt?: string | null;
  lastStatus?: UnitStatus | null;
  lastErrorCode?: string | null;
  /** 안건 ⑦ — house 0건 동의 90일 캐시. «영구 스킵이 아니다». */
  skipUntil?: string | null;
  /** 안건 ⑥ — EMPTY_BODY·503 으로 «못 물어본» 곳의 재조회 예약. */
  retryAfter?: string | null;
  attempts?: number | null;
}

export type UnitReason = 'retry' | 'fresh' | 'rotate';

export interface PlannedUnit extends Unit {
  reason: UnitReason;
}

export function keyOf(u: Unit): string {
  return `${u.track}|${u.sigungu}|${u.bjdong}`;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** 안건 ⑦ — 0건 동을 얼마나 쉬게 할 것인가. */
export const ZERO_HIT_CACHE_DAYS = 90;

/**
 * 다음에 부를 단위를 고른다.
 *
 * 우선순위 — 「모르는 것」이 「오래된 것」보다 급하다:
 *   ① retry   — 못 물어본 곳(EMPTY_BODY·503). 커버율에 뚫린 구멍이라 가장 급하다.
 *   ② fresh   — 한 번도 안 본 곳.
 *   ③ rotate  — 본 지 오래된 순.
 * ⛔ skipUntil 이 미래인 행은 «건너뛴다» — 단, 재조회 예약(retryAfter)이 걸린 행은
 *    스킵보다 우선한다. 못 물어본 것을 「0건이라 쉰다」로 덮으면 구멍이 영구화된다.
 */
export function planUnits(
  grid: Unit[],
  ledger: Map<string, CursorRow>,
  opts: { now?: Date; limit: number },
): PlannedUnit[] {
  const now = (opts.now ?? new Date()).getTime();
  const retry: PlannedUnit[] = [];
  const fresh: PlannedUnit[] = [];
  const rotate: Array<PlannedUnit & { at: number }> = [];

  for (const u of grid) {
    const row = ledger.get(keyOf(u));
    if (!row) {
      fresh.push({ ...u, reason: 'fresh' });
      continue;
    }
    const due = row.retryAfter ? Date.parse(row.retryAfter) : NaN;
    if (!Number.isNaN(due) && due <= now) {
      retry.push({ ...u, reason: 'retry' });
      continue;
    }
    const skip = row.skipUntil ? Date.parse(row.skipUntil) : NaN;
    if (!Number.isNaN(skip) && skip > now) continue;
    // 재조회 예약이 «미래» 면 아직 부르지 않는다 — 백오프를 무시하면 같은 답만 온다.
    if (!Number.isNaN(due) && due > now) continue;
    rotate.push({ ...u, reason: 'rotate', at: row.lastRunAt ? Date.parse(row.lastRunAt) : 0 });
  }

  rotate.sort((a, b) => a.at - b.at);
  return [...retry, ...fresh, ...rotate.map(({ at: _at, ...r }) => r)].slice(0, opts.limit);
}

/**
 * 안건 ⑦ — 다음 skipUntil.
 * ⛔ arch 에는 «적용하지 않는다». arch 는 0건 법정동이 1,171 중 20 뿐이라
 *    캐시가 아무것도 못 아끼면서 신규 누락 위험만 진다.
 * ⚠️ 0건이 아닌 동은 캐시하지 않는다(null) — 값이 있는 곳은 계속 본다.
 */
export function nextSkipUntil(
  track: PermitTrack,
  status: UnitStatus,
  now = new Date(),
  days = ZERO_HIT_CACHE_DAYS,
): string | null {
  if (track !== 'house') return null;
  if (status !== 'empty') return null;
  return new Date(now.getTime() + days * DAY).toISOString();
}

/**
 * 안건 ⑥ — 못 물어본 곳의 재조회 예약. 1h → 2h → 4h … 최대 24h.
 * ⚠️ 성공했으면 예약을 «지운다»(null). 남겨 두면 영원히 재조회 큐에 산다.
 * ⛔ 30(키 미등록)·22(일 한도)는 예약하지 않는다 — 같은 답이 오고 한도만 더 탄다.
 */
const NO_RETRY_CODES = new Set(['30', '22']);

export function nextRetryAfter(
  status: UnitStatus,
  errorCode: string | null | undefined,
  attempts: number,
  now = new Date(),
): string | null {
  if (status !== 'error') return null;
  if (errorCode && NO_RETRY_CODES.has(errorCode)) return null;
  const backoff = Math.min(2 ** Math.max(0, attempts), 24) * HOUR;
  return new Date(now.getTime() + backoff).toISOString();
}

/**
 * 한 단위의 결과를 대장 행으로 만든다.
 * ⚠️ 「0건」과 「못 물어봤다」를 «다른 상태» 로 남긴다. 오늘 커버율 표에서 그 둘이
 *    섞이는 바람에 남구 달동이 진짜 0인지 구멍인지 판정할 수 없었다.
 */
export function toCursorRow(
  u: Unit,
  result: { ok: boolean; code: string; items: number },
  prev: CursorRow | undefined,
  now = new Date(),
): CursorRow {
  const status: UnitStatus = !result.ok ? 'error' : result.items > 0 ? 'ok' : 'empty';
  const attempts = status === 'error' ? (prev?.attempts ?? 0) + 1 : 0;
  return {
    ...u,
    lastRunAt: now.toISOString(),
    lastStatus: status,
    lastErrorCode: status === 'error' ? result.code : null,
    skipUntil: nextSkipUntil(u.track, status, now),
    retryAfter: nextRetryAfter(status, result.code, prev?.attempts ?? 0, now),
    attempts,
  };
}

/** 대장에서 「아직 한 번도 못 본 단위」 수 — 진행률의 분모가 아니라 «분자의 반대» 다. */
export function coverageOf(grid: Unit[], ledger: Map<string, CursorRow>) {
  let measured = 0, holes = 0, cached = 0;
  for (const u of grid) {
    const row = ledger.get(keyOf(u));
    if (!row || !row.lastStatus) continue;
    if (row.lastStatus === 'error') holes++;
    else {
      measured++;
      if (row.skipUntil) cached++;
    }
  }
  return { total: grid.length, measured, holes, cached, unseen: grid.length - measured - holes };
}
