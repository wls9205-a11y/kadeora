import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { id } = await params;
  const { action, points } = await req.json();

  if (action === 'suspend') {
    await supabase.from('profiles').update({ is_deleted: true }).eq('id', id);
  } else if (action === 'restore') {
    await supabase.from('profiles').update({ is_deleted: false }).eq('id', id);
  } else if (action === 'set_points' && points !== undefined) {
    // admin set_points: 현재 포인트 조회 후 차이만큼 award_points 호출
    const { data: current } = await supabase.from('profiles').select('points').eq('id', id).single();
    const diff = Number(points) - (current?.points ?? 0);
    if (diff !== 0) {
      await supabase.rpc('award_points', { p_user_id: id, p_amount: diff, p_reason: '관리자조정', p_meta: null });
    }
  } else if (action === 'toggle_admin') {
    // toggle_admin은 prevent_privilege_escalation 트리거가 차단하므로 SQL RPC 필요
    const { data: cur } = await supabase.from('profiles').select('is_admin').eq('id', id).single();
    await supabase.rpc('admin_toggle_admin', { p_user_id: id, p_value: !cur?.is_admin });
  } else if (action === 'ban') {
    await supabase.from('profiles').update({ is_banned: true }).eq('id', id);
  } else if (action === 'unban') {
    await supabase.from('profiles').update({ is_banned: false }).eq('id', id);
  } else {
    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
} catch (e: unknown) {
    console.error('[admin] PATCH', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
