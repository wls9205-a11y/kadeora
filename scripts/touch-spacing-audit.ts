/**
 * 인접 터치 타깃 간격 감사 — 촘촘 리듬(DS-2d-2)의 부대조건 ①.
 *
 * 왜 필요한가
 * -----------
 * `--sp-xs` 는 163곳에서 쓰이고 그중 «70곳이 gap» 이다. 그리고 그 gap 의 상당수가
 * breadcrumb nav 처럼 «작은 링크가 여러 개 나란히» 있는 자리다.
 * 촘촘 리듬으로 --sp-xs 가 6px → 4px 이 되면 그 링크들이 더 붙는다.
 *
 * 무엇을 재나
 * -----------
 * 계산된 gap 이 좁은(≤8px) 컨테이너 중 «상호작용 자식이 둘 이상» 인 것을 찾아,
 * 그 자식들의 실제 크기를 잰다. 44px 미만인 것이 몇 개인지 «숫자로» 남긴다.
 *
 * ⚠️ 실효 히트 영역을 잰다 — 요소의 자기 상자만 보면 «과다 보고» 한다.
 *    Rule #77 의 `.touch-target` 은 시각 크기를 그대로 둔 채 ::after 로 히트 영역만
 *    44px 로 넓히는데, ::after 는 절대배치라 부모 rect 에 잡히지 않는다.
 *    이 정정 전에는 헤더 크롬(로그인·검색 버튼)을 「44px 미만」으로 세고 있었다 — 거짓이었다.
 *
 * ⚠️ 이 스크립트는 «합격/불합격을 스스로 정하지 않는다».
 *    breadcrumb 링크가 44px 이 아닌 것은 이 변경이 만든 문제가 아니라 «이미 있던 상태» 다.
 *    그래서 전/후 «숫자를 비교» 하는 용도로 쓴다 — 변경이 상태를 «악화시켰는가» 만 본다.
 *    게이트가 「그렇게 되기를 바라는 것」이 아니라 「지금 참인 것」을 말해야 한다는
 *    DS-1b-2 의 교훈과 같은 선이다.
 *
 * 사용: npx tsx scripts/touch-spacing-audit.ts <BASE_URL> > before.txt
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3111').replace(/\/$/, '');
const PATHS = ['/', '/apt', '/blog', '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0'];
/** 좁은 화면 + 글꼴모드 3종. font-small 이 가장 촘촘하다. */
const MODES = ['', 'font-small', 'font-large'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  for (const path of PATHS) {
    // ⚠️ networkidle 을 쓰지 않는다 — 로컬 빌드는 Supabase 키가 placeholder 라
    //    데이터 요청이 끝나지 않아 /apt 가 영원히 idle 이 안 된다(실측 60s 타임아웃).
    //    레이아웃만 재면 되므로 DOM 이 서면 충분하다.
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    for (const mode of MODES) {
      const r = await page.evaluate((m) => {
        document.documentElement.className = m;
        const INTERACTIVE = 'a[href],button,[role="button"],input,select,summary';
        let narrowContainers = 0;
        let pairs = 0;
        let tiny = 0;
        let minGap = 999;
        const samples: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          const cs = getComputedStyle(el);
          if (cs.display !== 'flex' && cs.display !== 'grid' && cs.display !== 'inline-flex') continue;
          const g = parseFloat(cs.gap || cs.columnGap || '0');
          if (!g || g > 8) continue;
          const kids = Array.from(el.children).filter((c) => (c as HTMLElement).matches?.(INTERACTIVE));
          if (kids.length < 2) continue;
          narrowContainers++;
          if (g < minGap) minGap = g;
          for (const k of kids) {
            const b = k.getBoundingClientRect();
            if (b.width === 0) continue;
            pairs++;
            // ⚠️ 2026-08-29 정정 — 요소의 «자기 상자» 만 보면 과다 보고한다.
            //    이 저장소에는 Rule #77 의 `.touch-target` 이 있고, 그것은 시각 크기를
            //    그대로 둔 채 ::after 로 «히트 영역만» 44px 로 넓힌다.
            //    ::after 는 절대배치라 부모의 getBoundingClientRect 에 «잡히지 않는다».
            //    → 실효 히트 높이 = max(자기 높이, ::after 의 min-height)
            const after = getComputedStyle(k, '::after');
            const hitMin = after.content !== 'none' ? parseFloat(after.minHeight || '0') || 0 : 0;
            const effective = Math.max(b.height, hitMin);
            if (effective < 44) {
              tiny++;
              if (samples.length < 3) {
                samples.push(`${k.tagName.toLowerCase()}"${(k.textContent || '').trim().slice(0, 14)}" ${Math.round(b.width)}×${Math.round(b.height)} 실효${Math.round(effective)} gap${g}`);
              }
            }
          }
        }
        return { narrowContainers, pairs, tiny, minGap: minGap === 999 ? 0 : minGap, samples };
      }, mode);
      console.log(
        `${path}|${mode || 'default'}| 좁은컨테이너 ${r.narrowContainers} · 상호작용자식 ${r.pairs} · 44px미만 ${r.tiny} · 최소gap ${r.minGap}px`,
      );
      for (const s of r.samples) console.log(`   · ${s}`);
    }
  }
  await browser.close();
})();
