/**
 * TY-3 codemod — 매핑표(docs/ty/README.md §매핑)를 AST 로 적용한다. 수동 파일별 편집 금지(§4 T4 공통).
 *
 *   npx tsx tools/ty-audit/codemod.ts --bucket T4-1 [--dry]
 *   npx tsx tools/ty-audit/codemod.ts --files src/a.tsx,src/b.tsx [--dry]
 *
 * 규칙 (판정 증분-2 «렌더 기준 스냅» 반영):
 *   fontSize (가)  px 리터럴 → 현재 렌더 px(globals 인라인 가드 반영·반픽셀 반올림) → 최근접 --fs 단(동률 아래)
 *                   → 'var(--fs-*)'. input·textarea·select 의 style 은 'max(16px, var(--fs-*))'(iOS 16px 하한).
 *                   34px 초과·clamp 는 존치 → display 대장. fs13-holdouts 대장 좌표는 건너뛴다.
 *   fontWeight (가) 400/500/600/700 → var(--fw-quiet/body/title/num) · 800/900 → var(--fw-num)(700 캡).
 *   lineHeight (가) 무단위 → {1, 1.3, 1.5, 1.6} 최근접(동률 아래). 단위 있는 값은 존치.
 *   letterSpacing (가) 음수 → 같은 객체 fontSize 의 렌더 px 로 TY1 사다리(−0.4/−0.2/0). fontSize 를 모르면 존치.
 *                   양수 → uppercase·font-mono 문맥이면 '0.14em'(eyebrow 기확정), 아니면 0.
 *   (나)형 fontSize — 값 스냅만(데스크탑·모바일 사다리 합집합) + prop-allowlist 등재.
 *   textAlign — 치환 제외(정적 자로 의미를 못 잰다).
 *   테일윈드 text-[Npx] — 렌더 기준으로 브리지 키(text-xs=--fs-xs 등) 또는 text-[length:var(--fs-2xs)].
 */
import * as ts from 'typescript';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, rel, isExempt, screenOf, bucketOf, FS_STEPS, INLINE_GUARD, snapFs, snapPropPx, FW_TOKEN, snapLh, tyLetterSpacing } from './shared';
import { walk, leaves, formOf } from './static-census';

type Edit = { start: number; end: number; text: string };
type Ledger = Record<string, Array<{ f: string; l: number; raw: string; note?: string }>>;

const fsDesktop = (tok: string) => FS_STEPS.find((s) => s.token === tok)?.desktop ?? null;

function readJson<T>(p: string, d: T): T {
  const abs = join(ROOT, p);
  return existsSync(abs) ? JSON.parse(readFileSync(abs, 'utf8')) : d;
}

/** 명목 px → 렌더 px. 정수 9~15 만 인라인 가드에 걸린다(반픽셀은 셀렉터가 안 맞는다). */
function renderOf(px: number) {
  if (Number.isInteger(px) && INLINE_GUARD[px] != null) return INLINE_GUARD[px];
  return Math.round(px);
}

function pxOfLeaf(leaf: number | string | null): number | null {
  if (typeof leaf === 'number') return leaf;
  if (typeof leaf === 'string') {
    const m = leaf.trim().match(/^(-?\d*\.?\d+)(px)?$/);
    if (m) return +m[1];
  }
  return null;
}

function emOrPx(leaf: number | string | null): { v: number; unit: 'px' | 'em' } | null {
  if (typeof leaf === 'number') return { v: leaf, unit: 'px' };
  if (typeof leaf === 'string') {
    const m = leaf.trim().match(/^(-?\d*\.?\d+)(px|em)?$/);
    if (m) return { v: +m[1], unit: (m[2] as 'px' | 'em') ?? 'px' };
  }
  return null;
}

/** 이 객체 리터럴이 붙은 JSX 요소 태그명(style={{…}} 직속일 때만). */
function hostTag(obj: ts.ObjectLiteralExpression): string | null {
  let n: ts.Node = obj.parent;
  while (n && (ts.isParenthesizedExpression(n) || ts.isJsxExpression(n))) n = n.parent;
  if (!n || !ts.isJsxAttribute(n) || n.name.getText() !== 'style') return null;
  const el = n.parent.parent; // JsxAttributes → JsxOpeningElement | JsxSelfClosingElement
  if (ts.isJsxOpeningElement(el) || ts.isJsxSelfClosingElement(el)) return el.tagName.getText();
  return null;
}

