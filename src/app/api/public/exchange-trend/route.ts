import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 1800;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') || '30'), 60);
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_exchange_rate_trend', { p_limit: limit });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
