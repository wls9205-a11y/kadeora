import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', Referer: 'https://m.stock.naver.com/' };

async function fetchNaverFundamentals(symbol: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      per: parseFloat(j?.per) || null,
      pbr: parseFloat(j?.pbr) || null,
      dividend_yield: parseFloat(j?.dividendYield) || null,
      eps: parseFloat(String(j?.eps || '').replace(/,/g, '')) || null,
      roe: parseFloat(j?.roe) || null,
      high_52w: parseFloat(String(j?.high52wPrice || '').replace(/,/g, '')) || null,
      low_52w: parseFloat(String(j?.low52wPrice || '').replace(/,/g, '')) || null,
      market_cap: parseInt(String(j?.marketCap || '0').replace(/,/g, '')) || null,
      sector: j?.sectorName || null,
    };
  } catch { return null; }
}

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('stock-fundamentals-kr', async () => {
    const admin = getSupabaseAdmin();

    // PER이 NULL인 한국 종목 우선 (인기순)
    const { data: stocks } = await admin.from('stock_quotes')
      .select('symbol')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .eq('is_active', true)
      .is('per', null)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(50);

    if (!stocks?.length) {
      // PER 있는 종목 중 7일 이상 미갱신 건
      const { data: stale } = await (admin as any).from('stock_quotes')
        .select('symbol')
        .in('market', ['KOSPI', 'KOSDAQ'])
        .eq('is_active', true)
        .not('per', 'is', null)
        .or('fundamentals_updated_at.is.null,fundamentals_updated_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
        .order('volume', { ascending: false, nullsFirst: false })
        .limit(50);
      if (!stale?.length) return { processed: 0, metadata: { reason: 'all_updated' } };
      return await processStocks(admin, stale);
    }

    return await processStocks(admin, stocks);
  });
  return NextResponse.json(result);
}

async function processStocks(admin: any, stocks: any[]) {
  let updated = 0, failed = 0;
  for (const s of stocks) {
    const f = await fetchNaverFundamentals(s.symbol);
    if (!f) { failed++; continue; }

    const updateData: Record<string, any> = { fundamentals_updated_at: new Date().toISOString() };
    if (f.per) updateData.per = f.per;
    if (f.pbr) updateData.pbr = f.pbr;
    if (f.dividend_yield) updateData.dividend_yield = f.dividend_yield;
    if (f.eps) updateData.eps = f.eps;
    if (f.roe) updateData.roe = f.roe;
    if (f.high_52w) updateData.high_52w = f.high_52w;
    if (f.low_52w) updateData.low_52w = f.low_52w;
    if (f.market_cap && f.market_cap > 0) updateData.market_cap = f.market_cap;
    if (f.sector) updateData.sector = f.sector;

    // 품질 점수 계산
    let score = 20; // 가격 있으면 기본 20
    if (f.market_cap && f.market_cap > 0) score += 15;
    if (f.per) score += 15;
    if (f.eps || f.roe) score += 15;
    if (f.dividend_yield) score += 10;
    if (f.sector) score += 10;
    if (f.high_52w) score += 10;
    updateData.data_quality_score = score;

    await (admin as any).from('stock_quotes').update(updateData).eq('symbol', s.symbol);
    updated++;
  }
  return { processed: stocks.length, updated, failed };
}
