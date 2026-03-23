import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 90);

    const since = new Date(Date.now() + 9 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    const { data, error } = await getSupabaseAdmin().from('portfolio_snapshots')
      .select('snapshot_date, total_invested, total_current, total_pnl, pnl_pct, holding_count')
      .eq('user_id', user.id)
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ history: data || [] }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
