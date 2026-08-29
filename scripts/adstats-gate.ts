/**
 * U-3층 ⑤ 게이트 — 검색광고 API «판정만» 한다 (호출·출력만, Rule #116).
 *
 * 답해야 하는 것:
 *   ① 자격 모양 — 전사 오류인가 (스크린샷 경유라 I/l · O/0 혼동이 실제 위험)
 *   ② 서명이 통하는가 — 401 이면 «코드보다 전사» 를 먼저 의심한다
 *   ③ StatReport 실스펙 — 필드명·배치 한도·기간 제약. 추정과 다르면 «중단·보고»
 *   ④ 표본 키워드 실값 — 「아크로라로체」(리드 1건이 붙은 그 키워드)
 *
 * 실행: npx tsx scripts/adstats-gate.ts
 * ⛔ 읽기만 한다. 캠페인·입찰을 바꾸는 호출은 이 파일에 없다(P4 소관).
 */
import { config } from 'dotenv';
import {
  classifyStatus,
  describeCred,
  kstDate,
  searchAdHeaders,
  searchAdUrl,
  type SearchAdCred,
  type SearchAdEnvelope,
} from '../src/lib/ads/searchad';

config({ path: '.env.local' });

async function call(cred: SearchAdCred, method: string, path: string, query?: Record<string, string | number>): Promise<SearchAdEnvelope> {
  const url = searchAdUrl(path, query);
  try {
    const res = await fetch(url, { method, headers: searchAdHeaders(cred, method, path) });
    const body = await res.text();
    return { ok: res.ok, status: res.status, code: classifyStatus(res.status), body };
  } catch (e) {
    return { ok: false, status: 0, code: 'FETCH_FAIL', body: String(e).slice(0, 200) };
  }
}

function head(s: string, n = 400) {
  return s.replace(/\s+/g, ' ').slice(0, n);
}

async function main() {
  const cred: SearchAdCred = {
    apiKey: process.env.SEARCHAD_API_KEY ?? '',
    secret: process.env.SEARCHAD_SECRET ?? '',
    customerId: process.env.SEARCHAD_CUSTOMER_ID ?? '',
  };

  console.log('── ① 자격 모양 ─────────────────────────');
  const d = describeCred(cred);
  console.log(`  ${d.ready ? '✅' : '⛔'} ${d.note}`);
  if (!d.ready) process.exit(1);

  console.log('');
  console.log('── ② 서명 (GET /ncc/campaigns · 읽기) ──');
  const camp = await call(cred, 'GET', '/ncc/campaigns');
  console.log(`  HTTP ${camp.status} · ${camp.code}`);
  if (camp.code === 'SIGNATURE') {
    console.log('  ⚠️ 401 — 코드보다 «전사» 를 먼저 의심한다. 스크린샷 경유 I/l · O/0 혼동.');
    console.log(`  본문: ${head(camp.body, 200)}`);
    process.exit(1);
  }
  if (!camp.ok) {
    console.log(`  본문: ${head(camp.body, 300)}`);
    process.exit(1);
  }
  let campaigns: Array<Record<string, unknown>> = [];
  try { campaigns = JSON.parse(camp.body); } catch { /* 배열이 아니면 아래에서 본문으로 본다 */ }
  console.log(`  ✅ 서명 통과 · 캠페인 ${Array.isArray(campaigns) ? campaigns.length : '?'}개`);
  if (Array.isArray(campaigns)) {
    for (const c of campaigns.slice(0, 6)) console.log(`     ${c.nccCampaignId} · ${c.name} · ${c.campaignTp} · ${c.status}`);
  }

  console.log('');
  console.log('── ③ StatReport 실스펙 대조 ────────────');
  // ⚠️ 지시서의 경로·필드는 «추정» 이다. 실호출로 확정하고 다르면 R-3 로 문서를 갱신한다.
  const yday = kstDate(new Date(), -1);
  const probes: Array<{ label: string; path: string; query: Record<string, string> }> = [
    {
      label: 'GET /stats (ids + fields + timeRange)',
      path: '/stats',
      query: {
        ids: '',                                  // 아래에서 키워드 ID 를 채운다
        fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'ctr', 'cpc', 'avgRnk']),
        timeRange: JSON.stringify({ since: yday, until: yday }),
      },
    },
    {
      label: 'GET /stats (datePreset)',
      path: '/stats',
      query: {
        ids: '',
        fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt']),
        datePreset: 'yesterday',
      },
    },
  ];

  // 표본 키워드 ID — 리드 1건이 붙어 있는 그 키워드가 최우선 표본이다.
  const SAMPLE_KEYWORD_ID = 'nkw-a001-01-000008540645599'; // 아크로라로체 (leads.utm 실측)
  let keywordIds: string[] = [SAMPLE_KEYWORD_ID];

  // 그룹→키워드로 실제 ID 를 더 모아 본다(배치 한도 실측용).
  if (Array.isArray(campaigns) && campaigns.length) {
    const gid = await call(cred, 'GET', '/ncc/adgroups', { nccCampaignId: String(campaigns[0].nccCampaignId) });
    if (gid.ok) {
      try {
        const groups = JSON.parse(gid.body) as Array<Record<string, unknown>>;
        console.log(`  그룹 ${groups.length}개 (첫 캠페인)`);
        if (groups.length) {
          const kw = await call(cred, 'GET', '/ncc/keywords', { nccAdgroupId: String(groups[0].nccAdgroupId) });
          if (kw.ok) {
            const kws = JSON.parse(kw.body) as Array<Record<string, unknown>>;
            console.log(`  키워드 ${kws.length}개 (첫 그룹) · 예: ${kws.slice(0, 3).map((k) => `${k.keyword}[${k.nccKeywordId}]`).join(' ')}`);
            keywordIds = [...new Set([SAMPLE_KEYWORD_ID, ...kws.map((k) => String(k.nccKeywordId))])].slice(0, 30);
          } else console.log(`  ⚠️ /ncc/keywords ${kw.status} ${kw.code}`);
        }
      } catch { console.log('  ⚠️ 그룹/키워드 본문 파싱 실패'); }
    } else console.log(`  ⚠️ /ncc/adgroups ${gid.status} ${gid.code}`);
  }

  console.log(`  대상 키워드 ID ${keywordIds.length}개 · 기준일 ${yday}`);
  for (const p of probes) {
    const r = await call(cred, 'GET', p.path, { ...p.query, ids: JSON.stringify(keywordIds) });
    console.log(`  ${r.ok ? '✅' : '⛔'} ${p.label} → HTTP ${r.status} ${r.code}`);
    console.log(`     ${head(r.body, 500)}`);
    if (r.ok) break;
  }

  console.log('');
  console.log('⛔ 읽기만 했다. 광고 계정에 아무것도 쓰지 않았다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
