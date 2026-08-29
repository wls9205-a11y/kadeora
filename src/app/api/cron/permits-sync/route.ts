import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { normalizeServiceKey } from '@/lib/cron/data-go-kr-key';
import { BUULGYEONG_REGIONS } from '@/lib/region/buulgyeong';
import { lawdEntriesForRegions } from '@/lib/region/lawd';
import {
  PERMIT_TRACKS,
  buildPermitUrl,
  fetchPermitPage,
  isPermitCandidate,
  parsePermitItems,
  parseTotalCount,
  toPermitInsert,
  type PermitTrack,
} from '@/lib/permits/hub';

// ⚠️ Rule #18 정정(2026-08-27) — 이 선언만으로 충분하다. functions 항목을 늘리지 않는다(Rule #112).
export const maxDuration = 300;

/**
 * PV-2 — 인허가 수집. 건축HUB 두 트랙을 apt_permits 스테이징에 «옮기기만» 한다.
 *
 * ── 이 라우트가 «하지 않는» 것 ──────────────────────────────────────────────
 * ⛔ apt_sites 를 건드리지 않는다. 매칭·승격은 PV-3 이다(D1·D4).
 *    수집과 반영을 한 곳에 두면 잘못 붙은 것을 되돌릴 때 무엇이 원문이었는지 사라진다.
 * ⛔ 판단하지 않는다. 세대수를 모르면 «버리지 않고» 그대로 넣는다 —
 *    버리면 그 현장이 API 커버에 있었는지조차 알 수 없다.
 *
 * ── 아직 모르는 것 (첫 실호출에서 갈린다) ───────────────────────────────────
 * ⚠️ bjdongCd 가 필수인지 모른다. 지금은 «붙이지 않고» 시군구 단위로 부른다.
 *    필수로 판명되면 그때 lawd 모듈에 법정동 매핑을 넣는다 — 필요 없을지 모르는
 *    2만 행짜리 표를 미리 만들지 않는다.
 *    판정 근거는 응답 봉투다: 파라미터 누락이면 업무오류 코드가 온다.
 *
 * ── 예산 ────────────────────────────────────────────────────────────────────
 * 이 API 는 개발계정 일 10,000 이다(기존 실거래 1,355 예산과 «별개»).
 * 부울경 43코드 × 2트랙 = 86 호출. 전국으로 넓혀도 251 × 2 = 502 다.
 *
 * ── 실행 방법 ──────────────────────────────────────────────────────────────
 *   ?dry=1              적재하지 않고 «세기만» 한다
 *   ?track=house|arch   한 트랙만
 *   ?codes=26350,31140  지정한 시군구 코드만 (표본 게이트용)
 */
async function handler(req: NextRequest) {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  const sp = req.nextUrl.searchParams;
  const dryRun = sp.get('dry') === '1';

  if (!key) {
    // ⚠️ 던지지 않는다. 「키가 없다」와 「돌았는데 0건」은 다른 사실이고,
    //    로그에서 그 둘이 구분돼야 중단점 A 에서 판정할 수 있다.
    return { processed: 0, metadata: { skipped: 'PERMIT_API_KEY not set' } };
  }

  const trackParam = sp.get('track');
  const tracks: PermitTrack[] =
    trackParam === 'house' || trackParam === 'arch' ? [trackParam] : ['house', 'arch'];

  const codeParam = sp.get('codes');
  const entries = codeParam
    ? codeParam.split(',').map((c) => c.trim()).filter(Boolean).map((c) => ['(지정)', c] as const)
    : lawdEntriesForRegions([...BUULGYEONG_REGIONS]);

  const sb = getSupabaseAdmin();

  let apiCalls = 0;
  let items = 0;
  let candidates = 0;
  let inserted = 0;
  const errorCodes: Record<string, number> = {};
  /** 응답의 sigunguCd 가 요청한 코드와 «다른» 건수. 0 이 아니면 수집이 틀린 것이다(D5-4). */
  let codeMismatch = 0;
  const emptyCodes: string[] = [];

  for (const track of tracks) {
    for (const [, code] of entries) {
      const url = buildPermitUrl(track, key, { sigunguCd: code, numOfRows: 100 });
      // 간격·재시도·봉투 판독은 fetchPermitPage 한 곳에 있다 — 게이트와 «같은 규칙» 이어야
      // 게이트 결과가 이 크론을 대변한다.
      const r = await fetchPermitPage(url);
      apiCalls += r.calls;
      if (!r.ok) {
        errorCodes[r.code] = (errorCodes[r.code] ?? 0) + 1;
        continue;
      }
      const xml = r.body;

      const parsed = parsePermitItems(xml);
      items += parsed.length;
      if (parsed.length === 0 && (parseTotalCount(xml) ?? 0) === 0) emptyCodes.push(`${track}:${code}`);

      const rows = [];
      for (const item of parsed) {
        if (item.sigunguCd && item.sigunguCd !== code) codeMismatch++;
        if (!isPermitCandidate(track, item)) continue;
        const row = toPermitInsert(track, item, { sigunguCd: code });
        if (row) rows.push(row);
      }
      candidates += rows.length;

      if (!dryRun && rows.length > 0) {
        // ⚠️ 매칭 컬럼(match_*)은 «건드리지 않는다». 재수집이 PV-3 의 판정을 되돌리면 안 된다.
        const { error } = await (sb as any)
          .from('apt_permits')
          .upsert(rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), {
            onConflict: 'source,source_key',
          });
        if (error) errorCodes.UPSERT_FAIL = (errorCodes.UPSERT_FAIL ?? 0) + 1;
        else inserted += rows.length;
      }
    }
  }

  return {
    processed: items,
    created: inserted,
    failed: Object.values(errorCodes).reduce((a, b) => a + b, 0),
    metadata: {
      dry_run: dryRun,
      tracks,
      codes: entries.length,
      api_calls: apiCalls,
      // 재시도가 있으므로 실제 호출은 이보다 «클 수 있다». 두 값을 갈라 남긴다.
      api_calls_expected: entries.length * tracks.length,
      items,
      candidates,
      // D5-4 관측. 0 이 아니면 「요청한 지역이 아닌 데이터」를 받고 있다는 뜻이다.
      code_mismatch: codeMismatch,
      // 「돌았는데 0건」인 코드. 봉투가 정상인데 여기가 길면 파라미터가 틀린 것이다.
      empty_codes: emptyCodes.slice(0, 20),
      empty_code_count: emptyCodes.length,
      error_codes: errorCodes,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('permits-sync', () => handler(req));
  return NextResponse.json(result);
}