/** ⛔ 색·배지·tone·스테이지 칩은 DS2 소관(§0) — 그 스타일 헬퍼 안은 건드리지 않는다.
 *  함수명(선언·화살표 변수·메서드)이 chip/badge/tone/stage 를 품으면 그 몸통 전체를 건너뛴다. */
const DS2_NAME = /chip|badge|tone|stage/i;
function inDs2Helper(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name && DS2_NAME.test(p.name.getText())) return true;
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && DS2_NAME.test(p.parent.name.getText())) return true;
    if (ts.isVariableDeclaration(p) && p.initializer && ts.isObjectLiteralExpression(p.initializer) && DS2_NAME.test(p.name.getText())) return true;
  }
  return false;
}

export function transformFile(abs: string, holds: Set<string>, ledger: Ledger, allow: Ledger, onlyTw = false) {
  const f = rel(abs);
  // 파일명 자체가 배지·칩·tone 모듈이면 통째로 DS2 소관 — 손대지 않는다(subscription-badge.ts 등).
  if (!onlyTw && /(badge|chip|tone)[^/]*$/i.test(f)) return { changed: false, stat: {} as Record<string, number> };
  const text = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, abs.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits: Edit[] = [];
  const stat: Record<string, number> = {};
  const bump = (k: string) => (stat[k] = (stat[k] ?? 0) + 1);
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const note = (L: Ledger, key: string, n: ts.Node, raw: string, why?: string) => (L[key] ??= []).push({ f, l: line(n), raw, ...(why ? { note: why } : {}) });
  const replace = (n: ts.Node, t: string) => edits.push({ start: n.getStart(sf), end: n.getEnd(), text: t });

  /** 같은 객체의 fontSize → 렌더 px(치환 전 값 기준). 토큰이면 데스크탑 값. */
  const siblingFsPx = (obj: ts.ObjectLiteralExpression): number | null => {
    for (const pr of obj.properties) {
      if (!ts.isPropertyAssignment(pr) || pr.name.getText().replace(/['"]/g, '') !== 'fontSize') continue;
      const ls = leaves(pr.initializer, sf);
      if (ls.length !== 1) return null;
      const leaf = ls[0].leaf;
      const px = pxOfLeaf(leaf);
      // 자간은 «치환 후» 크기로 판정한다 — 13px(가드 렌더 15)는 --fs-xs(14)가 되므로 음수 0(12~13px 음수 금지).
      if (px != null) { const t = snapFs(renderOf(px)); return t ? fsDesktop(t) : renderOf(px); }
      const m = typeof leaf === 'string' && leaf.match(/var\(--fs-([\w]+)\)/);
      if (m) return fsDesktop(m[1]);
      return null;
    }
    return null;
  };
  const hasEyebrowContext = (obj: ts.ObjectLiteralExpression) =>
    obj.properties.some((pr) => ts.isPropertyAssignment(pr) && (
      (pr.name.getText() === 'textTransform' && /uppercase/.test(pr.initializer.getText())) ||
      (pr.name.getText() === 'fontFamily' && /mono/i.test(pr.initializer.getText()))));

  const visit = (node: ts.Node) => {
    if (!onlyTw && inDs2Helper(node)) { ts.forEachChild(node, visit); return; }
    if (!onlyTw && ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      const name = node.name.text;
      const obj = node.parent;
      if (['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'].includes(name)) {
        const form = formOf(obj);
        for (const lf of leaves(node.initializer, sf)) {
          if (lf.leaf == null) continue;
          const key = `${f}:${line(lf.node)}`;
          if (form === '나') {
            if (name === 'fontSize') {
              const px = pxOfLeaf(lf.leaf);
              if (px == null) continue;
              const snapped = snapPropPx(px);
              if (snapped !== px) { replace(lf.node, typeof lf.leaf === 'string' ? `"${snapped}"` : String(snapped)); bump('prop-snap'); }
              note(allow, 'fontSize', lf.node, lf.text, `→ ${snapped}`);
            }
            continue;
          }
          if (form !== '가') { note(ledger, 'form-unknown', lf.node, lf.text, name); continue; }

          if (name === 'fontSize') {
            const px = pxOfLeaf(lf.leaf);
            if (px == null) { if (typeof lf.leaf === 'string' && /clamp|rem|em/.test(lf.leaf)) note(ledger, 'display', lf.node, lf.text); continue; }
            if (holds.has(key)) { bump('fs-hold'); continue; }
            const tok = snapFs(renderOf(px));
            if (!tok) { note(ledger, 'display', lf.node, lf.text, 'over-ladder'); bump('fs-display'); continue; }
            const tag = hostTag(obj);
            const val = tag && /^(input|textarea|select)$/.test(tag) ? `max(16px, var(--fs-${tok}))` : `var(--fs-${tok})`;
            replace(lf.node, `'${val}'`);
            bump(`fs ${px}→${tok}`);
          } else if (name === 'fontWeight') {
            const v = typeof lf.leaf === 'number' ? lf.leaf : /^\d+$/.test(lf.leaf) ? +lf.leaf : lf.leaf === 'bold' ? 700 : lf.leaf === 'normal' ? 400 : null;
            if (v == null) continue;
            const capped = v >= 800 ? 700 : v;
            const tok = FW_TOKEN[capped];
            if (!tok) { note(ledger, 'fw-off', lf.node, lf.text); continue; }
            replace(lf.node, `'var(--fw-${tok})'`);
            bump(v >= 800 ? `fw ${v}→num(cap)` : `fw ${v}`);
          } else if (name === 'lineHeight') {
            const v = typeof lf.leaf === 'number' ? lf.leaf : /^\d*\.?\d+$/.test(lf.leaf) ? +lf.leaf : null;
            if (v == null) { note(ledger, 'lh-unit', lf.node, lf.text); continue; }
            const s = snapLh(v);
            if (s !== v || typeof lf.leaf === 'string') { replace(lf.node, String(s)); bump(`lh ${v}→${s}`); }
          } else if (name === 'letterSpacing') {
            const ev = emOrPx(lf.leaf);
            if (!ev || ev.v === 0) continue;
            if (ev.v < 0) {
              const fsPx = siblingFsPx(obj);
              if (fsPx == null) { note(ledger, 'ls-unknown-size', lf.node, lf.text); bump('ls-hold'); continue; }
              const t = tyLetterSpacing(fsPx);
              replace(lf.node, t === 0 ? '0' : `'${t}px'`);
              bump(`ls neg→${t}`);
            } else if (hasEyebrowContext(obj)) {
              if (!(ev.unit === 'em' && ev.v === 0.14)) { replace(lf.node, `'0.14em'`); bump('ls pos→.14em'); }
            } else {
              replace(lf.node, '0');
              note(ledger, 'ls-positive-zeroed', lf.node, lf.text);
              bump('ls pos→0');
            }
          }
        }
      }
    } else if (!onlyTw && ts.isJsxAttribute(node) && node.name.getText() === 'fontWeight') {
      // (나)형 SVG 속성 굵기 — var() 가 안 먹으니 값만 700 캡(화면계 800+ 금지).
      const init = node.initializer;
      const expr = init && ts.isJsxExpression(init) ? init.expression : init;
      if (expr) for (const lf of leaves(expr as ts.Expression, sf)) {
        const v = typeof lf.leaf === 'number' ? lf.leaf : typeof lf.leaf === 'string' && /^\d+$/.test(lf.leaf) ? +lf.leaf : null;
        if (v != null && v >= 800) { replace(lf.node, typeof lf.leaf === 'string' ? '"700"' : '700'); bump(`fw ${v}→num(cap)`); }
      }
    } else if (!onlyTw && ts.isJsxAttribute(node) && node.name.getText() === 'fontSize') {
      const init = node.initializer;
      const expr = init && ts.isJsxExpression(init) ? init.expression : init;
      if (expr) for (const lf of leaves(expr as ts.Expression, sf)) {
        const px = pxOfLeaf(lf.leaf);
        if (px == null) continue;
        const snapped = snapPropPx(px);
        if (snapped !== px) { replace(lf.node, typeof lf.leaf === 'string' ? `"${snapped}"` : String(snapped)); bump('prop-snap'); }
        note(allow, 'fontSize', lf.node, lf.text, `→ ${snapped}`);
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      // 테일윈드 임의 크기값 → 브리지 키
      const raw = node.getText(sf);
      const out = raw.replace(/(?<![\w\-\[])((?:[a-z0-9-]+:)*)text-\[(\d+(?:\.\d+)?)px\]/g, (_m, variant: string, n: string) => {
        const px = +n;
        // globals.css 클래스 가드: .text-[9..14px] 와 .text-[12.5px] 가 인라인 가드와 같은 사다리로 끌어올려진다.
        const r = px === 12.5 ? 14 : renderOf(px);
        const tok = snapFs(r);
        bump(`tw [${px}px]→${tok}`);
        // ⚠️ 브리지 키(text-sm 등)로 보내지 «않는다». 브리지 키는 lineHeight 튜플을 싣고 있어
        //    임의값 클래스에 없던 행간이 조용히 붙는다. 크기만 옮기는 length: 힌트를 쓴다.
        return `${variant}text-[length:var(--fs-${tok})]`;
      });
      if (out !== raw) replace(node, out);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) return { changed: false, stat };
  edits.sort((a, b) => b.start - a.start);
  let s = text;
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart) continue; // 겹침 방어 — 바깥 문자열 치환과 안쪽 리터럴 치환이 겹치지 않게
    s = s.slice(0, e.start) + e.text + s.slice(e.end);
    lastStart = e.start;
  }
  return { changed: s !== text, stat, out: s };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const bucket = arg('--bucket');
  const files = arg('--files');
  const dry = args.includes('--dry');
  const onlyTw = args.includes('--only-tw'); // T4-0: 테일윈드 임의 크기값만
  const holdsJson = readJson<{ holds: Array<{ f: string; l: number }> }>('docs/ty/fs13-holdouts.json', { holds: [] });
  const holds = new Set(holdsJson.holds.map((h) => `${h.f}:${h.l}`));
  const ledger: Ledger = {};
  const allow: Ledger = {};
  const targets = walk(join(ROOT, 'src')).filter((abs) => {
    const f = rel(abs);
    if (isExempt(f)) return false;
    if (files) return files.split(',').includes(f);
    if (bucket === 'all') return true;
    return bucket ? bucket.split(',').includes(bucketOf(screenOf(f))) : false;
  });
  const total: Record<string, number> = {};
  let changed = 0;
  for (const abs of targets) {
    const r = transformFile(abs, holds, ledger, allow, onlyTw);
    for (const [k, v] of Object.entries(r.stat)) total[k] = (total[k] ?? 0) + v;
    if (r.changed) { changed++; if (!dry) writeFileSync(abs, r.out!); }
  }
  // 대장 병합(파일 단위로 갈아끼운다 — 같은 파일 재실행 시 중복 방지)
  const touched = new Set(targets.map(rel));
  const merge = (p: string, L: Ledger) => {
    const prev = readJson<{ _doc?: string; entries: Ledger }>(p, { entries: {} });
    // 합집합(중복 제거). 재실행은 이미 0 으로 바뀐 자간 등을 다시 «기록» 하지 못하므로 교체하면 대장이 지워진다.
    void touched;
    for (const [k, v] of Object.entries(L)) {
      const seen = new Set((prev.entries[k] ?? []).map((e) => `${e.f}:${e.l}:${e.raw}`));
      prev.entries[k] = [...(prev.entries[k] ?? []), ...v.filter((e) => !seen.has(`${e.f}:${e.l}:${e.raw}`))];
    }
    if (!dry) writeFileSync(join(ROOT, p), JSON.stringify(prev, null, 1));
  };
  if (!onlyTw) {
    merge('docs/ty/ledger.json', ledger);
    merge('docs/ty/prop-allowlist.json', allow);
  }
  console.log(JSON.stringify({ targets: targets.length, changed, dry, total: Object.fromEntries(Object.entries(total).sort()), ledger: Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, v.length])) }, null, 1));
}
