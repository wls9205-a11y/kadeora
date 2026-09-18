/**
 * TY-3 CSS codemod — styles 의 리터럴 타이포 선언을 사다리로. 매핑은 codemod.ts 와 같은 shared.ts 정의.
 *
 *   npx tsx tools/ty-audit/css-codemod.ts src/app/styles/blog.css [--dry]
 *
 * CSS 선언은 인라인 가드에 안 걸리므로 «명목값 = 렌더값» 이다(반픽셀만 반올림).
 * 건너뛰는 규칙(의도된 고정값):
 *   · 가드 규칙([style*=] · .text-\[)            — 퇴역은 따로 판정한다
 *   · html.font-large / html.font-small 선택자   — 사용자가 고른 모드의 명시값
 *   · input · select · textarea · .kd-input      — iOS 16px 하한
 */
import postcss, { type Rule, type Declaration } from 'postcss';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, FS_STEPS, snapFs, FW_TOKEN, snapLh, tyLetterSpacing } from './shared';

const SKIP_SEL = /\[style\*=|\.text-\\\[|html\.font-(large|small)|\binput\b|\bselect\b|\btextarea\b|\.kd-input/;
const desk = (t: string) => FS_STEPS.find((s) => s.token === t)?.desktop ?? null;

/** 모바일 전용 미디어 블록(max-width ≤ 767.98) 안인가 — 그 안의 값은 «모바일 사다리» 로 스냅해야 한다.
 *  (blog.css 모바일 p 15px 를 데스크탑 기준으로 스냅하면 --fs-xs = 모바일 13 이 돼 본문이 −2 떨어진다.) */
function inMobileMedia(n: any): boolean {
  for (let p = n.parent; p; p = p.parent) {
    if (p.type === 'atrule' && p.name === 'media') {
      const m = String(p.params).match(/max-width:\s*(\d+(?:\.\d+)?)px/);
      if (m && +m[1] < 768) return true;
    }
  }
  return false;
}
/** 모바일 값 기준 최근접(동률 아래) · 제목대(≥22) 2px 대역 밖은 null. */
function snapFsMobile(px: number): string | null {
  if (px > 34) return null;
  let best = FS_STEPS[0];
  for (const s of FS_STEPS) if (Math.abs(s.mobile - px) < Math.abs(best.mobile - px)) best = s;
  if (px >= 22 && Math.abs(best.mobile - px) > 2) return null;
  return best.token;
}

export function transformCss(file: string, dry = false) {
  const abs = join(ROOT, file);
  const root = postcss.parse(readFileSync(abs, 'utf8'));
  const stat: Record<string, number> = {};
  const bump = (k: string) => (stat[k] = (stat[k] ?? 0) + 1);
  const ledger: Array<{ f: string; l: number; raw: string; note: string }> = [];

  root.walkRules((rule: Rule) => {
    if (SKIP_SEL.test(rule.selector)) return;
    const decls = rule.nodes.filter((n): n is Declaration => n.type === 'decl');
    const get = (p: string) => decls.find((d) => d.prop === p);
    const imp = (d: Declaration) => (d.important ? ' !important' : '');
    const val = (d: Declaration) => d.value.replace(/\s*!important\s*$/, '').trim();

    // 자간 판정용 — 치환 «전» 크기(px)
    const fsDecl = get('font-size');
    let fsPx: number | null = null;
    if (fsDecl) {
      const m = val(fsDecl).match(/^(\d*\.?\d+)px$/);
      const t = val(fsDecl).match(/^var\(--fs-([\w]+)/);
      fsPx = m ? Math.round(+m[1]) : t ? desk(t[1]) : null;
    }

    for (const d of decls) {
      const v = val(d);
      const line = d.source?.start?.line ?? 0;
      if (d.prop === 'font-size') {
        const m = v.match(/^(\d*\.?\d+)px$/);
        if (!m) continue;
        // 13px 는 지시서 §4 TY-3 명시 귀속(--fs-xs · 모바일 13 유지). 동률 아래(2xs) 규칙보다 우선.
        const px = Math.round(+m[1]);
        const tok = px === 13 ? 'xs' : inMobileMedia(d) ? snapFsMobile(px) : snapFs(px);
        if (!tok) { ledger.push({ f: file, l: line, raw: v, note: 'display' }); continue; }
        d.value = `var(--fs-${tok})${imp(d)}`;
        d.important = false;
        bump(`css fs ${m[1]}→${tok}`);
      } else if (d.prop === 'font-weight') {
        const n = /^\d+$/.test(v) ? +v : v === 'bold' ? 700 : v === 'normal' ? 400 : null;
        if (n == null) continue;
        const tok = FW_TOKEN[n >= 800 ? 700 : n];
        if (!tok) continue;
        d.value = `var(--fw-${tok})${imp(d)}`;
        d.important = false;
        bump(n >= 800 ? `css fw ${n}→num(cap)` : `css fw ${n}`);
      } else if (d.prop === 'line-height') {
        if (!/^\d*\.?\d+$/.test(v)) continue;
        const s = snapLh(+v);
        if (s !== +v) { d.value = `${s}${imp(d)}`; d.important = false; bump(`css lh ${v}→${s}`); }
      } else if (d.prop === 'letter-spacing') {
        const m = v.match(/^(-?\d*\.?\d+)(px|em)?$/);
        if (!m || +m[1] === 0) continue;
        if (+m[1] < 0) {
          if (fsPx == null) { ledger.push({ f: file, l: line, raw: v, note: 'ls-unknown-size' }); continue; }
          const t = tyLetterSpacing(fsPx);
          d.value = `${t === 0 ? '0' : `${t}px`}${imp(d)}`;
          d.important = false;
          bump(`css ls neg→${t}`);
        } else {
          const eyebrow = /uppercase/.test(get('text-transform')?.value ?? '') || /mono/.test(get('font-family')?.value ?? '');
          if (eyebrow) { if (v !== '0.14em' && v !== '.14em') { d.value = `0.14em${imp(d)}`; d.important = false; bump('css ls pos→.14em'); } }
          else { d.value = `0${imp(d)}`; d.important = false; ledger.push({ f: file, l: line, raw: v, note: 'ls-positive-zeroed' }); bump('css ls pos→0'); }
        }
      }
    }
  });
  const out = root.toString();
  if (!dry) writeFileSync(abs, out);
  return { stat, ledger };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const all: Record<string, number> = {};
  const led: any[] = [];
  for (const f of args.filter((a) => !a.startsWith('--'))) {
    const r = transformCss(f, dry);
    for (const [k, v] of Object.entries(r.stat)) all[k] = (all[k] ?? 0) + v;
    led.push(...r.ledger);
  }
  if (!dry && led.length) {
    const p = join(ROOT, 'docs/ty/ledger.json');
    const L = JSON.parse(readFileSync(p, 'utf8'));
    const files = new Set(args);
    L.entries['css'] = [...(L.entries['css'] ?? []).filter((e: any) => !files.has(e.f)), ...led];
    writeFileSync(p, JSON.stringify(L, null, 1));
  }
  console.log(JSON.stringify({ dry, stat: Object.fromEntries(Object.entries(all).sort()), ledger: led.length }, null, 1));
}
