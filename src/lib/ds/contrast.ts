// 대비 계산 — WCAG 상대휘도·명암비.
//
// ── 왜 lib 로 꺼냈나 (RULES#143) ────────────────────────────────────────────
// `scripts/` 는 tsconfig 의 exclude 에 있어 `npm run type-check` 가 «검사하지 않는다».
// 이 파일의 로직은 «판정» 이다 — 여기가 틀리면 접근성 미달 색을 통과시켜 놓고
// 「통과했다」고 보고하게 된다. 게이트가 틀린 말을 하면 게이트가 아니다.
// 그래서 계산은 src/lib 로 꺼내 테스트를 붙이고, 스크립트는 «호출과 출력만» 한다.
//
// ⚠️ 알파 합성이 이 파일의 핵심이다. 이 저장소의 대비 사고 두 건
//    (BlogAptAlertCTA 1.26 · MapClient 1.24)은 전부 «반투명 틴트 위 글자» 였다.
//    rgba(...,0.08) 은 그 자체로 대비를 말할 수 없다 — 무엇 위에 얹히는지를 알아야
//    실제 색이 정해진다. hex 만 보고 판단하면 매번 틀린다.

export type RGB = [number, number, number];
export interface ParsedColor {
  rgb: RGB;
  a: number;
}

/** `#RRGGBB` · `rgb()` · `rgba()` 를 읽는다. 못 읽으면 «지어내지 않고» null 을 낸다. */
export function parseColor(css: string): ParsedColor | null {
  if (!css) return null;
  const t = css.trim();
  const fn = t.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const p = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) {
      const a = p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1;
      return { rgb: [p[0], p[1], p[2]], a };
    }
    return null;
  }
  const hex6 = t.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const hex3 = t.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split('');
    return { rgb: [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)], a: 1 };
  }
  return null;
}

/** src 를 dst «위에» 얹는다(source-over). 이 한 줄이 없어서 1.24 짜리 배지가 나갔다. */
export function composite(src: ParsedColor, dst: RGB): RGB {
  return [0, 1, 2].map((i) => src.rgb[i] * src.a + dst[i] * (1 - src.a)) as RGB;
}

/** WCAG 2.x 상대휘도. */
export function luminance(c: RGB): number {
  const f = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

/** 명암비. 인자 순서와 무관하다(밝은 쪽이 분자). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 「이 토큰 조합이 몇 대 일인가」 — 배지·칩 판정의 실제 진입점.
 *
 * @param fg  글자색 (반투명일 수 있다)
 * @param bg  배경색 (반투명 틴트가 보통이다)
 * @param on  그 배경이 «얹히는» 바탕. 모르면 흰 종이로 본다.
 * @returns   못 읽는 색이 하나라도 있으면 null — «지어내지 않는다»
 */
export function toneContrast(fg: string, bg: string, on: string): number | null {
  const f = parseColor(fg);
  const b = parseColor(bg);
  const o = parseColor(on);
  if (!f || !b || !o) return null;
  // 바탕도 반투명일 수 있다. 흰 종이 위로 한 번 더 내린다.
  const base = composite(o, [255, 255, 255]);
  const solidBg = composite(b, base);
  const solidFg = composite(f, solidBg);
  return contrastRatio(solidFg, solidBg);
}

/** WCAG AA 본문 하한. */
export const AA_NORMAL = 4.5;
