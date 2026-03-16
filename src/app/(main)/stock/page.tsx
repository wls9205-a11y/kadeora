import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '주식 시세',
  description: '실시간 국내 주식 시세 - KOSPI, KOSDAQ 주요 종목',
};
import { createSupabaseServer } from '@/lib/supabase-server';
import StockClient from './StockClient';

export default async function StockPage() {
  let stocks: { symbol: string; name: string; market: string; price: number; change_amt: number; change_pct: number; volume: number; market_cap: number; updated_at: string }[] = [];

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from('stock_quotes')
      .select('*')
      .order('market_cap', { ascending: false });
    if (data && data.length > 0) {
      stocks = data;
    }
  } catch {}

  return <StockClient initialStocks={stocks} />;
}