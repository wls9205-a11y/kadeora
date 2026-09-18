/**
 * TY-1(a) 정적 자 — src 전수 타이포 census. «계기» 이지 게이트가 아니다.
 *
 *   npx tsx tools/ty-audit/static-census.ts [--out docs/ty/census_20260918.json] [--quiet]
 *
 * 세는 것 (자가 무엇을 세는지 먼저 밝힌다):
 *   ① 인라인 7속성 — 객체 리터럴의 fontSize·fontWeight·lineHeight·letterSpacing·textAlign·
 *      fontFamily·textTransform 프로퍼티 + 같은 이름의 JSX 속성(<text fontSize={11}>).
 *      값은 «리터럴 잎» 단위다: `a ? 600 : 400` 은 2건. 식별자·호출은 kind=expr 로 따로 센다.
 *   ② 테일윈드 타이포 유틸 — 문자열 리터럴(주석 제외) 안의 text-{xs..9xl}·text-[..]·font-*·leading-*·tracking-*.
 *   ③ CSS — globals.css + styles/{blog,components,responsive,screens}.css 의 선언. 가드 규칙은 guard=true.
 *   ④ 간격(padding·margin·gap 계열) — 인라인 리터럴 «건수만». 전량 트랙 금지·화면 동반 회수 대상.
 *
 * 2형 분류 (form):
 *   가 — style 객체/CSS. 토큰 참조(`'var(--fs-xs)'`)로 치환 가능.
 *   나 — 라이브러리 prop 숫자(recharts tick·SVG 속성 등). var() 가 안 먹는다 → 값 스냅만.
 *   ? — JSX 밖 객체라 판정 근거 부족. 치환 대상에서 빼고 대장에서 사람이 본다.
 */
import * as ts from 'typescript';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import postcss from 'postcss';
import { ROOT, rel, isExempt, screenOf, bucketOf } from './shared';

export const PROPS = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'fontFamily', 'textTransform'] as const;
type Prop = (typeof PROPS)[number];
const PROPSET = new Set<string>(PROPS);
const SPACING = /^(padding|margin|gap|rowGap|columnGap)(Top|Bottom|Left|Right|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?$/;
const CSS_HINT = new Set([
  'color', 'background', 'backgroundColor', 'padding', 'margin', 'display', 'border', 'borderRadius', 'width', 'height',
  'gap', 'flex', 'alignItems', 'justifyContent', 'position', 'overflow', 'whiteSpace', 'opacity', 'cursor', 'minWidth',
  'maxWidth', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'boxShadow', 'textDecoration', 'fontSize',
  'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'wordBreak', 'textOverflow', 'transition', 'zIndex',
]);

export type Item = {
  f: string; l: number; p: string; raw: string;
  v: number | string | null; unit: 'px' | 'em' | 'rem' | 'unitless' | 'token' | 'kw' | 'expr' | 'other';
  form: '가' | '나' | '?'; src: 'inline' | 'jsxattr' | 'tw' | 'css';
  screen: string; bucket: string; exempt?: string; guard?: boolean; sel?: string;
};

export function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== '.next') walk(p, out); }
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** 값 정규화 — 속성별. */
export function normalize(p: string, leaf: number | string): { v: number | string | null; unit: Item['unit'] } {
  if (typeof leaf === 'number') {
    if (p === 'lineHeight') return { v: leaf, unit: 'unitless' };
    if (p === 'fontWeight') return { v: leaf, unit: 'unitless' };
    return { v: leaf, unit: 'px' };
  }
  const s = leaf.trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^var\(--([\w-]+)(?:,.*)?\)$/))) return { v: m[1], unit: 'token' };
  if ((m = s.match(/^(-?\d*\.?\d+)px$/))) return { v: +m[1], unit: 'px' };
  if ((m = s.match(/^(-?\d*\.?\d+)rem$/))) return { v: +m[1], unit: 'rem' };
  if ((m = s.match(/^(-?\d*\.?\d+)em$/))) return { v: +m[1], unit: 'em' };
  if ((m = s.match(/^(-?\d*\.?\d+)$/))) return { v: +m[1], unit: p === 'lineHeight' || p === 'fontWeight' ? 'unitless' : 'px' };
  if (p === 'fontWeight') {
    const kw: Record<string, number> = { normal: 400, bold: 700, bolder: 700, lighter: 300 };
    if (kw[s] != null) return { v: kw[s], unit: 'unitless' };
  }
  return { v: s, unit: /^[a-z-]+$/.test(s) ? 'kw' : 'other' };
}

