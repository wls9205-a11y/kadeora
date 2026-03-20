import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_seed_stats');

    if (error || !data || data.length === 0) {
      return NextResponse.json({ users: 0, posts: 0, comments: 0, likes: 0 });
    }

    const row = data[0];
    return NextResponse.json({
      users: Number(row.seed_users) || 0,
      posts: Number(row.seed_posts) || 0,
      comments: Number(row.seed_comments) || 0,
      likes: Number(row.seed_likes) || 0,
    });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
