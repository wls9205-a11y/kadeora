import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/push/click
 * SW notificationclick에서 호출 — 푸시 클릭률 추적
 */
export async function POST(req: NextRequest) {
  try {
    const { log_id } = await req.json();
    if (!log_id) return NextResponse.json({ ok: true });

    const sb = getSupabaseAdmin();
    await sb.from('push_logs')
      .update({ click_count: (sb as any).rpc ? undefined : 1 })
      .eq('id', log_id);
    
    // click_count 증가 (직접 SQL)
    await (sb as any).rpc('increment_push_click', { p_log_id: Number(log_id) }).catch(() => {
      // RPC 없으면 직접 업데이트 (fallback)
      sb.from('push_logs')
        .select('click_count')
        .eq('id', log_id)
        .single()
        .then(({ data }) => {
          if (data) {
            (sb as any).from('push_logs')
              .update({ click_count: (data.click_count || 0) + 1 })
              .eq('id', log_id);
          }
        });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // 클릭 추적 실패해도 200
  }
}