/** 초기화 식에서 리터럴 잎을 뽑는다. 리터럴이 아니면 expr 1건. */
export function leaves(e: ts.Expression, sf: ts.SourceFile): Array<{ node: ts.Node; leaf: number | string | null; text: string }> {
  const out: Array<{ node: ts.Node; leaf: number | string | null; text: string }> = [];
  const rec = (x: ts.Expression) => {
    if (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isSatisfiesExpression?.(x) || ts.isNonNullExpression(x)) return rec((x as any).expression);
    if (ts.isNumericLiteral(x)) return out.push({ node: x, leaf: +x.text, text: x.getText(sf) });
    if (ts.isPrefixUnaryExpression(x) && x.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(x.operand))
      return out.push({ node: x, leaf: -x.operand.text, text: x.getText(sf) });
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) return out.push({ node: x, leaf: x.text, text: x.getText(sf) });
    if (ts.isConditionalExpression(x)) { rec(x.whenTrue); rec(x.whenFalse); return; }
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
      rec(x.left); rec(x.right); return;
    }
    out.push({ node: x, leaf: null, text: x.getText(sf).slice(0, 80) });
  };
  rec(e);
  return out;
}

/** 객체 리터럴 프로퍼티의 형 판정. */
export function formOf(obj: ts.ObjectLiteralExpression): Item['form'] {
  // 가장 가까운 JSX 속성
  let n: ts.Node | undefined = obj.parent;
  let viaObjects = true;
  while (n) {
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText();
      return /style$/i.test(name) ? '가' : '나';
    }
    if (ts.isObjectLiteralExpression(n) || ts.isPropertyAssignment(n) || ts.isParenthesizedExpression(n) ||
        ts.isConditionalExpression(n) || ts.isJsxExpression(n) || ts.isAsExpression(n) || ts.isSpreadAssignment(n) ||
        ts.isArrayLiteralExpression(n) || ts.isBinaryExpression(n)) { n = n.parent; continue; }
    viaObjects = false;
    break;
  }
  void viaObjects;
  // JSX 밖: 타입 주석·형제 키로 판정
  let p: ts.Node | undefined = obj.parent;
  for (let i = 0; p && i < 6; i++, p = p.parent) {
    const t = (p as any).type as ts.TypeNode | undefined;
    if (t && /CSSProperties|CSS\b/.test(t.getText())) return '가';
    if (ts.isFunctionLike(p) && p.type && /CSSProperties/.test(p.type.getText())) return '가';
    if (ts.isCallExpression(p) && /ImageResponse/.test(p.expression.getText())) return '나';
  }
  let hints = 0;
  for (const pr of obj.properties) {
    const nm = pr.name && (ts.isIdentifier(pr.name) || ts.isStringLiteral(pr.name)) ? pr.name.text : '';
    if (CSS_HINT.has(nm)) hints++;
  }
  if (hints >= 2) return '가';
  return '?';
}

