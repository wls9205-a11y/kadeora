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

// ── Market status ──

export function marketStatusColor(isOpen: boolean): string {
  return isOpen ? 'var(--stock-market-open)' : 'var(--stock-market-closed)';
}

export function marketStatusBg(isOpen: boolean): string {
  return isOpen ? 'var(--stock-market-open-bg)' : 'var(--stock-market-closed-bg)';
}

// ─────────────────────────────────────────────────────────────────────
// s262 Phase B — v3 compact card 톤 시스템 (Architecture Rule #83).
// 한국 주식 일일 등락 한계 ±30% 기준, ±29.5% 부근부터 limit 톤.
// 카드/배지에서 hex 직접 사용 금지 — 반드시 이 헬퍼 통과.
// ─────────────────────────────────────────────────────────────────────

export type StockTone = 'limit_up' | 'up' | 'flat' | 'down' | 'limit_down';

const FLAT_THRESHOLD = 0.05;   // ±0.05% 미만 보합
const LIMIT_THRESHOLD = 29.5;  // ±29.5% 이상 limit

export function getStockTone(changePct: number | null | undefined): StockTone {
  if (changePct == null || Number.isNaN(changePct)) return 'flat';
  if (changePct >= LIMIT_THRESHOLD)  return 'limit_up';
  if (changePct <= -LIMIT_THRESHOLD) return 'limit_down';
  if (Math.abs(changePct) < FLAT_THRESHOLD) return 'flat';
  return changePct > 0 ? 'up' : 'down';
}

export function stockBarColor(tone: StockTone): string {
  switch (tone) {
    case 'limit_up':   return '#DC2626';
    case 'up':         return '#EF4444';
    case 'flat':       return '#6B7280';
    case 'down':       return '#2563EB';
    case 'limit_down': return '#1D4ED8';
  }
}

export function stockChipStyle(tone: StockTone): { background: string; color: string; fontWeight: number } {
  switch (tone) {
    case 'limit_up':   return { background: '#DC2626', color: '#FFFFFF', fontWeight: 700 };
    case 'up':         return { background: '#FEE2E2', color: '#991B1B', fontWeight: 600 };
    case 'flat':       return { background: '#F3F4F6', color: '#4B5563', fontWeight: 600 };
    case 'down':       return { background: '#DBEAFE', color: '#1E40AF', fontWeight: 600 };
    case 'limit_down': return { background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700 };
  }
}

/**
 * 칩 «배경 없이» 등락률을 글자로만 쓸 때의 색.
 *
 * ⚠️ stockChipStyle() 의 color 를 그냥 가져다 쓰면 안 된다. 그것은 «제 background 와
 *    한 쌍» 이라 limit_up·limit_down 에서 #FFFFFF 를 돌려준다 — 흰 카드 위에 그대로
 *    얹으면 대비 1.00, 글자가 사라진다. 실제로 StockCurationCard·StockHubRail 두 곳이
 *    그렇게 쓰고 있었다(TY1-6c 에서 발견). 상·하한가 종목에서만 드러나 오래 안 보였다.
 *
 * limit 계열은 칩의 «배경색» 이 곧 진한 전경색이라 그것을 쓴다 — #DC2626 4.83 · #1D4ED8 6.70.
 * 나머지는 chip.color 가 이미 진한 값이다.
 */
export function stockChipTextColor(tone: StockTone): string {
  const c = stockChipStyle(tone);
  return tone === 'limit_up' || tone === 'limit_down' ? c.background : c.color;
}

export function formatChangePct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '0.00%';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
