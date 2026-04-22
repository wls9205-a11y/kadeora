import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

/**
 * POST /api/events/cta — conversion_events INSERT (fire-and-forget)
 *
 * sendBeacon 호환: Content-Type 이 application/json / text/plain / 누락 모두 수용.
 * raw text 를 읽어 JSON.parse → 실패 시 빈 객체.
 *
 * body: {
 *   event_type: 'cta_view' | 'cta_click' | 'cta_complete',
 *   cta_name, page_path?, category?, visitor_id, device_type?, referrer_source?, gate_position?
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // sendBeacon 은 Blob 이 application/json 이어도 Next 가 때때로 text/plain 처리 →
    // req.json() 이 실패 (silent) 하므로 항상 text 로 읽은 뒤 수동 파싱.
    const raw = await req.text().catch(() => '');
    let body: any = {};
    if (raw) {
      try { body = JSON.parse(raw); } catch { /* raw 가 JSON 아니면 빈 객체 */ }
    }
    const event_type = String(body?.event_type || '').slice(0, 40);
    const cta_name = String(body?.cta_name || '').slice(0, 80);
    if (!event_type || !cta_name) {
      return NextResponse.json({ ok: false, error: 'event_type+cta_name required' }, { status: 400 });
    }

    // UA 폴백: 클라이언트가 device_type 안 보내면 서버가 감지
    const ua = req.headers.get('user-agent') || '';
    const device_type: string =
      body?.device_type ? String(body.device_type).slice(0, 20)
        : /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile'
        : /iPad|Tablet/i.test(ua) ? 'tablet'
        : ua ? 'desktop' : 'unknown';

    const row = {
      event_type,
      cta_name,
      category: body?.category ? String(body.category).slice(0, 40) : null,
      page_path: body?.page_path ? String(body.page_path).slice(0, 200) : null,
      visitor_id: body?.visitor_id ? String(body.visitor_id).slice(0, 80) : null,
      device_type,
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
