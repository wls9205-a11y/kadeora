/**
 * PV-3b — 인허가 매칭 «배선» (2026-09-02).
 *
 * ── 왜 이 라우트가 없었나 ──────────────────────────────────────────────────
 * 판정기(`@/lib/permits/match`)는 완성돼 있고 테스트로 잠겨 있는데, **부르는 곳이
 * 테스트뿐이었다.** 그래서 `apt_permits.matched_site_id` 가 1,465행 전량 NULL 이었다 —
 * 로직 결함이 아니라 «배선 부재» 다. CV-4 갭워치의 첫 관측이 이것을 critical 로 잡았다.
 * ⇒ 오늘 잡은 「이중 생산자」의 쌍둥이가 이것이다: **소비자 없는 판정기**.
 *
 * ── 이 라우트가 «하지 않는» 것 ─────────────────────────────────────────────
 * ⛔ 현장을 만들지 않는다. 인허가에서 시드로 가는 길은 백필과 같다 —
 *    presale_candidates 를 지난다. 여기서 apt_sites 를 만들면 문이 둘이 된다.
 * ⛔ 이름만으로 matched 를 주지 않는다. 그 규칙은 판정기가 들고 있고 여기서 다시 쓰지 않는다.
 * ⛔ 후보가 둘 이상이면 고르지 않는다 — review 로 보낸다.
 * ⚠️ review 행의 `matched_site_id` 는 «비워 둔다». 후보 id 는 note 에 적는다 —
 *    「matched_site_id 가 있다 = 확정이다」라는 불변식을 깨지 않기 위해서다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { fetchAll } from '@/lib/db/fetchBatched';
import {
  extractDong, isOutOfWindow, judgeMatch,
  type PermitFact,
} from '@/lib/permits/match';
// ⚠️ 라우트 모듈은 헬퍼를 export 하지 못한다(생성 타입이 거부). 변환 본문은 lib 에 산다.
import {
  confidenceOf, indexByDong, toColumnStatus, toSiteFact,
  type SiteRow,
} from '@/lib/permits/site-fact';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 500;
const TIME_BUDGET_MS = 240_000;

async function handler(req: NextRequest) {
  const admin = getSupabaseAdmin() as any;
  const sp = req.nextUrl.searchParams;
  const dry = sp.get('dry') === '1';
  const limit = Math.min(Number(sp.get('limit') || BATCH), 2000);
  const started = Date.now();

  // ⚠️ 한 장(1,000행)만 받으면 후보 색인이 6,261 중 1,000 으로 줄고, 대부분의 인허가가
  //    「후보 없음」으로 떨어진다 — 배선을 고쳐 놓고 결과는 여전히 0에 가까웠을 것이다.
  //    PostgREST db-max-rows=1000 (fetchAll 이 그 우회다).
  const siteRows = (await fetchAll(admin, 'apt_sites',
    'id, name, display_name, name_variants, address, region, sigungu, dong, total_units, complex_units',
    (q: any) => q.eq('is_active', true))) as SiteRow[];
  const idx = indexByDong(siteRows);

  // ⚠️ 아직 «본 적 없는» 것부터 본다(pending). review·unmatched 는 재판정 대상이 아니다 —
  //    같은 입력에 같은 답이 나오고, 사람이 큐에서 내린 판단을 덮어쓸 위험만 있다.
  const { data: permits } = await admin.from('apt_permits')
    .select('id, bjd_cd, address, project_name, total_units, permit_date, match_status')
    .eq('match_status', 'pending').order('id').limit(limit);

  const tally: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const samples: Array<Record<string, unknown>> = [];
  let processed = 0, stoppedBy: string | null = null;
  let writeFails = 0;
  let firstWriteError: string | null = null;

  for (const p of (permits ?? []) as Array<Record<string, any>>) {
    if (Date.now() - started > TIME_BUDGET_MS) { stoppedBy = 'time_budget'; break; }

    const fact: PermitFact = {
      bjdCd: p.bjd_cd, address: p.address, name: p.project_name,
      units: p.total_units, permitDate: p.permit_date,
    };
    const dong = extractDong(p.address);
    const candidates = dong ? (idx.get(dong) ?? []) : [];
    const v = judgeMatch(fact, candidates);

    const outWindow = isOutOfWindow(p.permit_date);
    const note = [
      v.note,
      v.status !== 'matched' && v.siteId ? `후보 ${v.siteId}` : '',
      outWindow ? 'out_of_window' : '',
      candidates.length === 0 && dong ? `후보 없음(법정동 ${dong})` : '',
      !dong ? '법정동 추출 실패' : '',
    ].filter(Boolean).join(' · ').slice(0, 300);

    tally[v.status] = (tally[v.status] ?? 0) + 1;
    byMethod[v.method] = (byMethod[v.method] ?? 0) + 1;
    if (samples.length < 15 && v.status !== 'unmatched') {
      samples.push({ id: p.id, name: p.project_name, units: p.total_units, status: v.status, method: v.method, note });
    }

    if (!dry) {
      const { error } = await admin.from('apt_permits').update({
        match_status: toColumnStatus(v.status),
        // ⛔ 확정이 아니면 비워 둔다. 후보 id 는 note 에만 남는다.
        matched_site_id: v.status === 'matched' ? v.siteId : null,
        match_method: v.method,
        match_confidence: v.status === 'matched' ? confidenceOf(v.score) : null,
        match_note: note,
        matched_at: new Date().toISOString(),
      }).eq('id', p.id);
      // ⛔ 쓰기 실패를 «세지 않으면» 판정만 하고 아무것도 안 바뀐 실행이 성공으로 보고된다.
      if (error) {
        writeFails++;
        if (firstWriteError == null) firstWriteError = String(error.message ?? error).slice(0, 200);
        continue;   // 세지 않은 것을 «처리했다» 고 세지 않는다
      }
    }
    processed++;
  }

  const { count: remaining } = await admin.from('apt_permits')
    .select('id', { count: 'exact', head: true }).eq('match_status', 'pending');

  return {
    processed,
    metadata: {
      dry, stopped_by: stoppedBy, sites_indexed: siteRows.length,
      dongs: idx.size, by_status: tally, by_method: byMethod,
      // ⚠️ 0 이 아니면 그 실행은 «판정만» 하고 아무것도 못 바꾼 것이다.
      write_fails: writeFails, first_write_error: firstWriteError,
      remaining_pending: dry ? remaining : Math.max((remaining ?? 0) - (dry ? 0 : 0), 0),
      samples, elapsed_ms: Date.now() - started,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('permits-match', () => handler(req));
  return NextResponse.json(result);
}
