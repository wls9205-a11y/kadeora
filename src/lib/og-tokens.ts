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
  /** 한 글자 표식(집·주·돈 …). ⚠️ 이모지가 아니다 — satori 이모지 금지(T1 §4). */
  icon: string;
}

/**
 * [T1 §1.1·§1.2] 색을 확정 팔레트로 갈아끼웠다.
 *
 * 이전에는 카테고리마다 네온 한 색(형광 초록·시안·노랑 등)과 «거의 검정» 인
 * 3-stop 그라디언트를 들고 있었다. 그래서 생성기마다 배경이 달랐고, 검색결과에
 * 여러 편이 뜨면 색동저고리가 됐다. T1 이 그걸 걷어낸다.
 *
 *   color — §1.2 카테고리 띠 색 7종으로 접었다. 네이비 위에서 읽히는 채도다.
 *   bg    — 전 카테고리 동일한 브랜드 네이비 스톱. «카테고리로 분기하지 않는다»(§6.1).
 *           이 필드로 gradient 를 만들던 호출부가 그대로 네이비를 얻게 남겨둔다.
 *   dim   — color 의 18% 반투명. 뱃지 배경용.
 *
 * ⚠️ 여기에 네온을 되살리지 말 것. 색이 필요하면 src/lib/og/brand.ts 의
 *    CATEGORY_BAR 를 보고 계열을 늘린다.
 */
const NAVY_STOPS: [string, string, string] = ['#0B2A6B', '#123A8F', '#2563EB'];

export const OG_CAT: Record<string, OgCategoryToken> = {
  apt:     { color: '#FF8A5B', dim: 'rgba(255,138,91,0.18)',  bg: NAVY_STOPS, label: '청약·분양',   code: 'APT',     icon: '집' },
  stock:   { color: '#F472B6', dim: 'rgba(244,114,182,0.18)', bg: NAVY_STOPS, label: '주식·시세',   code: 'STOCK',   icon: '주' },
  finance: { color: '#60A5FA', dim: 'rgba(96,165,250,0.18)',  bg: NAVY_STOPS, label: '재테크·절세', code: 'FINANCE', icon: '돈' },
  unsold:  { color: '#FBBF6E', dim: 'rgba(251,191,110,0.18)', bg: NAVY_STOPS, label: '미분양',      code: 'UNSOLD',  icon: '미' },
  redev:   { color: '#A78BFA', dim: 'rgba(167,139,250,0.18)', bg: NAVY_STOPS, label: '재개발',      code: 'REDEV',   icon: '재' },
  general: { color: '#94A3B8', dim: 'rgba(148,163,184,0.18)', bg: NAVY_STOPS, label: '생활정보',   code: 'INFO',    icon: '뉴' },
  blog:    { color: '#94A3B8', dim: 'rgba(148,163,184,0.18)', bg: NAVY_STOPS, label: '블로그',      code: 'BLOG',    icon: '글' },
  local:   { color: '#34D399', dim: 'rgba(52,211,153,0.18)',  bg: NAVY_STOPS, label: '우리동네',   code: 'LOCAL',   icon: '동' },
  free:    { color: '#94A3B8', dim: 'rgba(148,163,184,0.18)', bg: NAVY_STOPS, label: '자유',        code: 'FREE',    icon: '톡' },
};

export type OgCategory = keyof typeof OG_CAT;

/** 안전한 카테고리 lookup (잘못된 key 시 'blog' fallback) */
export function getOgCat(key: string | null | undefined): OgCategoryToken {
  if (!key || !(key in OG_CAT)) return OG_CAT.blog;
  return OG_CAT[key];
}
