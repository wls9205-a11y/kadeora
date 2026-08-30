/**
 * §7 — 상단 폼 리드 E2E «1건». Node 승인 건에서만 돌린다(2026-08-30).
 *
 * ⚠️ 진짜 리드가 기록된다. 이름 앞 [TEST] 표식 규약을 반드시 지킨다 —
 *    시트의 테스트 행 삭제는 Node 가 한다.
 * ⛔ 반복 실행하지 않는다. dedupe_key 로 inquiry_count 만 올라가 «다른 사실» 이 된다.
 */
import { chromium } from 'playwright';
const BASE = process.argv[2];
const PATH = process.argv[3] ?? '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const posts: string[] = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (r.request().method() !== 'POST') return;
    if (!/script\.google|macros/.test(u)) return;
    posts.push(`${r.status()} → ${(await r.text().catch(() => '<읽기실패>')).slice(0, 240)}`);
  });
  await page.goto(BASE + PATH, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#kd-lead-name', { timeout: 30000 });
  const band = await page.evaluate(() => (document.getElementById('lead-form')?.innerText || '').split('\n')[0]);
  await page.fill('#kd-lead-name', '[TEST] 게이트확인');
  await page.fill('#kd-lead-phone', '01000000000');
  await page.fill('#kd-lead-birth', '000101');
  await page.check('#lead-form input[type="checkbox"]:not([name="company"])');
  await page.waitForTimeout(8000);   // too_fast 필터를 «끄지 않고» 기다린다
  await page.click('#lead-form button[type="submit"]');
  await page.waitForTimeout(9000);
  const after = await page.evaluate(() => (document.getElementById('lead-form')?.innerText || '').replace(/\s+/g, ' ').slice(0, 240));
  console.log('폼 배너 :', band);
  console.log('전송 응답:', posts.length ? posts.join(' | ') : '(리드 엔드포인트 POST 없음)');
  console.log('전송 후  :', after);
  await b.close();
})();
