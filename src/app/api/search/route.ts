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
    const stocksPromise = supabase.from('stock_quotes').select('symbol, name, market, price, change_pct, currency').or(`name.ilike.%${query}%,symbol.ilike.%${query}%`).limit(5);

    // Apt subscriptions search
    const aptsPromise = supabase.from('apt_subscriptions').select('id, house_nm, region_nm, rcept_bgnde, rcept_endde').or(`house_nm.ilike.%${query}%,region_nm.ilike.%${query}%`).limit(5);

    // Blog search
    const blogsPromise = supabase.from('blog_posts').select('id, slug, title, excerpt, category, created_at, view_count').eq('is_published', true).ilike('title', `%${query}%`).order('view_count', { ascending: false }).limit(5);

    // Redevelopment search
    const redevPromise = supabase.from('redevelopment_projects').select('id, district_name, region, stage, project_type, address, total_households').or(`district_name.ilike.%${query}%,region.ilike.%${query}%,address.ilike.%${query}%`).limit(5);

    // Unsold search
    const unsoldPromise = supabase.from('unsold_apts').select('id, house_nm, region_nm, sigungu_nm, tot_unsold_hshld_co').or(`house_nm.ilike.%${query}%,region_nm.ilike.%${query}%`).limit(5);

    // Transaction search
    const tradePromise = supabase.from('apt_transactions').select('id, apt_name, region_nm, deal_amount, exclusive_area, deal_date').or(`apt_name.ilike.%${query}%,region_nm.ilike.%${query}%`).order('deal_date', { ascending: false }).limit(5);

    // Discussion topics search
    const discussPromise = supabase.from('discussion_topics').select('id, title, category, vote_yes, vote_no, created_at').ilike('title', `%${query}%`).limit(5);

    const [postsResult, stocksResult, aptsResult, blogsResult, redevResult, unsoldResult, tradeResult, discussResult] = await Promise.all([postsPromise, stocksPromise, aptsPromise, blogsPromise, redevPromise, unsoldPromise, tradePromise, discussPromise]);

    if (postsResult.error) { console.error('[Search GET] posts', postsResult.error); return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 }); }

    return NextResponse.json({
      posts: postsResult.data || [],
      total: postsResult.count || 0,
      query,
      page,
      hasMore: (postsResult.count || 0) > page * limit,
      stocks: stocksResult.data || [],
      apts: aptsResult.data || [],
      blogs: blogsResult.data || [],
      redevelopments: redevResult.data || [],
      unsolds: unsoldResult.data || [],
      transactions: tradeResult.data || [],
      discussions: discussResult.data || [],
    }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (err) { console.error('[Search GET]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
