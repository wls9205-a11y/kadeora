import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '실시간 주식 시세',
  description: '국내외 주요 종목 실시간 시세와 등락률을 확인하세요. KOSPI, KOSDAQ, NYSE, NASDAQ.',
  openGraph: {
    title: '주식 시세 | 카더라',
    description: '국내외 주요 종목 실시간 시세와 등락률',
    images: [{ url: 'https://kadeora.app/images/brand/kadeora-wide.png', alt: '카더라 주식' }],
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
    .select('*')
    .order('market_cap', { ascending: false });
  return data ?? [];
}

async function fetchBriefing() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_daily_briefing')
    .select('*')
    .eq('market', 'KR')
    .order('briefing_date', { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

async function fetchExchangeHistory() {
  const sb = await createSupabaseServer();
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb
    .from('exchange_rate_history')
    .select('*')
    .eq('pair', 'USD/KRW')
    .gte('date', since)
    .order('date', { ascending: true });
  return data ?? [];
}

async function fetchThemeHistory() {
  const sb = await createSupabaseServer();
  const { data } = await sb
    .from('stock_theme_history')
    .select('*')
    .order('date', { ascending: false })
    .limit(20);
  return data ?? [];
}

// Cache: 300s — 주식 목록 (시세 크론 5분 주기)
const getCachedStocks = unstable_cache(fetchStocks, ['stock-quotes', 'v3'], { revalidate: 300 });
const getCachedBriefing = unstable_cache(fetchBriefing, ['stock-briefing', 'v1'], { revalidate: 600 });
const getCachedExchangeHistory = unstable_cache(fetchExchangeHistory, ['exchange-history', 'v1'], { revalidate: 3600 });
const getCachedThemeHistory = unstable_cache(fetchThemeHistory, ['theme-history', 'v1'], { revalidate: 600 });

export default async function StockPage() {
  let stocks: { symbol: string; name: string; market: string; price: number; change_amt: number; change_pct: number; volume: number; market_cap: number; updated_at: string }[] = [];
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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "DataCatalog",
        "name": "카더라 실시간 주식 시세",
        "description": "KOSPI, KOSDAQ, NYSE, NASDAQ 주요 종목 실시간 시세",
        "url": "https://kadeora.app/stock",
        "inLanguage": "ko-KR",
        "provider": { "@type": "Organization", "name": "카더라", "url": "https://kadeora.app" }
      }) }} />
      <StockClient initialStocks={stocks} briefing={briefing} exchangeHistory={exchangeHistory} themeHistory={themeHistory} />
      <Disclaimer />
    </>
  );
}