/**
 * PV-2 표본 게이트 — 인허가 API «판정만» 한다 (dry-run).
 *
 * ── 왜 라우트가 아니라 스크립트인가 ────────────────────────────────────────
 * 로컬 .env.local 의 SUPABASE_SERVICE_ROLE_KEY 는 placeholder(길이 29)다.
 * 즉 로컬에서는 «적재할 수 없다». 그래서 DB 를 아예 열지 않고 API 호출·판정까지만 한다.
 *
 * ⚠️ 판정 로직은 여기 없다 — `src/lib/permits/hub.ts` 와 `src/lib/region/bjdong.ts` 에
 *    있고 테스트로 잠겨 있다. 이 파일은 «호출과 출력만» 한다 (Rule #116).
 *
 * ── 답해야 하는 것 ─────────────────────────────────────────────────────────
 *   ① 봉투 — 키가 통하는가 · 초당 제한에 안 걸리는가
 *   ② 표본 5건이 잡히는가 + «검출 트랙» (이원 소스 가설의 실증)
 *   ③ 커버율 — 어느 지역이 0건인가
 *   ④ 응답 sigunguCd 가 요청한 코드와 같은가 (D5-4)
 *
 * 실행:
 *   npx tsx scripts/permits-gate.ts --samples        표본이 있는 시군구만 (빠름)
 *   npx tsx scripts/permits-gate.ts                  부울경 전수 (2,834동 × 2트랙)
 *   npx tsx scripts/permits-gate.ts --sigungu 31140  지정 시군구만
 */
import { config } from 'dotenv';
import { normalizeServiceKey } from '../src/lib/cron/data-go-kr-key';
import { BJDONG_BY_SIGUNGU } from '../src/lib/region/bjdong-data';
import { labelOfLawdCode } from '../src/lib/region/lawd';
import { isRiCode } from '../src/lib/region/bjdong';
import {
  buildPermitUrl,
  fetchPermitPage,
  isPermitCandidate,
  parsePermitItems,
  parseTotalCount,
  permitHaystack,
  permitToExpectedSalePeriod,
  sampleVerdict,
  toInt,
  type PermitTrack,
} from '../src/lib/permits/hub';

config({ path: '.env.local' });

/**
 * 표본 5건. 지시서 §③.
 * ⚠️ `expect` 는 «가설이지 필터가 아니다». 두 트랙을 전부 훑어 어디서 잡히는지 본다 —
 *    가설로 걸러 버리면 「대단지=Hs · 소형=Arch」가 참인지 영원히 확인할 수 없고,
 *    한쪽에만 있는 현장을 놓쳤을 때 폴백이 필요한지도 판단할 수 없다.
 */
const SAMPLES: { label: string; expect: PermitTrack; needle: RegExp; sigungu: string }[] = [
  { label: '그랑라크 에일린의 뜰', expect: 'house', needle: /그랑라크|에일린/, sigungu: '31140' },
  { label: '문수로 비스타 더파크', expect: 'house', needle: /문수로|비스타/, sigungu: '31140' },
  { label: '화정동 638-3', expect: 'arch', needle: /화정동\s*638-?3|화정동\s*638/, sigungu: '31170' },
  { label: '옥교동 224', expect: 'arch', needle: /옥교동\s*224/, sigungu: '31110' },
  { label: '범천동 1090-61', expect: 'arch', needle: /범천동\s*1090-?61|범천동\s*1090/, sigungu: '26230' },
];

interface Hit { track: PermitTrack; sigungu: string; bjdong: string; row: Record<string, string> }

function targets(): string[] {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--sigungu');
  if (i >= 0 && argv[i + 1]) return argv[i + 1].split(',').map((s) => s.trim());
  if (argv.includes('--samples')) return [...new Set(SAMPLES.map((s) => s.sigungu))];
  return Object.keys(BJDONG_BY_SIGUNGU);
}

