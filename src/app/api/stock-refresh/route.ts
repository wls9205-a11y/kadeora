import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const KOSDAQ_SYMBOLS = new Set([
  '086520','247540','196170','357780','091990','214150','039030','145020',
  '041510','035900','122870','112040','263750','293490','042700','240810',
  '018290','950130',
]);

async function getKisToken(appkey: string, appsecret: string): Promise<string | null> {
  try {
    const res = await fetch('https://openapi.koreainvestment.com:9443/oauth2/tokenP', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey,
        appsecret,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchKisQuote(
  symbol: string,
  token: string,
  appkey: string,
  appsecret: string
): Promise<any | null> {
  try {
    const url = `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${symbol}`;
    const res = await fetch(url, {
      headers: {
        'authorization': `Bearer ${token}`,
        'appkey': appkey,
        'appsecret': appsecret,
        'tr_id': 'FHKST01010100',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const o = json?.output;
    if (!o || !o.stck_prpr) return null;
    return {
      price: Number(o.stck_prpr),
      change_amt: Number(o.prdy_vrss),
      change_pct: Number(o.prdy_ctrt),
      volume: Number(o.acml_vol),
    };
  } catch {
    return null;
  }
}

async function fetchViaKis(supabase: any): Promise<{ stocks: any[]; success: number; failed: number } | null> {
  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) return null;

  const token = await getKisToken(appkey, appsecret);
  if (!token) return null;

  const { data: allStocks } = await supabase
    .from('stock_quotes')
    .select('symbol')
    .order('market_cap', { ascending: false })
    .limit(50);

  if (!allStocks?.length) return null;

  let success = 0;
  let failed = 0;

  for (const stock of allStocks) {
    const quote = await fetchKisQuote(stock.symbol, token, appkey, appsecret);
    if (quote) {
      await supabase.from('stock_quotes')
        .update({
          price: quote.price,
          change_amt: quote.change_amt,
          change_pct: quote.change_pct,
          volume: quote.volume,
          updated_at: new Date().toISOString(),
        })
        .eq('symbol', stock.symbol);
      success++;
    } else {
      failed++;
    }
    await sleep(50);
  }

  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('market_cap', { ascending: false });

  return { stocks: data ?? [], success, failed };
}

async function fetchViaYahoo(supabase: any): Promise<{ stocks: any[]; success: number; failed: number } | null> {
  const { data: allStocks } = await supabase
    .from('stock_quotes')
    .select('symbol')
    .order('market_cap', { ascending: false })
    .limit(50);

  if (!allStocks?.length) return null;

  const tickers = allStocks.map((s: any) =>
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

  if (!res.ok) return null;

  const json = await res.json();
  const quotes = json?.quoteResponse?.result ?? [];
  if (quotes.length === 0) return null;

  let success = 0;
  let failed = 0;

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
      success++;
    } else {
      failed++;
    }
  }

  failed += allStocks.length - quotes.length;

  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('market_cap', { ascending: false });

  return { stocks: data ?? [], success, failed };
}

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'auth'))) return rateLimitResponse();

  // CRON_SECRET 체크
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!cronSecret || token !== cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 장 운영시간 체크 (KST 09:00~15:30)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  const isMarketOpen = (hour > 9 || (hour === 9 && min >= 0)) && (hour < 15 || (hour === 15 && min <= 30));
  const isWeekday = kst.getUTCDay() >= 1 && kst.getUTCDay() <= 5;

  if (!isMarketOpen || !isWeekday) {
    const { data } = await supabase
      .from('stock_quotes')
      .select('*')
      .order('market_cap', { ascending: false });

    return NextResponse.json({ stocks: data ?? [], updated: 0, source: 'cache', reason: 'market_closed' });
  }

  // 1) KIS API 시도
  try {
    const kisResult = await fetchViaKis(supabase);
    if (kisResult) {
      return NextResponse.json({
        stocks: kisResult.stocks,
        updated: kisResult.success,
        source: 'kis' as const,
        success: kisResult.success,
        failed: kisResult.failed,
      });
    }
  } catch {
    // KIS 실패 -> Yahoo 폴백
  }

  // 2) Yahoo Finance 폴백
  try {
    const yahooResult = await fetchViaYahoo(supabase);
    if (yahooResult) {
      return NextResponse.json({
        stocks: yahooResult.stocks,
        updated: yahooResult.success,
        source: 'yahoo' as const,
        success: yahooResult.success,
        failed: yahooResult.failed,
      });
    }
  } catch {
    // Yahoo 실패 -> DB 캐시 폴백
  }

  // 3) 둘 다 실패시 DB 캐시 반환
  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('market_cap', { ascending: false });

  return NextResponse.json({
    stocks: data ?? [],
    updated: 0,
    source: 'cache' as const,
    success: 0,
    failed: 0,
  });
}
