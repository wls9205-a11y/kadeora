/**
 * 인증키 확장 ① 게이트 — 면적 «타입표» 판정만 한다 (호출·출력만 · Rule #116).
 *
 * 답해야 하는 것:
 *   ① 호별(getHpHoOulnInfo)에서 타입표가 «세대수까지» 나오는가
 *   ② 오염 2종(근생 · 호표기)이 걸러지는가 — 걸러진 수가 보이는가
 *   ③ 전유면적(getHpExposPubuseAreaInfo)이 타입 라벨에 «실면적» 을 붙일 수 있는가
 *   ④ 표기 두 체계(84A / 21.62C)가 한 단지에 섞이는가
 *
 * 실행: npx tsx scripts/unittypes-gate.ts [--sigungu 31140] [--bjdong 10800] [--pages 8]
 * ⛔ 읽기만 한다. DB 에 아무것도 쓰지 않는다.
 * ⚠️ 호출 예산 — 기본 12발(호 8 + 면적 4). permits-sync 크론(매시 25분)과 같은 키를 쓰므로
 *    페이지를 함부로 늘리지 않는다.
 */
import { config } from 'dotenv';
import { normalizeServiceKey } from '../src/lib/cron/data-go-kr-key';
import { buildTypeTables, exclusiveAreas, matchArea } from '../src/lib/permits/unittypes';

config({ path: '.env.local' });

const BASE = 'https://apis.data.go.kr/1613000/HsPmsHubService/';

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const items = (t: string): Record<string, string>[] =>
  [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const o: Record<string, string> = {};
    for (const f of m[1].matchAll(/<([a-zA-Z][a-zA-Z0-9]*)>([^<]*)<\/\1>/g)) {
      const v = f[2].trim();
      if (v !== '') o[f[1]] = v;   // 빈 값을 담지 않는다 — 「없음」과 「빈 값」은 다르다
    }
    return o;
  });

async function page(key: string, op: string, sgg: string, bjd: string, p: number) {
  const url = `${BASE}${op}?serviceKey=${key}&sigunguCd=${sgg}&bjdongCd=${bjd}&numOfRows=100&pageNo=${p}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const t = await r.text();
  return { ok: r.ok, rows: items(t), total: Number((t.match(/<totalCount>(\d+)</) ?? [])[1] ?? 0) };
}

async function main() {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  if (!key) { console.error('⛔ PERMIT_API_KEY 가 없다.'); process.exit(1); }

  const sgg = arg('--sigungu', '31140');
  const bjd = arg('--bjdong', '10800');
  const pages = Math.max(1, Math.min(20, Number(arg('--pages', '8'))));

  let calls = 0;
  const ho: Record<string, string>[] = [];
  let hoTotal = 0;
  for (let p = 1; p <= pages; p++) {
    const r = await page(key, 'getHpHoOulnInfo', sgg, bjd, p); calls++;
    if (!r.ok) break;
    hoTotal = r.total; ho.push(...r.rows);
    if (r.rows.length < 100) break;
    await new Promise((x) => setTimeout(x, 350));
  }
  const ar: Record<string, string>[] = [];
  for (let p = 1; p <= Math.ceil(pages / 2); p++) {
    const r = await page(key, 'getHpExposPubuseAreaInfo', sgg, bjd, p); calls++;
    if (!r.ok) break;
    ar.push(...r.rows);
    if (r.rows.length < 100) break;
    await new Promise((x) => setTimeout(x, 350));
  }

  const areas = exclusiveAreas(ar);
  console.log(`── 수집 ── ${sgg}+${bjd} · 호 ${ho.length}/${hoTotal} · 면적행 ${ar.length} · 전유(주건축물·주거) ${areas.length} · 호출 ${calls}`);
  // ⚠️ 「수집 < 전체」면 잘린 것이다. 0 건과 구분되어야 한다.
  if (ho.length < hoTotal) console.log(`   ⚠️ 호별이 잘렸다 — ${ho.length}/${hoTotal}. --pages 를 늘려야 전량이다.`);

  const tables = buildTypeTables(ho).filter((t) => t.totalUnits >= 30).slice(0, 3);
  if (tables.length === 0) { console.log('   30세대 이상 단지가 없다.'); return; }

  for (const t of tables) {
    console.log('');
    console.log(`■ ${t.building} — 총 ${t.totalUnits}세대 · ${t.dongs}개동 · 타입 ${t.types.length}종${t.mixedNotation ? '  ⚠️ 표기 혼재(평형계열+면적계열)' : ''}`);
    console.log(`  제외 — 근생 ${t.excluded.retail} · 호표기 ${t.excluded.malformed} · 빈값 ${t.excluded.empty}`);
    for (const x of t.types) {
      const a = matchArea(x, areas);
      const pct = ((x.units / t.totalUnits) * 100).toFixed(0);
      console.log(`    ${x.label.padEnd(10)} ${String(x.units).padStart(4)}세대 (${pct.padStart(2)}%)   전유 ${a !== null ? `${a.toFixed(2)}㎡` : '— 미매칭'}`);
    }
  }
  console.log('');
  console.log('⛔ 읽기만 했다. DB 에 아무것도 쓰지 않았다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
