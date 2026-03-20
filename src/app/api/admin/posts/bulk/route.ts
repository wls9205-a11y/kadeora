import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, ids } = await req.json();
  if (!action || !ids?.length) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  if (action === 'hide') {
    await sb.from('posts').update({ is_deleted: true }).in('id', ids);
  } else if (action === 'restore') {
    await sb.from('posts').update({ is_deleted: false }).in('id', ids);
  }

  return NextResponse.json({ ok: true, count: ids.length });
}
