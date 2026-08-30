/**
 * 헤더 검색 오버레이 «실측» 자 — 눈 검사 결함 1호(2026-08-30).
 *
 * ⚠️ 자를 「모달이 열렸는가」에 맞추지 «않는다». 그러면 이번 결함이 안 잡힌다 —
 *    open 상태도 맞았고 포커스도 입력창에 갔는데 그 입력창이 화면 «위 -54px» 에 있었다.
 *    그래서 이 자는 «좌표» 를 잰다: 입력창이 뷰포트 안인가, 그 중심점의 최상단 요소가
 *    자기 자신인가, 패널이 입력 «아래» 인가.
 *
 * 계약 6개 (전 폭 · 전 모드):
 *   ① 입력창이 뷰포트 안에서 실제로 보인다(elementFromPoint 로 확인)
 *   ② 포커스가 즉시 입력창에 있다
 *   ③ 패널 top ≥ 입력 bottom  — 패널이 입력 «아래» 에 붙는다
 *   ④ 패널 × 입력 겹침 0
 *   ⑤ 입력 top ≥ 헤더 bottom  — --kd-overlay-top 이 헤더 높이와 어긋나지 않았다
 *   ⑥ 가로 넘침 0
 *
 * 사용: npx tsx scripts/search-overlay-audit.ts https://kadeora.app [경로]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://kadeora.app';
const PATH = process.argv[3] ?? '/';
const WIDTHS = [390, 480, 700, 768, 1024, 1280];
const MODES = ['', 'font-small', 'font-large'];

let fails = 0;
let checks = 0;
function expect(where: string, cond: boolean, msg: string) {
  checks++;
  if (cond) return;
  fails++;
  console.log(`  ❌ ${where} — ${msg}`);
}

(async () => {
  const b = await chromium.launch();
  const detail: string[] = [];
  const grid: Record<string, Record<string, string>> = {};

  for (const w of WIDTHS) {
    grid[String(w)] = {};
    for (const mode of MODES) {
      const where = `${w}px/${mode || 'default'}`;
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
      const page = await ctx.newPage();
      // tsx(esbuild) 가 keepNames 로 __name 을 심는다 — 페이지 쪽에는 그 헬퍼가 없다.
      await page.addInitScript({ content: 'globalThis.__name = globalThis.__name || function (f) { return f; };' });
      await page.goto(BASE + PATH, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(1600);
      if (mode) {
        await page.evaluate((m) => document.documentElement.classList.add(m), mode);
        await page.waitForTimeout(300);
      }
      // 홈 모바일은 히어로가 보이는 동안 헤더 돋보기를 감춘다 → 스크롤해 드러낸다.
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(500);

      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('header [aria-label="검색 열기"]')) as HTMLElement[];
        const vis = btns.find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
        });
        if (!vis) return null;
        const r = vis.getBoundingClientRect();
        vis.click();
        return { tag: vis.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      });
      if (!clicked) {
        expect(where, false, '헤더 검색 트리거를 못 찾음');
        grid[String(w)][mode || 'default'] = '⛔';
        await ctx.close();
        continue;
      }
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const R = (el: Element | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) };
        };
        const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
        const input = document.querySelector('[role="dialog"] input[aria-label="검색어 입력"]') as HTMLElement | null;
        const chipsHead = Array.from(document.querySelectorAll('[role="dialog"] h3'))
          .find((h) => /인기 검색어|최근 검색|추천/.test((h as HTMLElement).innerText)) as HTMLElement | null;
        const panel = chipsHead?.parentElement ?? null;
        const header = document.querySelector('header');

        let hit = '-';
        let visible = false;
        if (input) {
          const r = input.getBoundingClientRect();
          const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.width > 0 && r.height > 0;
          const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
          const top = (cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) ? document.elementFromPoint(cx, cy) : null;
          hit = top ? `${top.tagName.toLowerCase()}${top.getAttribute('aria-label') ? `[${top.getAttribute('aria-label')}]` : ''}` : '(밖)';
          visible = inView && !!top && (top === input || input.contains(top) || top.contains(input));
        }
        const ae = document.activeElement as HTMLElement | null;
        let overlap: null | { x: number; y: number; w: number; h: number } = null;
        if (input && panel) {
          const a = input.getBoundingClientRect(), c = panel.getBoundingClientRect();
          const x1 = Math.max(a.left, c.left), y1 = Math.max(a.top, c.top);
          const x2 = Math.min(a.right, c.right), y2 = Math.min(a.bottom, c.bottom);
          if (x2 > x1 && y2 > y1) overlap = { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
        }
        // fixed 의 «기준 상자» 를 만드는 조상 — 이번 결함의 원인 축이다.
        const chain: string[] = [];
        let p: HTMLElement | null = dlg ? (dlg.parentElement as HTMLElement) : null;
        while (p && p !== document.documentElement) {
          const cs = getComputedStyle(p);
          const why: string[] = [];
          if (cs.transform !== 'none') why.push('transform');
          if (cs.filter !== 'none') why.push(`filter:${cs.filter}`);
          const bf = (cs as unknown as { backdropFilter?: string }).backdropFilter;
          if (bf && bf !== 'none') why.push(`backdrop-filter:${bf}`);
          if (cs.perspective !== 'none') why.push('perspective');
          if (cs.contain && /paint|layout|strict|content/.test(cs.contain)) why.push(`contain:${cs.contain}`);
          if (cs.willChange && cs.willChange !== 'auto') why.push(`will-change:${cs.willChange}`);
          if (why.length) chain.push(`${p.tagName.toLowerCase()} → ${why.join(' ')}`);
          p = p.parentElement;
        }
        return {
          viewport: { w: innerWidth, h: innerHeight },
          dialog: R(dlg), dlgParent: dlg?.parentElement?.tagName.toLowerCase() ?? '-',
          input: R(input), inputVisible: visible, hit,
          focusIsInput: !!input && ae === input,
          focused: ae ? `${ae.tagName.toLowerCase()}${ae.getAttribute('aria-label') ? `[${ae.getAttribute('aria-label')}]` : ''}` : '(none)',
          panel: R(panel), panelLabel: chipsHead?.innerText.trim() ?? null, overlap,
          header: R(header),
          overlayTopVar: getComputedStyle(document.documentElement).getPropertyValue('--kd-overlay-top').trim(),
          causes: chain,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(where, m.inputVisible, `입력창이 안 보인다 — rect ${m.input ? `y ${m.input.y}..${m.input.b}` : '없음'} · 중심점 ${m.hit}`);
      expect(where, m.focusIsInput, `포커스가 입력창이 아니다 — ${m.focused}`);
      expect(where, !!m.input && !!m.panel && m.panel.y >= m.input.b, `패널이 입력 아래가 아니다 — 입력 bottom ${m.input?.b} · 패널 top ${m.panel?.y}`);
      expect(where, !m.overlap, `패널이 입력을 덮는다 — 겹침 ${m.overlap ? `${m.overlap.w}×${m.overlap.h} @(${m.overlap.x},${m.overlap.y})` : ''}`);
      expect(where, !!m.input && !!m.header && m.input.y >= m.header.b, `입력창이 헤더를 파고든다 — 헤더 bottom ${m.header?.b} · 입력 top ${m.input?.y} (--kd-overlay-top ${m.overlayTopVar})`);
      expect(where, m.overflow === 0, `가로 넘침 ${m.overflow}px`);

      grid[String(w)][mode || 'default'] = m.inputVisible && m.focusIsInput && !m.overlap ? '✅' : '❌';
      detail.push(
        `${where.padEnd(18)} 트리거 ${clicked.w}×${clicked.h} @${clicked.y} | dialog 부모 <${m.dlgParent}> ${m.dialog ? `${m.dialog.w}×${m.dialog.h}` : '-'}` +
        ` | 입력 (${m.input?.x},${m.input?.y}) ${m.input?.w}×${m.input?.h} ${m.inputVisible ? '보임' : '안보임'}` +
        ` | 패널 top ${m.panel?.y} «${m.panelLabel ?? '-'}» | 헤더 h ${m.header?.h} | 기준상자 ${m.causes.length ? m.causes.join(',') : '뷰포트'}`,
      );

      if (!mode) await page.screenshot({ path: `.audit/search-overlay-${w}.png` });
      await ctx.close();
    }
  }
  await b.close();

  console.log('\n■ 상세 실측');
  for (const d of detail) console.log('  ' + d);
  console.log('\n■ 6폭 × 3모드 — 돋보기 클릭 상태');
  console.log('        default    font-small  font-large');
  for (const w of WIDTHS) {
    const g = grid[String(w)];
    console.log(`${String(w).padStart(5)}px  ${(g.default ?? '-').padEnd(10)} ${(g['font-small'] ?? '-').padEnd(11)} ${g['font-large'] ?? '-'}`);
  }
  console.log(`\n■ 검사 ${checks} / 실패 ${fails}`);
  if (fails) { console.log('❌ 검색 오버레이 게이트 실패'); process.exit(1); }
  console.log('✅ 검색 오버레이 게이트 통과');
})();
