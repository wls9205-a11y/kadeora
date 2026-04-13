import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { symbol } = await req.json();
    if (!symbol || typeof symbol !== 'string') return NextResponse.json({ ok: false }, { status: 400 });
    const sb = getSupabaseAdmin();
    await (sb as any).rpc('increment_stock_view', { p_symbol: symbol });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
