import { Suspense } from 'react';
import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';

export const revalidate = 60;

const SECTION_META: Record<string, { title: string; desc: string }> = {
  'stock-kr':      { title: '국내 주식 시세', desc: 'KOSPI·KOSDAQ 실시간 시세와 등락률을 확인하세요' },
  'stock-us':      { title: '해외 주식 시세', desc: 'NASDAQ·S&P 500 글로벌 종목 시세와 등락률' },
  'stock-heatmap': { title: '섹터별 등락률 히트맵', desc: '업종별 시장 흐름을 한눈에 파악하세요' },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ section?: string }> }): Promise<Metadata> {
  const { section } = await searchParams;
  const s = section ? SECTION_META[section] : null;
  const title = s?.title || '실시간 주식 시세 — KOSPI·KOSDAQ·해외주식';
  const desc = s?.desc || '국내외 주요 종목 실시간 시세, 등락률, 배당금, PER, 섹터 분석, AI 시황 브리핑, 포트폴리오 시뮬레이터. 카더라에서 무료로 확인하세요.';
  const ogImg = section ? `${SITE_URL}/api/og?section=${section}&design=2` : `${SITE_URL}/api/og?title=${encodeURIComponent('실시간 주식 시세')}&subtitle=${encodeURIComponent('KOSPI·KOSDAQ·해외주식')}&category=stock`;

  return {
    title, description: desc,
    alternates: { canonical: SITE_URL + '/stock' },
    openGraph: {
      title, description: desc,
      url: SITE_URL + '/stock',
      siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [
        { url: ogImg, width: 1200, height: 630, alt: `카더라 ${title}` },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('실시간 주식 시세')}&category=stock`, width: 630, height: 630, alt: `카더라 ${title}` },
      ],
    },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'naver:author': '카더라',
      'og:updated_time': new Date().toISOString(),
      'dg:plink': SITE_URL + '/stock',
      'article:section': '주식',
      'article:tag': '주식,시세,KOSPI,KOSDAQ,실시간,등락률',
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogImg] },
  };
}
import { createSupabaseServer } from '@/lib/supabase-server';
import { unstable_cache } from 'next/cache';
import StockClient from './StockClient';
// s205-W2: StockHeroCarousel + HeroCard "오늘의 종목" 제거 — 14d 클릭 0건, hero refresh cron 도 정리.
import Disclaimer from '@/components/Disclaimer';

async function fetchStocks() {
  const sb = await createSupabaseServer();
  // 세션 138: get_stocks_with_thumbnails RPC 로 교체 — stock_images 1장 thumbnail 병합
  // 반환 TABLE: symbol, name, market, price, change_amt, change_pct, volume, market_cap,
  //            currency, ticker, description, sector, per, pbr, dividend_yield,
  //            logo_url, thumbnail, page_views, comment_count
  const { data } = await (sb as any).rpc('get_stocks_with_thumbnails', {
    p_market: null,
    p_limit: 500,
    p_offset: 0,
    p_sort: 'market_cap',
  });
  return data ?? [];
}

async function fetchBriefing() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_daily_briefing')
    .select('id, market, briefing_date, title, summary, sentiment, top_gainers, top_losers')
    .eq('market', 'KR')
    .order('briefing_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function fetchBriefingUS() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_daily_briefing')
    .select('id, market, briefing_date, title, summary, sentiment, top_gainers, top_losers')
    .eq('market', 'US')
    .order('briefing_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function fetchExchangeHistory() {
  const sb = await createSupabaseServer();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await sb
    .from('exchange_rate_history')
    .select('id, currency_pair, rate, change_pct, recorded_at')
    .eq('currency_pair', 'USD/KRW')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });
  return data ?? [];
}

async function fetchThemeHistory() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_theme_history')
    .select('id, theme_id, theme_name, change_pct, recorded_date')
    .order('recorded_date', { ascending: false })
    .limit(20);
  return data ?? [];
}

// Cache: 300s — 주식 목록 (시세 크론 5분 주기)
const getCachedStocks = unstable_cache(fetchStocks, ['stock-quotes', 'v6'], { revalidate: 60 });
const getCachedBriefing = unstable_cache(fetchBriefing, ['stock-briefing', 'v1'], { revalidate: 600 });
const getCachedBriefingUS = unstable_cache(fetchBriefingUS, ['stock-briefing-us', 'v1'], { revalidate: 600 });
const getCachedExchangeHistory = unstable_cache(fetchExchangeHistory, ['exchange-history', 'v1'], { revalidate: 3600 });
const getCachedThemeHistory = unstable_cache(fetchThemeHistory, ['theme-history', 'v1'], { revalidate: 600 });

// s205-W2: fetchHeroSlides + getCachedHeroSlides 제거 — stock_hero_slides 13개 활성 중복, 클릭 0건.

export default async function StockPage() {
  let stocks: Record<string, any>[] = [];
  let briefing: any = null;
  let briefingUS: any = null;
  let exchangeHistory: Record<string, any>[] = [];
  let themeHistory: Record<string, any>[] = [];

  try {
    const [stocksData, briefingData, briefingUSData, exchData, themeData] = await Promise.all([
      getCachedStocks(),
      getCachedBriefing().catch(() => null),
      getCachedBriefingUS().catch(() => null),
      getCachedExchangeHistory().catch(() => []),
      getCachedThemeHistory().catch(() => []),
    ]);
    stocks = stocksData.length > 0 ? stocksData : await fetchStocks();
    briefing = briefingData;
    briefingUS = briefingUSData;
    exchangeHistory = exchData;
    themeHistory = themeData;
  } catch {
    try { stocks = await fetchStocks(); } catch {}
  }

  return (
    <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 1 }} />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "DataCatalog",
        "name": "카더라 실시간 주식 시세",
        "description": "KOSPI, KOSDAQ, NYSE, NASDAQ 주요 종목 실시간 시세",
        "url": SITE_URL + "/stock",
        "inLanguage": "ko-KR",
        "provider": { "@type": "Organization", "name": "카더라", "url": SITE_URL }
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "홈", "item": SITE_URL },
          { "@type": "ListItem", "position": 2, "name": "주식 시세", "item": SITE_URL + "/stock" },
        ]
      }) }} />
      {/* FAQ JSON-LD (검색결과 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "카더라에서 어떤 주식을 볼 수 있나요?", "acceptedAnswer": { "@type": "Answer", "text": "KOSPI, KOSDAQ, NYSE, NASDAQ 등 국내외 주요 종목의 실시간 시세를 제공합니다. 테마별 동향, 섹터 히트맵, AI 종목 분석, 투자자 매매동향까지 확인 가능합니다." } },
          { "@type": "Question", "name": "주식 시세는 얼마나 자주 업데이트되나요?", "acceptedAnswer": { "@type": "Answer", "text": "장중에는 5~10분 간격으로 시세가 업데이트됩니다. 장 마감 후에도 종가 기준 데이터를 제공합니다." } },
          { "@type": "Question", "name": "카더라 주식 서비스는 무료인가요?", "acceptedAnswer": { "@type": "Answer", "text": "네, 카더라의 모든 주식 시세 조회, 차트, 수급 분석, AI 한줄평, 종목 토론 기능은 완전 무료입니다. 카카오 로그인으로 관심종목 등록, 가격 알림도 무료로 사용할 수 있습니다." } },
        ],
      }) }} />
      {/* speakable — 네이버 음성검색 + 스마트 스니펫 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", "name": "실시간 주식 시세", "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", ".market-status", ".briefing-summary"] } }) }} />
      {/* ItemList JSON-LD (Google 캐러셀) — 상위 10 종목 */}
      {stocks.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "ItemList",
        "name": "실시간 인기 종목",
        "numberOfItems": Math.min(stocks.length, 10),
        "itemListElement": stocks.slice(0, 10).map((s: any, i: number) => ({
          "@type": "ListItem",
          "position": i + 1,
          "name": `${s.name} (${s.symbol})`,
          "url": `${SITE_URL}/stock/${s.symbol}`,
          "image": `${SITE_URL}/api/og-square?title=${encodeURIComponent(s.name + ' ' + s.symbol)}&category=stock`,
          "description": `${s.name} ${s.market || ''} ${s.price ? `현재가 ${Number(s.price).toLocaleString()}` : ''}`.trim(),
        })),
      }) }} />}
      <h1 className="sr-only">주식 시세 — 실시간 국내외 종목</h1>
      <p className="sr-only">카더라 주식에서는 KOSPI·KOSDAQ·NYSE·NASDAQ {stocks.length}개 종목의 실시간 시세, 등락률, 시가총액, PER, 배당수익률을 확인할 수 있습니다. AI 시황 브리핑, 섹터별 히트맵, 테마주 분석, 포트폴리오 시뮬레이터를 무료로 제공합니다.</p>
      {/* LiveBar 는 (main)/layout 의 LiveBarChrome 으로 통합. */}
      {/* s205-W2: "오늘의 종목" HeroCard + StockHeroCarousel 2종 제거 — 14d /stock 23 PV, 클릭 0건 */}
      <StockClient initialStocks={stocks as React.ComponentProps<typeof StockClient>['initialStocks']} briefing={briefing} briefingUS={briefingUS} exchangeHistory={exchangeHistory} themeHistory={themeHistory} />
      {/* C-7: noscript — JS 비활성화 크롤러용 기본 종목 목록 */}
      <noscript>
        <div style={{ padding: 20 }}>
          <h2>주요 종목 시세</h2>
          <ul>
            {stocks.slice(0, 20).map((s: any) => (
              <li key={s.symbol}><a href={`/stock/${s.symbol}`}>{s.name} ({s.symbol}) — {s.market} {s.price ? `${Number(s.price).toLocaleString()}원` : ''}</a></li>
            ))}
          </ul>
        </div>
      </noscript>
      {/* StockClient 내부에 Disclaimer compact 있음 — 중복 제거 */}
    </Suspense>
  );
}