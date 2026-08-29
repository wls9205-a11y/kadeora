import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import {
  STATS_FIELDS,
  STATS_PATH,
  buildStatsUrl,
  chunkIdsByUri,
  credFromEnv,
  describeCred,
  fetchSearchAd,
  parseStatRows,
  kstDate,
  recentDates,
  type AdStatRow,
} from '@/lib/ads/searchad';

// ⚠️ Rule #18 — 이 선언만으로 충분하다. functions 항목을 늘리지 않는다(Rule #112).
export const maxDuration = 300;

const TIME_BUDGET_MS = 250_000;

/**
 * U-3층 ⑤ — 검색광고 키워드 «일별 비용» 수집 (지시서_U3 §2-4).
 *
 * ── 이 라우트가 «하지 않는» 것 ──────────────────────────────────────────────
 * ⛔ 광고 계정에 «쓰지» 않는다. 입찰·상태 변경은 P4(9/11) 소관이고, 이 코드에는
 *    그 호출이 아예 없다 — 만들어 두면 언젠가 눌린다.
 * ⛔ ad_keywords 의 «기존 행을 덮어쓰지 않는다». 그 표의 유니크 키는 keyword_id 가 아니라
 *    (snapshot_date, keyword_id) 다 — «일자별 스냅샷 이력» 이라는 뜻이다. 그래서 동기화는
 *    오늘 날짜의 «새 세대» 를 넣는 방식이고, 8/26 수동 스냅샷은 그대로 남는다.
 *    ⚠️ site_slug·landing_* 은 직전 스냅샷에서 «이어받는다». 광고 API 는 키워드별 랜딩을
 *       주지 않으므로, 이어받지 않으면 사람이 붙여 둔 현장 연결이 세대마다 사라진다.
 *
 * ── 2026-08-29 실측으로 정해진 것 ───────────────────────────────────────────
 * `id`(단수)는 일자별 행을 주지만 키워드 하나뿐이라 5,974 호출/일이 든다.
 * `ids`(복수)는 기간 «합계» 만 주고 timeIncrement 를 지원하지 않는다.
 * → **기간을 하루로 좁히면 합계가 곧 일별 행이다.** 호출이 1/250 로 준다.
 * ⚠️ ids 는 노출 0 인 키워드의 «행을 아예 주지 않는다». 「행이 없다」를
 *    「수집 실패」로 읽지 않는다 — 이 시스템의 API 들이 부재를 말하는 방식이다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   ?dry=1     호출·파싱까지만. DB 에 쓰지 않는다
 *   ?days=3    최근 N일 (전일 데이터는 익일 확정되므로 재수집이 기본)
 *   ?limit=2   훑을 배치 수 상한 (게이트·소량 검증용)
 */
