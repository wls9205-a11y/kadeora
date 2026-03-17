import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '실시간 주식 시세',
  description: '국내외 주요 종목 실시간 시세와 등락률을 확인하세요. KOSPI, KOSDAQ, NYSE, NASDAQ.',
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

const getCachedStocks = unstable_cache(fetchStocks, ['stock-quotes', 'v2'], { revalidate: CACHE_TTL.medium });

export default async function StockPage() {
  let stocks: { symbol: string; name: string; market: string; price: number; change_amt: number; change_pct: number; volume: number; market_cap: number; updated_at: string }[] = [];

  try {
    const data = await getCachedStocks();
    if (data.length > 0) {
      stocks = data;
    } else {
      stocks = await fetchStocks();
    }
  } catch {}

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
      <StockClient initialStocks={stocks} />
      <Disclaimer />
    </>
  );
}