export function censusFile(abs: string): { items: Item[]; spacing: number } {
  const f = rel(abs);
  const text = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, abs.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const screen = screenOf(f);
  const bucket = bucketOf(screen);
  const ex = isExempt(f) ?? undefined;
  const items: Item[] = [];
  let spacing = 0;
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const push = (p: string, node: ts.Node, leaf: number | string | null, raw: string, form: Item['form'], srcKind: Item['src']) => {
    const nv = leaf == null ? { v: null, unit: 'expr' as const } : normalize(p, leaf);
    items.push({ f, l: line(node), p, raw, ...nv, form, src: srcKind, screen, bucket, ...(ex ? { exempt: ex } : {}) });
  };

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      const name = node.name.text;
      if (PROPSET.has(name) && ts.isObjectLiteralExpression(node.parent)) {
        const form = formOf(node.parent);
        for (const lf of leaves(node.initializer, sf)) push(name, lf.node, lf.leaf, lf.text, form, 'inline');
      } else if (SPACING.test(name) && ts.isObjectLiteralExpression(node.parent)) {
        const init = node.initializer;
        if (ts.isNumericLiteral(init) || ts.isStringLiteral(init)) spacing++;
      }
    } else if (ts.isJsxAttribute(node) && PROPSET.has(node.name.getText())) {
      const name = node.name.getText();
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) push(name, init, init.text, init.getText(sf), '나', 'jsxattr');
      else if (init && ts.isJsxExpression(init) && init.expression)
        for (const lf of leaves(init.expression, sf)) push(name, lf.node, lf.leaf, lf.text, '나', 'jsxattr');
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      twScan((node as any).text as string, node);
    }
    ts.forEachChild(node, visit);
  };

  const TW: Array<[RegExp, string]> = [
    [/(?<![\w\-\[])((?:[a-z0-9-]+:)*)text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w\-])/g, 'fontSize'],
    [/(?<![\w\-\[])((?:[a-z0-9-]+:)*)text-\[([^\]\s]+)\]/g, 'fontSize'],
    [/(?<![\w\-\[])((?:[a-z0-9-]+:)*)font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])(?![\w\-])/g, 'fontWeight'],
    [/(?<![\w\-\[])((?:[a-z0-9-]+:)*)leading-(none|tight|snug|normal|relaxed|loose|\d+|\[[^\]\s]+\])(?![\w\-])/g, 'lineHeight'],
    [/(?<![\w\-\[])((?:[a-z0-9-]+:)*)tracking-(tighter|tight|normal|wide|wider|widest|\[[^\]\s]+\])(?![\w\-])/g, 'letterSpacing'],
  ];
  function twScan(s: string, node: ts.Node) {
    if (!/text-|font-|leading-|tracking-/.test(s)) return;
    for (const [re, p] of TW) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        const val = m[2];
        if (p === 'fontSize' && val.startsWith('[') === false && m[0].includes('text-[')) {
          // 임의값: 크기만(색·var(--text-*) 제외)
          if (!/^(\d|clamp|var\(--fs)/.test(val)) continue;
        }
        items.push({ f, l: line(node), p, raw: m[0], v: m[0].replace(/^(?:[a-z0-9-]+:)*/, ''), unit: 'kw', form: '가', src: 'tw', screen, bucket, ...(ex ? { exempt: ex } : {}) });
      }
    }
  }
  visit(sf);
  return { items, spacing };
}

const CSS_FILES = ['src/app/globals.css', 'src/app/styles/blog.css', 'src/app/styles/components.css', 'src/app/styles/responsive.css', 'src/app/styles/screens.css'];
const CSS_PROPS: Record<string, string> = { 'font-size': 'fontSize', 'font-weight': 'fontWeight', 'line-height': 'lineHeight', 'letter-spacing': 'letterSpacing', 'text-align': 'textAlign' };

