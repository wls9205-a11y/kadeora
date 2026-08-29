/**
 * U-3층 ⑤ 게이트 — 지시서_U3 §2-4 의 4항 판정 (호출·출력만, Rule #116).
 *
 *   ① 서명 통과
 *   ② 표본 키워드 실값 (아크로라로체 포함 · 최근 7일)
 *   ③ upsert 멱등 — ⛔ 로컬은 SERVICE_ROLE_KEY 가 placeholder 라 «여기서 못 한다».
 *      배포 후 프로덕션 라우트를 2회 돌려 diff 0 으로 확인한다.
 *   ④ 전량 1패스 — 키워드 수 · 배치 수 · 호출 수 · 소요 실측
 *
 * 실행: npm run adstats:gate  (전량 ④까지)  ·  --quick (①②만)
 * ⛔ 읽기만 한다. 광고 계정에 아무것도 쓰지 않는다.
 */
import { config } from 'dotenv';
import {
  buildStatsUrl,
  chunkIdsByUri,
  credFromEnv,
  describeCred,
  fetchSearchAd,
  kstDate,
  parseStatRows,
  STATS_PATH,
} from '../src/lib/ads/searchad';

config({ path: '.env.local' });

/** 리드 1건이 붙어 있는 그 키워드 — 단가 축이 실재하는지 보는 표본이다. */
const LEAD_KEYWORD_ID = 'nkw-a001-01-000008540645599'; // 아크로라로체 (leads.utm 실측)

async function main() {
  const quick = process.argv.includes('--quick');
  const cred = credFromEnv();

  console.log('── ① 자격·서명 ─────────────────────────');
  const shape = describeCred(cred);
  console.log(`  ${shape.ready ? '✅' : '⛔'} ${shape.note}`);
  if (!shape.ready) process.exit(1);

  const t0 = Date.now();
  let calls = 0;
  const camp = await fetchSearchAd(cred, 'GET', '/ncc/campaigns');
  calls += camp.calls;
  if (!camp.ok) {
    console.log(`  ⛔ HTTP ${camp.status} · ${camp.code}`);
    if (camp.code === 'FORBIDDEN' || camp.code === 'SIGNATURE') {
      console.log('  ⚠️ 코드보다 «전사» 를 먼저 의심한다 — 화면의 I/l · O/0 은 구분되지 않는다.');
    }
    console.log(`  본문: ${camp.body.replace(/\s+/g, ' ').slice(0, 200)}`);
    process.exit(1);
  }
  const camps = JSON.parse(camp.body) as Array<{ nccCampaignId: string; name: string; status: string }>;
  console.log(`  ✅ 서명 통과 · 캠페인 ${camps.length}개 (활성 ${camps.filter((c) => c.status === 'ELIGIBLE').length})`);

  console.log('');
  console.log('── ② 표본 키워드 실값 (최근 7일) ────────');
  const since = kstDate(new Date(), -7);
  const until = kstDate(new Date(), -1);
  let sampleRows = 0;
  for (const d of [until, kstDate(new Date(), -2), kstDate(new Date(), -3)]) {
    const url = buildStatsUrl([LEAD_KEYWORD_ID], d);
    const r = await fetchSearchAd(cred, 'GET', STATS_PATH, url.slice(url.indexOf('?') + 1));
    calls += r.calls;
    const p = parseStatRows(r.body, d);
    sampleRows += p.rows.length;
    const row = p.rows[0];
    console.log(
      `  ${d}  ${row ? `노출 ${row.imp_cnt} · 클릭 ${row.clk_cnt} · 지출 ${row.sales_amt}원 · 순위 ${row.avg_rnk ?? '-'}` : '행 없음 (그날 노출 0 — «수집 실패가 아니다»)'}`,
    );
  }
  console.log(`  ⚠️ 「행 없음」은 정상이다 — 이 API 는 부재를 0 이 아니라 «무행» 으로 말한다.`);
  console.log(`  표본 기간 ${since}~${until} · 행 ${sampleRows}`);

  if (quick) {
    console.log('');
    console.log(`── ③④ 생략(--quick) · 호출 ${calls} · ${Date.now() - t0}ms`);
    return;
  }

  console.log('');
  console.log('── ④ 전량 1패스 실측 ───────────────────');
  const ids: string[] = [];
  let groups = 0;
  for (const c of camps) {
    const g = await fetchSearchAd(cred, 'GET', '/ncc/adgroups', `nccCampaignId=${c.nccCampaignId}`);
    calls += g.calls;
    if (!g.ok) { console.log(`  ⚠️ 그룹 조회 실패 ${c.nccCampaignId} ${g.code}`); continue; }
    const gs = JSON.parse(g.body) as Array<{ nccAdgroupId: string }>;
    groups += gs.length;
    for (const gg of gs) {
      const k = await fetchSearchAd(cred, 'GET', '/ncc/keywords', `nccAdgroupId=${gg.nccAdgroupId}`);
      calls += k.calls;
      if (!k.ok) { console.log(`  ⚠️ 키워드 조회 실패 ${gg.nccAdgroupId} ${k.code}`); continue; }
      for (const x of JSON.parse(k.body) as Array<{ nccKeywordId: string }>) ids.push(x.nccKeywordId);
    }
  }
  const uniq = [...new Set(ids)];
  const chunks = chunkIdsByUri(uniq);
  console.log(`  캠페인 ${camps.length} · 그룹 ${groups} · 키워드 ${uniq.length} · 배치 ${chunks.length}`);
  console.log(`  목록 수집 호출 ${calls} 회`);

  const day = kstDate(new Date(), -1);
  let rows = 0, empty = 0, spend = 0, clicks = 0, fails = 0;
  const bad: string[] = [];
  for (const chunk of chunks) {
    const url = buildStatsUrl(chunk, day);
    const r = await fetchSearchAd(cred, 'GET', STATS_PATH, url.slice(url.indexOf('?') + 1));
    calls += r.calls;
    if (!r.ok) { fails++; console.log(`  ⛔ 배치 실패 HTTP ${r.status} ${r.code}`); continue; }
    const p = parseStatRows(r.body, day);
    if (!p.parsed) { fails++; continue; }
    if (p.rows.length === 0) empty++;
    rows += p.rows.length;
    bad.push(...p.bad);
    for (const x of p.rows) { spend += x.sales_amt; clicks += x.clk_cnt; }
  }
  const ms = Date.now() - t0;
  console.log(`  ${day} 1일치 — 행 ${rows} · 행없는 배치 ${empty}/${chunks.length} · 실패 ${fails}`);
  console.log(`  지출 ${spend.toLocaleString()}원 · 클릭 ${clicks} · 이상치(클릭>노출) ${bad.length}`);
  console.log(`  총 호출 ${calls} · 소요 ${(ms / 1000).toFixed(1)}s`);
  console.log(`  → 3일 재수집 시 예상 호출 ${calls + chunks.length * 2} · 예상 소요 ${((ms + chunks.length * 2 * (ms / Math.max(1, chunks.length))) / 1000).toFixed(0)}s (maxDuration 300)`);

  console.log('');
  console.log('── ③ upsert 멱등 ───────────────────────');
  console.log('  ⛔ 로컬 SERVICE_ROLE_KEY 는 placeholder 다 — 여기서 적재할 수 없다.');
  console.log('     배포 후 프로덕션 라우트를 2회 돌려 rows diff 0 으로 확인한다.');
  console.log('');
  console.log('⛔ 읽기만 했다. 광고 계정에 아무것도 쓰지 않았다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
