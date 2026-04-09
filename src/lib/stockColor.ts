/**
 * Stock Color System v2
 * 주식 상승/하락/보합 + 투자자 + AI시그널 + 센티먼트 컬러 통합 유틸리티
 */

// ── Market detection ──

export function isKRMarket(market?: string | null, currency?: string | null): boolean {
  if (currency === 'USD') return false;
  if (market === 'NYSE' || market === 'NASDAQ') return false;
  return true;
}

// ── Price change colors ──

export function stockColor(changePct: number, isKR: boolean): string {
  if (changePct > 0) return isKR ? 'var(--stock-kr-up)' : 'var(--stock-us-up)';
  if (changePct < 0) return isKR ? 'var(--stock-kr-down)' : 'var(--stock-us-down)';
  return 'var(--stock-flat)';
}

export function stockBg(changePct: number, isKR: boolean): string {
  if (changePct > 0) return isKR ? 'var(--stock-kr-up-bg)' : 'var(--stock-us-up-bg)';
  if (changePct < 0) return isKR ? 'var(--stock-kr-down-bg)' : 'var(--stock-us-down-bg)';
  return 'var(--stock-flat-bg)';
}

export function stockUpColor(isKR: boolean): string {
  return isKR ? 'var(--stock-kr-up)' : 'var(--stock-us-up)';
}

export function stockDownColor(isKR: boolean): string {
  return isKR ? 'var(--stock-kr-down)' : 'var(--stock-us-down)';
}

// ── Raw hex for SVG/Canvas (CSS vars can't resolve there) ──

export function stockUpHex(isKR: boolean, isDark = true): string {
  if (isKR) return isDark ? '#FF5252' : '#D32F2F';
  return isDark ? '#66BB6A' : '#2E7D32';
}

export function stockDownHex(isKR: boolean, isDark = true): string {
  if (isKR) return isDark ? '#42A5F5' : '#1976D2';
  return isDark ? '#EF5350' : '#C62828';
}

export function stockFlatHex(isDark = true): string {
  return isDark ? '#9E9E9E' : '#757575';
}

// ── Investor colors (독립 팔레트 — 상승/하락과 겹치지 않음) ──

export function investorColor(type: 'foreign' | 'inst' | 'retail'): string {
  const map = { foreign: 'var(--stock-foreign)', inst: 'var(--stock-inst)', retail: 'var(--stock-retail)' };
  return map[type];
}

export function investorBg(type: 'foreign' | 'inst' | 'retail'): string {
  const map = { foreign: 'var(--stock-foreign-bg)', inst: 'var(--stock-inst-bg)', retail: 'var(--stock-retail-bg)' };
  return map[type];
}

// ── AI signal ──

export function signalColor(signal: string): string {
  if (signal === 'bullish') return 'var(--stock-bullish)';
  if (signal === 'bearish') return 'var(--stock-bearish)';
  return 'var(--stock-neutral)';
}

export function signalBg(signal: string): string {
  if (signal === 'bullish') return 'var(--stock-bullish-bg)';
  if (signal === 'bearish') return 'var(--stock-bearish-bg)';
  return 'var(--stock-neutral-bg)';
}

// ── News sentiment ──

export function sentimentColor(label: string): string {
  if (label === 'positive') return 'var(--stock-positive)';
  if (label === 'negative') return 'var(--stock-negative)';
  return 'var(--stock-neutral)';
}

export function sentimentBg(label: string): string {
  if (label === 'positive') return 'var(--stock-positive-bg)';
  if (label === 'negative') return 'var(--stock-negative-bg)';
  return 'var(--stock-neutral-bg)';
}
