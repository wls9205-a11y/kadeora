/**
 * TY3 타이포 게이트 — FINAL_TYFB_20260918 §4 TY-5 · 판정 증분-2.
 *
 *   npx tsx scripts/type-audit.ts                 # 전수(CI)
 *   npx tsx scripts/type-audit.ts --bucket T4-1   # 화면 커밋 게이트 ②(그 묶음만)
 *
 * 세 가지만 잰다 («정적 자로 잴 수 있는 사실만 게이트화한다»):
 *   ① 사다리 밖 인라인 크기 0 — 화면계 style 객체의 fontSize px 리터럴 · 테일윈드 text-[Npx].
 *      (나)형 prop 숫자는 사다리 값이어야 한다.
 *   ② 화면계 fontWeight 800+ 0.
 *   ③ 소형 음수 자간 0 — 같은 객체의 렌더 크기가 14px 이하인데 letterSpacing 이 음수.
 *
 * 예외 대장(내장): docs/ty/exempt-paths.json(경로) · prop-allowlist.json((나)형 좌표) ·
 *   fs13-holdouts.json(13px 안전판 존치 좌표) · ledger.json 의 display(34px 초과·clamp·제목대 대역 밖).
 *
 * 판정 방식: 매핑 codemod(tools/ty-audit/codemod.ts)를 «쓰지 않고» 돌려, 위 세 규칙에 해당하는
 * 치환이 하나라도 나오면 빨강이다 — 자와 게이트가 한 정의를 공유한다(shared.ts).
 */
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT, rel, isExempt, screenOf, bucketOf } from '../tools/ty-audit/shared';
import { walk } from '../tools/ty-audit/static-census';
import { transformFile } from '../tools/ty-audit/codemod';

const args = process.argv.slice(2);
const bi = args.indexOf('--bucket');
const bucket = bi >= 0 ? args[bi + 1] : null;

const holdsPath = join(ROOT, 'docs/ty/fs13-holdouts.json');
const holds = new Set<string>(
  existsSync(holdsPath) ? JSON.parse(readFileSync(holdsPath, 'utf8')).holds.map((h: { f: string; l: number }) => `${h.f}:${h.l}`) : [],
);

const RULES: Array<[string, RegExp]> = [
  ['① 사다리 밖 인라인 크기', /^(fs \d|tw \[|prop-snap)/],
  ['② 화면계 800+', /^fw (800|900)/],
  ['③ 소형 음수 자간', /^ls neg→0$/],
];

const fails: Record<string, string[]> = {};
let scanned = 0;
for (const abs of walk(join(ROOT, 'src'))) {
  const f = rel(abs);
  if (isExempt(f)) continue;
  if (bucket && !bucket.split(',').includes(bucketOf(screenOf(f)))) continue;
  scanned++;
  const r = transformFile(abs, holds, {}, {});
  for (const [k, n] of Object.entries(r.stat)) {
    for (const [name, re] of RULES) if (re.test(k)) (fails[name] ??= []).push(`${f} — ${k} ×${n}`);
  }
}

let bad = 0;
console.log(`type-audit${bucket ? ` [${bucket}]` : ''} — 파일 ${scanned}`);
for (const [name] of RULES) {
  const xs = fails[name] ?? [];
  bad += xs.length;
  console.log(`  ${xs.length ? '❌' : '✅'} ${name} ${xs.length}`);
  for (const x of xs.slice(0, 30)) console.log('      ' + x);
  if (xs.length > 30) console.log(`      … +${xs.length - 30}`);
}
process.exit(bad ? 1 : 0);
