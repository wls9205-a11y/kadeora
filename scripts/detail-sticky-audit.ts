/**
 * U-1b — 상세 상단 고정 스택 «실측».
 *
 * ⚠️ 점프바 높이와 `--rail-top` 은 «파일을 건너» 살아 있다. 자동으로 안 따라오므로
 *    칩 구성이 바뀔 때마다 이 자로 재고, 값이 어긋나면 «숫자가 아니라 원인» 을 고친다.
 *    (U-1a 에서 57→42 로 낮추며 레일이 15px 낮은 자리에 멈춘 회귀가 실제로 있었다.)
 */
import { chromium } from 'playwright';
const BASE = process.argv[2];
const PATH = process.argv[3] ?? '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0';
(async () => {
  const b = await chromium.launch();
  for (const w of [390, 768, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
    const page = await ctx.newPage();
    await page.goto(BASE + PATH, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 2400));
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const bar = document.querySelector('.kd-jumpbar') as HTMLElement | null;
      // ⚠️ 붙는 것은 «바깥 레일이 아니라» 안쪽 .kd-rail-sticky 다(H6-6 에서 이중 sticky 를 정리했다).
      //    바깥을 재면 position:static 이 나와 「안 붙는다」고 오독하게 된다 — 자를 대상에 맞춘다.
      const rail = document.querySelector('.kd-rail-sticky') as HTMLElement | null;
      const railBox = document.querySelector('.kd-detail-rail') as HTMLElement | null;
      const header = document.querySelector('header') as HTMLElement | null;
      const chips = bar ? Array.from(bar.querySelectorAll('a')).map((a) => (a as HTMLElement).innerText.trim()) : [];
      const cs = rail ? getComputedStyle(rail) : null;
      return {
        chips,
        barH: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
        barTop: bar ? Math.round(bar.getBoundingClientRect().top) : 0,
        headerH: header ? Math.round(header.getBoundingClientRect().height) : 0,
        railTopVar: railBox ? getComputedStyle(railBox).getPropertyValue('--rail-top').trim() : '(레일 없음)',
        railPos: cs ? cs.position : '-',
        railCssTop: cs ? cs.top : '-',
        railTop: rail ? Math.round(rail.getBoundingClientRect().top) : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const expected = r.headerH + r.barH;
    console.log(`${w}px | 헤더 ${r.headerH} + 바 ${r.barH} = ${expected} | 바 top ${r.barTop} | rail-top ${r.railTopVar}(css ${r.railCssTop}/${r.railPos}) | 레일 실제 top ${r.railTop} | 넘침 ${r.overflow}`);
    console.log(`      칩 ${r.chips.length}: ${r.chips.join(' · ')}`);
    await ctx.close();
  }
  await b.close();
})();
