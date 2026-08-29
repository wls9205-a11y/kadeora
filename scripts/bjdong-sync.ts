/**
 * StanReginCd → `src/lib/region/bjdong-data.ts` 생성 (PV-2).
 *
 * ⚠️ 이 스크립트는 «받아쓰기만» 한다. 무엇을 넣을지의 판정은 `src/lib/region/bjdong.ts`
 *    (isBjdongLevel · splitRegionCd)에 있고 테스트로 잠겨 있다 — Rule #116.
 *
 * 실행:  npx tsx scripts/bjdong-sync.ts          부울경(26·31·48)
 *        npx tsx scripts/bjdong-sync.ts 26 31 48 41   시도 지정
 */
import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { normalizeServiceKey, buildDataGoKrUrl } from '../src/lib/cron/data-go-kr-key';
import { sleep, PERMIT_THROTTLE_MS } from '../src/lib/permits/hub';
import { dongName, isBjdongLevel, splitRegionCd, type StanReginRow } from '../src/lib/region/bjdong';
import { labelOfLawdCode } from '../src/lib/region/lawd';

config({ path: '.env.local' });

const BASE = 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList';
const OUT = 'src/lib/region/bjdong-data.ts';

async function fetchSido(key: string, sido: string): Promise<StanReginRow[]> {
  const rows: StanReginRow[] = [];
  for (let page = 1; page <= 40; page++) {
    const url = buildDataGoKrUrl(BASE, key, { type: 'json', numOfRows: 1000, pageNo: page, sido_cd: sido });
    await sleep(PERMIT_THROTTLE_MS);
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`sido ${sido} page ${page}: HTTP ${res.status}`);
    const j = JSON.parse(await res.text()) as { StanReginCd?: Array<Record<string, unknown>> };
    const blocks = j.StanReginCd ?? [];
    const head = blocks.find((b) => 'head' in b)?.head as Array<Record<string, unknown>> | undefined;
    const total = Number(head?.[0]?.totalCount ?? 0);
    const page_rows = (blocks.find((b) => 'row' in b)?.row ?? []) as StanReginRow[];
    rows.push(...page_rows);
    process.stdout.write(`  시도 ${sido} p${page}: +${page_rows.length} (누적 ${rows.length}/${total})\n`);
    if (rows.length >= total || page_rows.length === 0) break;
  }
  return rows;
}

async function main() {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  if (!key) { console.error('⛔ PERMIT_API_KEY 없음'); process.exit(1); }

  const sidos = process.argv.slice(2).length ? process.argv.slice(2) : ['26', '31', '48'];
  const bySigungu = new Map<string, Array<[string, string]>>();
  let seen = 0, skippedHead = 0, unknownSigungu = new Set<string>();

  for (const sido of sidos) {
    for (const row of await fetchSido(key, sido)) {
      seen++;
      if (!isBjdongLevel(row)) { skippedHead++; continue; }
      const split = splitRegionCd(row.region_cd);
      if (!split) continue;
      // ⚠️ 우리 지역표에 없는 시군구는 «넣지 않는다». 넣으면 수집이 lawd 모듈과 갈린다.
      if (!labelOfLawdCode(split.sigunguCd)) { unknownSigungu.add(split.sigunguCd); continue; }
      const list = bySigungu.get(split.sigunguCd) ?? [];
      list.push([split.bjdongCd, dongName(row)]);
      bySigungu.set(split.sigunguCd, list);
    }
  }

  const keys = [...bySigungu.keys()].sort();
  const codes = keys.reduce((n, k) => n + bySigungu.get(k)!.length, 0);

  const body = keys.map((k) => {
    const label = labelOfLawdCode(k);
    const seenCd = new Set<string>();
    const list = bySigungu.get(k)!
      .filter(([c]) => (seenCd.has(c) ? false : (seenCd.add(c), true)))
      .sort((a, b) => a[0].localeCompare(b[0]));
    const entries = list
      .map(([c, n]) => "['" + c + "', '" + n.replace(/'/g, "\'") + "']")
      .join(', ');
    return `  // ${label} (${list.length})
  '${k}': [${entries}],`;
  }).join('\n');

  writeFileSync(OUT, `/**
 * 법정동코드 표 — «생성물이다. 손으로 고치지 말 것».
 *   생성: npx tsx scripts/bjdong-sync.ts
 *   원천: 행정표준코드관리시스템 StanReginCd (시도 ${sidos.join('·')})
 *   생성일: ${new Date().toISOString().slice(0, 10)}
 *
 * 시군구 5자리 → [법정동 5자리, 이름] 목록. 건축HUB 의 sigunguCd + bjdongCd 짝이다.
 * ⚠️ «리를 포함한다». 읍면 단위 조회는 리를 포함하지 «않는다» — 기장읍 25건 /
 *    동부리 658건(실측). 빼면 그만큼이 조용히 사라진다.
 */
export const BJDONG_BY_SIGUNGU: Record<string, ReadonlyArray<readonly [code: string, name: string]>> = {
${body}
};
`, 'utf8');

  console.log(`\n생성: ${OUT}`);
  console.log(`  원문 ${seen} · 머리행 제외 ${skippedHead} · 시군구 ${keys.length} · 법정동 ${codes}`);
  if (unknownSigungu.size) console.log(`  ⚠️ 지역표에 없는 시군구 ${unknownSigungu.size}: ${[...unknownSigungu].join(', ')}`);
  console.log(`  호출 예산: ${codes} 코드 × 2트랙 = ${codes * 2} (일 한도 10,000)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
