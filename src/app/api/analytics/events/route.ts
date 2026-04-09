import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * /api/analytics/events — 통합 행동 이벤트 수집
 * 클라이언트에서 배치로 전송 (sendBeacon/fetch keepalive)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.visitor_id || !Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // 로그인 유저 확인 (fire-and-forget이므로 실패해도 진행)
    let userId: string | null = null;
    try {
      const authSb = await createSupabaseServer();
      const { data: { user } } = await authSb.auth.getUser();
      if (user) {
        // 관리자 제외
        const { data: profile } = await authSb.from('profiles').select('is_admin').eq('id', user.id).single();
        if (profile?.is_admin) return NextResponse.json({ ok: true, skipped: 'admin' });
        userId = user.id;
      }
    } catch {}

    const sb = getSupabaseAdmin();
    const rows = body.events.slice(0, 20).map((e: any) => ({
      visitor_id: String(body.visitor_id).slice(0, 50),
      user_id: userId,
      session_id: body.session_id ? String(body.session_id).slice(0, 50) : null,
      event_type: String(e.event_type || '').slice(0, 30),
      event_name: String(e.event_name || '').slice(0, 50),
      page_path: e.page_path ? String(e.page_path).slice(0, 300) : null,
      page_category: e.page_category ? String(e.page_category).slice(0, 20) : null,
      referrer: e.referrer ? String(e.referrer).slice(0, 500) : null,
      properties: e.properties && typeof e.properties === 'object' ? e.properties : {},
      device_type: body.device_type ? String(body.device_type).slice(0, 10) : null,
      screen_width: typeof body.screen_width === 'number' ? body.screen_width : null,
      duration_ms: typeof e.duration_ms === 'number' ? e.duration_ms : null,
    }));

    // fire-and-forget
    (sb as any).from('user_events').insert(rows).then(() => {});

    return NextResponse.json({ ok: true, count: rows.length });
  } catch {
    return NextResponse.json({ ok: true }); // 추적 실패해도 200
  }
}
