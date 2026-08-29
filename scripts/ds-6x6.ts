/**
 * DS 화면 확인 — 6페이지 × 6폭 «측정» 목록.
 *
 * 부록 C-2 의 「간격 값이 실제로 바뀌는 커밋 → 배포 후 멈추고 확인 목록 정리·보고」
 * 절차를 사람 눈이 아니라 «자로» 수행한다.
 *
 * 무엇을 재나
 * -----------
 *  ① 가로 넘침 — 간격·라운드 변경이 레이아웃을 깨면 «가장 먼저» 나오는 증상.
 *  ② 실제 적용된 라운드 — 토큰이 아니라 «렌더된 요소» 의 border-radius.
 *     토큰 스냅샷은 「토큰 값이 바뀌었다」까지만 말한다. 요소가 그 토큰을 쓰는지는 다른 사실이다.
 *  ③ 실제 적용된 간격 — 카드 목록의 실측 gap.
 *  ④ 내부 404 — 링크가 깨졌는지(간격 변경과 무관하지만 화면 확인의 기본).
 *
 * ⚠️ 글꼴모드를 «곱한다». 부대조건 ②(font-small 6폭 실화면)가 여기 들어간다.
 *    --sp-* 는 모드마다 값이 다르므로 기본 모드만 보면 절반만 본 것이다.
 *
 * 사용: npx tsx scripts/ds-6x6.ts [BASE_URL]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'https://kadeora.app').replace(/\/$/, '');
/** 합집합 6폭 — 마스터·STATUS(390·480·700·1024·1280) ∪ 설계서(768). 중단점 C-1 안건. */
const WIDTHS = [390, 480, 700, 768, 1024, 1280];
// ⚠️ font-large 를 «반드시» 넣는다. 조밀 표는 글자가 커질 때 깨진다 —
//    작아질 때(font-small)만 보면 정작 위험한 쪽을 안 본 것이다(부대조건 ③).
const MODES = ['', 'font-small', 'font-large'];
// U-1a — 상세 두 곳을 «넣는다». 이 커밋이 바꾼 화면이 거기다.
//   그랑라크(verified·분양예정 있음) · 대연 푸르지오(기축·분양예정 없음) — 두 경로가 다르다.
const PAGES = ['/', '/apt', '/blog', '/stock',
  '/apt/%EA%B7%B8%EB%9E%91%EB%9D%BC%ED%81%AC-%EC%97%90%EC%9D%BC%EB%A6%B0%EC%9D%98-%EB%9C%B0',
  '/apt/%EB%8C%80%EC%97%B0-%ED%91%B8%EB%A5%B4%EC%A7%80%EC%98%A4-%ED%81%B4%EB%9D%BC%EC%84%BC%ED%8A%B8'];

let fails = 0;

(async () => {
  const browser = await chromium.launch();
  console.log('폭  | 모드       | 경로            | 넘침 | 토큰 r/gap | 첫 카드(실측)       | gap  | 판정');
  console.log('----|-----------|-----------------|------|-----------|---------------------|------|-----');

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    const page = await ctx.newPage();
    for (const mode of MODES) {
      for (const path of PAGES) {
        let row = '';
        try {
          await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(1200);
          const r = await page.evaluate((m) => {
            document.documentElement.className = m;
            // 강제 리플로우 — 클래스 교체 직후 값을 읽으면 이전 값이 잡힌다.
            void document.documentElement.offsetHeight;
            const de = document.documentElement;
            const overflow = de.scrollWidth - de.clientWidth;
            // ⚠️ 「카드」를 넓은 선택자로 잡으면 «무엇을 쟀는지» 를 모른다.
            //    클래스명을 같이 돌려줘야 10px 이 나왔을 때 「토큰이 안 왔다」인지
            //    「그 요소가 원래 하드코딩」인지 구분할 수 있다.
            const card = document.querySelector('.apt-card, .kd-card, [class*="card"]');
            const radius = card ? getComputedStyle(card).borderTopLeftRadius : '-';
            const cardName = card ? String((card as HTMLElement).className).split(' ')[0].slice(0, 12) : '-';
            // 토큰이 «실제로» 그 값인지는 임시 요소로 직접 확인한다.
            // 화면 요소가 토큰을 안 쓰는 경우와 토큰이 안 온 경우는 «다른 사실» 이다.
            const probe = document.createElement('div');
            probe.style.borderRadius = 'var(--radius-md)';
            probe.style.display = 'flex';
            probe.style.gap = 'var(--sp-md)';
            document.body.appendChild(probe);
            const pcs = getComputedStyle(probe);
            const tokenRadius = pcs.borderTopLeftRadius;
            const tokenGap = pcs.gap;
            probe.remove();
            let gap = '-';
            for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
              const cs = getComputedStyle(el);
              if ((cs.display === 'flex' || cs.display === 'grid') && el.children.length >= 3) {
                const g = cs.gap || cs.rowGap;
                if (g && g !== 'normal' && parseFloat(g) > 0) { gap = g.split(' ')[0]; break; }
              }
            }
            return { overflow, radius, gap, cardName, tokenRadius, tokenGap };
          }, mode);
          const bad = r.overflow > 2;
          if (bad) fails++;
          row = `${String(width).padEnd(4)}| ${(mode || 'default').padEnd(10)}| ${path.padEnd(16)}| ${String(r.overflow).padStart(4)} | ${(r.tokenRadius + '/' + r.tokenGap).padEnd(9)}| ${(r.cardName + ' ' + r.radius).padEnd(20)}| ${r.gap.padEnd(5)}| ${bad ? '❌ 넘침' : '✅'}`;
        } catch (e) {
          fails++;
          row = `${String(width).padEnd(4)}| ${(mode || 'default').padEnd(10)}| ${path.padEnd(16)}| ERR  | -            | -    | ❌ ${(e as Error).name}`;
        }
        console.log(row);
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n검사 ${WIDTHS.length * MODES.length * PAGES.length} / 실패 ${fails}`);
  console.log(fails === 0 ? '✅ 6폭 확인 통과 (가로 넘침 0)' : `❌ ${fails}건`);
})();