async function main() {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  if (!key) { console.error('⛔ PERMIT_API_KEY 가 없다.'); process.exit(1); }

  const sigungus = targets();
  const pairs: Array<[string, string]> = [];
  for (const sgg of sigungus) for (const [cd] of BJDONG_BY_SIGUNGU[sgg] ?? []) pairs.push([sgg, cd]);
  console.log(`대상 시군구 ${sigungus.length} · 법정동 ${pairs.length} · 예상 호출 ${pairs.length * 2}`);

  const envelopes: Record<string, number> = {};
  const found = new Map<string, Hit[]>();
  const perTrack: Record<PermitTrack, { items: number; candidates: number; empty: number; riItems: number; riCand: number }> = {
    house: { items: 0, candidates: 0, empty: 0, riItems: 0, riCand: 0 },
    arch: { items: 0, candidates: 0, empty: 0, riItems: 0, riCand: 0 },
  };
  const bySigungu = new Map<string, number>();
  let mismatch = 0, apiCalls = 0, done = 0;

  for (const track of ['house', 'arch'] as PermitTrack[]) {
    for (const [sgg, bjd] of pairs) {
      const r = await fetchPermitPage(buildPermitUrl(track, key, { sigunguCd: sgg, bjdongCd: bjd, numOfRows: 100 }));
      apiCalls += r.calls;
      envelopes[r.ok ? 'OK' : r.code] = (envelopes[r.ok ? 'OK' : r.code] ?? 0) + 1;
      if (++done % 200 === 0) process.stdout.write(`  … ${done}/${pairs.length * 2} (호출 ${apiCalls})\n`);
      if (!r.ok) continue;

      const items = parsePermitItems(r.body);
      const isRi = isRiCode(bjd);
      perTrack[track].items += items.length;
      if (isRi) perTrack[track].riItems += items.length;
      if (items.length === 0 && (parseTotalCount(r.body) ?? 0) === 0) perTrack[track].empty++;
      bySigungu.set(sgg, (bySigungu.get(sgg) ?? 0) + items.length);

      for (const it of items) {
        if (it.sigunguCd && it.sigunguCd !== sgg) mismatch++;
        if (isPermitCandidate(track, it)) { perTrack[track].candidates++; if (isRi) perTrack[track].riCand++; }
        const hay = permitHaystack(it);
        for (const s of SAMPLES) {
          if (!s.needle.test(hay)) continue;
          const hits = found.get(s.label) ?? [];
          if (!hits.some((h) => h.track === track)) hits.push({ track, sigungu: sgg, bjdong: bjd, row: it });
          found.set(s.label, hits);
        }
      }
    }
  }

  console.log('');
  console.log('── ① 봉투 ──────────────────────────────');
  console.log(envelopes);
  console.log(`  실제 호출 ${apiCalls} (재시도 포함) · 일 한도 10,000`);

  console.log('');
  console.log('── ② 표본 5건 · 검출 트랙 ───────────────');
  let hypothesisOk = 0;
  for (const s of SAMPLES) {
    const hits = found.get(s.label) ?? [];
    if (hits.length === 0) {
      console.log(`  ❌ ${s.label} — 양쪽 트랙 어디에도 없음 (가설 ${s.expect} · ${labelOfLawdCode(s.sigungu)})`);
      continue;
    }
    const tracks = hits.map((h) => h.track);
    const v = sampleVerdict(s.expect, tracks);
    if (v === 'match') hypothesisOk++;
    for (const h of hits) {
      const r = h.row;
      console.log(`  ✅ ${s.label} — [${h.track}] ${h.sigungu}+${h.bjdong} · 세대 ${toInt(r.totHhldCnt ?? r.hhldCnt) ?? '?'} · `
        + `착공예정 ${r.stcnsSchedDay ?? '-'} → 분양예정 ${permitToExpectedSalePeriod(r.stcnsSchedDay) ?? '미정'}`);
      console.log(`        ${(r.platPlc ?? '').trim()} | ${(r.bldNm ?? '').trim() || '(이름없음)'}`);
    }
    console.log(`     └ 가설 ${s.expect} / 실측 ${[...new Set(tracks)].join('+')} → `
      + (v === 'both' ? '⚠️ 양쪽 모두' : v === 'match' ? '가설 일치' : '⚠️ 가설과 «다른» 트랙'));
  }
  console.log(`  이원 소스 가설(대단지=Hs · 소형=Arch): ${hypothesisOk}/${SAMPLES.length} 일치`);
  console.log('  ⚠️ 「다른 트랙」·「양쪽 모두」는 한 트랙만 도는 수집이 «샌다» 는 뜻 — 폴백 트리거.');

  console.log('');
  console.log('── ③ 커버율 ────────────────────────────');
  for (const t of ['house', 'arch'] as PermitTrack[]) {
    const p = perTrack[t];
    console.log(`  ${t}: 원문 ${p.items} · 후보 ${p.candidates} · 0건 법정동 ${p.empty}/${pairs.length}`);
    // ⚠️ 리를 뺐다면 «사라졌을» 양. 기장읍 25 / 동부리 658 의 교정이 얼마를 건졌는지 수치로 남긴다.
    console.log(`      └ 리(里) 레벨: 원문 ${p.riItems} · 후보 ${p.riCand}  ← 리를 뺐다면 사라졌을 몫`);
  }
  const zero = sigungus.filter((s) => !(bySigungu.get(s) ?? 0));
  console.log(`  0건 시군구 ${zero.length}/${sigungus.length}${zero.length ? ': ' + zero.map((s) => labelOfLawdCode(s)).join(', ') : ''}`);

  console.log('');
  console.log('── ④ 코드 불일치 (D5-4) ────────────────');
  console.log(`  ${mismatch} 건${mismatch ? '  ⚠️ 요청한 지역이 아닌 데이터가 온다' : '  (정상)'}`);
  console.log('');
  console.log('⛔ dry-run. DB 에 아무것도 쓰지 않았다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
