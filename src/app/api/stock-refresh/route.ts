import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const BATCH_SYMBOLS = [
    '005930','000660','005380','035420','035720','068270','207940','006400',
    '051910','012330','028260','066570','105560','055550','086790','000270',
    '005490','000810','373220','259960','352820','323410','377300','012450',
    '329180','009540','086520','247540','196170','357780','042700','145020',
    '041510','035900','293490','091990','214150','064350','047810','272210',
  ];

  try {
    const tickers = BATCH_SYMBOLS.map(s => {
      const num = parseInt(s);
      const suffix = (num >= 900000 || (num >= 100000 && num < 200000) ||
        ['086520','247540','196170','357780','091990','214150','039030','145020',
         '041510','035900','122870','112040','263750','293490','042700','240810'].includes(s))
        ? 'KQ' : 'KS';
      return `${s}.${suffix}`;
    }).join(',');

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await res.json();
    const quotes = json?.quoteResponse?.result ?? [];

    const updates = [];
    for (const q of quotes) {
      const sym = q.symbol?.replace(/\.(KS|KQ)$/, '');
      if (!sym || !q.regularMarketPrice) continue;
      updates.push({
        symbol: sym,
        price: q.regularMarketPrice,
        change_amt: +(q.regularMarketChange ?? 0).toFixed(0),
        change_pct: +(q.regularMarketChangePercent ?? 0).toFixed(2),
        volume: q.regularMarketVolume ?? 0,
        market_cap: q.marketCap ?? 0,
        updated_at: new Date().toISOString(),
      });
    }

    for (const u of updates) {
      await supabase.from('stock_quotes')
        .upsert(u, { onConflict: 'symbol' });
    }

    const { data } = await supabase
      .from('stock_quotes')
      .select('*')
      .order('market_cap', { ascending: false });

    return NextResponse.json({ stocks: data, updated: updates.length });
  } catch (e: unknown) {
    const { data } = await supabase
      .from('stock_quotes')
      .select('*')
      .order('market_cap', { ascending: false });
    return NextResponse.json({ stocks: data, updated: 0, error: String(e) });
  }
}