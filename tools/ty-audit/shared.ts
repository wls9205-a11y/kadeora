/**
 * TY3 공용 — 사다리 정의 · 화면 귀속 · 예외 경로 · 값 정규화.
 *
 * 정본: docs/ty/README.md (FINAL_TYFB_20260918 §4 + 판정 증분).
 * ⚠️ 이 파일은 «계기» 다. 게이트(scripts/type-audit.ts)가 같은 정의를 import 한다 —
 *    자와 게이트가 서로 다른 사다리를 들고 있으면 「자는 초록, 게이트는 빨강」이 된다.
 */
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const ROOT = join(__dirname, '..', '..');
export const rel = (abs: string) => relative(ROOT, abs).split(sep).join('/');

/** --fs 사다리 — tokens.css :root(데스크탑) / @media 767.98 (모바일). 3상태 재정의는 토큰이 흡수한다. */
export const FS_STEPS: Array<{ token: string; desktop: number; mobile: number }> = [
  { token: '3xs', desktop: 10, mobile: 10 },
  { token: '2xs', desktop: 12, mobile: 11 },
  { token: 'xs', desktop: 14, mobile: 13 },
  { token: 'sm', desktop: 16, mobile: 15 },
  { token: 'base', desktop: 18, mobile: 17 },
  { token: 'md', desktop: 19, mobile: 18 },
  { token: 'lg', desktop: 21, mobile: 20 },
  { token: 'xl', desktop: 24, mobile: 23 },
  { token: '2xl', desktop: 32, mobile: 30 },
];

/**
 * globals.css 의 인라인 font-size 강제 스케일링(세션70+s5·s6-3) — 루트 상태.
 * `[style*="font-size:Npx"] { font-size: Mpx !important }` 가 «미디어 무관» 으로 걸려
 * 인라인 9~15px 는 명목값이 아니라 아래 값으로 렌더된다(판정 증분-2의 근거).
 */
export const INLINE_GUARD: Record<number, number> = { 9: 12, 10: 13, 11: 14, 12: 14, 13: 15, 14: 16, 15: 16 };
/** 테일윈드 클래스 가드 — .text-xs · .text-[Npx] 도 같은 사다리로 끌어올려진다. */
export const CLASS_GUARD: Record<string, number> = { 'text-xs': 14 };

/** 명목 px → 현재 렌더 px (루트 상태·인라인 style 한정). */
export const renderedInline = (px: number) => INLINE_GUARD[px] ?? px;

/**
 * 렌더 px → --fs 단. 데스크탑 값 기준 최근접, 동률은 아래.
 * 2xl(32) 를 2px 넘게 벗어나는 큰 값은 null — display 대장(clamp 편입 안건)으로 존치.
 * 22px 이상 제목대에서 최근접 단이 2px 넘게 떨어지면(28 = 24·32 양쪽 4px) 역시 null —
 * «±2px 대역 이탈 키는 되돌리고 보고»(§4 T4-0 게이트)를 스냅 규칙 쪽에서 미리 지킨다.
 * 10px 미만은 바닥(3xs) 으로 올린다 — 사다리 바닥 10px 규정이 대역보다 우선한다.
 */
export function snapFs(renderPx: number): string | null {
  if (renderPx > 34) return null;
  let best = FS_STEPS[0];
  for (const s of FS_STEPS) {
    const d = Math.abs(s.desktop - renderPx);
    const bd = Math.abs(best.desktop - renderPx);
    if (d < bd) best = s; // 동률이면 먼저 만난(아래) 단 유지
  }
  if (renderPx >= 22 && Math.abs(best.desktop - renderPx) > 2) return null;
  return best.token;
}

/** (나)형 prop 숫자 — 값 스냅만. 데스크탑·모바일 사다리 값의 합집합 최근접(동률 아래). */
export const PROP_LADDER = Array.from(new Set(FS_STEPS.flatMap((s) => [s.desktop, s.mobile]))).sort((a, b) => a - b);
export function snapPropPx(px: number): number {
  let best = PROP_LADDER[0];
  for (const v of PROP_LADDER) if (Math.abs(v - px) < Math.abs(best - px)) best = v;
  return best;
}

export const FW_TOKEN: Record<number, string> = { 400: 'quiet', 500: 'body', 600: 'title', 700: 'num' };

/** 행간 사다리 {1, 1.3, 1.5, 1.6} — 최근접(동률 아래). 단위 있는 값은 스냅하지 않는다(대장). */
export const LH_STEPS = [1, 1.3, 1.5, 1.6];
export function snapLh(v: number): number {
  let best = LH_STEPS[0];
  for (const s of LH_STEPS) if (Math.abs(s - v) < Math.abs(best - v) - 1e-9) best = s;
  return best;
}

/** TY1 자간 사다리 — 20px+ −0.4 / 15~19 −0.2 / 14 이하 0 (렌더 px 기준). */
export function tyLetterSpacing(renderPx: number): number {
  if (renderPx >= 20) return -0.4;
  if (renderPx >= 15) return -0.2;
  return 0;
}

/* ── 예외 원장 ──────────────────────────────────────────────────────────── */
export type Exempt = { path: string; reason: string };
let _exempt: Exempt[] | null = null;
export function exemptList(): Exempt[] {
  if (!_exempt) _exempt = JSON.parse(readFileSync(join(ROOT, 'docs/ty/exempt-paths.json'), 'utf8')).paths;
  return _exempt!;
}
export function isExempt(file: string): string | null {
  for (const e of exemptList()) {
    if (e.path.endsWith('/**') ? file.startsWith(e.path.slice(0, -3)) : file === e.path) return e.reason;
  }
  return null;
}

/* ── 화면 귀속 ──────────────────────────────────────────────────────────── */
/** 파일 → 화면 키. app 라우트는 그룹 괄호를 벗긴 경로, 컴포넌트는 폴더 단위. */
export function screenOf(file: string): string {
  if (file.startsWith('src/app/api/')) return 'api';
  if (file.startsWith('src/app/admin/') || file.startsWith('src/components/admin/')) return 'admin';
  if (file.startsWith('src/app/')) {
    const parts = file.slice('src/app/'.length).split('/');
    parts.pop();
    const segs = parts.filter((p) => !/^\(.*\)$/.test(p));
    return '/' + segs.join('/');
  }
  if (file.startsWith('src/components/')) {
    const parts = file.slice('src/components/'.length).split('/');
    return 'components/' + (parts.length > 1 ? parts[0] : '(root)');
  }
  return file.split('/').slice(0, 2).join('/');
}

/** 화면 키 → T4 커밋 묶음. 정본 표: docs/ty/README.md §묶음. */
export function bucketOf(screen: string): string {
  if (screen === 'api') return 'exempt';
  if (screen === 'admin') return 'T4-8';
  if (screen.startsWith('/daily')) return 'T4-1';
  if (screen.startsWith('/stock/[symbol]')) return 'T4-2';
  if (screen.startsWith('/apt/[id]')) return 'T4-6';
  if (screen.startsWith('/blog/[slug]')) return 'T4-4';
  // 메인 4화면(홈·부동산·블로그·주식 허브)의 라우트 파일
  if (screen === '/apt' || screen === '/blog' || screen === '/stock' || screen === '/') return 'T4-7';
  if (screen.startsWith('/apt/')) return 'T4-3';
  if (screen.startsWith('components/') || screen.startsWith('src/')) return 'T4-5';
  // 그 밖의 라우트(/calc·/discuss·/profile·/stock 서브 …) — 지시서 큐에 명시 묶음이 없어 T4-7b 로 모은다(판정 증분-2).
  return 'T4-7b';
}
