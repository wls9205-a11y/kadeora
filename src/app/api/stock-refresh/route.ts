// Data source: Naver Finance API (finance.naver.com) + Yahoo Finance API (finance.yahoo.com)
// Naver: Korean domestic stocks (KOSPI/KOSDAQ) - polling + mobile API
// Yahoo: US stocks (NYSE/NASDAQ) - v7 quote API with previousClose fallback
// Usage: Personal/non-commercial display only
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';

interface StockRow { symbol: string; name?: string; market?: string; [key: string]: unknown; }
interface StockResult { stocks: StockRow[]; success: number; failed: number; }


const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const maxDuration = 300;

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

async function fetchViaKis(supabase: SupabaseClient): Promise<StockResult | null> {
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

  // KIS는 API rate limit이 있으므로 5개씩 병렬
  const BATCH = 5;
  for (let i = 0; i < allStocks.length; i += BATCH) {
    const batch = allStocks.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (stock: StockRow) => {
        const quote = await fetchKisQuote(stock.symbol, token, appkey, appsecret);
        if (quote) {
          await supabase.from('stock_quotes')
            .update({ price: quote.price, change_amt: quote.change_amt, change_pct: Math.max(-30, Math.min(30, quote.change_pct)), volume: quote.volume, updated_at: new Date().toISOString() })
            .eq('symbol', stock.symbol);
          return true;
        }
        return false;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) success++;
      else failed++;
    }
    if (i + BATCH < allStocks.length) await sleep(200);
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
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 5000);
    const res = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.naver.com/',
      },
      signal: ctrl1.signal,
    });
    clearTimeout(t1);
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
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 5000);
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Referer': 'https://m.stock.naver.com/',
      },
      signal: ctrl2.signal,
    });
    clearTimeout(t2);
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

async function fetchViaNaver(supabase: SupabaseClient): Promise<StockResult | null> {
  const { data: allStocks } = await supabase
    .from('stock_quotes')
    .select('symbol')
    .neq('currency', 'USD')
    .order('market_cap', { ascending: false })
    .limit(250);

  if (!allStocks?.length) return null;

  let success = 0;
  let failed = 0;

  // 동시 10개씩 배치 처리 (순차→병렬, 타임아웃 대폭 단축)
  const BATCH_SIZE = 10;
  for (let i = 0; i < allStocks.length; i += BATCH_SIZE) {
    const batch = allStocks.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (stock: StockRow) => {
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
          return true;
        }
        return false;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) success++;
      else failed++;
    }
    if (i + BATCH_SIZE < allStocks.length) await sleep(100);
  }

  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('market_cap', { ascending: false });

  return { stocks: data ?? [], success, failed };
}

