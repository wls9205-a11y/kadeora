/**
 * 활성색 게이트 — 「문서 판정」을 «정적 검사» 로 바꾼 자.
 *
 * 왜 필요한가
 * -----------
 * H5 에서 「선택은 전 화면 공통으로 네이비」가 확정됐는데, V4 트랙에서 그 이탈이
 * «세 곳» 에서 나왔다(/blog 서브칩 · /stock 칩 · /apt 단계 스트립). 한 곳은 심지어
 * screens.css 안에서 네이비 규칙 «바로 위» 에 파랑으로 남아 있었다.
 * 즉 판정이 문서에만 있고 코드에 강제되지 않아서 생긴 계열이다.
 * 「인기」 금칙어를 smoke 가 상시 검사하는 것과 같은 자리다.
 *
 * ⚠️ 이 자는 «초록으로 태어났다». 신설 «전» 에 (a) 21+3건을 수리하고 (b) 11곳에
 *    예외 태그를 붙였다. 빨간불로 태어난 게이트는 무시하는 습관을 만든다 —
 *    if(!error) 침묵 46곳과 같은 계열이다(DS_RULES §4).
 *
 * ⛔ 이 자가 «재지 않는» 것
 *    「흰 바탕 골드 텍스트 금지」는 일부러 뺐다. 「네이비 컨텍스트 «위» 인가」를
 *    정적으로 판정할 수 없다 — .kd-home-hero__gold 는 그라디언트 «상단 1/3» 에서 5.82 고
 *    같은 색이 아래에서는 3.27 이다. 자리를 알아야 답이 나오는 종류의 사실이다.
 *    → 정적 자로 잴 수 없는 사실은 게이트화하지 않는다. 영원한 거짓 양성이거나
 *      영원한 예외 태그가 된다. 그 규칙은 DS_RULES 로 유지하고 사용처는 F 문서에 수동 등재.
 *
 * ── 활성색 의미론 4분류 (판정회신 증분18 · 이 트랙에서 확립) ──────────────
 * 미래의 분류는 이 표에서 시작한다. 「--brand 가 보인다」가 아니라
 * «그 삼항이 무엇을 말하는가» 를 먼저 정한다.
 *
 *   개념          뜻                                        색
 *   ───────────  ────────────────────────────────────────  ─────────────────────
 *   선택          지금 «고른» 것                              --brand-navy «강제»
 *   (selected)    aria-current / aria-selected / data-active
 *   활성화        «누를 수 있는가» (disabled 와 짝)            --brand (주 CTA 표준)
 *   (enabled)
 *   진행          «여기까지 왔다» (>= 비교 · 타임라인 · 출석)   green/brand 계열 허용
 *   (progress)
 *   강조·시맨틱   데이터가 «의미» 를 가진 색                    의미가 정한다
 *                (시리즈 · 전세/매매 · 비율 막대)               → kd-brand-exempt
 *
 * ⚠️ 실제로 갈린 자리들 — 패턴이 아니라 «방향» 과 «부등호» 를 봐야 한다:
 *    · `active ? 흰 : var(--brand)`      → --brand 가 «비활성» 쪽이다. 선택 신호가 아니다.
 *    · `steps.indexOf(step) >= i`        → «>=» 다. 「지금」이 아니라 「여기까지」다.
 *    · `selected.length > 0 ? --brand`   → disabled 와 짝인 «버튼 활성화» 다.
 * ⚠️ 그리고 «한 파일 안에 여러 개념이 섞인다». 파일 단위로 면제하지 않는 이유다 —
 *    RegionStackedBar 는 시리즈 색(강조)과 KPI 탭(선택)을 «같이» 갖고 있었고,
 *    BigEventCharts 도 그랬다. 둘 다 파일 단위 분류에서 오분류로 잡혔다.
 *
 * 사용: npx tsx scripts/active-color-gate.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';

/** 예외 표식. hit «위» 이 창 안에 있어야 인정한다 — 파일 단위 면제를 만들지 않기 위해서다. */
const EXEMPT_TAG = 'kd-brand-exempt';
const EXEMPT_WINDOW = 4;

