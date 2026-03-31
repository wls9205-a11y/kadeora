import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://m.stock.naver.com/' };
const CLAMP = (v: number) => Math.max(-30, Math.min(30, v));

interface NaverQuote {
  symbol: string;
  price: number;
  change_pct: number;
  change_amt: number;
  volume: number;
  market_cap: number;
}

// 네이버 모바일 API — 개별 종목
async function fetchNaverSingle(symbol: string): Promise<NaverQuote | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: HEADERS, signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const price = parseInt(String(j?.closePrice ?? '0').replace(/,/g, ''));
    if (!price) return null;
    return {
      symbol,
      price,
      change_pct: CLAMP(parseFloat(String(j?.fluctuationsRatio ?? '0'))),
      change_amt: parseInt(String(j?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
      volume: parseInt(String(j?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
      market_cap: parseInt(String(j?.marketCap ?? '0').replace(/,/g, '')),
    };
  } catch { return null; }
}

// 네이버 해외주식 API — 개별 종목
async function fetchNaverWorldStock(symbol: string): Promise<NaverQuote | null> {
  try {
    const res = await fetch(`https://api.stock.naver.com/stock/${symbol}/basic`, {
      headers: { ...HEADERS, Referer: 'https://m.stock.naver.com/worldstock/' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const price = parseFloat(String(j?.closePrice ?? '0').replace(/,/g, ''));
    if (!price) return null;
    return {
      symbol,
      price,
      change_pct: CLAMP(parseFloat(String(j?.fluctuationsRatio ?? '0'))),
      change_amt: parseFloat(String(j?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
      volume: parseInt(String(j?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
      market_cap: 0, // 해외종목은 market_cap 별도
    };
  } catch { return null; }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  let krSuccess = 0, krFailed = 0, usSuccess = 0, usFailed = 0;

  // ═══ 1. 국내 주식 (KOSPI + KOSDAQ) — 시총순 상위 500개 네이버 크롤링 ═══
  const { data: krStocks } = await sb.from('stock_quotes')
    .select('symbol')
    .in('market', ['KOSPI', 'KOSDAQ'])
    .eq('is_active', true)
    .gt('price', 0)
    .order('market_cap', { ascending: false })
    .limit(500);

  if (krStocks?.length) {
    const BATCH = 15;
    for (let i = 0; i < krStocks.length; i += BATCH) {
      const batch = krStocks.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (s: any) => {
          const q = await fetchNaverSingle(s.symbol);
          if (q && q.price > 0) {
            const updates: Record<string, any> = {
              price: q.price,
              change_pct: q.change_pct,
              change_amt: q.change_amt,
              updated_at: new Date().toISOString(),
            };
            if (q.volume > 0) updates.volume = q.volume;
            if (q.market_cap > 0) updates.market_cap = q.market_cap;
            await sb.from('stock_quotes').update(updates).eq('symbol', q.symbol);
            return true;
          }
          return false;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) krSuccess++;
        else krFailed++;
      }
      if (i + BATCH < krStocks.length) await sleep(80);
    }
  }

  // ═══ 2. 해외 주식 (NYSE + NASDAQ) — 네이버 해외주식 API ═══
  const { data: usStocks } = await sb.from('stock_quotes')
    .select('symbol')
    .in('market', ['NYSE', 'NASDAQ'])
    .eq('is_active', true)
    .gt('price', 0)
    .order('market_cap', { ascending: false })
    .limit(200);

  if (usStocks?.length) {
    const BATCH = 10;
    for (let i = 0; i < usStocks.length; i += BATCH) {
      const batch = usStocks.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (s: any) => {
          const q = await fetchNaverWorldStock(s.symbol);
          if (q && q.price > 0) {
            const updates: Record<string, any> = {
              price: q.price,
              change_pct: q.change_pct,
              change_amt: q.change_amt,
              updated_at: new Date().toISOString(),
            };
            if (q.volume > 0) updates.volume = q.volume;
            await sb.from('stock_quotes').update(updates).eq('symbol', q.symbol);
            return true;
          }
          return false;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) usSuccess++;
        else usFailed++;
      }
      if (i + BATCH < usStocks.length) await sleep(120);
    }
  }

  // ═══ 3. price_history에 오늘 종가 기록 ═══
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: updated } = await sb.from('stock_quotes')
      .select('symbol, price, change_pct, volume')
      .gt('price', 0)
      .order('market_cap', { ascending: false })
      .limit(500);

    if (updated?.length) {
      const historyRows = updated.map((s: any) => ({
        symbol: s.symbol,
        date: today,
        close_price: s.price,
        change_pct: s.change_pct ?? 0,
        volume: s.volume ?? 0,
      }));
      // 100개씩 upsert
      for (let i = 0; i < historyRows.length; i += 100) {
        await (sb as any).from('stock_price_history')
          .upsert(historyRows.slice(i, i + 100), { onConflict: 'symbol,date' });
      }
    }
  } catch {}

  // ═══ 로깅 ═══
  try {
    await (sb as any).from('cron_logs').insert({
      cron_name: 'stock-naver-sync',
      status: 'success',
      records_processed: krSuccess + usSuccess + krFailed + usFailed,
      records_updated: krSuccess + usSuccess,
      records_failed: krFailed + usFailed,
      metadata: { krSuccess, krFailed, usSuccess, usFailed },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    kr: { success: krSuccess, failed: krFailed },
    us: { success: usSuccess, failed: usFailed },
  });
}
