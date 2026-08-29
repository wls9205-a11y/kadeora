/**
 * PV-2b 수집 커서 (안건 ①·⑥·⑦).
 *
 * 이 파일이 지키는 것: «0건과 못 물어본 것을 섞지 않는다».
 * 2026-08-29 커버율 표에서 그 둘이 한 칸에 들어가는 바람에, 울산 남구 달동이
 * 진짜 0건인지 EMPTY_BODY 구멍인지 판정할 수 없었다. 결측 명단 2건이 거기 걸려 있었다.
 */
import { describe, expect, it } from 'vitest';
import {
  ZERO_HIT_CACHE_DAYS,
  coverageOf,
  keyOf,
  nextRetryAfter,
  nextSkipUntil,
  planUnits,
  toCursorRow,
  type CursorRow,
  type Unit,
} from '@/lib/permits/cursor';

const NOW = new Date('2026-08-30T00:00:00Z');
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 3_600_000;
const DAY = 86_400_000;

const u = (track: 'house' | 'arch', sigungu: string, bjdong: string): Unit => ({ track, sigungu, bjdong });
const ledgerOf = (rows: CursorRow[]) => new Map(rows.map((r) => [keyOf(r), r]));

describe('안건 ① — 회전 순서', () => {
  const grid = [u('house', '31140', '10100'), u('house', '31140', '10200'), u('house', '31140', '10300')];

  it('한 번도 안 본 곳이 본 곳보다 먼저다', () => {
    const led = ledgerOf([{ ...grid[0], lastRunAt: iso(-DAY), lastStatus: 'ok' }]);
    const plan = planUnits(grid, led, { now: NOW, limit: 3 });
    expect(plan[0].bjdong).toBe('10200');
    expect(plan[0].reason).toBe('fresh');
    expect(plan.at(-1)!.reason).toBe('rotate');
  });

  it('본 것들끼리는 «오래된 순»', () => {
    const led = ledgerOf([
      { ...grid[0], lastRunAt: iso(-1 * DAY), lastStatus: 'ok' },
      { ...grid[1], lastRunAt: iso(-9 * DAY), lastStatus: 'ok' },
      { ...grid[2], lastRunAt: iso(-5 * DAY), lastStatus: 'ok' },
    ]);
    expect(planUnits(grid, led, { now: NOW, limit: 3 }).map((p) => p.bjdong)).toEqual(['10200', '10300', '10100']);
  });

  it('limit 를 넘겨 주지 않는다 — maxDuration 300초가 진짜 한도다', () => {
    expect(planUnits(grid, new Map(), { now: NOW, limit: 2 })).toHaveLength(2);
  });
});

describe('안건 ⑥ — 못 물어본 곳이 «가장 급하다»', () => {
  const grid = [u('house', '31140', '10100'), u('house', '31140', '10200')];

  it('재조회 예약이 도래한 행이 신규보다 먼저 나온다', () => {
    // 커버율에 뚫린 «구멍» 이다. 새 지역을 훑는 것보다 이걸 메우는 게 급하다.
    const led = ledgerOf([{ ...grid[1], lastRunAt: iso(-2 * HOUR), lastStatus: 'error', lastErrorCode: 'EMPTY_BODY', retryAfter: iso(-HOUR), attempts: 1 }]);
    const plan = planUnits(grid, led, { now: NOW, limit: 2 });
    expect(plan[0]).toMatchObject({ bjdong: '10200', reason: 'retry' });
  });

  it('예약이 «미래» 면 아직 부르지 않는다 — 백오프를 무시하면 같은 답만 온다', () => {
    const led = ledgerOf([{ ...grid[1], lastStatus: 'error', retryAfter: iso(6 * HOUR), attempts: 2 }]);
    expect(planUnits(grid, led, { now: NOW, limit: 5 }).map((p) => p.bjdong)).toEqual(['10100']);
  });

  it('재조회는 0건 캐시보다 «우선» 한다 — 구멍이 스킵에 덮이면 영구화된다', () => {
    const led = ledgerOf([{ ...grid[1], lastStatus: 'error', skipUntil: iso(80 * DAY), retryAfter: iso(-HOUR), attempts: 1 }]);
    expect(planUnits(grid, led, { now: NOW, limit: 5 })[0]).toMatchObject({ bjdong: '10200', reason: 'retry' });
  });

  it('백오프는 1h → 2h → 4h … 24h 에서 멈춘다', () => {
    expect(nextRetryAfter('error', 'EMPTY_BODY', 0, NOW)).toBe(iso(1 * HOUR));
    expect(nextRetryAfter('error', 'HTTP_503', 2, NOW)).toBe(iso(4 * HOUR));
    expect(nextRetryAfter('error', 'EMPTY_BODY', 10, NOW)).toBe(iso(24 * HOUR));
  });

  it('키 미등록(30)·일 한도(22)는 재조회하지 않는다', () => {
    // 같은 답이 오고 한도만 더 탄다.
    expect(nextRetryAfter('error', '30', 0, NOW)).toBeNull();
    expect(nextRetryAfter('error', '22', 0, NOW)).toBeNull();
  });

  it('성공하면 예약을 «지운다»', () => {
    expect(nextRetryAfter('ok', null, 3, NOW)).toBeNull();
    expect(nextRetryAfter('empty', null, 3, NOW)).toBeNull();
  });
});

