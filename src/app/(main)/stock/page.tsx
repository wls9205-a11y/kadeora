import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '주식 시세',
  description: '실시간 국내 주식 시세 - KOSPI, KOSDAQ 주요 종목',
};
import { createSupabaseServer } from '@/lib/supabase-server';
import StockClient from './StockClient';

export default async function StockPage() {
  let stocks: any[] = [];
  let isDemo = true;

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from('stock_quotes')
      .select('*')
      .order('market_cap', { ascending: false });
    if (data && data.length > 0) {
      stocks = data;
      isDemo = false;
    }
  } catch {}

  return <StockClient initialStocks={stocks} isDemo={isDemo} />;
}