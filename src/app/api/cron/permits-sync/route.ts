import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { normalizeServiceKey } from '@/lib/cron/data-go-kr-key';
import { BJDONG_BY_SIGUNGU } from '@/lib/region/bjdong-data';
import {
  buildPermitUrl,
  fetchPermitPage,
  isPermitCandidate,
  parsePermitItems,
  parseTotalCount,
  toPermitInsert,
  type PermitTrack,
} from '@/lib/permits/hub';
import {
  coverageOf,
  keyOf,
  planUnits,
  toCursorRow,
  type CursorRow,
  type Unit,
} from '@/lib/permits/cursor';

// ⚠️ Rule #18 정정(2026-08-27) — 이 선언만으로 충분하다. functions 항목을 늘리지 않는다(Rule #112).
export const maxDuration = 300;

/** 벽시계 여유 — 300초 상한에 부딪혀 «중간에 잘리면» 마지막 단위의 대장이 안 남는다. */
const TIME_BUDGET_MS = 240_000;
/** 한 번의 실행이 훑을 단위 수. 실측 ≈1.05s/단위 → 240 단위 ≈ 250초. */
const DEFAULT_LIMIT = 220;

/**
 * PV-2 — 인허가 수집. 건축HUB 두 트랙을 apt_permits 스테이징에 «옮기기만» 한다.
 *
 * ── 이 라우트가 «하지 않는» 것 ──────────────────────────────────────────────
 * ⛔ apt_sites 를 건드리지 않는다. 매칭·승격은 PV-3 이다(D1·D4).
 * ⛔ 판단하지 않는다. 세대수를 모르면 «버리지 않고» 그대로 넣는다 —
 *    버리면 그 현장이 API 커버에 있었는지조차 알 수 없다.
 *
 * ── 2026-08-29 실측으로 바뀐 것 (안건 ①) ───────────────────────────────────
 * ⚠️ bjdongCd 는 «필수» 다. sigunguCd 만으로는 부울경 43코드 전수에서 원문 0건이었고,
 *    bjdongCd 를 넣는 순간 실데이터가 온다(31140+10100 → 무거동 211건).
 *    ⛔ 「봉투 OK · items 0」을 통과로 읽지 않는다 — 그것이 이 증상이었다.
 * ⚠️ 그래서 1회 전수가 2,834동 × 2트랙 = 5,668 호출 ≈ 99분이 됐다. maxDuration 은
 *    300초다. 한 번에 다 돌 수 없으므로 apt_permit_cursor 가 «어디까지 갔는지» 를
 *    기억하고, 매 실행은 limit 만큼만 훑는다.
 *
 * ── 실행 방법 ──────────────────────────────────────────────────────────────
 *   ?dry=1              적재하지 않고 «세기만» 한다. ⛔ 커서도 «전진시키지 않는다».
 *   ?track=house|arch   한 트랙만
 *   ?codes=26350,31140  지정한 시군구만 (첫 실가동의 소량 검증용)
 *   ?limit=50           이번 실행이 훑을 단위 수
 */
