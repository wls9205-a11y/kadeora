/**
 * nowrap 게이트 — 「말줄임 없는 nowrap」 이 «새로» 늘지 않게 막는 정적 자 (R-5 · 2026-09-14).
 *
 * 왜 필요한가
 * -----------
 * `whiteSpace: 'nowrap'` 은 줄바꿈만 막고 넘친 글자는 «그대로 밀어낸다». 같은 스타일
 * 객체에 overflow:hidden + textOverflow:'ellipsis' 가 없으면 390px 에서 카드 밖으로
 * 삐져나오거나 가로 스크롤을 만든다. 225곳이 쌓인 뒤에야 셌다 — 한 번 줄여도
 * 다음 사람이 무심코 쓰면 다시 는다. 그래서 «파일별 기준선» 을 저장소가 들고 있는다.
 *
 * 판정(스타일 객체 단위)
 *   nowrap 이 든 «가장 안쪽 { }» 안에 아래 중 하나라도 있으면 통과로 본다.
 *     · textOverflow            — 말줄임
 *     · overflow: 'hidden'      — 잘라서 넘침 없음
 *     · overflow(X): auto|scroll — 가로 스크롤 줄(칩 줄 등). 넘치는 게 의도다.
 * ⚠️ 부모가 잘라주는 경우(부모 overflow:hidden) 는 정적으로 못 본다 → 기준선에 남는다.
 *    그래서 «0 강제» 가 아니라 «증가 금지» 다(게이트는 초록으로 태어난다 · active-color-gate 와 같은 원칙).
 * ⛔ admin 은 대상 밖 — 데스크톱 운영 화면이다.
 *
 * 사용:
 *   npx tsx scripts/nowrap-gate.ts            # 기준선 대비 증가하면 exit 1
 *   npx tsx scripts/nowrap-gate.ts --list     # 현재 위반 전체 목록
 *   npx tsx scripts/nowrap-gate.ts --update   # 줄였을 때 기준선 갱신(늘릴 때 쓰지 말 것)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = 'src';
const BASELINE = 'docs/gates/nowrap-baseline.txt';

type Hit = { file: string; line: number; text: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const isAdmin = (f: string) => f.split(sep).join('/').split('/').includes('admin');

/** idx 를 감싸는 가장 안쪽 { … } 본문. 괄호 짝만 센다(문자열 안 괄호는 드물어 무시). */
function enclosingObject(src: string, idx: number): string {
  let depth = 0;
  let start = -1;
  for (let i = idx; i >= 0; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { start = i; break; }
      depth--;
    }
  }
  if (start < 0) return src.slice(Math.max(0, idx - 200), idx + 200);
  depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

const NOWRAP = /whiteSpace\s*:\s*['"]nowrap['"]/g;
const SAFE = /textOverflow\s*:|overflow\s*:\s*['"]hidden['"]|overflowX?\s*:\s*['"](auto|scroll)['"]/;

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(ROOT)) {
    if (isAdmin(file)) continue;
    const src = readFileSync(file, 'utf8');
    if (!src.includes('nowrap')) continue;
    for (const m of src.matchAll(NOWRAP)) {
      const obj = enclosingObject(src, m.index!);
      if (SAFE.test(obj)) continue;
      const line = src.slice(0, m.index!).split('\n').length;
      hits.push({
        file: relative('.', file).split(sep).join('/'),
        line,
        text: src.split('\n')[line - 1].trim(),
      });
    }
  }
  return hits;
}

function countByFile(hits: Hit[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of hits) m.set(h.file, (m.get(h.file) ?? 0) + 1);
  return m;
}

function readBaseline(): Map<string, number> {
  const m = new Map<string, number>();
  if (!existsSync(BASELINE)) return m;
  for (const raw of readFileSync(BASELINE, 'utf8').split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const [f, n] = l.split('|');
    m.set(f, Number(n));
  }
  return m;
}

const hits = scan();
const now = countByFile(hits);
const total = hits.length;

if (process.argv.includes('--list')) {
  for (const h of hits) console.log(`${h.file}:${h.line}  ${h.text.slice(0, 140)}`);
  console.log(`\n총 ${total}건 · ${now.size}파일`);
  process.exit(0);
}

if (process.argv.includes('--update')) {
  const body = [...now.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([f, n]) => `${f}|${n}`);
  writeFileSync(
    BASELINE,
    `# nowrap 게이트 기준선 — 파일|말줄임 없는 nowrap 수 (총 ${total}). scripts/nowrap-gate.ts --update 로만 갱신.\n` +
      body.join('\n') + '\n',
  );
  console.log(`기준선 갱신: ${total}건 · ${now.size}파일 → ${BASELINE}`);
  process.exit(0);
}

const base = readBaseline();
const grown: string[] = [];
const grownFiles = new Set<string>();
for (const [f, n] of now) {
  const b = base.get(f) ?? 0;
  if (n > b) { grown.push(`  ${f}  ${b} → ${n}`); grownFiles.add(f); }
}
const baseTotal = [...base.values()].reduce((s, n) => s + n, 0);

console.log(`\n■ nowrap 게이트 — 말줄임 없는 nowrap ${total}건 (기준선 ${baseTotal})`);
if (grown.length === 0) {
  if (total < baseTotal) console.log(`✅ 통과 · ${baseTotal - total}건 줄었다 → --update 로 기준선을 내려 둘 것`);
  else console.log('✅ 통과 · 증가 없음');
  process.exit(0);
}
console.log(`\n❌ 기준선보다 늘어난 파일 ${grown.length}개\n${grown.join('\n')}`);
for (const h of hits.filter((h) => grownFiles.has(h.file))) {
  console.log(`    ${h.file}:${h.line}  ${h.text.slice(0, 120)}`);
}
console.log(`
  → 넘칠 수 있는 글자면 같은 스타일에 overflow: 'hidden', textOverflow: 'ellipsis' 를 붙인다
    (flex 자식이면 minWidth: 0 도). 칩 줄처럼 넘침이 의도면 overflowX: 'auto' 컨테이너에 둔다.
  ⛔ 기준선을 올려서 통과시키지 않는다 — 그러면 이 자는 아무것도 막지 않는다.
`);
process.exit(1);
