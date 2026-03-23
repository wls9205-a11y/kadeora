// Data source: Naver Finance API (finance.naver.com) + Yahoo Finance API (finance.yahoo.com)
// Naver: Korean domestic stocks (KOSPI/KOSDAQ) - polling + mobile API
// Yahoo: US stocks (NYSE/NASDAQ) - v7 quote API with previousClose fallback
// Usage: Personal/non-commercial display only
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
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
    .limit(250);

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

// Naver Finance API — 국내 주식용 (가장 안정적)
async function fetchNaverQuote(symbol: string): Promise<{ price: number; change_amt: number; change_pct: number; volume: number } | null> {
  try {
    // 1순위: Naver 폴링 API
    const res = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.naver.com/',
      },
    });
    if (res.ok) {
      const json = await res.json();
      const d = json?.result?.datas?.[0];
      if (d) {
        const price = parseInt(String(d.closePriceRaw ?? '0'));
        if (price) {
          return {
            price,
            change_amt: parseInt(String(d.compareToPreviousClosePriceRaw ?? '0')),
            change_pct: parseFloat(String(d.fluctuationsRatioRaw ?? '0')),
            volume: parseInt(String(d.accumulatedTradingVolumeRaw ?? d.accumulatedTradingVolume ?? '0')),
          };
        }
      }
    }
  } catch { /* fallthrough */ }

  try {
    // 2순위: Naver 모바일 API
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Referer': 'https://m.stock.naver.com/',
      },
    });
    if (res.ok) {
      const json = await res.json();
      const price = parseInt(String(json?.closePrice ?? '0').replace(/,/g, ''));
      if (price) {
        return {
          price,
          change_amt: parseInt(String(json?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
          change_pct: parseFloat(String(json?.fluctuationsRatio ?? '0')),
          volume: parseInt(String(json?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
        };
      }
    }
  } catch { /* fallthrough */ }

  return null;
}

async function fetchViaNaver(supabase: any): Promise<{ stocks: any[]; success: number; failed: number } | null> {
  const { data: allStocks } = await supabase
    .from('stock_quotes')
    .select('symbol')
    .neq('currency', 'USD')
    .order('market_cap', { ascending: false })
    .limit(250);

  if (!allStocks?.length) return null;

  let success = 0;
  let failed = 0;

  for (const stock of allStocks) {
    const quote = await fetchNaverQuote(stock.symbol);
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
    await sleep(30);
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
    .neq('currency', 'USD')
    .order('market_cap', { ascending: false })
    .limit(250);

  if (!allStocks?.length) return null;

  // KOSDAQ 판별: DB에서 market='KOSDAQ'인 심볼 조회
  const { data: kosdaqList } = await supabase.from('stock_quotes').select('symbol').eq('market', 'KOSDAQ');
  const kosdaqSet = new Set((kosdaqList ?? []).map((s: any) => s.symbol));

  const tickers = allStocks.map((s: any) =>
    `${s.symbol}.${kosdaqSet.has(s.symbol) ? 'KQ' : 'KS'}`
  ).join(',');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketVolume,marketCap`,
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
    .map((q: any) => {
      const price = q.regularMarketPrice;
      const prevClose = q.regularMarketPreviousClose;
      const rawChange = q.regularMarketChange;
      const rawChangePct = q.regularMarketChangePercent;
      const change_amt = (rawChange != null && rawChange !== 0)
        ? Math.round(rawChange)
        : (prevClose ? Math.round(price - prevClose) : 0);
      const change_pct = (rawChangePct != null && rawChangePct !== 0)
        ? +(rawChangePct.toFixed(2))
        : (prevClose ? +(((price - prevClose) / prevClose * 100).toFixed(2)) : 0);
      return {
        symbol: q.symbol?.replace(/\.(KS|KQ)$/, ''),
        price,
        change_amt,
        change_pct,
        volume: q.regularMarketVolume ?? 0,
        market_cap: q.marketCap ?? 0,
        updated_at: new Date().toISOString(),
      };
    });

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

  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // 장 운영시간 체크 (KST 09:00~15:30)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  const isMarketOpen = (hour > 9 || (hour === 9 && min >= 0)) && (hour < 15 || (hour === 15 && min <= 30));
  const isWeekday = kst.getUTCDay() >= 1 && kst.getUTCDay() <= 5;

  let success = 0;
  let failed = 0;
  let domesticSource: 'kis' | 'naver' | 'yahoo' | 'cache' = 'cache';

  // 국내주식 갱신 (장 운영시간에만)
  if (isMarketOpen && isWeekday) {
    // 1) KIS API 시도 — 환경변수 없으면 스킵
    if (process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET) {
      try {
        const kisResult = await fetchViaKis(supabase);
        if (kisResult) {
          success += kisResult.success;
          failed += kisResult.failed;
          domesticSource = 'kis';
        }
      } catch {
        // KIS 실패 -> Naver 폴백
      }
    }

    // 2) KIS 실패/스킵 시 Naver Finance 폴백 (가장 안정적)
    if (domesticSource === 'cache') {
      try {
        const naverResult = await fetchViaNaver(supabase);
        if (naverResult) {
          success += naverResult.success;
          failed += naverResult.failed;
          domesticSource = 'naver';
        }
      } catch {
        // Naver 실패 -> Yahoo 폴백
      }
    }

    // 3) Naver도 실패 시 Yahoo Finance 폴백
    if (domesticSource === 'cache') {
      try {
        const yahooResult = await fetchViaYahoo(supabase);
        if (yahooResult) {
          success += yahooResult.success;
          failed += yahooResult.failed;
          domesticSource = 'yahoo';
        }
      } catch {
        // Yahoo 실패 -> 캐시 사용
      }
    }
  }

  // 해외주식 갱신 (USD 종목) — 해외 장 시간이 다르므로 항상 시도
  let usdUpdated = false;
  try {
    const { data: usdStocks } = await supabase
      .from('stock_quotes')
      .select('symbol')
      .eq('currency', 'USD')
      .order('market_cap', { ascending: false })
      .limit(100);

    if (usdStocks?.length) {
      const usdTickers = usdStocks.map((s: any) => s.symbol).join(',');
      const usdController = new AbortController();
      const usdTimeout = setTimeout(() => usdController.abort(), 10000);

      const usdRes = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${usdTickers}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketVolume,marketCap`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          signal: usdController.signal,
        }
      );
      clearTimeout(usdTimeout);

      if (usdRes.ok) {
        const usdJson = await usdRes.json();
        const usdQuotes = usdJson?.quoteResponse?.result ?? [];
        let usdSuccess = 0;
        for (const q of usdQuotes) {
          if (q.regularMarketPrice && q.symbol) {
            const price = q.regularMarketPrice;
            const prevClose = q.regularMarketPreviousClose;
            const rawChange = q.regularMarketChange;
            const rawChangePct = q.regularMarketChangePercent;
            const change_amt = (rawChange != null && rawChange !== 0)
              ? Math.round(rawChange * 100) / 100
              : (prevClose ? Math.round((price - prevClose) * 100) / 100 : 0);
            const change_pct = (rawChangePct != null && rawChangePct !== 0)
              ? +(rawChangePct.toFixed(2))
              : (prevClose ? +(((price - prevClose) / prevClose * 100).toFixed(2)) : 0);
            await supabase.from('stock_quotes')
              .update({
                price,
                change_amt,
                change_pct,
                volume: q.regularMarketVolume ?? 0,
                market_cap: q.marketCap ?? 0,
                updated_at: new Date().toISOString(),
              })
              .eq('symbol', q.symbol);
            usdSuccess++;
          }
        }
        success += usdSuccess;
        if (usdSuccess > 0) usdUpdated = true;
      }
    }
  } catch {
    // USD 갱신 실패 시 무시 — 국내 결과만 반환
  }

  // price=0 종목 자동 비활성화 (7일 이상 시세 없으면)
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    await supabase
      .from('stock_quotes')
      .update({ is_active: false })
      .eq('price', 0)
      .lt('updated_at', sevenDaysAgo);
  } catch {}

  // 최종 DB 조회
  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('market_cap', { ascending: false });

  const source = usdUpdated
    ? `${domesticSource}+usd`
    : domesticSource;

  return NextResponse.json({
    stocks: data ?? [],
    updated: success,
    source,
    success,
    failed,
    ...(!isMarketOpen || !isWeekday ? { reason: 'domestic_market_closed' } : {}),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  });
}
