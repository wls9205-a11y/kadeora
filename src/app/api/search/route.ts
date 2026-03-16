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
    if (!query || query.length < 2) return NextResponse.json({ posts: [], total: 0, query: query || '', page: 1, hasMore: false, stocks: [], apts: [] }, { headers: { 'Cache-Control': 'public, max-age=30' } });
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Posts search
    const postsPromise = supabase.from('posts').select(`id, title, content, created_at, category, likes_count, comments_count, author:profiles!posts_author_id_fkey(id, nickname, avatar_url)`, { count: 'exact' }).eq('is_deleted', false).or(`title.ilike.%${query}%,content.ilike.%${query}%`).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);

    // Stocks search
    const stocksPromise = supabase.from('stock_quotes').select('symbol, name, market, price, change_pct').or(`name.ilike.%${query}%,symbol.ilike.%${query}%`).limit(5);

    // Apt subscriptions search
    const aptsPromise = supabase.from('apt_subscriptions').select('id, house_nm, region_nm, rcept_bgnde, rcept_endde').or(`house_nm.ilike.%${query}%,region_nm.ilike.%${query}%`).limit(5);

    const [postsResult, stocksResult, aptsResult] = await Promise.all([postsPromise, stocksPromise, aptsPromise]);

    if (postsResult.error) { console.error('[Search GET] posts', postsResult.error); return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 }); }

    return NextResponse.json({
      posts: postsResult.data || [],
      total: postsResult.count || 0,
      query,
      page,
      hasMore: (postsResult.count || 0) > page * limit,
      stocks: stocksResult.data || [],
      apts: aptsResult.data || [],
    }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (err) { console.error('[Search GET]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
