import { Suspense } from 'react';
import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '실시간 주식 시세',
  description: '국내외 주요 종목 실시간 시세와 등락률을 확인하세요. KOSPI, KOSDAQ, NYSE, NASDAQ.',
  alternates: { canonical: SITE_URL + '/stock' },
  openGraph: {
    title: '실시간 주식 시세',
    description: '국내외 주요 종목 실시간 시세와 등락률',
    images: [{ url: SITE_URL + '/images/brand/kadeora-wide.png', alt: '카더라 주식' }],
  },
};
import { createSupabaseServer } from '@/lib/supabase-server';
import { unstable_cache } from 'next/cache';
import { CACHE_TTL } from '@/lib/cache-config';
import StockClient from './StockClient';
import Disclaimer from '@/components/Disclaimer';

async function fetchStocks() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_quotes')
    .select('symbol, name, market, price, change_amt, change_pct, volume, market_cap, currency, sector, updated_at, is_active, description')
    .order('market_cap', { ascending: false });
  return data ?? [];
}

async function fetchBriefing() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_daily_briefing')
    .select('id, market, briefing_date, summary, top_gainers, top_losers, market_sentiment')
    .eq('market', 'KR')
    .order('briefing_date', { ascending: false })
    .limit(1)
    .single();
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
const getCachedStocks = unstable_cache(fetchStocks, ['stock-quotes', 'v3'], { revalidate: 300 });
const getCachedBriefing = unstable_cache(fetchBriefing, ['stock-briefing', 'v1'], { revalidate: 600 });
const getCachedExchangeHistory = unstable_cache(fetchExchangeHistory, ['exchange-history', 'v1'], { revalidate: 3600 });
const getCachedThemeHistory = unstable_cache(fetchThemeHistory, ['theme-history', 'v1'], { revalidate: 600 });

export default async function StockPage() {
  let stocks: any[] = [];
  let briefing: any = null;
  let exchangeHistory: any[] = [];
  let themeHistory: any[] = [];

  try {
    const [stocksData, briefingData, exchData, themeData] = await Promise.all([
      getCachedStocks(),
      getCachedBriefing().catch(() => null),
      getCachedExchangeHistory().catch(() => []),
      getCachedThemeHistory().catch(() => []),
    ]);
    stocks = stocksData.length > 0 ? stocksData : await fetchStocks();
    briefing = briefingData;
    exchangeHistory = exchData;
    themeHistory = themeData;
  } catch {
    try { stocks = await fetchStocks(); } catch {}
  }

  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>주식 시세를 불러오는 중...</div>}>
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
      <StockClient initialStocks={stocks as any} briefing={briefing} exchangeHistory={exchangeHistory} themeHistory={themeHistory} />
      <Disclaimer />
    </Suspense>
  );
}