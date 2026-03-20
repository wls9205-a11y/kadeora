import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await supabase.from('profiles').update({ points: Number(points) }).eq('id', id);
  } else if (action === 'toggle_admin') {
    const { data: current } = await supabase.from('profiles').select('is_admin').eq('id', id).single();
    await supabase.from('profiles').update({ is_admin: !current?.is_admin }).eq('id', id);
  } else if (action === 'ban') {
    await supabase.from('profiles').update({ is_banned: true }).eq('id', id);
  } else if (action === 'unban') {
    await supabase.from('profiles').update({ is_banned: false }).eq('id', id);
  } else {
    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
