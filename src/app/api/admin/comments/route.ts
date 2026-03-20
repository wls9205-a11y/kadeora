import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.from('comments')
      .select('id, content, created_at, is_deleted, post_id, profiles:author_id(nickname), posts:post_id(title)')
      .order('created_at', { ascending: false })
      .limit(50);

    const comments = (data ?? []).map((c: any) => ({
      id: c.id, content: c.content, created_at: c.created_at, is_deleted: c.is_deleted,
      post_id: c.post_id,
      author_nickname: c.profiles?.nickname ?? '-',
      post_title: c.posts?.title ?? '-',
    }));

    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
