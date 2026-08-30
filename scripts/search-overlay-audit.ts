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
 *   ⑤ 입력 top ≥ «뷰포트 고정» 상단 크롬의 bottom — --kd-overlay-top 이 그 띠와 어긋나지 않았다
 *      ⚠️ 첫판에 이 계약을 「헤더 bottom」으로 썼다가 자를 고쳤다. 헤더는 sticky 라
 *         스크롤에 따라 top 이 52↔0 로 «움직인다» — 스크롤 900 에서만 참인 계약이었다.
 *         고정된 것(노란 띠 fixed 0..52)만이 스크롤과 무관한 기준이다.
 *   ⑥ 가로 넘침 0
 *   ⑦ **트리거가 실제로 눌리는가** — `elementFromPoint(돋보기 중심) === 돋보기`.
 *      결함 2호(띠 z110 이 헤더 z100 을 덮어 스크롤 뒤 헤더가 통째로 죽던 것)의 잠금이다.
 *      ⚠️ 스크롤 0 과 900 «두 자리» 에서 잰다 — 헤더는 sticky 라 한 자리만 재면 안 보인다.
 *
 * 사용: npx tsx scripts/search-overlay-audit.ts https://kadeora.app [경로]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://kadeora.app';
// 띠 «유»(홈) · 띠 «무»(현장 상세) 각 1곳. 조건이 값(--kd-banner-h)에 흡수되는지 두 쪽에서 본다.
const PATHS = process.argv.length > 3
  ? process.argv.slice(3)
  : ['/', '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0'];

/* ⚠️ Git Bash(MSYS)는 `/stock` 같은 «슬래시로 시작하는 인자» 를 Windows 경로로
      바꿔 버린다 — 실측 2026-08-30: `/stock` → `C:/Program Files/Git/stock` 이 되어
      첫 실행이 ERR_NAME_NOT_RESOLVED 로 죽었다. 앞에 MSYS_NO_PATHCONV=1 을 붙인다.
      여기서 «죽기 전에» 알려 준다 — 다음 사람이 자를 의심하기 전에 환경을 보게. */
