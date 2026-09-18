/**
 * TY-3 매핑표 생성기 — docs/ty/mapping_20260918.md 는 «손으로 쓰지 않는다».
 * shared.ts 의 스냅 함수가 정본이고, 이 표는 그 함수를 census 실값에 돌린 결과다.
 *
 *   npx tsx tools/ty-audit/mapping.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, FS_STEPS, INLINE_GUARD, snapFs, snapLh, snapPropPx, tyLetterSpacing, FW_TOKEN } from './shared';

const census = JSON.parse(readFileSync(join(ROOT, 'docs/ty/census_20260918.json'), 'utf8'));
const items: any[] = census.items.filter((i: any) => !i.exempt && (i.src === 'inline' || i.src === 'jsxattr') && i.form === '가');
const cnt = (pred: (i: any) => boolean) => items.filter(pred).length;
const step = (t: string) => FS_STEPS.find((s) => s.token === t)!;

const L: string[] = [];
L.push('# TY-3 매핑표 (기계 생성 · 2026-09-18)', '');
L.push(`> 생성: \`npx tsx tools/ty-audit/mapping.ts\` · census head \`${census.head}\` · 정본 함수: tools/ty-audit/shared.ts`);
L.push('> **판정 증분-2 «렌더 기준 스냅»** — globals.css 의 인라인 가드(`[style*="font-size:Npx"]{…!important}`, 미디어 무관)가');
L.push('> 9~15px 를 끌어올리고 있어, 명목값이 아니라 «현재 렌더값» 에서 최근접 단을 고른다. 명목 스냅은 인라인 12px(현 렌더 14)을');
L.push('> 11px(모바일)로 −3 떨어뜨려 «±1~2px 는 사다리 의도» 범위를 깬다.', '');

L.push('## 1. 크기 (fontSize · 가형)', '');
L.push('| 명목 | 현 렌더 | → 토큰 | 데스크탑 | 모바일 | Δ데탑 | Δ모바일 | 건수 |', '|---|---|---|---|---|---|---|---|');
const pxVals = [...new Set(items.filter((i) => i.p === 'fontSize' && i.unit === 'px').map((i) => i.v as number))].sort((a, b) => a - b);
for (const v of pxVals) {
  const r = Number.isInteger(v) && INLINE_GUARD[v] != null ? INLINE_GUARD[v] : Math.round(v);
  const t = snapFs(r);
  const n = cnt((i) => i.p === 'fontSize' && i.unit === 'px' && i.v === v);
  if (!t) { L.push(`| ${v} | ${r} | 존치(display 대장) | — | — | — | — | ${n} |`); continue; }
  const s = step(t);
  L.push(`| ${v} | ${r} | --fs-${t} | ${s.desktop} | ${s.mobile} | ${s.desktop - r >= 0 ? '+' : ''}${s.desktop - r} | ${s.mobile - r >= 0 ? '+' : ''}${s.mobile - r} | ${n} |`);
}
L.push('', '- 치환형: `fontSize: \'var(--fs-*)\'` (3상태 사다리 네이티브 반응). input·textarea·select 는 `max(16px, var(--fs-*))`(iOS 16px 하한).');
L.push('- 34px 초과(에러·빈 상태 이모지 36~64)·clamp 는 존치 → `docs/ty/ledger.json` display. clamp 편입은 안건.');
L.push('- 13px 안전판 걸린 좌표는 `docs/ty/fs13-holdouts.json`(리터럴 존치·가드가 계속 15px 로 렌더 = 시각 무변경).', '');

L.push('## 2. 테일윈드 브리지 (T4-0 · theme.extend.fontSize)', '');
L.push('| 키 | 기본 명목 | 현 렌더 | → 토큰 | 행간 튜플 |', '|---|---|---|---|---|');
const tw: Array<[string, number, number]> = [['xs', 12, 1 / 0.75 / 1], ['sm', 14, 20 / 14], ['base', 16, 24 / 16], ['lg', 18, 28 / 18], ['xl', 20, 28 / 20], ['2xl', 24, 32 / 24], ['3xl', 30, 36 / 30]];
tw[0][2] = 16 / 12;
for (const [k, px, lh] of tw) {
  const r = k === 'xs' ? 14 : px;
  L.push(`| text-${k} | ${px} | ${r}${k === 'xs' ? '(가드)' : ''} | --fs-${snapFs(r)} | ${snapLh(lh)} (기본 ${lh.toFixed(2)}) |`);
}
L.push('', '- 임의값 `text-[Npx]` 20건 → `text-[length:var(--fs-*)]`(브리지 키로 보내면 행간 튜플이 새로 붙는다). text-4xl·5xl 존치(display).', '');

L.push('## 3. 굵기', '');
L.push('| 값 | → | 건수 |', '|---|---|---|');
for (const v of [400, 500, 600, 700, 800, 900]) {
  L.push(`| ${v} | var(--fw-${FW_TOKEN[v >= 800 ? 700 : v]})${v >= 800 ? ' (700 캡)' : ''} | ${cnt((i) => i.p === 'fontWeight' && i.v === v)} |`);
}
L.push('', '- 예외 원장(api·og·satori·이메일)의 800/900 은 존치. 테일윈드 font-* 유틸은 값이 정당해 무접촉.', '');

L.push('## 4. 행간 — 사다리 {1, 1.3, 1.5, 1.6} 최근접(동률 아래)', '');
L.push('| 값 | → | 건수 |', '|---|---|---|');
const lhVals = [...new Set(items.filter((i) => i.p === 'lineHeight' && i.unit === 'unitless').map((i) => i.v as number))].sort((a, b) => a - b);
for (const v of lhVals) L.push(`| ${v} | ${snapLh(v)} | ${cnt((i) => i.p === 'lineHeight' && i.v === v && i.unit === 'unitless')} |`);
L.push('', '- 단위 있는 행간(px)은 존치 + ledger `lh-unit`.', '');

L.push('## 5. 자간', '');
L.push('- 음수 → 같은 객체 fontSize 의 렌더 px 로 TY1 사다리: 20px+ `-0.4px` · 15~19 `-0.2px` · 14 이하 `0`. fontSize 불명은 존치 + ledger `ls-unknown-size`.');
L.push(`  (검산: 렌더 13→${tyLetterSpacing(13)} · 16→${tyLetterSpacing(16)} · 24→${tyLetterSpacing(24)})`);
L.push('- 양수 → `textTransform: uppercase`·`font-mono` 문맥이면 `0.14em`(eyebrow 기확정), 아니면 `0` + ledger `ls-positive-zeroed`.', '');

L.push('## 6. 정렬 · 간격', '');
L.push('- textAlign 치환 제외(의미는 정적 자로 못 잰다) — census 대장만. 간격은 화면 커밋 동반 회수만(4배수·--card-p 동결).', '');

L.push('## 7. (나)형 prop', '');
L.push(`- 값 스냅만 — 데스크탑·모바일 사다리 합집합 {${[...new Set(FS_STEPS.flatMap((s) => [s.desktop, s.mobile]))].sort((a, b) => a - b).join(', ')}} 최근접. 예: 7→${snapPropPx(7)} · 9→${snapPropPx(9)} · 11→${snapPropPx(11)}.`);
L.push('- 좌표는 `docs/ty/prop-allowlist.json` 영구 등재(게이트 예외).', '');

writeFileSync(join(ROOT, 'docs/ty/mapping_20260918.md'), L.join('\n'));
console.log(L.join('\n'));
