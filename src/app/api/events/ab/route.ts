import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

/**
 * POST /api/events/ab — ab_experiments INSERT (fire-and-forget)
 *
 * sendBeacon 호환 — Content-Type 여부 무관 raw text → JSON.parse.
 *
 * body: {
 *   experiment_name: string,
 *   variant: string,
 *   event_type: 'view' | 'click' | 'convert',
 *   visitor_id?: string,
 *   page_path?: string,
 *   metadata?: object,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text().catch(() => '');
    let body: any = {};
    if (raw) {
      try { body = JSON.parse(raw); } catch { /* silent */ }
    }
    const experiment_name = String(body?.experiment_name || '').slice(0, 80);
    const variant = String(body?.variant || '').slice(0, 16);
    const event_type = String(body?.event_type || '').slice(0, 16);

    if (!experiment_name || !variant || !['view', 'click', 'convert'].includes(event_type)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      experiment_name,
      variant,
      event_type,
      visitor_id: body?.visitor_id ? String(body.visitor_id).slice(0, 80) : null,
      page_path: body?.page_path ? String(body.page_path).slice(0, 200) : null,
      metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    };

    try {
      const sb = getSupabaseAdmin();
      (sb as any).from('ab_experiments').insert(row).then(() => {}).catch(() => {});
    } catch { /* silent */ }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