/**
 * 활성 상태를 나타내는 «식별자» 들. 이 이름이 삼항의 조건부에 있고
 * 결과부에 --brand 가 있으면 「선택을 파랑으로 칠했다」로 본다.
 * ⚠️ 넓게 잡는다 — 좁은 패턴이 5건을 놓쳤다(신설 직전 전수에서 드러났다).
 */
const ACTIVE_HINT = /\b(isActive|isAct|active|selected|activeTab|current|isCurrent|step\s*===|activeIdx|isOn|isSelected)\b/;

/** CSS 쪽 — 활성 «선택자» 가 --brand 계열을 쓰는가. */
const CSS_ACTIVE_SEL = /\[(aria-current|aria-selected|data-active)\s*=\s*['"]?(true|page|step)['"]?\]/;

type Hit = { file: string; line: number; text: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p);
  }
  return out;
}

function isExempt(lines: string[], idx: number): boolean {
  const from = Math.max(0, idx - EXEMPT_WINDOW);
  for (let i = from; i <= idx; i++) if (lines[i].includes(EXEMPT_TAG)) return true;
  return false;
}

const hits: Hit[] = [];
let scanned = 0;

for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  scanned++;
  const isCss = file.endsWith('.css');
  lines.forEach((raw, i) => {
    // --brand-navy · --brand-gold · --brand-bg 등 «다른 토큰» 은 대상이 아니다.
    if (!/var\(--brand\)/.test(raw)) return;
    if (isExempt(lines, i)) return;

    if (isCss) {
      // CSS 는 «선택자» 로 본다. 규칙 본문이 여러 줄이라 위쪽 선택자 줄까지 훑는다.
      const from = Math.max(0, i - 6);
      const block = lines.slice(from, i + 1).join('\n');
      if (CSS_ACTIVE_SEL.test(block)) hits.push({ file, line: i + 1, text: raw.trim() });
      return;
    }
    // TSX — 삼항의 «조건부» 에 활성 힌트가 있어야 한다.
    const q = raw.indexOf('?');
    if (q < 0) return;
    if (!ACTIVE_HINT.test(raw.slice(0, q))) return;
    // --brand 가 «비활성» 쪽이면 선택 신호가 아니다(AptBuilderHub 사례).
    const colon = raw.indexOf(':', q);
    const truthy = colon > q ? raw.slice(q, colon) : raw.slice(q);
    if (!truthy.includes('var(--brand)')) return;
    hits.push({ file, line: i + 1, text: raw.trim() });
  });
}

console.log(`\n■ 활성색 게이트 — 파일 ${scanned}개 스캔`);
if (hits.length === 0) {
  console.log('✅ 선택 상태를 --brand 로 칠한 곳 없음 (「선택 = 네이비」 유지)');
  process.exit(0);
}
console.log(`\n❌ 선택 상태에 --brand 를 쓴 곳 ${hits.length}건\n`);
for (const h of hits) {
  console.log(`  ${h.file}:${h.line}`);
  console.log(`    ${h.text.slice(0, 120)}`);
}
console.log(`
  → 「선택」이면 var(--brand-navy) 로 바꾼다(H5 기확정 · 전 화면 공통).
  → 「선택이 아니면」 위 4분류로 어느 개념인지 정하고, 그 줄 «바로 위»(${EXEMPT_WINDOW}줄 이내)에
     // ${EXEMPT_TAG}: <왜 예외인가 한 줄> 을 단다.
     ⚠️ 이유 없는 태그를 달지 않는다 — 다음 사람이 다시 조사하게 되고 예외만 늘어난다.
  ⛔ 클래스로 «넘길» 때는 인라인 색을 반드시 비운다. 인라인은 모든 @layer 를 이긴다.
`);
process.exit(1);
