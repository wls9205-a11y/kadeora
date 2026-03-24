import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// GET /api/stock/sparkline?symbols=005930,000660,035420
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
  const symbols = req.nextUrl.searchParams.get('symbols')?.split(',').filter(Boolean).slice(0, 20);
  if (!symbols?.length) return NextResponse.json({ data: {} });

  const sb = getSupabaseAdmin();
  const { data } = await sb.from('stock_price_history')
    .select('symbol, date, close_price')
    .in('symbol', symbols)
    .order('date', { ascending: true });

  // 심볼별로 그룹핑하여 최근 10일 가격만 반환
  const map: Record<string, number[]> = {};
  (data || []).forEach((d) => {
    if (!map[d.symbol]) map[d.symbol] = [];
    map[d.symbol].push(Number(d.close_price));
  });

  // 각 심볼 최근 10개만
  Object.keys(map).forEach(k => {
    map[k] = map[k].slice(-10);
  });

  return NextResponse.json({ data: map }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });

  } catch (e) {
    console.error('[src/app/api/stock/sparkline/route.ts]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