async function fetchViaYahoo(supabase: SupabaseClient): Promise<StockResult | null> {
  const { data: allStocks } = await supabase
    .from('stock_quotes')
    .select('symbol')
    .neq('currency', 'USD')
    .order('market_cap', { ascending: false })
    .limit(250);

  if (!allStocks?.length) return null;

  // KOSDAQ 판별: DB에서 market='KOSDAQ'인 심볼 조회
  const { data: kosdaqList } = await supabase.from('stock_quotes').select('symbol').eq('market', 'KOSDAQ');
  const kosdaqSet = new Set((kosdaqList ?? []).map((s: StockRow) => s.symbol));

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
    .filter((q: Record<string, any>) => q.regularMarketPrice)
    .map((q: Record<string, any>) => {
      const price = q.regularMarketPrice;
      const prevClose = q.regularMarketPreviousClose;
      const rawChange = q.regularMarketChange;
      const rawChangePct = q.regularMarketChangePercent;
      const change_amt = (rawChange != null && rawChange !== 0)
        ? Math.round(rawChange)
        : (prevClose ? Math.round(price - prevClose) : 0);
      const rawCalcPct = prevClose ? +(((price - prevClose) / prevClose * 100).toFixed(2)) : 0;
      const change_pct = (rawChangePct != null && rawChangePct !== 0)
        ? +(Math.max(-30, Math.min(30, rawChangePct)).toFixed(2))
        : (Math.abs(rawCalcPct) > 30 ? 0 : rawCalcPct);
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
      .limit(400);

    if (usdStocks?.length) {
      let usdSuccess = 0;
      // Yahoo Finance는 URL 길이 제한이 있으므로 100개씩 배치
      const BATCH = 100;
      for (let b = 0; b < usdStocks.length; b += BATCH) {
        const batch = usdStocks.slice(b, b + BATCH);
        const usdTickers = batch.map((s: StockRow) => s.symbol).join(',');
        try {
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
            for (const q of usdQuotes) {
              if (q.regularMarketPrice && q.symbol) {
                const price = q.regularMarketPrice;
                const prevClose = q.regularMarketPreviousClose;
                const rawChange = q.regularMarketChange;
                const rawChangePct = q.regularMarketChangePercent;
                const change_amt = (rawChange != null && rawChange !== 0)
                  ? Math.round(rawChange * 100) / 100
                  : (prevClose ? Math.round((price - prevClose) * 100) / 100 : 0);
                const rawCalcPct2 = prevClose ? +(((price - prevClose) / prevClose * 100).toFixed(2)) : 0;
                const change_pct = (rawChangePct != null && rawChangePct !== 0)
                  ? +(Math.max(-30, Math.min(30, rawChangePct)).toFixed(2))
                  : (Math.abs(rawCalcPct2) > 30 ? 0 : rawCalcPct2);
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
          }
        } catch { /* 개별 배치 실패 무시 — 다음 배치 계속 */ }
        if (b + BATCH < usdStocks.length) await sleep(200);
      }
      success += usdSuccess;
      if (usdSuccess > 0) usdUpdated = true;

      // 등락률 0% 종목 → stock_price_history에서 전일 종가 기반 계산
      try {
        const { data: zeroStocks } = await supabase
          .from('stock_quotes')
          .select('symbol, price')
          .eq('currency', 'USD')
          .eq('change_pct', 0)
          .gt('price', 0)
          .limit(200);
        if (zeroStocks?.length) {
          const today = new Date().toISOString().split('T')[0];
          for (const s of zeroStocks) {
            const { data: hist } = await supabase
              .from('stock_price_history')
              .select('close_price')
              .eq('symbol', s.symbol)
              .lt('date', today)
              .order('date', { ascending: false })
              .limit(1);
            if (hist?.[0]?.close_price && Number(hist[0].close_price) > 0) {
              const prev = Number(hist[0].close_price);
              const curr = Number(s.price);
              const rawPct = +((curr - prev) / prev * 100).toFixed(2);
              // CLAMP: ±30% 초과는 주식분할/오래된 데이터 → 무시
              const pct = Math.abs(rawPct) > 30 ? 0 : rawPct;
              if (pct !== 0) {
                await supabase.from('stock_quotes')
                  .update({ change_pct: pct, change_amt: +(curr - prev).toFixed(2) })
                  .eq('symbol', s.symbol);
              }
            }
          }
        }
      } catch { /* history fallback 실패 무시 */ }
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

  // Stale 종목 개별 재시도 (3일 이상 미갱신 — Yahoo 배치에서 누락된 종목)
  let staleRetried = 0;
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: staleStocks } = await supabase
      .from('stock_quotes')
      .select('symbol, market')
      .eq('is_active', true)
      .lt('updated_at', threeDaysAgo)
      .limit(20);

    if (staleStocks?.length) {
      // 소규모 배치로 Yahoo Finance 개별 조회
      const staleTickers = staleStocks.map(s => s.symbol).join(',');
      try {
        const staleRes = await fetch(
          `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${staleTickers}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketVolume,marketCap`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (staleRes.ok) {
          const staleJson = await staleRes.json();
          const staleQuotes = staleJson?.quoteResponse?.result ?? [];
          for (const q of staleQuotes) {
            if (q.regularMarketPrice && q.symbol) {
              const price = q.regularMarketPrice;
              const prevClose = q.regularMarketPreviousClose;
              const change_amt = q.regularMarketChange != null
                ? Math.round(q.regularMarketChange * 100) / 100
                : (prevClose ? Math.round((price - prevClose) * 100) / 100 : 0);
              const change_pct = q.regularMarketChangePercent != null
                ? +(q.regularMarketChangePercent.toFixed(2))
                : (prevClose ? +(((price - prevClose) / prevClose * 100).toFixed(2)) : 0);
              await supabase.from('stock_quotes')
                .update({
                  price, change_amt, change_pct,
                  volume: q.regularMarketVolume ?? 0,
                  market_cap: q.marketCap ?? 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('symbol', q.symbol);
              staleRetried++;
            }
          }
        }
        // Yahoo에서도 못 가져온 국내 stale 종목 → Naver 개별 시도
        const krStale = staleStocks.filter(s => s.market === 'KOSPI' || s.market === 'KOSDAQ');
        for (const ks of krStale) {
          try {
            const nRes = await fetch(`https://m.stock.naver.com/api/stock/${ks.symbol}/basic`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(5000),
            });
            if (nRes.ok) {
              const nJson = await nRes.json();
              const cp = Number(nJson.closePrice?.replace(/,/g, ''));
              if (cp > 0) {
                const prevClose = Number(nJson.compareToPreviousClosePrice?.replace(/,/g, '') || '0');
                await supabase.from('stock_quotes')
                  .update({
                    price: cp,
                    change_amt: prevClose ? cp - prevClose : 0,
                    change_pct: prevClose ? +((((cp - prevClose) / prevClose) * 100).toFixed(2)) : 0,
                    volume: Number(nJson.accumulatedTradingVolume?.replace(/,/g, '') || '0'),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('symbol', ks.symbol);
                staleRetried++;
              }
            }
          } catch { /* 개별 실패 무시 */ }
        }
      } catch { /* stale retry 전체 실패 무시 */ }
    }
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