export function censusCss(): Item[] {
  const items: Item[] = [];
  for (const f of CSS_FILES) {
    const root = postcss.parse(readFileSync(join(ROOT, f), 'utf8'));
    const screen = f.endsWith('screens.css') ? 'css:screens' : f.endsWith('blog.css') ? 'css:blog' : 'css:shared';
    const bucket = f.endsWith('screens.css') ? 'css-screen' : f.endsWith('blog.css') ? 'T4-4' : 'T4-5';
    root.walkDecls((d) => {
      const p = CSS_PROPS[d.prop];
      if (!p) return;
      const sel = (d.parent as any)?.selector ?? '';
      const guard = /\[style\*=|\.text-\\\[|\.text-xs/.test(sel);
      const val = d.value.replace(/\s*!important/, '');
      const nv = normalize(p, val);
      items.push({ f, l: d.source?.start?.line ?? 0, p, raw: d.value, ...nv, form: '가', src: 'css', screen, bucket, ...(guard ? { guard } : {}), sel: sel.slice(0, 120) });
    });
  }
  return items;
}

export function runCensus() {
  const files = walk(join(ROOT, 'src'));
  const items: Item[] = [];
  let spacing = 0;
  for (const abs of files) {
    const r = censusFile(abs);
    items.push(...r.items);
    spacing += r.spacing;
  }
  items.push(...censusCss());
  return { items, spacing, files: files.length };
}

/* ── 요약 ───────────────────────────────────────────────────────────── */
function count<T>(xs: T[], key: (x: T) => string) {
  const m: Record<string, number> = {};
  for (const x of xs) { const k = key(x); m[k] = (m[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
}

export function summarize(items: Item[], spacing: number) {
  const code = items.filter((i) => i.src === 'inline' || i.src === 'jsxattr');
  const screenCode = code.filter((i) => !i.exempt);
  const val = (i: Item) => (i.v == null ? `expr` : `${i.v}${i.unit === 'px' || i.unit === 'em' || i.unit === 'rem' ? i.unit : ''}${i.unit === 'token' ? '(tok)' : ''}`);
  const byProp: Record<string, any> = {};
  for (const p of PROPS) {
    const xs = screenCode.filter((i) => i.p === p);
    byProp[p] = { total: xs.length, form: count(xs, (i) => i.form), values: count(xs, val) };
  }
  const fsLit = screenCode.filter((i) => i.p === 'fontSize' && i.unit === 'px');
  const fw800 = screenCode.filter((i) => i.p === 'fontWeight' && typeof i.v === 'number' && i.v >= 800);
  const smallNegLs = screenCode.filter((i) => i.p === 'letterSpacing' && typeof i.v === 'number' && i.v < 0);
  const tw = items.filter((i) => i.src === 'tw' && !i.exempt);
  const css = items.filter((i) => i.src === 'css');
  return {
    inline: {
      all: code.length,
      exempt: code.length - screenCode.length,
      screen: screenCode.length,
      byProp,
      fontSizeLiteralPx: fsLit.length,
      fontSizeDistinct: new Set(fsLit.map((i) => i.v)).size,
      fontWeight800plus: fw800.length,
      negativeLetterSpacing: smallNegLs.length,
      byBucket: count(screenCode.filter((i) => i.p === 'fontSize'), (i) => i.bucket),
      topFiles: Object.fromEntries(Object.entries(count(screenCode.filter((i) => i.p === 'fontSize'), (i) => i.f)).slice(0, 25)),
    },
    tailwind: { total: tw.length, byProp: count(tw, (i) => i.p), values: count(tw, (i) => String(i.v)), byBucket: count(tw, (i) => i.bucket) },
    css: { total: css.length, guard: css.filter((i) => i.guard).length, byFile: count(css, (i) => i.f), fontSizeValues: count(css.filter((i) => i.p === 'fontSize' && !i.guard), val) },
    spacingInlineLiterals: spacing,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : 'docs/ty/census_20260918.json';
  const { items, spacing, files } = runCensus();
  const summary = summarize(items, spacing);
  const head = (() => { try { return require('node:child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return '?'; } })();
  mkdirSync(dirname(join(ROOT, out)), { recursive: true });
  writeFileSync(join(ROOT, out), JSON.stringify({ generatedAt: new Date().toISOString(), head, files, summary, items }, null, 0));
  if (!args.includes('--quiet')) console.log(JSON.stringify({ head, files, ...summary }, null, 2));
}
