/**
 * 게이트 ④ 색 diff 0 — TY3 커밋은 색·배지·tone 을 건드리지 않는다(DS2 소관).
 *
 *   npx tsx tools/ty-audit/color-diff.ts [<git diff 범위>]   # 기본: 작업트리 vs HEAD
 *
 * 삭제 줄과 추가 줄에서 색 표현(#hex · rgb/rgba/hsl · var(--색 계열) · tone/색 키 값)을 뽑아
 * «다중집합» 으로 비교한다. 같으면 초록 — 줄이 옮겨졌어도 색 자체가 바뀌지 않았다는 뜻이다.
 */
import { execSync } from 'node:child_process';
import { ROOT } from './shared';

const range = process.argv[2] ?? 'HEAD';
const diff = execSync(`git diff ${range} -U0 -- src tailwind.config.ts`, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 }).toString();
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|var\(--(?:c-|text-|bg-|brand|accent|border|surface|nav-|tone|badge|stage)[\w-]*\)|\b(?:tone|color|background|backgroundColor|borderColor|fill|stroke)\s*[:=]\s*['"{]?[\w#(),.\s-]{1,40}/g;
const bag = (lines: string[]) => {
  const m = new Map<string, number>();
  for (const l of lines) for (const c of l.match(COLOR) ?? []) m.set(c.trim(), (m.get(c.trim()) ?? 0) + 1);
  return m;
};
const del = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1));
const add = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
const a = bag(del), b = bag(add);
const out: string[] = [];
for (const k of new Set([...a.keys(), ...b.keys()])) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) out.push(`${k}: -${a.get(k) ?? 0} +${b.get(k) ?? 0}`);
console.log(`색 diff (${range}) — 변경 줄 -${del.length} +${add.length} · 색 표현 불일치 ${out.length}건`);
for (const l of out.slice(0, 40)) console.log('  ' + l);
process.exit(out.length ? 1 : 0);
