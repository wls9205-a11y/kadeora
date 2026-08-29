/**
 * StanReginCd → `src/lib/region/bjdong-data.ts` 생성 (PV-2).
 *
 * ⚠️ 이 스크립트는 «받아쓰기만» 한다. 무엇을 넣을지의 판정은 `src/lib/region/bjdong.ts`
 *    (isBjdongLevel · splitRegionCd)에 있고 테스트로 잠겨 있다 — Rule #116.
 *
 * 실행:  npx tsx scripts/bjdong-sync.ts              «전국» — 시도 목록을 lawd.ts 에서 뽑는다
 *        npx tsx scripts/bjdong-sync.ts 26 31 48      시도 지정(부분 갱신용)
 *
 * ⚠️⚠️ 시도 목록을 «손으로 적지 않는다». lawd.ts(PV-1 단일 원본)의 시군구 코드
 *    앞 2자리를 모아 쓴다 — 두 표가 갈리면 수집 대상이 조용히 어긋난다.
 *    (2026-08-30 실측: 손으로 17개를 적었다가 «12(전남광주통합)를 빠뜨리고»
 *     폐지된 29·46 을 넣어, 광주·전남이 통째로 0건이 됐다.)
 *
 * ⛔ 0건 시도를 «조용히 넘기지 않는다». 요청한 시도가 0행이면 실패로 멈춘다 —
 *    「failed 0 ≠ 실패 없음」. 0 은 「없다」가 아니라 「못 물어봤다」일 수 있다.
 */
import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { normalizeServiceKey, buildDataGoKrUrl } from '../src/lib/cron/data-go-kr-key';
import { sleep, PERMIT_THROTTLE_MS } from '../src/lib/permits/hub';
import { dongName, isBjdongLevel, splitRegionCd, type StanReginRow } from '../src/lib/region/bjdong';
import { labelOfLawdCode, SIGUNGU_LAWD_CODES } from '../src/lib/region/lawd';

/** lawd.ts 가 아는 시도 접두 — 시도 목록의 «단일 출처». 손으로 적지 않는다. */
function sidosFromLawd(): string[] {
  const set = new Set<string>();
  for (const codes of Object.values(SIGUNGU_LAWD_CODES)) for (const c of codes) set.add(c.slice(0, 2));
  return [...set].sort();
}

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

  const sidos = process.argv.slice(2).length ? process.argv.slice(2) : sidosFromLawd();
  console.log(`시도 ${sidos.length}개: ${sidos.join(' ')}`);
  const emptySidos: string[] = [];
  const bySigungu = new Map<string, Array<[string, string]>>();
  let seen = 0, skippedHead = 0, unknownSigungu = new Set<string>();

  for (const sido of sidos) {
    const rows = await fetchSido(key, sido);
    // ⛔ 0행을 «조용히» 넘기지 않는다. 폐지된 코드일 수도, 우리가 못 물어본 것일 수도 있다 —
    //    둘은 다른 사실이고 사람이 봐야 한다.
    if (rows.length === 0) emptySidos.push(sido);
    for (const row of rows) {
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
 *   원천: 행정표준코드관리시스템 StanReginCd
 *   요청 시도 ${sidos.length}개: ${sidos.join('·')}
 *   생성일: ${new Date().toISOString().slice(0, 10)}
 *   시군구 ${keys.length} · 법정동 ${codes}
 *${emptySidos.length ? `
 * ⛔⛔ **이 표는 전국이 아니다.** 0행으로 돌아온 시도 ${emptySidos.length}개가 빠져 있다: ${emptySidos.join(', ')}
 *    (29 광주 · 46 전남 은 StanReginCd 에서 «12 전남광주통합특별시» 로 통합됐다.
 *     lawd.ts 는 아직 29·46 을 쓰므로, 12 로 받아 온 행은 지역표에 없어 전량 버려진다.
 *     lawd.ts 를 통합 코드로 맞추기 전에는 이 두 지역을 채울 수 없다 — PV 트랙 판단.)
 * ⛔ 「전국 표」라고 부르지 말 것. 라벨이 데이터를 앞지르면 라벨을 고친다.
 *` : ''}
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

  // ⛔ 여기가 「failed 0 ≠ 실패 없음」이 걸리는 자리다.
  if (emptySidos.length) {
    console.error(`
⛔ 0행 시도 ${emptySidos.length}개: ${emptySidos.join(', ')}`);
    console.error('   폐지된 코드이거나(예: 29·46 → 12 통합) 못 물어본 것이다. 둘은 «다른 사실» 이니 확인하고 다시 돌릴 것.');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
