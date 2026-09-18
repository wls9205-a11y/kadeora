/**
 * TY-1(b) 동적 자 — 10화면 × 3뷰포트 게스트 렌더의 computed 타이포 census. «관측 지표» 이지 게이트가 아니다.
 *
 *   npx tsx tools/ty-audit/dom-census.ts --label before [--base http://localhost:3000] [--only /daily]
 *   npx tsx tools/ty-audit/dom-census.ts --label t4-1 --compare before      # 13px 안전판 판정
 *
 * 세는 것:
 *   · «직속 텍스트가 있는 요소» 마다 computed fontSize·fontWeight·lineHeight·letterSpacing·textAlign·fontFamily(첫 가족)
 *     → 화면별 고유 조합 수 · 고유 크기 수 (요약은 docs/ty/dom-census_<label>.json)
 *   · flex/grid 컨테이너의 gap · 요소 padding 고유값 수(섹션 간격 관측)
 *   · 안전판 원자료(노드 키 · 줄 수 · 가로 넘침) — TY_CACHE(기본 OS 임시) 에만 쓴다. 커밋하지 않는다.
 *
 * 뷰포트: 기존 playwright 2프로젝트(Desktop Chrome 1280 · iPhone 14=webkit 390) + 768 커스텀(chromium).
 * 안전판(--compare): chromium 두 폭(1280·768)에서 «같은 키» 노드의 신규 가로 넘침 · 신규 줄바꿈(줄 수 증가) = 0 이어야 한다.
 */
import { chromium, webkit, devices, type Browser, type BrowserContextOptions } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT } from './shared';

export const SCREENS: Array<{ key: string; path: string }> = [
  { key: 'home', path: '/' },
  { key: 'apt', path: '/apt' },
  { key: 'apt-id', path: '/apt/엄궁역-트라비스-하늘채' },
  { key: 'apt-complex', path: '/apt/complex/헬리오시티' },
  { key: 'daily', path: '/daily/부산' },
  { key: 'blog', path: '/blog' },
  { key: 'blog-slug', path: '/blog/gyeonggi-suwon-maekyogyeok-pellucid-consortium' },
  { key: 'stock', path: '/stock' },
  { key: 'stock-symbol', path: '/stock/475830' },
  { key: 'search', path: '/search?q=부산' },
  { key: 'toss-apt', path: '/apt?toss=1' },
];

type VP = { key: string; engine: 'chromium' | 'webkit'; opts: BrowserContextOptions };
export const VIEWPORTS: VP[] = [
  { key: 'desktop', engine: 'chromium', opts: { ...devices['Desktop Chrome'] } },
  { key: 'mobile', engine: 'webkit', opts: { ...devices['iPhone 14'] } },
  { key: 'w768', engine: 'chromium', opts: { viewport: { width: 768, height: 1024 } } },
];

type Node = { k: string; fs: string; fw: string; lh: string; ls: string; ta: string; ff: string; lines: number; h: number; ovf: boolean };

async function measure(browser: Browser, vp: VP, url: string) {
  const ctx = await browser.newContext(vp.opts);
  // tsx(esbuild keepNames) 가 evaluate 본문에 __name 헬퍼를 심는다 — 브라우저 쪽에 무해한 심을 둔다.
  await ctx.addInitScript('window.__name = (f) => f;');
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const out: any[] = [];
    const gaps: Record<string, number> = {};
    const pads: Record<string, number> = {};
    const seen = new Map<string, number>();
    const path = (el: Element) => {
      const parts: string[] = [];
      let e: Element | null = el;
      for (let i = 0; e && i < 6; i++, e = e.parentElement) {
        const cls = (e.getAttribute('class') || '').split(/\s+/).filter((c) => c && !/^(md|sm|lg|hover|dark):/.test(c)).slice(0, 2).join('.');
        parts.unshift(e.tagName.toLowerCase() + (cls ? '.' + cls : ''));
      }
      return parts.join('>');
    };
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if ((cs.display.includes('flex') || cs.display.includes('grid')) && cs.gap && cs.gap !== 'normal') gaps[cs.gap] = (gaps[cs.gap] ?? 0) + 1;
      if (cs.padding && cs.padding !== '0px') pads[cs.padding] = (pads[cs.padding] ?? 0) + 1;
      let txt = '';
      for (const c of Array.from(el.childNodes)) if (c.nodeType === 3) txt += c.textContent;
      txt = txt.trim();
      if (!txt) continue;
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const base = path(el) + '|' + txt.slice(0, 24);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const lhPx = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      const range = document.createRange();
      range.selectNodeContents(el);
      // 줄 수 = 텍스트 조각 top 을 반 줄 높이 단위로 묶은 군집 수. (flex 안의 텍스트 조각은 top 이 조금씩 달라
      // 서로 다른 top 을 그대로 세면 한 줄 알약이 «3줄» 로 잡힌다 — 2026-09-18 T4-3 오탐.)
      const tops = Array.from(range.getClientRects()).filter((q) => q.width > 0).map((q) => q.top).sort((a, b) => a - b);
      let lines = tops.length ? 1 : Math.max(1, Math.round(rect.height / lhPx));
      for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > lhPx * 0.5) lines++;
      out.push({
        k: base + '#' + n,
        fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, ta: cs.textAlign,
        ff: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        lines,
        h: Math.round(rect.height),
        ovf: (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1 && cs.overflowX !== 'visible',
      });
    }
    return { nodes: out, gaps, pads, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const status = page.url();
  await ctx.close();
  return { ...r, finalUrl: status };
}

