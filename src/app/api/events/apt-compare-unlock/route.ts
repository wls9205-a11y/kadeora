import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

/**
 * POST /api/events/apt-compare-unlock — apt_compare_unlock_logs fire-and-forget insert.
 *   event ∈ 'viewed_3rd_locked' | 'clicked_3rd_cta' (free-form ok)
 *
 * body (text/plain sendBeacon 호환):
 *   { event, apt_site_id?, visitor_id? }
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text().catch(() => '');
    let body: any = {};
    if (raw) { try { body = JSON.parse(raw); } catch { /* silent */ } }
    const event = String(body?.event || '').slice(0, 40);
    if (!event) return NextResponse.json({ ok: false, error: 'event required' }, { status: 400 });

    const apt_site_id = body?.apt_site_id ? String(body.apt_site_id).slice(0, 40) : null;
    const visitor_id = body?.visitor_id ? String(body.visitor_id).slice(0, 80) : null;

    try {
      const sb = getSupabaseAdmin();
      (sb as any).from('apt_compare_unlock_logs').insert({
        event,
        apt_site_id,
        visitor_id,
      }).then(() => {}, () => {});
    } catch { /* silent */ }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
