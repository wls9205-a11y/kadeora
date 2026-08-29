/**
 * 배지·칩 «합성» 대비 감사 — DS-2 게이트.
 *
 * 왜 필요한가
 * -----------
 * 이 저장소에서 대비 사고는 «반투명 틴트 위 글자» 에서 반복해 났다:
 *   BlogAptAlertCTA  「#FEE500 은 여기서 대비 1.26 이었다」
 *   MapClient        「#FEE500 은 제 10% 틴트 위 1.24 였다」
 * rgba(...,0.08) 은 그 자체로 대비를 말할 수 없다 — «무엇 위에 얹히는지» 를 알아야
 * 실제 색이 정해진다. 그래서 hex 만 보고 판단하면 매번 틀린다.
 *
 * 무엇을 하나
 * -----------
 * ① 공개 페이지에서 토큰의 «계산값» 을 읽는다(로그인 불필요 — 토큰은 :root 전역이다).
 * ② src/components/ds/tone.ts 의 «같은 표» 를 import 한다(두 벌을 만들지 않는다).
 * ③ bg 를 on 위에 알파 합성하고, fg 와의 대비를 WCAG 식으로 계산한다.
 * ④ 4.5:1 미만이면 실패.
 *
 * ⚠️ 감사 대상 페이지가 «어드민 게이트 뒤» 라도 이 방식은 돈다 — 배지의 색은
 *    전역 토큰에서 나오고, 톤 조합은 코드에 있다. 화면을 열 필요가 없다.
 * ⚠️ 글꼴모드는 색에 영향이 없어 곱하지 않는다. 대신 «스킨»(toss-mode)은 색을
 *    통째로 갈아끼우므로 반드시 같이 잰다.
 *
 * 사용: npx tsx scripts/contrast-audit.ts [URL]
 */
import { chromium } from 'playwright';
import { TONE } from '../src/components/ds/tone';
// Rule #116 — 판정 로직은 src/lib 에 있고 테스트가 붙어 있다(ds-contrast.test.ts 12검사).
// scripts/ 는 tsc 사각지대라, 여기 계산식을 두면 «틀려도 아무도 모른다».
import { toneContrast, AA_NORMAL } from '../src/lib/ds/contrast';

const URL = process.argv[2] || 'https://kadeora.app/';
const MIN = AA_NORMAL;
/** 색 스킨. 기본과 토스 스킨은 팔레트가 다르다 — 한쪽만 재면 다른 쪽이 샌다. */
const SKINS = ['', 'toss-mode'];

/**
 * 아직 «결정되지 않은» 조합. smoke.ts 의 owner 장치와 «같은 규약» 이다 —
 * 실패를 경고로 내리되 담당 안건과 함께 반드시 찍고, 그 안건이 닫히면 여기서 지워
 * 다시 fail 로 올린다.
 *
 * ⛔ 「지금 고치기 귀찮다」는 등재 사유가 아니다. 안건 번호가 있어야 한다.
 * ⚠️ 토스 스킨은 토스의 «브랜드 색» 이라 카더라가 임의로 못 바꾼다.
 *    배지를 그 스킨에 내보내려면 컴포넌트 계층 토큰을 따로 두거나 톤을 바꿔야 하는데,
 *    둘 다 «색 결정» 이라 중단점 C 안건이다(C-5). 현재 배지를 쓰는 화면은 아직 없다.
 */
const OPEN: Record<string, string> = {
  'toss-mode/brand': 'C-5',
  'toss-mode/success': 'C-5',
  'toss-mode/info': 'C-5',
};

let fails = 0;
let warns = 0;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  for (const skin of SKINS) {
    console.log(`\n[ 스킨: ${skin || '기본'} ]`);
    const names = Array.from(
      new Set(Object.values(TONE).flatMap((t) => [t.fg, t.bg, t.on, t.border].filter(Boolean) as string[])),
    );
    const vals: Record<string, string> = await page.evaluate(
      ([s, ns]) => {
        document.documentElement.className = s as string;
        const cs = getComputedStyle(document.documentElement);
        const out: Record<string, string> = {};
        for (const n of ns as string[]) out[n] = cs.getPropertyValue(n).trim();
        return out;
      },
      [skin, names] as const,
    );

    for (const [tone, t] of Object.entries(TONE)) {
      const r = toneContrast(vals[t.fg], vals[t.bg], vals[t.on]);
      if (r === null) {
        // ⛔ 못 읽은 것을 «통과» 로 세지 않는다. 모르면 실패다.
        fails++;
        console.log(`  ❌ ${tone} — 토큰 해석 실패 (fg=${vals[t.fg]} bg=${vals[t.bg]} on=${vals[t.on]})`);
        continue;
      }
      const line = `${tone.padEnd(8)} fg ${vals[t.fg]} on ${vals[t.bg]} over ${vals[t.on]} → ${r.toFixed(2)}:1`;
      const owner = OPEN[`${skin || 'default'}/${tone}`];
      if (r >= MIN) {
        console.log(`  ✅ ${line}`);
        if (owner) { fails++; console.log(`     ❗ 통과했는데 ${owner} 로 등재돼 있다 — 등재를 지울 것`); }
      } else if (owner) {
        warns++;
        console.log(`  ⚠️  ${line}  (하한 ${MIN})  <- ${owner} 안건`);
      } else {
        fails++;
        console.log(`  ❌ ${line}  (하한 ${MIN})`);
      }
      // 하한을 «겨우» 넘긴 조합은 다음 색 변경 한 번에 떨어진다. 미리 말해 준다.
      if (!owner && r >= MIN && r < MIN + 0.3) {
        console.log(`     ·  여유 ${(r - MIN).toFixed(2)} — 이 조합은 토큰을 조금만 밝혀도 미달이 된다`);
      }
    }
  }

  await browser.close();
  console.log(`
검사 ${SKINS.length * Object.keys(TONE).length} / 실패 ${fails} / 안건 대기 ${warns}`);
  if (warns) console.log('   ⚠️  대기 건은 «무시가 아니다» — 안건이 닫히면 OPEN 에서 지우고 다시 fail 로 올린다.');
  console.log(fails === 0 ? '✅ 대비 감사 통과' : `❌ 대비 미달 ${fails}건`);
  process.exit(fails === 0 ? 0 : 1);
})();
