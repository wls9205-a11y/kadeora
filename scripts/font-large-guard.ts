/**
 * font-large 방어 규칙 게이트 — 토큰 스냅샷이 «못 보는» 영역.
 *
 * 왜 필요한가
 * -----------
 * `scripts/token-snapshot.ts` 는 커스텀 속성의 계산값만 본다. 그런데 접근성 큰글씨
 * 모드에는 토큰이 «아닌» 방어 규칙이 두 개 붙어 있다:
 *
 *   @media (max-width: 767.98px) {
 *     html.font-large [style*="gridTemplateColumns"] > * { min-width:0; word-break:keep-all; … }
 *     html.font-large [style*="flexWrap"]              { gap: 4px; }
 *   }
 *
 * 이 규칙이 죽으면 큰글씨 + 좁은 화면에서 «그리드 칸이 내용을 밀어내 가로 스크롤이
 * 생기거나 탭·뱃지가 겹친다». 그런데 커스텀 속성 값은 «하나도 변하지 않는다» —
 * 스냅샷은 초록이고 화면은 깨진다. 그래서 이 게이트를 따로 둔다.
 *
 * 대상 규모(실측 2026-08-29): 인라인 gridTemplateColumns 196곳 / flexWrap 175곳.
 * 앱 거의 전역이라, 규칙이 죽으면 한 화면이 아니라 여러 화면이 같이 깨진다.
 *
 * 사용: npx tsx scripts/font-large-guard.ts <BASE_URL> [경로...]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'https://kadeora.app').replace(/\/$/, '');
const PATHS = process.argv.slice(3).length ? process.argv.slice(3) : ['/', '/apt', '/blog'];

let fails = 0;
const ok = (w: string, m: string) => console.log(`  ✅ ${w} — ${m}`);
const bad = (w: string, m: string) => { fails++; console.log(`  ❌ ${w} — ${m}`); };

(async () => {
  const browser = await chromium.launch();
  // 390px = 규칙이 «걸려야 하는» 폭(≤767.98) · 1024px = «걸리면 안 되는» 폭.
  for (const width of [390, 1024]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const page = await ctx.newPage();
    for (const path of PATHS) {
      const where = `${width}px ${path}`;
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
      const r = await page.evaluate(() => {
        document.documentElement.className = 'font-large';
        // ⚠️ 2026-08-29 실측 — CSS 는 [style*="gridTemplateColumns"] 로 겨냥하는데
        //    React 는 인라인 스타일을 «kebab-case» 로 직렬화한다(grid-template-columns).
        //    그래서 두 방어 규칙은 «한 번도 매치된 적이 없다». 양쪽을 다 세어 기록한다.
        const camelGrid = document.querySelectorAll('[style*="gridTemplateColumns"]').length;
        const camelWrap = document.querySelectorAll('[style*="flexWrap"]').length;
        // 인라인 grid-template-columns 를 가진 첫 요소의 «자식» 하나를 잰다.
        const grids = Array.from(document.querySelectorAll('[style*="grid-template-columns"]'));
        let gridChild: { minWidth: string; wordBreak: string } | null = null;
        for (const g of grids) {
          const c = g.firstElementChild;
          if (c) {
            const cs = getComputedStyle(c);
            gridChild = { minWidth: cs.minWidth, wordBreak: cs.wordBreak };
            break;
          }
        }
        const wraps = Array.from(document.querySelectorAll('[style*="flex-wrap"]'));
        const wrapGap = wraps.length ? getComputedStyle(wraps[0]).gap : null;
        // 가로 스크롤은 「규칙이 죽었다」의 «증상» 이다. 원인과 증상을 같이 잰다.
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return { grids: grids.length, gridChild, wraps: wraps.length, wrapGap, overflow, camelGrid, camelWrap };
      });

      // ⛔ 「방어 규칙이 걸렸는가」를 «단언하지 않는다» — 그 규칙은 죽어 있다(아래 기록 참조).
      //    죽은 규칙이 적용되기를 기대하는 단언은 «버그를 정상으로 고정» 시킨다.
      //    지금 이 게이트가 지키는 것은 «증상»(가로 넘침)이다.
      if (r.camelGrid !== 0 || r.camelWrap !== 0) {
        bad(where, `camelCase 선택자가 매치됐다(grid ${r.camelGrid} · wrap ${r.camelWrap}) — 전제가 바뀌었다. 규칙을 다시 판정할 것`);
      } else if (r.grids > 0 || r.wraps > 0) {
        console.log(`  ·  ${where} — 죽은 방어 규칙 확인: camel 0 / 실제 DOM grid ${r.grids} · flexWrap ${r.wraps} (kebab-case)`);
      }
      // 가로 스크롤 — 큰글씨에서 가장 먼저 터지는 증상.
      if (r.overflow > 2) bad(where, `font-large 가로 넘침 ${r.overflow}px`);
      else ok(where, `font-large 가로 넘침 없음 (${r.overflow}px)`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${fails === 0 ? '✅ 전부 통과' : `❌ 실패 ${fails}건`}`);
  process.exit(fails === 0 ? 0 : 1);
})();
