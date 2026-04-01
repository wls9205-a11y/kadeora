import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { id } = await params;
  const body = await req.json();
  const action = body.action || (body.is_deleted === true ? 'hide' : body.is_deleted === false ? 'restore' : null);

  if (action === 'hide') {
    await supabase.from('posts').update({ is_deleted: true }).eq('id', Number(id));
  } else if (action === 'restore') {
    await supabase.from('posts').update({ is_deleted: false }).eq('id', Number(id));
  } else {
    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
} catch (e: unknown) {
    console.error('[admin] PATCH', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
