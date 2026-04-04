import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_stock_52w_range', { p_symbol: symbol });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.[0] || null });
}