async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dryRun = sp.get('dry') === '1';
  const days = Math.max(1, Math.min(14, Number(sp.get('days')) || 3));
  const chunkLimit = Number(sp.get('limit')) || 0;
  /** 키워드 사전 동기화(①). 끌 수 있게 둔다 — 통계만 다시 받고 싶을 때가 있다. */
  const syncKeywords = sp.get('sync_keywords') !== '0';

  const cred = credFromEnv();
  const shape = describeCred(cred);
  if (!shape.ready) {
    // ⚠️ 던지지 않는다. 「자격이 없다」와 「돌았는데 0건」은 다른 사실이고,
    //    로그에서 그 둘이 구분돼야 판정할 수 있다.
    return { processed: 0, metadata: { skipped: 'searchad cred not ready', note: shape.note } };
  }

  const started = Date.now();
  const errorCodes: Record<string, number> = {};
  const sb = getSupabaseAdmin();
  let apiCalls = 0;

  // ── ① 키워드 목록 (캠페인 → 그룹 → 키워드) ───────────────────────────────
  // 계정의 «현재» 목록을 권위로 쓴다. ad_keywords 는 캠페인 1/11 의 부분 스냅샷이라
  // 그것을 기준으로 삼으면 나머지 10개 캠페인의 지출을 통째로 놓친다.
  const keywordIds: string[] = [];
  const kwRows: Array<Record<string, unknown>> = [];
  let campaigns = 0, adgroups = 0;
  {
    const r = await fetchSearchAd(cred, 'GET', '/ncc/campaigns');
    apiCalls += r.calls;
    if (!r.ok) {
      errorCodes[r.code] = (errorCodes[r.code] ?? 0) + 1;
      return { processed: 0, failed: 1, metadata: { stage: 'campaigns', code: r.code, status: r.status, error_codes: errorCodes } };
    }
    const camps = JSON.parse(r.body) as Array<{ nccCampaignId: string }>;
    campaigns = camps.length;
    for (const c of camps) {
      const g = await fetchSearchAd(cred, 'GET', '/ncc/adgroups', `nccCampaignId=${c.nccCampaignId}`);
      apiCalls += g.calls;
      if (!g.ok) { errorCodes[g.code] = (errorCodes[g.code] ?? 0) + 1; continue; }
      const groups = JSON.parse(g.body) as Array<{ nccAdgroupId: string; name?: string }>;
      adgroups += groups.length;
      for (const gg of groups) {
        const k = await fetchSearchAd(cred, 'GET', '/ncc/keywords', `nccAdgroupId=${gg.nccAdgroupId}`);
        apiCalls += k.calls;
        if (!k.ok) { errorCodes[k.code] = (errorCodes[k.code] ?? 0) + 1; continue; }
        for (const x of JSON.parse(k.body) as Array<Record<string, unknown>>) {
          const id = String(x.nccKeywordId ?? '');
          if (!id) continue;
          keywordIds.push(id);
          kwRows.push({
            keyword_id: id,
            keyword: x.keyword ?? null,
            campaign_id: c.nccCampaignId,
            adgroup_id: gg.nccAdgroupId,
            adgroup_name: gg.name ?? null,
            bid: typeof x.bidAmt === 'number' ? x.bidAmt : null,
            status: x.status ?? null,
          });
        }
      }
    }
  }
  const ids = [...new Set(keywordIds)];

  // ── ①-b 키워드 사전 동기화 (오늘 날짜의 «새 세대») ──────────────────────────
  // ⛔ 8/26 스냅샷을 덮어쓰지 않는다. 유니크 키가 (snapshot_date, keyword_id) 이므로
  //    오늘 행을 넣는 것이 이 표의 «설계된» 갱신 방식이다.
  // ⚠️ site_slug·landing_* 은 직전 세대에서 이어받는다 — 광고 API 가 키워드별 랜딩을
  //    주지 않으니, 이어받지 않으면 사람이 붙인 현장 연결이 세대마다 증발한다.
  let kwInserted = 0, kwCarried = 0, carrySize = 0;
  if (!dryRun && syncKeywords && kwRows.length > 0) {
    const carry = new Map<string, { site_slug: unknown; landing_pc: unknown; landing_mobile: unknown }>();
    // ⚠️ `.limit()` 은 PostgREST 의 «서버 캡» 을 넘지 못한다. 기본 1,000행이라
    //    limit(20000) 을 적어도 1,000개만 온다 — 2026-08-29 에 그걸로 4,273개 현장
    //    연결이 조용히 증발했다(slug_carried 가 딱 1000 이었다). range 로 «페이지» 를 돈다.
    //    ⛔ 「limit 을 크게 적었으니 다 왔겠지」는 확인이 아니다.
    const PAGE = 1000;
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data: prior, error } = await (sb as any)
        .from('ad_keywords')
        .select('keyword_id,site_slug,landing_pc,landing_mobile,snapshot_date')
        .order('snapshot_date', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { errorCodes.CARRY_FAIL = (errorCodes.CARRY_FAIL ?? 0) + 1; break; }
      const page = (prior ?? []) as Array<Record<string, unknown>>;
      for (const p of page) {
        const kid = String(p.keyword_id);
        if (!carry.has(kid)) carry.set(kid, { site_slug: p.site_slug, landing_pc: p.landing_pc, landing_mobile: p.landing_mobile });
      }
      if (page.length < PAGE) break;
    }
    carrySize = carry.size;
    const today = kstDate();
    const payload = kwRows.map((r) => {
      const c = carry.get(String(r.keyword_id));
      if (c?.site_slug) kwCarried++;
      return { ...r, snapshot_date: today, site_slug: c?.site_slug ?? null, landing_pc: c?.landing_pc ?? null, landing_mobile: c?.landing_mobile ?? null };
    });
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await (sb as any)
        .from('ad_keywords')
        .upsert(payload.slice(i, i + 500), { onConflict: 'snapshot_date,keyword_id' });
      if (error) errorCodes.KEYWORD_SYNC_FAIL = (errorCodes.KEYWORD_SYNC_FAIL ?? 0) + 1;
      else kwInserted += Math.min(500, payload.length - i);
    }
  }

  // ── ② 하루 × 배치 ────────────────────────────────────────────────────────
  const dates = recentDates(days);
  let chunks = chunkIdsByUri(ids);
  if (chunkLimit > 0) chunks = chunks.slice(0, chunkLimit);

  const rows: AdStatRow[] = [];
  const bad: string[] = [];
  let batches = 0, inserted = 0, emptyBatches = 0;
  let stoppedBy: 'plan' | 'time' | 'error' = 'plan';

  outer: for (const date of dates) {
    for (const chunk of chunks) {
      if (Date.now() - started > TIME_BUDGET_MS) { stoppedBy = 'time'; break outer; }
      const url = buildStatsUrl(chunk, date);
      const q = url.slice(url.indexOf('?') + 1);
      const r = await fetchSearchAd(cred, 'GET', STATS_PATH, q);
      apiCalls += r.calls;
      batches++;
      if (!r.ok) {
        errorCodes[r.code] = (errorCodes[r.code] ?? 0) + 1;
        // ⛔ 자격 실패면 남은 배치를 계속 쏴 봐야 같은 답이다.
        if (r.code === 'SIGNATURE' || r.code === 'FORBIDDEN') { stoppedBy = 'error'; break outer; }
        continue;
      }
      const p = parseStatRows(r.body, date);
      if (!p.parsed) { errorCodes.PARSE_MISS = (errorCodes.PARSE_MISS ?? 0) + 1; continue; }
      // ⚠️ 행 0 은 «정상» 이다 — 그날 노출이 없던 키워드는 행이 아예 오지 않는다.
      if (p.rows.length === 0) emptyBatches++;
      rows.push(...p.rows);
      bad.push(...p.bad);
    }
  }

  // ── ③ 적재 ───────────────────────────────────────────────────────────────
  if (!dryRun && rows.length > 0) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await (sb as any)
        .from('ad_stats_daily')
        .upsert(rows.slice(i, i + 500).map((x) => ({ ...x, fetched_at: new Date().toISOString() })), {
          onConflict: 'keyword_id,stat_date',
        });
      if (error) errorCodes.UPSERT_FAIL = (errorCodes.UPSERT_FAIL ?? 0) + 1;
      else inserted += Math.min(500, rows.length - i);
    }
  }

  const spend = rows.reduce((a, r) => a + r.sales_amt, 0);
  const clicks = rows.reduce((a, r) => a + r.clk_cnt, 0);

  return {
    processed: rows.length,
    created: inserted,
    failed: Object.values(errorCodes).reduce((a, b) => a + b, 0),
    metadata: {
      dry_run: dryRun,
      campaigns,
      adgroups,
      keywords: ids.length,
      // ⚠️ slug_carried 가 «딱 1000» 이면 페이지네이션이 안 도는 것이다 — 서버 캡의 지문.
      keyword_sync: syncKeywords ? { upserted: kwInserted, slug_carried: kwCarried, carry_pool: carrySize } : 'skipped',
      dates,
      chunks: chunks.length,
      batches,
      // ⚠️ 「행 없는 배치」는 실패가 «아니다». 그날 노출이 없었을 뿐이다.
      empty_batches: emptyBatches,
      rows: rows.length,
      spend_krw: spend,
      clicks,
      // 클릭>노출로 갈라 낸 행 — DB 제약이 막기 «전에» 위치를 남긴다.
      anomalies: bad.slice(0, 10),
      anomaly_count: bad.length,
      api_calls: apiCalls,
      elapsed_ms: Date.now() - started,
      stopped_by: stoppedBy,
      fields: STATS_FIELDS,
      error_codes: errorCodes,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('ad-stats-sync', () => handler(req));
  return NextResponse.json(result);
}
