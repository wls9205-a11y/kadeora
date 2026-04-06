import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function fetchYahooFundamentals(symbol: string): Promise<Record<string, any> | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    // v8 chart API에서 시총 + 52주 고저 가져오기
    const result: Record<string, any> = {
      market_cap: meta.marketCap || null,
      high_52w: meta.fiftyTwoWeekHigh || null,
      low_52w: meta.fiftyTwoWeekLow || null,
    };

    // quoteSummary에서 PER/PBR/EPS/ROE/배당 가져오기
    try {
      const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics,summaryDetail`;
      const sRes = await fetch(summaryUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      });
      if (sRes.ok) {
        const sj = await sRes.json();
        const stats = sj?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
        const detail = sj?.quoteSummary?.result?.[0]?.summaryDetail;
        if (stats) {
          result.per = stats.forwardPE?.raw || stats.trailingPE?.raw || detail?.trailingPE?.raw || null;
          result.pbr = stats.priceToBook?.raw || null;
          result.eps = stats.trailingEps?.raw || null;
          result.roe = stats.returnOnEquity?.raw ? (stats.returnOnEquity.raw * 100) : null;
        }
        if (detail) {
          result.dividend_yield = detail.dividendYield?.raw ? (detail.dividendYield.raw * 100) : null;
          if (!result.per && detail.trailingPE?.raw) result.per = detail.trailingPE.raw;
        }
      }
    } catch {}

    return result;
  } catch { return null; }
}

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('stock-fundamentals-us', async () => {
    const admin = getSupabaseAdmin();

    const { data: stocks } = await (admin as any).from('stock_quotes')
      .select('symbol')
      .in('market', ['NYSE', 'NASDAQ'])
      .eq('is_active', true)
      .or('per.is.null,fundamentals_updated_at.is.null,fundamentals_updated_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(30);

    if (!stocks?.length) return { processed: 0, metadata: { reason: 'all_updated' } };

    let updated = 0, failed = 0;
    for (const s of stocks) {
      const f = await fetchYahooFundamentals(s.symbol);
      if (!f) { failed++; continue; }

      const updateData: Record<string, any> = { fundamentals_updated_at: new Date().toISOString() };
      if (f.per) updateData.per = f.per;
      if (f.pbr) updateData.pbr = f.pbr;
      if (f.eps) updateData.eps = f.eps;
      if (f.roe) updateData.roe = f.roe;
      if (f.dividend_yield) updateData.dividend_yield = f.dividend_yield;
      if (f.high_52w) updateData.high_52w = f.high_52w;
      if (f.low_52w) updateData.low_52w = f.low_52w;
      if (f.market_cap && f.market_cap > 0) updateData.market_cap = f.market_cap;

      let score = 20;
      if (f.market_cap && f.market_cap > 0) score += 15;
      if (f.per) score += 15;
      if (f.eps || f.roe) score += 15;
      if (f.dividend_yield) score += 10;
      if (f.high_52w) score += 10;
      score += 10; // US stocks always have sector from Yahoo
      updateData.data_quality_score = score;

      await (admin as any).from('stock_quotes').update(updateData).eq('symbol', s.symbol);
      updated++;
      // Rate limit: Yahoo 분당 ~60건 허용
      if (updated % 10 === 0) await new Promise(r => setTimeout(r, 2000));
    }
    return { processed: stocks.length, updated, failed };
  });
  return NextResponse.json(result);
}
