import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('author_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { id, all } = body;

    if (all) {
      await sb.from('notifications').update({ is_read: true }).eq('author_id', session.user.id);
    } else if (id) {
      await sb.from('notifications').update({ is_read: true }).eq('id', id).eq('author_id', session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
