import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// GET /api/stock/sparkline?symbols=005930,000660,035420
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const symbols = req.nextUrl.searchParams.get('symbols')?.split(',').filter(Boolean).slice(0, 200);
    if (!symbols?.length) return NextResponse.json({ data: {} });

    const sb = getSupabaseAdmin();

    // 최근 10일 날짜만 가져와서 데이터 양 제한 (Supabase 1000행 제한 우회)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 15); // 주말/공휴일 감안 15일
    const dateStr = tenDaysAgo.toISOString().slice(0, 10);

    const { data } = await sb.from('stock_price_history')
      .select('symbol, date, close_price')
      .in('symbol', symbols)
      .gte('date', dateStr)
      .order('date', { ascending: true })
      .limit(3000); // 200종목 × 15일 = 3000 충분

    // 심볼별 그룹핑
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
    console.error('[sparkline]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
