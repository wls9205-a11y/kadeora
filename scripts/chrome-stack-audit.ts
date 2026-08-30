/**
 * 상단 크롬 «스택» 실측 자 — 결함 2호(2026-08-30).
 *
 * 띠와 헤더는 겹치지 않고 «쌓인다». 그 순서가 실제 좌표에 나타나는지 잰다.
 *
 * 계약 (띠 유/무 라우트 «양쪽» · 스크롤 0 과 900 «두 자리»):
 *   ① 헤더 top ≥ 띠 bottom              — 겹치지 않고 쌓인다
 *   ② elementFromPoint(돋보기) = 돋보기  — «누를 수 있는가»
 *      ⚠️ el.click() 은 덮여 있어도 성공한다. 클릭 성공으로 재면 이 결함이 통과한다.
 *   ③ 토큰 --kd-header-bottom == 헤더 실측 bottom · --kd-banner-h == 그 라우트의 띠
 *   ④ --kd-overlay-top ≥ 띠 bottom       — 오버레이가 띠에 물리지 않는다
 *   ⑤ 하위 sticky 의 CSS top ≥ 헤더 bottom (헤더 밑에 깔리지 않는다)
 *   ⑥ 하위 sticky 가 «살아 있다» — 스크롤 뒤 rect.top < 자기 CSS top 이면 흘러간 것이다
 *   ⑦ 가로 넘침 0
 *
 * ⚠️ 셀렉터를 손으로 적지 «않는다». 화면에 있는 sticky 를 전부 찾아서 잰다 —
 *    적어 둔 목록만 재면 «안 적은 것» 이 죽어도 초록이 뜬다.
 * ⚠️ 커스텀 속성은 getPropertyValue 로 «px 이 안 나온다»(calc/max 가 그대로 온다).
 *    숨은 프로브 요소의 width/height 로 받아 «계산된 px» 을 읽는다.
 *
 * 사용: npx tsx scripts/chrome-stack-audit.ts https://kadeora.app
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://kadeora.app';
const DETAIL = '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0';
const BLOG = '/blog/%EB%B6%80%EC%82%B0-%EC%95%84%ED%8C%8C%ED%8A%B8-%EC%B2%AD%EC%95%BD';

/** 띠 «유» 3곳 · 띠 «무» 2곳. 조건이 값(--kd-banner-h)에 흡수되는지 양쪽에서 본다. */
const ROUTES: Array<{ path: string; banner: boolean }> = [
  { path: '/',      banner: true },
  { path: '/apt',   banner: true },
  { path: '/blog',  banner: true },
  { path: DETAIL,   banner: false },
];
const WIDTHS = [390, 1280];

let checks = 0;
let fails = 0;
function expect(where: string, cond: boolean, msg: string) {
  checks++;
  if (cond) return;
  fails++;
  console.log(`  ❌ ${where} — ${msg}`);
}