describe('안건 ⑦ — 0건 동 90일 캐시 (영구 금지 · arch 미적용)', () => {
  it('house 의 0건 동만 쉰다', () => {
    expect(nextSkipUntil('house', 'empty', NOW)).toBe(iso(ZERO_HIT_CACHE_DAYS * DAY));
  });
  it('arch 에는 적용하지 않는다', () => {
    // arch 는 0건 법정동이 1,171 중 20 뿐이다 — 아끼는 것 없이 누락 위험만 진다.
    expect(nextSkipUntil('arch', 'empty', NOW)).toBeNull();
  });
  it('값이 있는 동은 캐시하지 않는다', () => {
    expect(nextSkipUntil('house', 'ok', NOW)).toBeNull();
  });
  it('«영구» 가 아니다 — 90일 뒤에는 다시 큐에 든다', () => {
    const row: CursorRow = { ...u('house', '31140', '10100'), lastStatus: 'empty', skipUntil: iso(-1) };
    expect(planUnits([row], ledgerOf([row]), { now: NOW, limit: 1 })).toHaveLength(1);
  });
});

describe('결과 → 대장 행', () => {
  const unit = u('house', '31140', '10700');

  it('«0건» 과 «못 물어봤다» 를 다른 상태로 남긴다', () => {
    expect(toCursorRow(unit, { ok: true, code: 'OK', items: 0 }, undefined, NOW).lastStatus).toBe('empty');
    expect(toCursorRow(unit, { ok: false, code: 'EMPTY_BODY', items: 0 }, undefined, NOW).lastStatus).toBe('error');
  });

  it('실패한 곳은 «위치와 코드» 를 남긴다 — 세기만 하면 어디였는지 영영 모른다', () => {
    const r = toCursorRow(unit, { ok: false, code: 'EMPTY_BODY', items: 0 }, undefined, NOW);
    expect(r).toMatchObject({ sigungu: '31140', bjdong: '10700', lastErrorCode: 'EMPTY_BODY', attempts: 1 });
    expect(r.retryAfter).toBe(iso(1 * HOUR));
  });

  it('연속 실패는 attempts 를 쌓고 백오프를 늘린다', () => {
    const prev: CursorRow = { ...unit, lastStatus: 'error', attempts: 2 };
    const r = toCursorRow(unit, { ok: false, code: 'HTTP_503', items: 0 }, prev, NOW);
    expect(r.attempts).toBe(3);
    expect(r.retryAfter).toBe(iso(4 * HOUR));
  });

  it('성공하면 attempts 가 0 으로 돌아간다', () => {
    const prev: CursorRow = { ...unit, lastStatus: 'error', attempts: 4 };
    const r = toCursorRow(unit, { ok: true, code: 'OK', items: 12 }, prev, NOW);
    expect(r).toMatchObject({ lastStatus: 'ok', attempts: 0, retryAfter: null, skipUntil: null, lastErrorCode: null });
  });
});

describe('커버율 — 분모를 «측정된 동» 으로 (안건 ⑥)', () => {
  it('측정·구멍·미주사를 갈라 센다', () => {
    const grid = [u('house', '31140', '10100'), u('house', '31140', '10200'), u('house', '31140', '10300'), u('house', '31140', '10400')];
    const led = ledgerOf([
      { ...grid[0], lastStatus: 'ok' },
      { ...grid[1], lastStatus: 'empty', skipUntil: iso(90 * DAY) },
      { ...grid[2], lastStatus: 'error', lastErrorCode: 'EMPTY_BODY' },
    ]);
    expect(coverageOf(grid, led)).toEqual({ total: 4, measured: 2, holes: 1, cached: 1, unseen: 1 });
  });
});
