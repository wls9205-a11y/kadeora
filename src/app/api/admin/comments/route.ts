import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all';
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();

    let query = supabase.from('comments')
      .select('id, content, created_at, is_deleted, post_id, profiles:author_id(nickname), posts:post_id(title)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filter === 'active') query = query.eq('is_deleted', false);
    else if (filter === 'hidden') query = query.eq('is_deleted', true);
    if (search) query = query.ilike('content', `%${search}%`);

    query = query.range(offset, offset + limit - 1);
    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const comments = (data ?? []).map((c: any) => ({
      id: c.id, content: c.content, created_at: c.created_at, is_deleted: c.is_deleted,
      post_id: c.post_id,
      author_nickname: c.profiles?.nickname ?? '-',
      post_title: c.posts?.title ?? '-',
    }));

    return NextResponse.json({ comments, total: count ?? 0, page, limit });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