(async () => {
  const b = await chromium.launch();
  const rows: string[] = [];
  for (const r of ROUTES) {
    for (const w of WIDTHS) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768 });
      const page = await ctx.newPage();
      await page.addInitScript({ content: 'globalThis.__name = globalThis.__name || function (f) { return f; };' });
      await page.goto(BASE + r.path, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(1800);

      for (const y of [0, 900]) {
        const where = `${decodeURIComponent(r.path)} ${w}px scroll${y}`;
        await page.evaluate((s) => window.scrollTo(0, s), y);
        await page.waitForTimeout(450);
        const m = await page.evaluate(() => {
          const header = document.querySelector('header');
          const hb = header ? header.getBoundingClientRect() : null;

          // 띠 = 뷰포트 상단(y=0)에 걸려 있는 position:fixed 중 가장 아래끝
          let bannerBottom = 0;
          let bannerName = '(없음)';
          for (const el of Array.from(document.body.querySelectorAll('*'))) {
            if (getComputedStyle(el).position !== 'fixed') continue;
            const bb = el.getBoundingClientRect();
            if (bb.height === 0 || bb.top > 0 || bb.bottom <= 0) continue;
            if (Math.round(bb.bottom) > bannerBottom) {
              bannerBottom = Math.round(bb.bottom);
              bannerName = `${el.tagName.toLowerCase()} z:${getComputedStyle(el).zIndex}`;
            }
          }

          const trigger = [...document.querySelectorAll('header [aria-label="검색 열기"]')].find((el) => {
            const bb = (el as HTMLElement).getBoundingClientRect();
            return bb.width > 0 && bb.height > 0 && getComputedStyle(el).display !== 'none';
          }) as HTMLElement | undefined;
          let reachable: boolean | null = null;
          let cover = '-';
          if (trigger) {
            const bb = trigger.getBoundingClientRect();
            const at = document.elementFromPoint(Math.round(bb.x + bb.width / 2), Math.round(bb.y + bb.height / 2));
            reachable = !!at && (at === trigger || trigger.contains(at));
            cover = at ? `${at.tagName.toLowerCase()}${at.getAttribute('aria-label') ? `[${(at.getAttribute('aria-label') || '').slice(0, 18)}]` : ''}` : '(없음)';
          }

          // 커스텀 속성의 «계산된 px» — 프로브 요소로 받는다
          const probe = document.createElement('div');
          probe.style.cssText =
            'position:absolute;left:-9999px;visibility:hidden;' +
            'height:var(--kd-header-bottom);width:var(--kd-overlay-top);' +
            'padding-top:var(--kd-banner-h);margin-top:var(--kd-header-top)';
          document.body.appendChild(probe);
          const pc = getComputedStyle(probe);
          const tok = {
            bottom: Math.round(parseFloat(pc.height)),
            overlay: Math.round(parseFloat(pc.width)),
            banner: Math.round(parseFloat(pc.paddingTop)),
            top: Math.round(parseFloat(pc.marginTop)),
          };
          probe.remove();

          /* 하위 sticky — «찾아서» 잰다. top:auto(하단 고정)는 이 계약의 대상이 아니다. */
          const stickies: Array<{ name: string; cssTop: number; rectTop: number; alive: boolean }> = [];
          for (const el of Array.from(document.body.querySelectorAll('*'))) {
            if (el === header) continue;
            const cs = getComputedStyle(el);
            if (cs.position !== 'sticky' || cs.top === 'auto') continue;
            const bb = el.getBoundingClientRect();
            if (bb.height === 0) continue;
            const cssTop = Math.round(parseFloat(cs.top));
            const rectTop = Math.round(bb.top);
            stickies.push({
              name: `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}`,
              cssTop,
              rectTop,
              // 자기 정지선보다 «위» 로 흘러갔으면 붙은 적이 없는 것이다
              alive: rectTop >= cssTop - 1,
            });
          }

          return {
            header: hb ? { t: Math.round(hb.top), b: Math.round(hb.bottom) } : null,
            bannerBottom, bannerName, reachable, cover, tok, stickies,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });

        expect(where, !!m.header && m.header.t >= m.bannerBottom,
          `헤더가 띠 밑으로 들어간다 — 띠 bottom ${m.bannerBottom}(${m.bannerName}) · 헤더 top ${m.header?.t}`);
        expect(where, m.reachable !== false, `돋보기가 덮여 있다 — 누르면 «${m.cover}» 가 받는다`);
        expect(where, m.tok.banner === (r.banner ? 52 : 0), `--kd-banner-h ${m.tok.banner} (기대 ${r.banner ? 52 : 0})`);
        expect(where, !!m.header && m.tok.bottom === m.header.b,
          `토큰 --kd-header-bottom ${m.tok.bottom} ≠ 헤더 실측 bottom ${m.header?.b}`);
        expect(where, m.tok.overlay >= m.bannerBottom,
          `--kd-overlay-top ${m.tok.overlay} < 띠 bottom ${m.bannerBottom} — 오버레이가 띠에 물린다`);
        expect(where, m.overflow === 0, `가로 넘침 ${m.overflow}px`);
        for (const st of m.stickies) {
          expect(where, !!m.header && st.cssTop >= m.header.b,
            `${st.name} 의 정지선이 헤더 위다 — 헤더 bottom ${m.header?.b} · ${st.name} top ${st.cssTop}`);
          if (y === 900) {
            expect(where, st.alive,
              `${st.name} 가 «붙은 적이 없다» — 정지선 ${st.cssTop} 인데 실제 top ${st.rectTop} (조상 상자가 먼저 끝났는지 볼 것)`);
          }
        }

        rows.push(
          `${where.padEnd(32)} 띠 ..${m.bannerBottom} | 헤더 ${m.header?.t}..${m.header?.b} ${m.reachable === null ? '(트리거없음)' : m.reachable ? '닿음' : '덮임'}` +
          ` | 토큰 띠 ${m.tok.banner}·top ${m.tok.top}·bottom ${m.tok.bottom}·오버레이 ${m.tok.overlay}` +
          ` | sticky ${m.stickies.length ? m.stickies.map((s) => `${s.name} ${s.cssTop}→${s.rectTop}${s.alive ? '' : '✗'}`).join(', ') : '없음'}`,
        );
      }
      await ctx.close();
    }
  }
  await b.close();

  console.log('\n■ 상단 크롬 스택 실측');
  for (const l of rows) console.log('  ' + l);
  console.log(`\n■ 검사 ${checks} / 실패 ${fails}`);
  if (fails) { console.log('❌ 크롬 스택 게이트 실패'); process.exit(1); }
  console.log('✅ 크롬 스택 게이트 통과');
})();
