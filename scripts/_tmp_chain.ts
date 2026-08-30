import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto('https://kadeora.app/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const bar = document.querySelector('.kd-jumpbar') as HTMLElement | null;
    if (!bar) return { err: 'no bar' };
    const out: string[] = [];
    let el: HTMLElement | null = bar.parentElement;
    while (el && out.length < 10) {
      const cs = getComputedStyle(el);
      if (cs.overflow !== 'visible' || cs.transform !== 'none' || cs.contain !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none')
        out.push(`${el.tagName}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]} overflow=${cs.overflow} transform=${cs.transform !== 'none'} contain=${cs.contain}`);
      el = el.parentElement;
    }
    return { blockers: out };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
