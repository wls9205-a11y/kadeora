/**
 * 토큰 «계산값» 스냅샷 — DS 트랙 회귀 게이트.
 *
 * 소스 diff 는 「CSS 텍스트가 같다」까지만 증명한다. 번들러가 레이어를 재배열하거나
 * import 순서가 뒤집히면 텍스트가 같아도 «계산값» 이 달라진다. 그래서 브라우저에서
 * getComputedStyle 로 직접 읽는다.
 *
 * 사용: npx tsx scripts/token-snapshot.ts <URL> > before.txt
 *       (배포 후 다시 떠서 diff — 값 무변경 커밋이면 «빈 diff» 여야 한다)
 *
 * ⚠️ 글꼴 크기 모드(html.font-small/large)와 폭을 «곱해서» 뜬다. 기본 모드만 보면
 *    font-large 에서만 뒤집히는 회귀를 놓친다(--sp-* 는 모드별로 값이 다르다).
 */
import { chromium } from 'playwright';

const URL = process.argv[2];
const WIDTHS = [390, 1280];
const MODES = ['', 'font-small', 'font-large'];

(async () => {
  const browser = await chromium.launch();
  const rows: string[] = [];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (const mode of MODES) {
      const vals = await page.evaluate((m) => {
        document.documentElement.className = m;
        const cs = getComputedStyle(document.documentElement);
        // ⚠️ evaluate 안에서 함수를 변수에 담지 않는다 — tsx(esbuild) keepNames 가
        //    __name 래퍼를 씌우는데 그 심볼이 브라우저에 없다. 재귀는 스택으로 편다.
        const names: string[] = [];
        const stack: CSSRuleList[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try { stack.push((sheet as CSSStyleSheet).cssRules); } catch { /* CORS 시트 */ }
        }
        while (stack.length) {
          const list = stack.pop() as CSSRuleList;
          for (const r of Array.from(list)) {
            const st = (r as CSSStyleRule).style;
            if (st) for (const p of Array.from(st)) if (p.startsWith('--')) names.push(p);
            const inner = (r as CSSGroupingRule).cssRules;
            if (inner) stack.push(inner);
          }
        }
        const uniq = Array.from(new Set(names)).sort();
        return uniq.map((n) => `${n}=${cs.getPropertyValue(n).trim()}`);
      }, mode);
      for (const v of vals) rows.push(`${width}|${mode || 'default'}|${v}`);
    }
    await ctx.close();
  }
  await browser.close();
  rows.sort();
  console.log(rows.join('\n'));
})();
