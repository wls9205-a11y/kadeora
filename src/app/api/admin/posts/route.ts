import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('posts')
    .select('id, title, category, author_id, is_deleted, created_at, likes_count, comments_count, view_count, profiles!posts_author_id_fkey(nickname)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}
