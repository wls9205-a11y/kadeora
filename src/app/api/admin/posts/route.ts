import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const filter = searchParams.get('filter') || 'all';
  const category = searchParams.get('category') || 'all';
  const offset = (page - 1) * limit;

  let query = supabase.from('posts')
    .select('id, title, category, is_deleted, created_at, likes_count, comments_count, view_count, profiles!posts_author_id_fkey(nickname)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filter === 'active') query = query.eq('is_deleted', false);
  else if (filter === 'hidden') query = query.eq('is_deleted', true);
  if (category !== 'all') query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search}%`);

  query = query.range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data ?? [], total: count ?? 0, page, limit });
}
