/**
 * StanReginCd → 시도 하나의 «시군구 단위» 코드·이름 실측 (읽기 전용).
 *
 * ⚠️ lawd.ts 를 이 결과로 «고치기 전에» 사람이 눈으로 보라고 만든 자다.
 *    추정 코드를 넣지 않는다 — 등재 자체가 판정이다(A-1 의 12140 사례).
 *
 * 실행: npx tsx scripts/stanregin-sigungu.ts 12
 */
import { config } from 'dotenv';
import { normalizeServiceKey, buildDataGoKrUrl } from '../src/lib/cron/data-go-kr-key';
import { sleep, PERMIT_THROTTLE_MS } from '../src/lib/permits/hub';

config({ path: '.env.local' });
const BASE = 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList';

(async () => {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  if (!key) { console.error('⛔ PERMIT_API_KEY 없음'); process.exit(1); }
  const sido = process.argv[2];
  if (!sido) { console.error('⛔ 시도코드 인자 필요'); process.exit(1); }

  const rows: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 40; page++) {
    const url = buildDataGoKrUrl(BASE, key, { type: 'json', numOfRows: 1000, pageNo: page, sido_cd: sido });
    await sleep(PERMIT_THROTTLE_MS);
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
    const j = JSON.parse(await res.text()) as { StanReginCd?: Array<Record<string, unknown>> };
    const blocks = j.StanReginCd ?? [];
    const total = Number((blocks.find((b) => 'head' in b)?.head as Array<Record<string, unknown>>)?.[0]?.totalCount ?? 0);
    const page_rows = (blocks.find((b) => 'row' in b)?.row ?? []) as Array<Record<string, unknown>>;
    rows.push(...page_rows);
    if (rows.length >= total || page_rows.length === 0) break;
  }

  // 시군구 «머리행» = 읍면동(umd)·리(ri) 가 모두 0 이고 시군구(sgg) 는 0 이 아닌 행.
  const heads = rows.filter((r) => {
    const cd = String(r.region_cd ?? '');
    return cd.length === 10 && cd.slice(2, 5) !== '000' && cd.slice(5, 8) === '000' && cd.slice(8) === '00';
  });
  console.log(`시도 ${sido} — 전체 ${rows.length}행 · 시군구 머리행 ${heads.length}개`);
  for (const h of heads) {
    const cd = String(h.region_cd).slice(0, 5);
    console.log(`  ${cd}  ${h.sido_cd_nm ?? ''} | ${h.sgg_cd_nm ?? ''} | locallow=${h.locallow_nm ?? ''}`);
  }
})();
