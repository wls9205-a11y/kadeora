/**
 * s239 W4: OG 카테고리 색상 토큰 단일 source.
 * 6 OG route (og/og-apt/og-blog/og-square/og-image/og-stock) 모두 import.
 * 색상 변경 시 이 파일만 수정.
 */

export interface OgCategoryToken {
  /** 메인 색상 (강조선/텍스트) */
  color: string;
  /** dim 배경 (rgba) */
  dim: string;
  /** gradient 배경 3-stop */
  bg: [string, string, string];
  /** 한국어 라벨 */
  label: string;
  /** 영어 코드 */
  code: string;
  /** 이모지 */
  icon: string;
}

export const OG_CAT: Record<string, OgCategoryToken> = {
  apt:     { color: '#00FF87', dim: 'rgba(0,255,135,0.18)',   bg: ['#010804','#031509','#05230E'], label: '청약·분양',   code: 'APT',     icon: '🏢' },
  stock:   { color: '#00E5FF', dim: 'rgba(0,229,255,0.18)',   bg: ['#010508','#031020','#051830'], label: '주식·시세',   code: 'STOCK',   icon: '📈' },
  finance: { color: '#FFE000', dim: 'rgba(255,224,0,0.18)',   bg: ['#070500','#140E00','#201500'], label: '재테크·절세', code: 'FINANCE', icon: '💰' },
  unsold:  { color: '#FF6B1A', dim: 'rgba(255,107,26,0.18)',  bg: ['#070100','#140500','#210900'], label: '미분양',      code: 'UNSOLD',  icon: '⚠️' },
  redev:   { color: '#B794FF', dim: 'rgba(183,148,255,0.18)', bg: ['#04030C','#0B0820','#161033'], label: '재개발',      code: 'REDEV',   icon: '🏗️' },
  general: { color: '#C084FC', dim: 'rgba(192,132,252,0.18)', bg: ['#030108','#080518','#0D0825'], label: '생활정보',   code: 'INFO',    icon: '📰' },
  blog:    { color: '#C084FC', dim: 'rgba(192,132,252,0.18)', bg: ['#030108','#080518','#0D0825'], label: '블로그',      code: 'BLOG',    icon: '✍️' },
  local:   { color: '#FFD43B', dim: 'rgba(255,212,59,0.18)',  bg: ['#080700','#141000','#201800'], label: '우리동네',   code: 'LOCAL',   icon: '📍' },
  free:    { color: '#F472B6', dim: 'rgba(244,114,182,0.18)', bg: ['#080210','#130820','#1E0F30'], label: '자유',        code: 'FREE',    icon: '💬' },
};

export type OgCategory = keyof typeof OG_CAT;

/** 안전한 카테고리 lookup (잘못된 key 시 'blog' fallback) */
export function getOgCat(key: string | null | undefined): OgCategoryToken {
  if (!key || !(key in OG_CAT)) return OG_CAT.blog;
  return OG_CAT[key];
}
