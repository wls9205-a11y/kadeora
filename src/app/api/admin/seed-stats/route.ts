import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [users, posts, comments, likes] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }).like('id', 'aaaaaaaa%'),
      sb.from('posts').select('id', { count: 'exact', head: true }).like('author_id', 'aaaaaaaa%'),
      sb.from('comments').select('id', { count: 'exact', head: true }).like('author_id', 'aaaaaaaa%'),
      sb.from('post_likes').select('post_id', { count: 'exact', head: true }).like('user_id', 'aaaaaaaa%'),
    ]);

    return NextResponse.json({
      users: users.count ?? 0,
      posts: posts.count ?? 0,
      comments: comments.count ?? 0,
      likes: likes.count ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
