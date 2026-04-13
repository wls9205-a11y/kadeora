import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { siteId } = await req.json();
    if (!siteId || typeof siteId !== 'string') return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    const sb = getSupabaseAdmin();
    await sb.rpc('increment_site_view', { p_site_id: siteId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
