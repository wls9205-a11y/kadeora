import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'search'))) return rateLimitResponse();
  try {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const query = sanitizeSearchQuery(searchParams.get('q') || '', 200);
    if (!query || query.length < 2) return NextResponse.json({ posts: [], total: 0 });
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const { data, error, count } = await supabase.from('posts').select(`id, title, content, created_at, category, likes_count, comments_count, author:profiles!posts_author_id_fkey(id, nickname, avatar_url)`, { count: 'exact' }).eq('is_deleted', false).or(`title.ilike.%${query}%,content.ilike.%${query}%`).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (error) { console.error('[Search GET]', error); return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 }); }
    return NextResponse.json({ posts: data || [], total: count || 0, query, page, hasMore: (count || 0) > page * limit });
  } catch (err) { console.error('[Search GET]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
