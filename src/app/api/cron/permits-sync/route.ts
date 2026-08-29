import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { readEnvelope } from '@/lib/cron/data-go-kr-envelope';
import { normalizeServiceKey } from '@/lib/cron/data-go-kr-key';
import { BUULGYEONG_REGIONS } from '@/lib/region/buulgyeong';
import { lawdEntriesForRegions } from '@/lib/region/lawd';
import {
  PERMIT_TRACKS,
  buildPermitUrl,
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
      let xml = '';
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        apiCalls++;
        // ⚠️ res.ok 를 «먼저» 본다. 429 는 봉투에 안 나온다 — D5-1 이 그것 때문에 생겼다.
        if (!res.ok) {
          errorCodes[`HTTP_${res.status}`] = (errorCodes[`HTTP_${res.status}`] ?? 0) + 1;
          continue;
        }
        xml = await res.text();
      } catch {
        apiCalls++;
        errorCodes.FETCH_FAIL = (errorCodes.FETCH_FAIL ?? 0) + 1;
        continue;
      }

      const env = readEnvelope(xml);
      if (!env.ok) {
        errorCodes[env.code] = (errorCodes[env.code] ?? 0) + 1;
        continue;
      }

      const parsed = parsePermitItems(xml);
      items += parsed.length;
      if (parsed.length === 0 && (parseTotalCount(xml) ?? 0) === 0) emptyCodes.push(`${track}:${code}`);

      const rows = [];
      for (const item of parsed) {
        if (item.sigunguCd && item.sigunguCd !== code) codeMismatch++;
        if (!isPermitCandidate(item)) continue;
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
