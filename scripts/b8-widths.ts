/**
 * B8 — 현장 상세 하단 CTA·플로팅 스택의 5폭(390·480·700·1024·1280) «측정».
 *
 * 「확인했다」를 주장으로 내지 않는다. 브라우저에서 실제 좌표·크기를 재고,
 * 겹침은 사각형 교차로 판정한다. 이 방식이 실제로 결함을 잡았다 —
 * className="md:hidden" 이 인라인 display 에 져서 하단 바가 ≥1024 에서도
 * 떠 있던 것(v3 커밋2 이래)은 눈으로 「모바일 화면」만 봤다면 못 봤다.
 *
 * 사용: npx tsx scripts/b8-widths.ts <현장 상세 URL>
 *
 * ⚠️ 이 파일은 B8 «전용» 이다(셀렉터가 그 커밋의 것). 마스터 부록 C-2 가 DS-1 에
 *    승계시킨 「간격 값이 바뀌는 커밋 → 6페이지 × 5폭」 절차는 이걸 일반화해서 쓴다.
 *    일반화는 DS-1 몫이다 — 여기서 미리 넓히지 않는다(R-2).
 * ⚠️ evaluate 안에서 함수를 변수에 담지 말 것 — tsx(esbuild) keepNames 가 __name
 *    래퍼를 씌우는데 그 심볼은 브라우저에 없다(ReferenceError: __name).
 */
import { chromium } from 'playwright';

const URL = process.argv[2];
const WIDTHS = [390, 480, 700, 1024, 1280];
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

type Box = { x: number; y: number; w: number; h: number } | null;
const overlap = (a: Box, b: Box) =>
  !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

let fails = 0;
const ok = (w: number, m: string) => console.log(`  ✅ ${w} — ${m}`);
const bad = (w: number, m: string) => { fails++; console.log(`  ❌ ${w} — ${m}`); };
const chk = (w: number, cond: boolean, m: string) => (cond ? ok(w, m) : bad(w, m));

