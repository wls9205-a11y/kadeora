import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { id } = await params;
  const { action } = await req.json();

  if (action === 'suspend') {
    await supabase.from('profiles').update({ is_deleted: true }).eq('id', id);
  } else if (action === 'restore') {
    await supabase.from('profiles').update({ is_deleted: false }).eq('id', id);
  } else {
    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
