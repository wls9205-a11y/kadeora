/**
 * PV-2 표본 게이트 — 인허가 API «판정만» 한다 (dry-run).
 *
 * ── 왜 라우트가 아니라 스크립트인가 ────────────────────────────────────────
 * 로컬 .env.local 의 SUPABASE_SERVICE_ROLE_KEY 는 placeholder(길이 29)다.
 * 즉 로컬에서는 «적재할 수 없다». 그래서 이 스크립트는 DB 를 아예 열지 않고
 * API 호출·파싱·판정까지만 한다. 실적재는 라우트 배포 후 permits-sync 가 한다.
 *
 * ── 이 게이트가 답해야 하는 것 ─────────────────────────────────────────────
 *   ① bjdongCd 없이 시군구 단위 호출이 «되는가» (되면 법정동 매핑이 필요 없다)
 *   ② 표본 5건이 실제로 «잡히는가» — 대단지 2 / 소형 3
 *   ③ 부울경 43코드 커버율 — 어느 지역이 0건인지
 *   ④ 응답의 sigunguCd 가 요청한 코드와 같은가 (D5-4)
 *
 * 실행:  npx tsx scripts/permits-gate.ts
 *        npx tsx scripts/permits-gate.ts --bjdong   ← ①이 실패했을 때 재시도용
 */
import { config } from 'dotenv';
import { normalizeServiceKey } from '../src/lib/cron/data-go-kr-key';
import { readEnvelope } from '../src/lib/cron/data-go-kr-envelope';
import { BUULGYEONG_REGIONS } from '../src/lib/region/buulgyeong';
import { lawdEntriesForRegions } from '../src/lib/region/lawd';
import {
  buildPermitUrl,
  isPermitCandidate,
  parsePermitItems,
  parseTotalCount,
  permitToExpectedSalePeriod,
  toInt,
  type PermitTrack,
} from '../src/lib/permits/hub';

config({ path: '.env.local' });

/**
 * 표본 5건. 지시서 §③.
 * ⚠️ 시군구 코드를 «미리 박지 않는다» — 부울경 43코드를 전부 훑고 이름·지번으로 찾는다.
 *    코드를 손으로 적으면 그게 틀렸을 때 「API 에 없다」와 구분되지 않는다.
 */
const SAMPLES: { label: string; track: PermitTrack; needle: RegExp }[] = [
  { label: '그랑라크 에일린의 뜰', track: 'house', needle: /그랑라크|에일린/ },
  { label: '문수로 비스타 더파크', track: 'house', needle: /문수로|비스타/ },
  { label: '화정동 638-3', track: 'arch', needle: /화정동\s*638-?3/ },
  { label: '옥교동 224', track: 'arch', needle: /옥교동\s*224/ },
  { label: '범천동 1090-61', track: 'arch', needle: /범천동\s*1090-?61/ },
];

async function main() {
  const key = normalizeServiceKey(process.env.PERMIT_API_KEY);
  if (!key) {
    console.error('⛔ PERMIT_API_KEY 가 없다. .env.local 에 넣고 다시 실행할 것.');
    process.exit(1);
  }
  const useBjdong = process.argv.includes('--bjdong');
  const entries = lawdEntriesForRegions([...BUULGYEONG_REGIONS]);
  console.log(`부울경 ${entries.length}코드 × 2트랙 = ${entries.length * 2} 호출 (일 한도 10,000)`);
  if (useBjdong) console.log('⚠️ --bjdong: 아직 미구현 — ① 판정 결과를 보고 법정동 매핑을 넣는다.');

  const envelopes: Record<string, number> = {};
  const found = new Map<string, { code: string; row: Record<string, string> }>();
  const perTrack: Record<PermitTrack, { items: number; candidates: number; empty: string[] }> = {
    house: { items: 0, candidates: 0, empty: [] },
    arch: { items: 0, candidates: 0, empty: [] },
  };
  let mismatch = 0;
  let firstBody = '';

  for (const track of ['house', 'arch'] as PermitTrack[]) {
    for (const [label, code] of entries) {
      const url = buildPermitUrl(track, key, { sigunguCd: code, numOfRows: 100 });
      let xml = '';
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) { envelopes[`HTTP_${res.status}`] = (envelopes[`HTTP_${res.status}`] ?? 0) + 1; continue; }
        xml = await res.text();
      } catch {
        envelopes.FETCH_FAIL = (envelopes.FETCH_FAIL ?? 0) + 1; continue;
      }
      if (!firstBody) firstBody = xml.slice(0, 700);

      const env = readEnvelope(xml);
      envelopes[env.ok ? 'OK' : env.code] = (envelopes[env.ok ? 'OK' : env.code] ?? 0) + 1;
      if (!env.ok) continue;

      const items = parsePermitItems(xml);
      perTrack[track].items += items.length;
      if (items.length === 0 && (parseTotalCount(xml) ?? 0) === 0) perTrack[track].empty.push(`${label}(${code})`);

      for (const it of items) {
        if (it.sigunguCd && it.sigunguCd !== code) mismatch++;
        if (isPermitCandidate(it)) perTrack[track].candidates++;
        const hay = `${it.bldNm ?? ''} ${it.platPlc ?? ''} ${it.newPlatPlc ?? ''}`;
        for (const s of SAMPLES) {
          if (s.track === track && !found.has(s.label) && s.needle.test(hay)) {
            found.set(s.label, { code, row: it });
          }
        }
      }
    }
  }

  console.log('\n── ① 봉투 ──────────────────────────────');
  console.log(envelopes);
  if (!envelopes.OK) {
    console.log('⛔ 정상 응답 0건. 승인 반영 지연(20/30)인지 파라미터 문제인지 위 코드로 갈린다.');
    console.log('첫 응답 앞부분:\n' + firstBody);
    process.exit(2);
  }

  console.log('\n── ② 표본 5건 ──────────────────────────');
  for (const s of SAMPLES) {
    const hit = found.get(s.label);
    if (!hit) { console.log(`  ❌ ${s.label} — 못 찾음 (${s.track})`); continue; }
    const r = hit.row;
    console.log(`  ✅ ${s.label} — ${hit.code} · 세대 ${toInt(r.totHhldCnt) ?? '?'} · `
      + `승인 ${r.apprvDay ?? '-'} · 착공예정 ${r.stcnsSchedDay ?? '-'} `
      + `→ 분양예정 ${permitToExpectedSalePeriod(r.stcnsSchedDay) ?? '미정'}`);
  }

  console.log('\n── ③ 커버율 ────────────────────────────');
  for (const t of ['house', 'arch'] as PermitTrack[]) {
    const p = perTrack[t];
    console.log(`  ${t}: 원문 ${p.items} · 후보 ${p.candidates} · 0건 지역 ${p.empty.length}/${entries.length}`);
    if (p.empty.length) console.log(`    0건: ${p.empty.slice(0, 12).join(', ')}${p.empty.length > 12 ? ' …' : ''}`);
  }

  console.log('\n── ④ 코드 불일치 (D5-4) ────────────────');
  console.log(`  ${mismatch} 건${mismatch ? '  ⚠️ 요청한 지역이 아닌 데이터가 온다' : '  (정상)'}`);
  console.log('\n⛔ dry-run. DB 에 아무것도 쓰지 않았다.');
}

main().catch((e) => { console.error(e); process.exit(1); });
