import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Yahoo Finance 시도, 실패하면 DB 그대로 반환
  try {
    const KOSDAQ_SYMBOLS = new Set([
      '086520','247540','196170','357780','091990','214150','039030','145020',
      '041510','035900','122870','112040','263750','293490','042700','240810',
      '018290','950130',
    ]);

    const { data: allStocks } = await supabase
      .from('stock_quotes')
      .select('symbol')
      .order('market_cap', { ascending: false })
      .limit(50);

    if (!allStocks?.length) throw new Error('no stocks');

    const tickers = allStocks.map(s =>
      `${s.symbol}.${KOSDAQ_SYMBOLS.has(s.symbol) ? 'KQ' : 'KS'}`
    ).join(',');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const quotes = json?.quoteResponse?.result ?? [];

      if (quotes.length > 0) {
        const updates = quotes
          .filter((q: any) => q.regularMarketPrice)
          .map((q: any) => ({
            symbol: q.symbol?.replace(/\.(KS|KQ)$/, ''),
            price: q.regularMarketPrice,
            change_amt: Math.round(q.regularMarketChange ?? 0),
            change_pct: +((q.regularMarketChangePercent ?? 0).toFixed(2)),
            volume: q.regularMarketVolume ?? 0,
            market_cap: q.marketCap ?? 0,
            updated_at: new Date().toISOString(),
          }));

        for (const u of updates) {
          if (u.symbol) {
            await supabase.from('stock_quotes')
              .update({
                price: u.price,
                change_amt: u.change_amt,
                change_pct: u.change_pct,
                volume: u.volume,
                market_cap: u.market_cap,
                updated_at: u.updated_at,
              })
              .eq('symbol', u.symbol);
          }
        }
      }
    }
  } catch {
    // Yahoo 실패 시 DB 데이터 반환
  }

  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('market_cap', { ascending: false });

  return NextResponse.json({ stocks: data ?? [], updated: data?.length ?? 0 });
}