function summarizeNodes(nodes: Node[]) {
  const combos = new Set(nodes.map((n) => [n.fs, n.fw, n.lh, n.ls, n.ta, n.ff].join('|')));
  const sizes: Record<string, number> = {};
  for (const n of nodes) sizes[n.fs] = (sizes[n.fs] ?? 0) + 1;
  return {
    textNodes: nodes.length,
    combos: combos.size,
    sizes: Object.keys(sizes).length,
    sizeHist: Object.fromEntries(Object.entries(sizes).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))),
    weights: new Set(nodes.map((n) => n.fw)).size,
    lineHeights: new Set(nodes.map((n) => n.lh)).size,
    letterSpacings: new Set(nodes.map((n) => n.ls)).size,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (k: string, d?: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const label = arg('--label', 'before')!;
  const base = arg('--base', 'http://localhost:3000')!.replace(/\/$/, '');
  const only = arg('--only');
  const compare = arg('--compare');
  const vpOnly = arg('--vp');
  const cache = process.env.TY_CACHE || join(tmpdir(), 'ty-audit-cache');
  mkdirSync(cache, { recursive: true });

  const screens = SCREENS.filter((s) => !only || only.split(',').some((o) => s.key === o || s.path.startsWith(o)));
  const vps = VIEWPORTS.filter((v) => !vpOnly || vpOnly.split(',').includes(v.key));
  const browsers: Record<string, Browser> = {};
  const summary: Record<string, any> = {};
  const safety: string[] = [];
  let safetyBad = 0;
  let bandOut = 0;

  for (const vp of vps) {
    browsers[vp.engine] ??= await (vp.engine === 'webkit' ? webkit : chromium).launch();
    for (const s of screens) {
      const id = `${s.key}@${vp.key}`;
      let r;
      try { r = await measure(browsers[vp.engine], vp, base + encodeURI(s.path)); }
      catch (e) { summary[id] = { error: String(e).slice(0, 200) }; console.log(`  ✗ ${id} — ${String(e).slice(0, 120)}`); continue; }
      const sum = { ...summarizeNodes(r.nodes), gaps: Object.keys(r.gaps).length, paddings: Object.keys(r.pads).length, pageOverflow: r.pageOverflow };
      summary[id] = sum;
      writeFileSync(join(cache, `${label}__${id.replace(/[^\w@-]/g, '_')}.json`), JSON.stringify(r.nodes));
      console.log(`  · ${id.padEnd(22)} nodes ${String(sum.textNodes).padStart(4)} · combos ${String(sum.combos).padStart(3)} · sizes ${String(sum.sizes).padStart(2)} · pageOvf ${sum.pageOverflow}`);

      if (compare && vp.engine === 'chromium') {
        const prevPath = join(cache, `${compare}__${id.replace(/[^\w@-]/g, '_')}.json`);
        if (!existsSync(prevPath)) { safety.push(`${id}: 기준선 없음`); continue; }
        const prev = new Map<string, Node>(JSON.parse(readFileSync(prevPath, 'utf8')).map((n: Node) => [n.k, n]));
        let matched = 0;
        const deltas: Record<string, number> = {};
        for (const n of r.nodes as Node[]) {
          const p = prev.get(n.k);
          if (!p) continue;
          matched++;
          const d = Math.round((parseFloat(n.fs) - parseFloat(p.fs)) * 10) / 10;
          if (d !== 0) deltas[d] = (deltas[d] ?? 0) + 1;
          if (Math.abs(d) > 2) { bandOut++; safety.push(`${id} ±2 대역 이탈 ${p.fs}→${n.fs}: ${n.k}`); }
          if (n.ovf && !p.ovf) { safetyBad++; safety.push(`${id} 신규 넘침: ${n.k} (${p.fs}→${n.fs})`); }
          // 신규 줄바꿈 = 줄 수 증가 «그리고» 높이 증가(2px 초과). 둘 다여야 실제로 한 줄이 더 생긴 것이다.
          if (n.lines > p.lines && (p.h == null || n.h - p.h > 2)) { safetyBad++; safety.push(`${id} 신규 줄바꿈 ${p.lines}→${n.lines}: ${n.k} (${p.fs}→${n.fs})`); }
        }
        safety.push(`${id}: 대조 ${matched}/${r.nodes.length} · 크기 델타 ${JSON.stringify(deltas)}`);
      }
    }
  }
  for (const b of Object.values(browsers)) await b.close();

  mkdirSync(join(ROOT, 'docs/ty'), { recursive: true });
  const outFile = join(ROOT, `docs/ty/dom-census_${label}.json`);
  const prevOut = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')).screens : {};
  writeFileSync(outFile, JSON.stringify({ label, base, at: new Date().toISOString(), screens: { ...prevOut, ...summary } }, null, 1));
  if (compare) {
    console.log(`\n13px 안전판 (${compare} → ${label}): 신규 넘침·줄바꿈 ${safetyBad}건`);
    for (const l of safety) console.log('  ' + l);
    writeFileSync(join(cache, `safety_${label}.txt`), safety.join('\n'));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
