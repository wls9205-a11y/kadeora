// s262 Phase E — Per-tab SSR metadata + ItemList JSON-LD 헬퍼.
// /stock 7 tab × /apt 5 block = 12 variant. canonical + title + description + JSON-LD.

import { SITE_URL } from '@/lib/constants';

type StockTabKey = 'issue' | 'mcap' | 'gain' | 'loss' | 'volume' | 'foreign' | 'watch';
type AptBlockKey = 'regulated' | 'imminent' | 'fresh24h' | 'unsold' | 'redev';

// s274 — title 은 검색 질의문에 맞춘 문장으로 분리한다.
// 이전엔 label 만 조합해 "주식 급등" 같은, 아무도 검색하지 않는 타이틀이 나갔다.
// 또 title 에 '— 카더라' 를 직접 붙이고 있었는데 (main)/layout 의 `%s | 카더라`
// 템플릿이 한 번 더 붙어 "주식 이슈 — 카더라 | 카더라" 로 브랜드가 중복됐다.
// 브랜드 접미사는 템플릿에 맡기고 여기서는 붙이지 않는다.
const STOCK_TAB_META: Record<StockTabKey, { label: string; title: string; desc: string }> = {
  issue:   { label: '이슈',     title: '오늘의 이슈 종목 — 거래량·등락 급변 TOP 30',   desc: '오늘 가장 변동성 큰 종목 — 거래량·등락폭·신선도 종합 점수' },
  mcap:    { label: '시총',     title: '코스피·코스닥 시가총액 순위 TOP 30',           desc: '시가총액 상위 종목 — KOSPI·KOSDAQ' },
  gain:    { label: '급등',     title: '오늘의 급등주 — 상승률 상위 종목',             desc: '오늘 등락률 상위 종목' },
  loss:    { label: '급락',     title: '오늘의 급락주 — 하락률 상위 종목',             desc: '오늘 등락률 하위 종목' },
  volume:  { label: '거래폭증', title: '거래량 급증 종목 — 30일 평균 대비 폭증주',     desc: '거래량 폭증 종목 — 30일 평균 대비' },
  foreign: { label: '외인',     title: '외국인 순매수 상위 종목',                      desc: '외국인 순매수 상위 종목' },
  watch:   { label: '관심',     title: '내 관심 종목',                                 desc: '내 관심 종목' },
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
    title: m.title,
    description: m.desc,
    canonical,
    // 관심 탭은 비로그인 SSR 이 항상 빈 배열이라 크롤러에겐 빈 페이지다. 색인 제외.
    noindex: k === 'watch',
  };
}

export function aptBlockMeta(blockKey: string | undefined) {
  const k = (APT_BLOCK_META[blockKey as AptBlockKey] ? blockKey : 'imminent') as AptBlockKey;
  const m = APT_BLOCK_META[k];
  const canonical = `${SITE_URL}/apt`;
  return {
    key: k,
    // stockTabMeta 와 동일 — 브랜드 접미사는 layout 템플릿에 맡긴다.
    title: `${m.label} — 아파트 청약`,
    description: m.desc,
    canonical,
  };
}

// ItemList JSON-LD — 상위 5개 종목.
//
// v8: aptItemListJsonLd 는 삭제했다. 호출부가 0건인데 안에 /apt/subscription/{id} —
// 실재하지 않는 라우트가 남아 있었다. 지금 색인에 나가지는 않지만 누가 되살리면
// 죽은 URL 을 구조화 데이터로 제출하게 된다 (AptThumbnailCard·AptIssueCard 와 같은 유형).
// /apt 의 ItemList 는 lib/apt/subscription-schema.ts 가 aptHref() 로 이미 만들고 있다.
type StockItem = { symbol: string; name: string; price?: number | null };

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
