import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const SYMBOLS = [
  '005930','000660','005380','035420','035720','068270','207940','006400',
  '051910','012330','028260','066570','105560','055550','086790','032830',
  '018260','017670','030200','010130','096770','009150','003550','034020',
  '010950','033780','000270','005490','000810','004020','010140','042660',
  '009830','000100','034730','003490','036570','251270','000720','088350',
  '009540','161390','029780','024110','316140','039490','071050','377300',
  '323410','352820','259960','035760','004990','028050','047810','064350',
  '012450','272210','003670','373220','267250','329180','000150','241560',
  '086520','247540','196170','357780','091990','214150','039030','145020',
  '041510','035900','122870','112040','263750','293490','042700','240810',
  '036450','030000','081660','047050','011790','139480','011170','023530',
  '032640','011500','093220','018880','006800','006110','010060','055490',
  '004990','011760',
];

async function fetchYahoo(symbols: string[]) {
  const tickers = symbols.map(s => `${s}.${s.length === 6 && parseInt(s) < 200000 ? 'KS' : 'KQ'}`).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketCap`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
  const json = await res.json();
  return json?.quoteResponse?.result ?? [];
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const BATCH = 50;
    let updated = 0;

    for (let i = 0; i < SYMBOLS.length; i += BATCH) {
      const batch = SYMBOLS.slice(i, i + BATCH);
      const quotes = await fetchYahoo(batch);

      for (const q of quotes) {
        const rawSymbol = q.symbol?.replace(/\.(KS|KQ)$/, '');
        if (!rawSymbol) continue;
        await supabase.from('stock_quotes').update({
          price: q.regularMarketPrice ?? 0,
          change_amt: q.regularMarketChange ?? 0,
          change_pct: +(q.regularMarketChangePercent ?? 0).toFixed(2),
          volume: q.regularMarketVolume ?? 0,
          market_cap: q.marketCap ?? 0,
          updated_at: new Date().toISOString(),
        }).eq('symbol', rawSymbol);
        updated++;
      }
      if (i + BATCH < SYMBOLS.length) await new Promise(r => setTimeout(r, 300));
    }

    return NextResponse.json({ ok: true, updated, ts: new Date().toISOString() });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}