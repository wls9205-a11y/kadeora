// v7-C1 — /stock 2축 필터.
//
// 기존 탭 7개는 단일 축이라 "코스닥에서 급등한 종목" 을 고를 수 없었다.
// 시장 × 정렬로 갈라 두 축이 곱해지게 한다.
//
// URL 은 ?market= ?sort= ?theme= 3개로 고정한다.
// ⚠️ 기존 ?tab= 은 계속 받는다 — 색인·북마크가 걸려 있다. sort 로 매핑한다.

/** stock_quotes.market 실측값 (2026-08-23): KOSPI 310 · KOSDAQ 1042 · NYSE 302 · NASDAQ 192. */
export const MARKET_VALUES = {
  kospi: ['KOSPI'],
  kosdaq: ['KOSDAQ'],
  overseas: ['NYSE', 'NASDAQ'],
} as const;

export type MarketKey = 'all' | keyof typeof MARKET_VALUES;

export const MARKETS: { key: MarketKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'kospi', label: 'KOSPI' },
  { key: 'kosdaq', label: 'KOSDAQ' },
  { key: 'overseas', label: '해외' },
];

/**
 * 정렬 축.
 *
 * 화면 칩은 4개지만 값은 5개다 — '등락' 칩 하나가 gain↔loss 를 오간다.
 * 칩을 4개로 줄이면서 급락을 잃지 않으려면 이 방법뿐이다
 * (파라미터를 하나 더 만들면 URL 3개 고정이 깨진다).
 *
 * mcap·foreign 은 칩이 없지만 값으로는 계속 받는다 — 기존 ?tab= 링크가 살아야 한다.
 */
export type SortKey = 'issue' | 'gain' | 'loss' | 'volume' | 'watch' | 'mcap' | 'foreign';

const SORT_KEYS: SortKey[] = ['issue', 'gain', 'loss', 'volume', 'watch', 'mcap', 'foreign'];

/** 화면에 내는 칩 4개. '등락' 은 현재 방향에 따라 라벨과 링크가 갈린다. */
export const SORT_CHIPS = [
  { key: 'issue' as const, label: '이슈' },
  { key: 'change' as const, label: '등락' },
  { key: 'volume' as const, label: '거래량' },
  { key: 'watch' as const, label: '관심' },
];

/** ?tab= 레거시 값 → sort. 값이 같으면 그대로 통과한다. */
export function tabToSort(tab?: string | null): SortKey | null {
  if (!tab) return null;
  return (SORT_KEYS as string[]).includes(tab) ? (tab as SortKey) : null;
}

export function normalizeMarket(v?: string | null): MarketKey {
  const k = (v || '').toLowerCase();
  return k === 'kospi' || k === 'kosdaq' || k === 'overseas' ? k : 'all';
}

export function normalizeSort(v?: string | null, tab?: string | null): SortKey {
  if (v && (SORT_KEYS as string[]).includes(v)) return v as SortKey;
  return tabToSort(tab) ?? 'issue';
}

/** 시장 필터에 쓸 실제 market 값들. null 이면 필터하지 않는다. */
export function marketValues(m: MarketKey): readonly string[] | null {
  return m === 'all' ? null : MARKET_VALUES[m];
}

export type StockParams = {
  market: MarketKey;
  sort: SortKey;
  theme: string;
};

export function resolveParams(sp: {
  market?: string;
  sort?: string;
  theme?: string;
  tab?: string;
}): StockParams {
  return {
    market: normalizeMarket(sp.market),
    sort: normalizeSort(sp.sort, sp.tab),
    theme: (sp.theme || '').trim(),
  };
}

/** 현재 선택을 유지한 링크. 바꾸는 축만 넘긴다. */
export function stockHref(cur: StockParams, patch: Partial<StockParams>): string {
  const next = { ...cur, ...patch };
  const qs = [
    next.market !== 'all' ? `market=${next.market}` : '',
    next.sort !== 'issue' ? `sort=${next.sort}` : '',
    next.theme ? `theme=${encodeURIComponent(next.theme)}` : '',
  ].filter(Boolean).join('&');
  return qs ? `/stock?${qs}` : '/stock';
}

/** '등락' 칩의 다음 목적지 — 이미 등락이면 방향을 뒤집는다. */
export function changeToggleSort(cur: SortKey): SortKey {
  return cur === 'gain' ? 'loss' : 'gain';
}

/** '등락' 칩 라벨 — 어느 방향을 보고 있는지 드러낸다. */
export function changeChipLabel(cur: SortKey): string {
  if (cur === 'gain') return '등락 ↑';
  if (cur === 'loss') return '등락 ↓';
  return '등락';
}

export const isChangeSort = (s: SortKey) => s === 'gain' || s === 'loss';

/** 화면 캡션용 라벨. sr-only h1 과 섹션 메타가 같이 쓴다. */
export function sortLabel(s: SortKey): string {
  switch (s) {
    case 'issue': return '이슈';
    case 'gain': return '급등';
    case 'loss': return '급락';
    case 'volume': return '거래량';
    case 'watch': return '관심';
    case 'mcap': return '시총';
    case 'foreign': return '외국인 순매수';
  }
}

export function marketLabel(m: MarketKey): string {
  return MARKETS.find((x) => x.key === m)?.label ?? '전체';
}
