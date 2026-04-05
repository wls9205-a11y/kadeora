import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * /api/track — 전환 이벤트 추적 (fire-and-forget, beacon API 대응)
 * CTA 표시/클릭/완료 이벤트를 conversion_events 테이블에 기록
 */
export async function POST(req: NextRequest) {
  try {
    const { event_type, cta_name, category, page_path, visitor_id } = await req.json();
    if (!event_type || !cta_name) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    await (sb as any).from('conversion_events').insert({
      event_type: String(event_type).slice(0, 30),
      cta_name: String(cta_name).slice(0, 30),
      category: category ? String(category).slice(0, 20) : null,
      page_path: page_path ? String(page_path).slice(0, 200) : null,
      visitor_id: visitor_id ? String(visitor_id).slice(0, 50) : null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // 추적 실패해도 200 반환
  }
}