async function handler(req: NextRequest) {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  const sp = req.nextUrl.searchParams;
  const dryRun = sp.get('dry') === '1';

  if (!key) {
    // ⚠️ 던지지 않는다. 「키가 없다」와 「돌았는데 0건」은 다른 사실이고,
    //    로그에서 그 둘이 구분돼야 중단점에서 판정할 수 있다.
    return { processed: 0, metadata: { skipped: 'PERMIT_API_KEY not set' } };
  }

  const trackParam = sp.get('track');
  const tracks: PermitTrack[] =
    trackParam === 'house' || trackParam === 'arch' ? [trackParam] : ['house', 'arch'];

  const codeParam = sp.get('codes');
  const sigungus = codeParam
    ? codeParam.split(',').map((c) => c.trim()).filter((c) => BJDONG_BY_SIGUNGU[c])
    : Object.keys(BJDONG_BY_SIGUNGU);

  const limit = Math.max(1, Math.min(1000, Number(sp.get('limit')) || DEFAULT_LIMIT));

  // ── 격자 ── (트랙, 시군구, 법정동) 전부. 리(里)를 «포함한다» —
  //    읍면 단위 조회는 리를 포함하지 않는다(기장읍 25 vs 동부리 658, 실측).
  const grid: Unit[] = [];
  for (const track of tracks) {
    for (const sgg of sigungus) {
      for (const [bjd] of BJDONG_BY_SIGUNGU[sgg] ?? []) grid.push({ track, sigungu: sgg, bjdong: bjd });
    }
  }

  const sb = getSupabaseAdmin();

  // ── 작업 대장 적재 ──
  const ledger = new Map<string, CursorRow>();
  {
    const { data } = await (sb as any)
      .from('apt_permit_cursor')
      .select('track,sigungu,bjdong,last_run_at,last_status,last_error_code,skip_until,retry_after,attempts')
      .in('sigungu', sigungus);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const row: CursorRow = {
        track: r.track as PermitTrack,
        sigungu: r.sigungu as string,
        bjdong: r.bjdong as string,
        lastRunAt: (r.last_run_at as string) ?? null,
        lastStatus: (r.last_status as CursorRow['lastStatus']) ?? null,
        lastErrorCode: (r.last_error_code as string) ?? null,
        skipUntil: (r.skip_until as string) ?? null,
        retryAfter: (r.retry_after as string) ?? null,
        attempts: (r.attempts as number) ?? 0,
      };
      ledger.set(keyOf(row), row);
    }
  }

  const before = coverageOf(grid, ledger);
  const plan = planUnits(grid, ledger, { limit });

  const started = Date.now();
  const errorCodes: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  /** ⚠️ 실패한 «위치» 를 남긴다(안건 ⑥). 세기만 하면 어디였는지 영영 모른다. */
  const holes: string[] = [];
  const cursorRows: Array<Record<string, unknown>> = [];
  let apiCalls = 0, items = 0, candidates = 0, inserted = 0, codeMismatch = 0;
  let stoppedBy: 'plan' | 'time' | 'daily_quota' = 'plan';

  for (const unit of plan) {
    if (Date.now() - started > TIME_BUDGET_MS) { stoppedBy = 'time'; break; }
    reasons[unit.reason] = (reasons[unit.reason] ?? 0) + 1;

    const r = await fetchPermitPage(
      buildPermitUrl(unit.track, key, { sigunguCd: unit.sigungu, bjdongCd: unit.bjdong, numOfRows: 100 }),
    );
    apiCalls += r.calls;

    let unitItems = 0;
    let unitCands = 0;
    let unitOk = r.ok;
    let unitCode = r.code;
    if (r.ok) {
      const parsed = parsePermitItems(r.body);
      unitItems = parsed.length;
      items += parsed.length;
      // ⚠️ 「파싱 0 인데 totalCount 는 0 이 아니다」는 «0건» 이 아니라 «판독 실패» 다.
      //    그 둘을 섞으면 파서가 깨진 날 커버율이 조용히 「데이터가 없다」로 보고된다.
      const total = parseTotalCount(r.body) ?? 0;
      if (parsed.length === 0 && total > 0) {
        unitOk = false;
        unitCode = 'PARSE_MISS';
        errorCodes.PARSE_MISS = (errorCodes.PARSE_MISS ?? 0) + 1;
        if (holes.length < 50) holes.push(`${unit.track}:${unit.sigungu}+${unit.bjdong}:PARSE_MISS(total ${total})`);
      }

      const rows = [];
      for (const item of parsed) {
        if (item.sigunguCd && item.sigunguCd !== unit.sigungu) codeMismatch++;
        if (!isPermitCandidate(unit.track, item)) continue;
        const row = toPermitInsert(unit.track, item, { sigunguCd: unit.sigungu, bjdongCd: unit.bjdong });
        if (row) rows.push(row);
      }
      candidates += rows.length;
      unitCands = rows.length;

      if (!dryRun && rows.length > 0) {
        // ⚠️ 매칭 컬럼(match_*)은 «건드리지 않는다». 재수집이 PV-3 의 판정을 되돌리면 안 된다.
        const { error } = await (sb as any)
          .from('apt_permits')
          .upsert(rows.map((x) => ({ ...x, fetched_at: new Date().toISOString() })), {
            onConflict: 'source,source_key',
          });
        if (error) errorCodes.UPSERT_FAIL = (errorCodes.UPSERT_FAIL ?? 0) + 1;
        else inserted += rows.length;
      }
    } else {
      errorCodes[r.code] = (errorCodes[r.code] ?? 0) + 1;
      if (holes.length < 50) holes.push(`${unit.track}:${unit.sigungu}+${unit.bjdong}:${r.code}`);
    }

    const next = toCursorRow(unit, { ok: unitOk, code: unitCode, items: unitItems }, ledger.get(keyOf(unit)));
    cursorRows.push({
      track: next.track, sigungu: next.sigungu, bjdong: next.bjdong,
      last_run_at: next.lastRunAt, last_status: next.lastStatus, last_error_code: next.lastErrorCode,
      items: unitItems, candidates: unitCands,
      skip_until: next.skipUntil, retry_after: next.retryAfter, attempts: next.attempts,
    });

    // ⛔ 일 한도(22)를 만나면 «즉시» 멈춘다. 계속 쏘면 남은 한도만 태우고
    //    같은 답을 받는다 — 그리고 대장에 「못 물어봤다」가 잔뜩 쌓인다.
    if (!r.ok && r.code === '22') { stoppedBy = 'daily_quota'; break; }
  }

  // ⛔ dry-run 은 커서를 «전진시키지 않는다». 세어 보기만 하려다 회전을 앞당기면
  //    다음 실제 실행이 방금 본 곳을 건너뛴다.
  if (!dryRun && cursorRows.length > 0) {
    const { error } = await (sb as any)
      .from('apt_permit_cursor')
      .upsert(cursorRows, { onConflict: 'track,sigungu,bjdong' });
    if (error) errorCodes.CURSOR_FAIL = (errorCodes.CURSOR_FAIL ?? 0) + 1;
  }

  return {
    processed: items,
    created: inserted,
    failed: Object.values(errorCodes).reduce((a, b) => a + b, 0),
    metadata: {
      dry_run: dryRun,
      tracks,
      sigungu_count: sigungus.length,
      // 격자 전체 대비 이번에 훑은 몫. 「몇 번 더 돌면 한 바퀴인가」가 여기서 나온다.
      grid_units: grid.length,
      planned: plan.length,
      visited: cursorRows.length,
      plan_reasons: reasons,
      stopped_by: stoppedBy,
      elapsed_ms: Date.now() - started,
      api_calls: apiCalls,
      api_calls_expected: plan.length,
      items,
      candidates,
      // D5-4 관측. 0 이 아니면 「요청한 지역이 아닌 데이터」를 받고 있다는 뜻이다.
      code_mismatch: codeMismatch,
      // ⚠️ 안건 ⑥ — 「0건」과 「못 물어봤다」를 갈라 남긴다.
      coverage_before: before,
      holes: holes.slice(0, 20),
      hole_count: holes.length,
      error_codes: errorCodes,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('permits-sync', () => handler(req));
  return NextResponse.json(result);
}
