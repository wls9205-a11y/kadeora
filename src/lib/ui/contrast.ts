// v7-V8 — 색 대비 계산 (WCAG 2.x 상대 휘도 기준).
//
// 광고주가 입력한 색을 화면에 그대로 쓰기 전에 재는 데 쓴다.
// 실제 사고: site_notices.text_color 에 다크 시절 색 #00ff88 이 남아
// 라이트 배경 --bg-sunken(#E8ECF0) 위에서 대비 1.13:1 로 사실상 안 보였다.
//
// ⚠️ hex 만 재면 안 된다. opacity·rgba 알파까지 합성한 뒤에 재야 실제로 보이는 색이 나온다.
// ⚠️ CSS 변수는 값을 여기 복사하지 않는다 — 런타임에 getComputedStyle 로 읽는다.
//    복사해 두면 globals.css 를 고쳤을 때 조용히 어긋난다.

export type Rgba = { r: number; g: number; b: number; a: number };

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i;

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/** '#RGB' · '#RRGGBB' · '#RRGGBBAA' · 'rgb()' · 'rgba()' 만 받는다. 그 외는 null. */
export function parseColor(input?: string | null): Rgba | null {
  if (!input) return null;
  const v = input.trim();
  if (!v) return null;

  let m = HEX8.exec(v);
  if (m) {
    return {
      r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16),
      a: parseInt(m[4], 16) / 255,
    };
  }
  m = HEX6.exec(v);
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), a: 1 };
  m = HEX3.exec(v);
  if (m) {
    return {
      r: parseInt(m[1] + m[1], 16), g: parseInt(m[2] + m[2], 16), b: parseInt(m[3] + m[3], 16), a: 1,
    };
  }
  m = RGB_FN.exec(v);
  if (m) {
    const rawA = m[4];
    const a = rawA === undefined ? 1
      : rawA.endsWith('%') ? clamp01(parseFloat(rawA) / 100)
      : clamp01(parseFloat(rawA));
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
  }
  // 그라디언트·named color·hsl 등은 여기서 재지 않는다. 못 재는 것은 통과시키지 않는다.
  return null;
}

/**
 * CSS 변수를 실제 값으로 편다. `var(--x)` / `var(--x, fallback)` 을 처리한다.
 * 브라우저에서만 동작한다 (SSR 에서는 입력을 그대로 돌려준다).
 */
export function resolveCssColor(input?: string | null, depth = 0): string {
  const v = (input ?? '').trim();
  if (!v || depth > 4) return v;
  if (!v.startsWith('var(')) return v;
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return v;

  const inner = v.slice(4, v.lastIndexOf(')'));
  const comma = inner.indexOf(',');
  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
  const fallback = comma === -1 ? '' : inner.slice(comma + 1).trim();

  let got = '';
  try {
    got = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    got = '';
  }
  return resolveCssColor(got || fallback, depth + 1);
}

/** fg 를 (불투명한) bg 위에 합성한다. 알파를 무시하면 실제로 보이는 색이 안 나온다. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = clamp01(fg.a);
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

function channelLuminance(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(c: Rgba): number {
  return (
    0.2126 * channelLuminance(c.r) +
    0.7152 * channelLuminance(c.g) +
    0.0722 * channelLuminance(c.b)
  );
}

/**
 * 대비비. fg·bg 모두 알파를 합성한 뒤 잰다.
 * bg 가 반투명이면 page 위에 먼저 합성한다 (기본 흰색).
 */
export function contrastRatio(fg: Rgba, bg: Rgba, page: Rgba = { r: 255, g: 255, b: 255, a: 1 }): number {
  const solidBg = bg.a >= 1 ? bg : composite(bg, page);
  const solidFg = composite(fg, solidBg);
  const l1 = relativeLuminance(solidFg);
  const l2 = relativeLuminance(solidBg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** 본문 텍스트 하한. 배너 텍스트는 13px/600 이라 large text 완화(3:1) 대상이 아니다. */
export const MIN_CONTRAST = 4.5;

/**
 * 사용자 지정 전경색이 쓸 만한지 판정한다.
 *
 * 못 재는 색(그라디언트·named 등)은 **통과시키지 않는다** — 재지 못한 것을 안전하다고
 * 부르면 방어가 아니다. 호출부가 기본색으로 떨어뜨린다.
 *
 * ⚠️ 차단이 아니라 폴백이다. 저장은 그대로 두고 표시만 방어한다.
 */
export function isReadable(
  fgInput?: string | null,
  bgInput?: string | null,
  page?: string | null,
): boolean {
  const fg = parseColor(resolveCssColor(fgInput));
  const bg = parseColor(resolveCssColor(bgInput));
  if (!fg || !bg) return false;
  const pageRgba = parseColor(resolveCssColor(page)) ?? { r: 255, g: 255, b: 255, a: 1 };
  return contrastRatio(fg, bg, pageRgba) >= MIN_CONTRAST;
}

/** 실제 대비비. 어드민 경고 문구 등에서 숫자를 보여줄 때 쓴다. 못 재면 null. */
export function measureContrast(
  fgInput?: string | null,
  bgInput?: string | null,
  page?: string | null,
): number | null {
  const fg = parseColor(resolveCssColor(fgInput));
  const bg = parseColor(resolveCssColor(bgInput));
  if (!fg || !bg) return null;
  const pageRgba = parseColor(resolveCssColor(page)) ?? { r: 255, g: 255, b: 255, a: 1 };
  return contrastRatio(fg, bg, pageRgba);
}
