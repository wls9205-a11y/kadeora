// s262 Phase E — Per-tab SSR metadata + ItemList JSON-LD 헬퍼.
// /stock 7 tab × /apt 5 block = 12 variant. canonical + title + description + JSON-LD.

import { SITE_URL } from '@/lib/constants';

type StockTabKey = 'issue' | 'mcap' | 'gain' | 'loss' | 'volume' | 'foreign' | 'watch';
type AptBlockKey = 'regulated' | 'imminent' | 'fresh24h' | 'unsold' | 'redev';

const STOCK_TAB_META: Record<StockTabKey, { label: string; desc: string }> = {
  issue:   { label: '이슈',     desc: '오늘 가장 변동성 큰 종목 — 거래량·등락폭·신선도 종합 점수' },
  mcap:    { label: '시총',     desc: '시가총액 상위 종목 — KOSPI·KOSDAQ' },
  gain:    { label: '급등',     desc: '오늘 등락률 상위 종목' },
  loss:    { label: '급락',     desc: '오늘 등락률 하위 종목' },
  volume:  { label: '거래폭증', desc: '거래량 폭증 종목 — 30일 평균 대비' },
  foreign: { label: '외인',     desc: '외국인 순매수 상위 종목' },
  watch:   { label: '관심',     desc: '내 관심 종목' },
};

const APT_BLOCK_META: Record<AptBlockKey, { label: string; desc: string }> = {
  regulated: { label: '정책 알림', desc: '규제·투기 지역 청약 단지' },
  imminent:  { label: '마감 임박', desc: '이번 주 마감 청약 — D-7 이내' },
  fresh24h:  { label: '신규 공고', desc: '24시간 내 신규 청약 공고' },
  unsold:    { label: '미분양 핫', desc: '잔여 세대 많은 미분양 단지' },
  redev:     { label: '재개발 단계 변경', desc: '최근 단계 변경 재개발 단지' },
};

export function stockTabMeta(tabKey: string | undefined) {
  const k = (STOCK_TAB_META[tabKey as StockTabKey] ? tabKey : 'issue') as StockTabKey;
  const m = STOCK_TAB_META[k];
  const canonical = k === 'issue' ? `${SITE_URL}/stock` : `${SITE_URL}/stock?tab=${k}`;
  return {
    key: k,
    title: `주식 ${m.label} — 카더라`,
    description: m.desc,
    canonical,
  };
}

export function aptBlockMeta(blockKey: string | undefined) {
  const k = (APT_BLOCK_META[blockKey as AptBlockKey] ? blockKey : 'imminent') as AptBlockKey;
  const m = APT_BLOCK_META[k];
  const canonical = `${SITE_URL}/apt`;
  return {
    key: k,
    title: `${m.label} — 카더라 부동산`,
    description: m.desc,
    canonical,
  };
}

// ItemList JSON-LD — 상위 5개 종목 / 단지.
type StockItem = { symbol: string; name: string; price?: number | null };
type AptItem = { id: number | string; house_nm: string; region_nm?: string | null };

export function stockItemListJsonLd(tabLabel: string, items: StockItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `카더라 주식 ${tabLabel} TOP ${Math.min(items.length, 5)}`,
    numberOfItems: Math.min(items.length, 5),
    itemListElement: items.slice(0, 5).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${s.name} (${s.symbol})`,
      url: `${SITE_URL}/stock/${s.symbol}`,
    })),
  };
}

export function aptItemListJsonLd(blockLabel: string, items: AptItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `카더라 부동산 ${blockLabel} TOP ${Math.min(items.length, 5)}`,
    numberOfItems: Math.min(items.length, 5),
    itemListElement: items.slice(0, 5).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${a.house_nm}${a.region_nm ? ` (${a.region_nm})` : ''}`,
      url: `${SITE_URL}/apt/subscription/${a.id}`,
    })),
  };
}
