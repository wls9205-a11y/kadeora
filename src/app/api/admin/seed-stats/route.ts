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

    // Service role client for raw filter (anon key LIKE on uuid doesn't work)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [users, posts, comments, likes] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).filter('id::text', 'like', 'aaaaaaaa%'),
      admin.from('posts').select('id', { count: 'exact', head: true }).filter('author_id::text', 'like', 'aaaaaaaa%'),
      admin.from('comments').select('id', { count: 'exact', head: true }).filter('author_id::text', 'like', 'aaaaaaaa%'),
      admin.from('post_likes').select('post_id', { count: 'exact', head: true }).filter('user_id::text', 'like', 'aaaaaaaa%'),
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
