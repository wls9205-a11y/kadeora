import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;
  const { is_deleted } = await req.json();

  await supabase.from('comments').update({ is_deleted: is_deleted ?? true }).eq('id', Number(id));
  return NextResponse.json({ ok: true });
} catch (e: unknown) {
    console.error('[admin] PATCH', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