for (const p of PATHS) {
  if (/^[A-Za-z]:[\\/]/.test(p) || p.includes('Program Files')) {
    console.error(
      `⛔ 경로 인자가 «오변환» 됐다: ${p}\n` +
      `   Git Bash 의 MSYS 경로 변환이다. 이렇게 다시 실행할 것:\n` +
      `   MSYS_NO_PATHCONV=1 npx tsx scripts/search-overlay-audit.ts ${BASE} /경로`,
    );
    process.exit(2);
  }
}
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
  const grids: Array<{ path: string; grid: Record<string, Record<string, string>> }> = [];

  for (const PATH of PATHS) {
  const grid: Record<string, Record<string, string>> = {};
  grids.push({ path: decodeURIComponent(PATH), grid });
  detail.push(`
── ${decodeURIComponent(PATH)} ──`);
  for (const w of WIDTHS) {
    grid[String(w)] = {};
    for (const mode of MODES) {
      const where = `${decodeURIComponent(PATH)} ${w}px/${mode || 'default'}`;
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

      // ⚠️ Navigation 은 ssr:false — 헤더가 하이드레이션 뒤에 생긴다. 고정 대기로 재면 깜빡인다.
      await page.waitForSelector('header [aria-label="검색 열기"]', { state: 'attached', timeout: 8000 }).catch(() => {});
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('header [aria-label="검색 열기"]')) as HTMLElement[];
        const vis = btns.find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
        });
        if (!vis) return null;
        const r = vis.getBoundingClientRect();
        /* 계약 ⑦ — «누를 수 있는가». 결함 2호(띠 z110 이 헤더 z100 을 덮던 것)의 잠금.
         * ⚠️ el.click() 은 덮여 있어도 «성공한다» — 그래서 클릭 성공으로 재면 안 잡힌다.
         *    사람의 손가락이 닿는 곳을 재려면 elementFromPoint 여야 한다. */
        const at = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
        const reachable = !!at && (at === vis || vis.contains(at));
        const cover = at ? `${at.tagName.toLowerCase()}${at.getAttribute('aria-label') ? `[${(at.getAttribute('aria-label') || '').slice(0, 24)}]` : ''}` : '(없음)';
        const header = document.querySelector('header')!.getBoundingClientRect();
        const cs = getComputedStyle(document.documentElement);
        vis.click();
        return {
          tag: vis.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          reachable, cover,
          headerBox: [Math.round(header.top), Math.round(header.bottom)] as [number, number],
          bannerH: cs.getPropertyValue('--kd-banner-h').trim(),
          headerTop: cs.getPropertyValue('--kd-header-top').trim(),
          headerBottom: cs.getPropertyValue('--kd-header-bottom').trim(),
          overlayTop: cs.getPropertyValue('--kd-overlay-top').trim(),
        };
      });
      if (!clicked) {
        expect(where, false, '헤더 검색 트리거를 못 찾음');
        grid[String(w)][mode || 'default'] = '⛔';
        await ctx.close();
        continue;
      }
      await page.waitForSelector('[role="dialog"] input[aria-label="검색어 입력"]', { timeout: 5000 }).catch(() => {});
      // 「인기 검색어」 칩은 trending 응답 뒤에 붙는다 — 계약 ③④ 가 그 패널을 쓰므로 기다린다.
      await page.waitForFunction(
        () => [...document.querySelectorAll('[role="dialog"] h3')].some((h) => /인기 검색어|최근 검색/.test((h as HTMLElement).innerText)),
        undefined,
        { timeout: 4000 },
      ).catch(() => {});
      await page.waitForTimeout(200);

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
          // «뷰포트에 고정» 되어 상단(y=0)에 걸려 있는 것들의 최대 bottom.
          // 스크롤과 무관한 유일한 기준선이다 — sticky 헤더는 여기 안 넣는다.
          // ⚠️ 오버레이 «자신» 을 빼지 않으면 자기 bottom(900)이 기준선이 되어 항상 실패한다.
          //    첫판에 그렇게 재서 18건이 빨간불이었다 — 자가 자기를 재고 있었다.
          fixedTopBottom: Array.from(document.body.querySelectorAll('*')).reduce((mx, el) => {
            if (dlg && (el === dlg || dlg.contains(el))) return mx;
            if (getComputedStyle(el).position !== 'fixed') return mx;
            const r = el.getBoundingClientRect();
            if (r.height === 0 || r.top > 0 || r.bottom <= 0) return mx;
            return Math.max(mx, Math.round(r.bottom));
          }, 0),
          overlayTopVar: getComputedStyle(document.documentElement).getPropertyValue('--kd-overlay-top').trim(),
          causes: chain,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(where, m.inputVisible, `입력창이 안 보인다 — rect ${m.input ? `y ${m.input.y}..${m.input.b}` : '없음'} · 중심점 ${m.hit}`);
      expect(where, m.focusIsInput, `포커스가 입력창이 아니다 — ${m.focused}`);
      expect(where, !!m.input && !!m.panel && m.panel.y >= m.input.b, `패널이 입력 아래가 아니다 — 입력 bottom ${m.input?.b} · 패널 top ${m.panel?.y}`);
      expect(where, !m.overlap, `패널이 입력을 덮는다 — 겹침 ${m.overlap ? `${m.overlap.w}×${m.overlap.h} @(${m.overlap.x},${m.overlap.y})` : ''}`);
      expect(where, !!m.input && m.input.y >= m.fixedTopBottom, `입력창이 상단 고정 띠 밑으로 들어간다 — 고정 크롬 bottom ${m.fixedTopBottom} · 입력 top ${m.input?.y} (--kd-overlay-top ${m.overlayTopVar})`);
      expect(where, m.overflow === 0, `가로 넘침 ${m.overflow}px`);
      expect(where, clicked.reachable, `스크롤900 — 돋보기가 덮여 있다(누르면 «${clicked.cover}» 가 받는다) · 헤더 ${clicked.headerBox.join('..')}`);

      grid[String(w)][mode || 'default'] = m.inputVisible && m.focusIsInput && !m.overlap ? '✅' : '❌';
      detail.push(
        `${`${w}px/${mode || 'default'}`.padEnd(18)} 트리거 ${clicked.w}×${clicked.h} @${clicked.y} ${clicked.reachable ? '닿음' : '덮임'} | 띠 ${clicked.bannerH} · 헤더top ${clicked.headerTop} · 헤더bottom ${clicked.headerBottom} · 오버레이top ${clicked.overlayTop}` +
        ` | 입력 (${m.input?.x},${m.input?.y}) ${m.input?.w}×${m.input?.h} ${m.inputVisible ? '보임' : '안보임'}` +
        ` | 패널 top ${m.panel?.y} «${m.panelLabel ?? '-'}» | 헤더 ${m.header?.y}..${m.header?.b} · 고정띠 bottom ${m.fixedTopBottom} | 기준상자 ${m.causes.length ? m.causes.join(',') : '뷰포트'}`,
      );

      if (!mode) await page.screenshot({ path: `.audit/search-overlay-${PATH === '/' ? 'home' : 'detail'}-${w}.png` });

      /* 스크롤 0 재측 — 헤더는 sticky 라 스크롤에 따라 «자리가 바뀐다»(52..97 ↔ 0..45).
       * 오버레이가 그 움직임을 따라가면 안 된다. 두 자리에서 «같은 값» 이 나와야 한다.
       * ⚠️ 한 스크롤 위치만 재면 이 성질을 못 본다 — D 층에서 상세를 한 경로만 재다
       *    21건을 놓친 것과 같은 형태다. */
      if (!mode) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
        const top0 = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('header [aria-label="검색 열기"]')].find((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
          }) as HTMLElement | undefined;
          if (!btn) return null;
          const r = btn.getBoundingClientRect();
          const at = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
          const header = document.querySelector('header')!.getBoundingClientRect();
          btn.click();
          return {
            reachable: !!at && (at === btn || btn.contains(at)),
            cover: at ? at.tagName.toLowerCase() : '(없음)',
            headerBox: [Math.round(header.top), Math.round(header.bottom)] as [number, number],
          };
        });
        if (top0) {
          await page.waitForTimeout(450);
          const t = await page.evaluate(() => {
            const input = document.querySelector('[role="dialog"] input[aria-label="검색어 입력"]') as HTMLElement | null;
            if (!input) return null;
            const r = input.getBoundingClientRect();
            const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
            const top = document.elementFromPoint(cx, cy);
            const header = document.querySelector('header')!.getBoundingClientRect();
            return {
              y: Math.round(r.top), b: Math.round(r.bottom),
              onTop: !!top && (top === input || input.contains(top)),
              header: [Math.round(header.top), Math.round(header.bottom)],
            };
          });
          expect(`${w}px/스크롤0`, top0.reachable, `스크롤0 — 돋보기가 덮여 있다(«${top0.cover}») · 헤더 ${top0.headerBox.join('..')}`);
          expect(`${w}px/스크롤0`, !!t && t.onTop, '스크롤 0 에서 입력창이 최상단이 아니다');
          expect(`${w}px/스크롤0`, !!t && t.y === m.input?.y,
            `스크롤에 따라 오버레이가 움직인다 — 스크롤900 y ${m.input?.y} · 스크롤0 y ${t?.y}`);
          detail.push(`${(w + 'px/스크롤0').padEnd(18)} 입력 y ${t?.y}..${t?.b} (스크롤900 과 ${t?.y === m.input?.y ? '같음' : '다름'}) · 헤더 ${t?.header.join('..')}`);
        }
      }

      /* 히어로 경로 — 「홈 히어로 큰 검색창과 헤더 검색은 같은 계층」을 «좌표로» 증명한다.
       * 로직이 갈리면 여기서 다른 rect 가 나온다. 같은 컴포넌트를 쓰는지 «주장» 하지 않고 잰다. */
      if (!mode) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        const hero = await page.evaluate(() => {
          const el = document.querySelector('.kd-hero-search') as HTMLElement | null;
          if (!el) return null;
          el.click();
          return true;
        });
        if (hero) {
          await page.waitForTimeout(450);
          const h = await page.evaluate(() => {
            const input = document.querySelector('[role="dialog"] input[aria-label="검색어 입력"]') as HTMLElement | null;
            if (!input) return null;
            const r = input.getBoundingClientRect();
            return {
              y: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width),
              parent: document.querySelector('[role="dialog"]')?.parentElement?.tagName.toLowerCase() ?? '-',
              focused: document.activeElement === input,
            };
          });
          expect(`${w}px/히어로`, !!h && h.y === m.input?.y && h.w === m.input?.w,
            `히어로 검색이 헤더 검색과 다른 자리에 뜬다 — 헤더 (y ${m.input?.y}, w ${m.input?.w}) · 히어로 (y ${h?.y}, w ${h?.w})`);
          expect(`${w}px/히어로`, !!h && h.focused, '히어로 검색 — 입력창 포커스 아님');
          detail.push(`${(w + 'px/히어로').padEnd(18)} 입력 y ${h?.y}..${h?.b} w ${h?.w} · dialog 부모 <${h?.parent}> · 포커스 ${h?.focused ? '✅' : '❌'}`);
        } else {
          detail.push(`${(w + 'px/히어로').padEnd(18)} (.kd-hero-search 없음 — 홈이 아닌 경로)`);
        }
      }
      await ctx.close();
    }
  }
  }
  await b.close();

  console.log('\n■ 상세 실측');
  for (const d of detail) console.log('  ' + d);
  for (const { path, grid } of grids) {
    console.log(`
■ 6폭 × 3모드 — 돋보기 클릭 상태 · ${path}`);
    console.log('        default    font-small  font-large');
    for (const w of WIDTHS) {
      const g = grid[String(w)];
      console.log(`${String(w).padStart(5)}px  ${(g.default ?? '-').padEnd(10)} ${(g['font-small'] ?? '-').padEnd(11)} ${g['font-large'] ?? '-'}`);
    }
  }
  console.log(`\n■ 검사 ${checks} / 실패 ${fails}`);
  if (fails) { console.log('❌ 검색 오버레이 게이트 실패'); process.exit(1); }
  console.log('✅ 검색 오버레이 게이트 통과');
})();
