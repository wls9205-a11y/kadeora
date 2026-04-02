import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://m.stock.naver.com/' };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 네이버 시총 상위 종목 목록 수집
async function fetchNaverMarketList(market: 'KOSPI' | 'KOSDAQ'): Promise<{ symbol: string; name: string; price: number; change_pct: number; market_cap: number; volume: number }[]> {
  const results: any[] = [];
  try {
    // 네이버 모바일 시총순 종목 목록 API
    const res = await fetch(`https://m.stock.naver.com/api/stocks/marketValue/${market}?page=1&pageSize=100`, {
      headers: HEADERS, signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const json = await res.json();
      const stocks = json?.stocks ?? json?.result ?? json?.data ?? [];
      const list = Array.isArray(stocks) ? stocks : [];
      for (const s of list) {
        const symbol = s.itemCode ?? s.stockCode ?? s.code ?? '';
        const name = s.stockName ?? s.itemName ?? s.name ?? '';
        const price = parseInt(String(s.closePrice ?? s.now ?? '0').replace(/,/g, ''));
        const changePct = parseFloat(String(s.fluctuationsRatio ?? s.changeRate ?? '0'));
        const marketCap = parseInt(String(s.marketCap ?? s.marketSum ?? s.totalMarketValue ?? '0').replace(/,/g, ''));
        const volume = parseInt(String(s.accumulatedTradingVolume ?? s.volume ?? '0').replace(/,/g, ''));
        if (symbol && name && price > 0) {
          results.push({ symbol, name, price, change_pct: Math.max(-30, Math.min(30, changePct)), market_cap: marketCap, volume });
        }
      }
    }
  } catch { /* fallback below */ }

  // 폴백: 다른 API 형식 시도
  if (results.length === 0) {
    try {
      const res = await fetch(`https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=market_sum&sortOrder=desc`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.naver.com/' },
        signal: AbortSignal.timeout(10000),
      });
      // This is ETF-specific, skip if failed
    } catch { /* ignore */ }
  }

  return results;
}

// 네이버 해외주식 인기 종목 목록
async function fetchNaverWorldList(): Promise<{ symbol: string; name: string; market: string; price: number; change_pct: number }[]> {
  const results: any[] = [];
  for (const market of ['NYSE', 'NASDAQ'] as const) {
    try {
      const suffix = market === 'NASDAQ' ? 'NASDAQ' : 'NYSE';
      const res = await fetch(`https://api.stock.naver.com/stock/exchange/${suffix}/marketValue?page=1&pageSize=50`, {
        headers: { ...HEADERS, Referer: 'https://m.stock.naver.com/worldstock/' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const json = await res.json();
        const stocks = json?.stocks ?? json?.result ?? json?.data ?? [];
        const list = Array.isArray(stocks) ? stocks : [];
        for (const s of list) {
          const symbol = (s.symbolCode ?? s.stockCode ?? s.symbol ?? '').replace(/\.(O|N|K)$/, '');
          const name = s.stockName ?? s.name ?? '';
          const price = parseFloat(String(s.closePrice ?? s.now ?? '0').replace(/,/g, ''));
          const changePct = parseFloat(String(s.fluctuationsRatio ?? s.changeRate ?? '0'));
          if (symbol && name && price > 0) {
            results.push({ symbol, name, market, price, change_pct: Math.max(-30, Math.min(30, changePct)) });
          }
        }
      }
    } catch { /* continue */ }
    await sleep(500);
  }
  return results;
}

async function handler() {
  const sb = getSupabaseAdmin();

  // 현재 DB에 있는 모든 종목 심볼 조회
  const { data: existing } = await sb.from('stock_quotes').select('symbol').eq('is_active', true);
  const existingSet = new Set((existing || []).map((s: any) => s.symbol));

  let added = 0;
  let skipped = 0;
  const newStocks: any[] = [];

  // 1. 국내 시총 TOP 100 (KOSPI + KOSDAQ)
  for (const market of ['KOSPI', 'KOSDAQ'] as const) {
    const list = await fetchNaverMarketList(market);
    for (const s of list) {
      if (!existingSet.has(s.symbol)) {
        newStocks.push({
          symbol: s.symbol,
          name: s.name,
          market,
          price: s.price,
          change_pct: s.change_pct,
          change_amt: 0,
          volume: s.volume,
          market_cap: s.market_cap,
          currency: 'KRW',
          is_active: true,
          updated_at: new Date().toISOString(),
        });
        existingSet.add(s.symbol);
      } else {
        skipped++;
      }
    }
    await sleep(300);
  }

  // 2. 해외 시총 TOP 50 (NYSE + NASDAQ)
  const worldList = await fetchNaverWorldList();
  for (const s of worldList) {
    if (!existingSet.has(s.symbol)) {
      newStocks.push({
        symbol: s.symbol,
        name: s.name,
        market: s.market,
        price: s.price,
        change_pct: s.change_pct,
        change_amt: 0,
        volume: 0,
        market_cap: 0,
        currency: 'USD',
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      existingSet.add(s.symbol);
    } else {
      skipped++;
    }
  }

  // 3. DB에 새 종목 삽입 (100개씩 배치)
  if (newStocks.length > 0) {
    for (let i = 0; i < newStocks.length; i += 100) {
      const batch = newStocks.slice(i, i + 100);
      const { error } = await sb.from('stock_quotes').upsert(batch, { onConflict: 'symbol', ignoreDuplicates: true });
      if (!error) added += batch.length;
    }
  }

  return {
    processed: existingSet.size,
    created: added,
    updated: 0,
    failed: 0,
    metadata: {
      existing: (existing || []).length,
      discovered: newStocks.length,
      skipped,
      new_kr: newStocks.filter(s => s.currency === 'KRW').length,
      new_us: newStocks.filter(s => s.currency === 'USD').length,
      new_symbols: newStocks.slice(0, 20).map(s => `${s.symbol}(${s.name})`),
    },
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await withCronLogging('stock-discover', () => handler());
  return NextResponse.json(result);
}
