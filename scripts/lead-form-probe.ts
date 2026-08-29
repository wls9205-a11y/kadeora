// §7 — 리드 폼 «비파괴» 실측. 전송은 하지 않는다(실제 기록이 남는다).
// 확인하는 것: 폼이 서고 · 검증이 «막고» · 막힌 동안 네트워크로 아무것도 안 나간다.
import { chromium } from 'playwright';
const BASE = process.argv[2];
const PATH = '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url().slice(0, 70)); });
  await page.goto(BASE + PATH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#kd-lead-name', { timeout: 30000 });
  const before = await page.evaluate(() => ({
    엔드포인트있음: document.querySelectorAll('#lead-form').length > 0,
    입력칸: document.querySelectorAll('#lead-form input, #lead-form select').length,
    허니팟: document.querySelectorAll('#lead-form input[name="company"]').length,
    필수동의: document.querySelectorAll('#lead-form input[type="checkbox"]').length,
  }));
  await page.click('#lead-form button[type="submit"]');       // 빈 폼 — «막혀야» 한다
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    에러문구: Array.from(document.querySelectorAll('#lead-form p'))
      .map((p) => (p as HTMLElement).innerText.trim())
      .filter((t) => /입력|선택|동의/.test(t)),
    aria: document.querySelectorAll('#lead-form [aria-invalid="true"], #lead-form [role="alert"]').length,
  }));
  console.log('구조 :', JSON.stringify(before));
  console.log('빈폼 :', JSON.stringify(after));
  console.log('POST :', posts.length ? posts.join(' | ') : '0건 — 검증이 막았고 «전송은 없었다»');
  await b.close();
})();
