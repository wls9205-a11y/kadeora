import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') || '';
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
      .or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,content.ilike.%${q}%`);

    if (category) query = query.eq('category', category);
    query = query.order('view_count', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count } = await query;
    return NextResponse.json({ posts: data || [], total: count || 0 });
  } catch (e: any) {
    return NextResponse.json({ posts: [], total: 0, error: e.message }, { status: 200 });
  }
}
