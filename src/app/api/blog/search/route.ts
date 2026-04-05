import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sanitizeSearchQuery } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = sanitizeSearchQuery(searchParams.get('q') || '', 100);
  const category = searchParams.get('category') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!q || q.length < 2) {
    return NextResponse.json({ posts: [], total: 0 });
  }

  try {
    const sb = await createSupabaseServer();
    let query = sb.from('blog_posts')
      .select('id, slug, title, excerpt, category, tags, view_count, created_at, published_at', { count: 'exact' })
      .eq('is_published', true)
      .or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);

    if (category) query = query.eq('category', category);
    query = query.order('view_count', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count } = await query;
    return NextResponse.json({ posts: data || [], total: count || 0 }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (e: any) {
    return NextResponse.json({ posts: [], total: 0, error: '검색 오류' }, { status: 200 });
  }
}
