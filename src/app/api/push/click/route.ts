import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const { log_id } = await req.json();
    if (!log_id) return NextResponse.json({ ok: false });
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('push_logs').select('click_count').eq('id', log_id).single();
    await admin.from('push_logs').update({ click_count: (data?.click_count ?? 0) + 1 }).eq('id', log_id);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}
