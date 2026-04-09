/**
 * 공유 포맷팅 유틸리티
 * timeAgo, fmtAmount, fmtPrice, fmtCap, stockColor
 * 
 * 이전: 10+ 파일에서 각각 복사하여 사용
 * 이후: 단일 모듈에서 import
 */

/** 상대 시간 표시 (방금 전, 5분 전, 3시간 전, 2일 전) */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

/** 금액 포맷 (만원/억) */
export function fmtAmount(amt: number): string {
  if (!amt) return '-';
  if (amt >= 10000) return `${(amt / 10000).toFixed(1)}억`;
  return `${amt.toLocaleString()}만`;
}

/** 주식 가격 포맷 (KRW/USD 자동) */
export function fmtPrice(price: number, currency?: string): string {
  if (!price) return '-';
  return currency === 'USD' ? `$${price.toFixed(2)}` : `₩${price.toLocaleString()}`;
}

/** 시가총액 포맷 (억/조/B/T) */
export function fmtCap(v: number | null, currency?: string): string {
  if (!v) return '-';
  if (currency === 'USD') {
    if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
    return `$${(v / 1e6).toFixed(0)}M`;
  }
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (v >= 1e8) return `${Math.round(v / 1e8)}억`;
  return v.toLocaleString();
}

/** 숫자 축약 (1K, 1M) */
export function numFmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** 주식 등락률 색상 (한국: 빨강=상승, 해외: 초록=상승) */
export function stockColor(pct: number, isKR: boolean): string {
  if (pct === 0) return 'var(--stock-flat)';
  if (isKR) return pct > 0 ? 'var(--stock-kr-up)' : 'var(--stock-kr-down)';
  return pct > 0 ? 'var(--stock-us-up)' : 'var(--stock-us-down)';
}

/** 숫자 콤마 포맷 */
export function fmt(n: number): string {
  return n?.toLocaleString() ?? '0';
}