(async () => {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      userAgent: UA,
      deviceScaleFactor: 1,
      isMobile: width < 1024,
      hasTouch: width < 1024,
    });
    const page = await ctx.newPage();
    console.log(`\n[ ${width}px ]`);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    // 하단 바는 리드폼이 뷰포트에 없을 때만 뜬다 — 상단으로 올려 둔다.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);

    // ⚠️ evaluate 안에서 함수를 «bc변수에 담지 않는다» — tsx(esbuild) 의 keepNames 가
    //    __name 래퍼를 씨우는데 그 심볼은 브라우저에 없다(ReferenceError: __name).
    const m = await page.evaluate(() => {
      const SEL: Record<string, string> = {
        share: 'button[aria-label="이 현장 공유하기"]',
        comment: 'button[aria-label^="현장 댓글"]',
        scrollTop: 'button[aria-label="맨 위로 스크롤"]',
        nav: 'nav',
      };
      const out: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
      for (const key of Object.keys(SEL)) {
        const el = document.querySelector(SEL[key]);
        out[key] = null;
        if (el) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0) {
            out[key] = { x: r.x, y: r.y, w: r.width, h: r.height };
          }
        }
      }
      const talk = document.querySelector('a[aria-label*="카톡방"]');
      const bar = talk ? talk.parentElement : null;
      let barBox: { x: number; y: number; w: number; h: number } | null = null;
      if (bar) {
        const r = bar.getBoundingClientRect();
        const cs = getComputedStyle(bar);
        if (cs.display !== 'none' && r.width > 0) barBox = { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      const kids: { x: number; y: number; w: number; h: number }[] = [];
      const barTexts: string[] = [];
      if (bar && barBox) {
        for (const c of Array.from(bar.children)) {
          const r = c.getBoundingClientRect();
          if (r.width > 0) kids.push({ x: r.x, y: r.y, w: r.width, h: r.height });
          barTexts.push((c.textContent || '').trim());
        }
      }
      const writeHrefs: string[] = [];
      for (const a of Array.from(document.querySelectorAll('a[href]'))) {
        const h = a.getAttribute('href') || '';
        if (/^\/write(\/|$|\?)/.test(h)) writeHrefs.push(h);
      }
      return {
        writeFab: document.querySelectorAll('a[aria-label="글쓰기"]').length,
        writeHref: writeHrefs.length,
        share: out.share,
        comment: out.comment,
        scrollTop: out.scrollTop,
        nav: out.nav,
        bar: barBox,
        kids,
        barTexts,
        commentSection: !!document.getElementById('comment-section'),
        commentInput: !!document.getElementById('kd-apt-comment-input'),
      };
    });

    // 경계는 레일과 «같은 1024» 다(components.css). md(768)가 아니다.
    const mobile = width < 1024;

    // ① 글쓰기 FAB — 상세에서는 DOM 에 «없어야» 한다 (감춘 게 아니라 미렌더)
    chk(width, m.writeFab === 0, `글쓰기 FAB 앵커 ${m.writeFab}개 (기대 0)`);
    chk(width, m.writeHref === 0, `/write 링크 ${m.writeHref}개 (기대 0)`);

    if (mobile) {
      // ② 플로팅 스택 2개
      chk(width, !!m.share, `공유 버튼 렌더 ${m.share ? `${m.share.w}×${m.share.h}` : '없음'}`);
      chk(width, !!m.comment, `현장 댓글 버튼 렌더 ${m.comment ? `${m.comment.w}×${m.comment.h}` : '없음'}`);
      for (const [n, b] of [['공유', m.share], ['댓글', m.comment]] as const) {
        if (b) chk(width, b.w >= 44 && b.h >= 44, `${n} 터치 타깃 ${b.w}×${b.h} (≥44)`);
      }
      // 공유가 댓글 «위» 칸
      if (m.share && m.comment) chk(width, m.share.y < m.comment.y, `스택 순서: 공유(y=${Math.round(m.share.y)}) 위 · 댓글(y=${Math.round(m.comment.y)}) 아래`);

      // ③ 하단 바 50/50 · 동일 높이 48~52
      chk(width, m.kids.length === 2, `하단 바 칸 ${m.kids.length}개 (기대 2)`);
      if (m.kids.length === 2) {
        const [l, r] = m.kids as NonNullable<Box>[];
        chk(width, Math.abs(l.w - r.w) <= 2, `50/50 폭 ${Math.round(l.w)} vs ${Math.round(r.w)} (차 ≤2)`);
        chk(width, Math.abs(l.h - r.h) <= 1, `동일 높이 ${Math.round(l.h)} vs ${Math.round(r.h)}`);
        chk(width, l.h >= 48 && l.h <= 52, `바 높이 ${Math.round(l.h)}px (48~52)`);
        console.log(`  ·  문구: ${JSON.stringify(m.barTexts)}`);
      }

      // ④ 겹침 0 — 스택 × 바 × 탭바 × ScrollToTop
      const pairs: [string, Box, Box][] = [
        ['공유×바', m.share, m.bar],
        ['댓글×바', m.comment, m.bar],
        ['공유×댓글', m.share, m.comment],
        ['공유×맨위로', m.share, m.scrollTop],
        ['댓글×탭바', m.comment, m.nav],
        ['바×탭바', m.bar, m.nav],
      ];
      for (const [n, a, b] of pairs) {
        if (a && b) chk(width, !overlap(a, b), `겹침 없음 ${n}`);
      }
    } else {
      // ≥1024: 레일이 받는 구간. 바·스택 전부 미렌더여야 한다
      //  (components.css 「폼이 두 번, 카톡이 두 번」 XOR)
      chk(width, !m.share && !m.comment, `≥1024 플로팅 스택 미렌더`);
      chk(width, !m.bar, `≥1024 하단 바 미렌더`);
    }

    // ⑤ 댓글 점프 목적지가 실재하는가
    chk(width, m.commentSection, `#comment-section 존재`);

    await page.screenshot({ path: `b8-${width}.png`, fullPage: false });
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${fails === 0 ? '✅ 전부 통과' : `❌ 실패 ${fails}건`}`);
  process.exit(fails === 0 ? 0 : 1);
})();
