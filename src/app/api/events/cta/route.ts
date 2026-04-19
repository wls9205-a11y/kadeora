import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

/**
 * POST /api/events/cta — conversion_events INSERT (fire-and-forget)
 *
 * body: {
 *   event_type: 'cta_view' | 'cta_click' | 'cta_complete',
 *   cta_name, page_path?, category?, visitor_id, device_type?, referrer_source?, gate_position?
 * }
 *
 * 응답: { ok:true } 즉시. INSERT 는 백그라운드 Promise (요청 지연 최소화).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event_type = String(body?.event_type || '').slice(0, 40);
    const cta_name = String(body?.cta_name || '').slice(0, 80);
    if (!event_type || !cta_name) return NextResponse.json({ ok: false, error: 'event_type+cta_name required' }, { status: 400 });

    const row = {
      event_type,
      cta_name,
      category: body?.category ? String(body.category).slice(0, 40) : null,
      page_path: body?.page_path ? String(body.page_path).slice(0, 200) : null,
      visitor_id: body?.visitor_id ? String(body.visitor_id).slice(0, 80) : null,
      device_type: body?.device_type ? String(body.device_type).slice(0, 20) : null,
      referrer_source: body?.referrer_source ? String(body.referrer_source).slice(0, 80) : null,
      gate_position: Number.isFinite(Number(body?.gate_position)) ? Number(body.gate_position) : null,
    };

    try {
      const sb = getSupabaseAdmin();
      (sb as any).from('conversion_events').insert(row).then(() => {}).catch(() => {});
    } catch { /* silent */ }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
