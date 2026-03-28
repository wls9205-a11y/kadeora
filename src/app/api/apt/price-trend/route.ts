import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const aptName = searchParams.get('name');
    const region = searchParams.get('region');

    if (!aptName) return NextResponse.json({ error: 'name 파라미터 필요' }, { status: 400 });

    // RPC 먼저 시도
    const { data: rpcData, error: rpcErr } = await sb.rpc('get_apt_price_trend', {
      p_apt_name: aptName,
      p_region: region || undefined,
    });

    if (!rpcErr && rpcData?.length) {
      // 통계 계산
      const prices = rpcData.map((r: any) => r.price).filter((p: number) => p > 0);
      const stats = {
        count: prices.length,
        max: Math.max(...prices),
        min: Math.min(...prices),
        avg: Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length),
        latest: prices[0] || 0,
      };

      return NextResponse.json({ trend: rpcData, stats }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    // RPC 실패 시 직접 쿼리
    const { data, error } = await sb.from('apt_transactions')
      .select('deal_date, deal_amount, exclusive_area, apt_name, region_nm')
      .ilike('apt_name', `%${aptName}%`)
      .order('deal_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    const trend = ((data || []) as Record<string, unknown>[]).map((t: Record<string, any>) => ({
      deal_date: t.deal_date,
      price: t.deal_amount,
      area: t.exclusive_area,
      price_per_pyeong: t.exclusive_area > 0
        ? Math.round(t.deal_amount / (t.exclusive_area / 3.3058))
        : 0,
    }));

    const prices = trend.map(t => t.price).filter(p => p > 0);
    const stats = prices.length > 0 ? {
      count: prices.length,
      max: Math.max(...prices),
      min: Math.min(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      latest: prices[0] || 0,
    } : { count: 0, max: 0, min: 0, avg: 0, latest: 0 };

    return NextResponse.json({ trend, stats }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
