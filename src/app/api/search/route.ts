import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export const dynamic = 'force-dynamic';

// s186: 8병렬 쿼리(평균 14초) → search_kadeora_unified_v2 RPC 단일 호출(~1초)
// apt_sites/complexes/priority_order 새 키 + 기존 키(posts/apts/blogs/...) 동시 반환 (호환)
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  if (!(await rateLimit(req, 'search'))) return rateLimitResponse();

  try {
    const supabase = await createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const query = sanitizeSearchQuery(searchParams.get('q') || '', 200);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!query || query.length < 2) {
      return NextResponse.json({
        posts: [], total: 0, query: query || '', page: 1, hasMore: false,
        stocks: [], apts: [], blogs: [], redevelopments: [], unsolds: [], transactions: [], discussions: [],
        apt_sites: [], complexes: [], priority_order: ['apt_sites', 'complexes', 'blogs', 'posts', 'stocks'],
      }, { headers: { 'Cache-Control': 'public, max-age=30' } });
    }

    const limitPerType = Math.min(limit, 10);

    const { data, error } = await (supabase as any).rpc('search_kadeora_unified_v2', {
      p_query: query,
      p_limit_per_type: limitPerType,
    });

    if (error) {
      console.error('[Search GET s186] search_kadeora_unified_v2 RPC error:', error);
      // RPC 실패 시 safe_search_posts로 최소 결과 보장 (사이트 검색 사망 방지)
      try {
        const { data: rpcData } = await (supabase as any).rpc('safe_search_posts', { q: query, lim: limit });
        const rpcResults = (rpcData && typeof rpcData === 'object' && 'results' in rpcData && Array.isArray((rpcData as any).results))
          ? (rpcData as any).results : [];
        const rpcCount = (rpcData && typeof rpcData === 'object' && 'count' in rpcData)
          ? Number((rpcData as any).count) || rpcResults.length : rpcResults.length;
        return NextResponse.json({
          posts: rpcResults, total: rpcCount, query, page, hasMore: rpcCount > page * limit,
          stocks: [], apts: [], blogs: [], redevelopments: [], unsolds: [], transactions: [], discussions: [],
          apt_sites: [], complexes: [], priority_order: ['posts'],
          fallback: 'safe_search_posts',
        }, {
          headers: {
            'Cache-Control': 'public, max-age=30',
            'x-search-duration-ms': String(Date.now() - startedAt),
            'x-search-source': 'fallback_safe_search',
          },
        });
      } catch (fallbackErr) {
        console.error('[Search GET s186] fallback also failed:', fallbackErr);
        return NextResponse.json({
          posts: [], total: 0, query, page, hasMore: false,
          stocks: [], apts: [], blogs: [], redevelopments: [], unsolds: [], transactions: [], discussions: [],
          apt_sites: [], complexes: [], priority_order: [],
          fallback: 'empty',
        }, {
          headers: {
            'Cache-Control': 'public, max-age=30',
            'x-search-duration-ms': String(Date.now() - startedAt),
            'x-search-source': 'fallback_empty',
          },
        });
      }
    }

    const v2 = (data ?? {}) as Record<string, any>;
    const aptSites: any[] = Array.isArray(v2.apt_sites) ? v2.apt_sites : [];
    const v2Posts: any[] = Array.isArray(v2.posts) ? v2.posts : [];
    const v2Blogs: any[] = Array.isArray(v2.blogs) ? v2.blogs : [];
    const v2Stocks: any[] = Array.isArray(v2.stocks) ? v2.stocks : [];
    const v2Complexes: any[] = Array.isArray(v2.complexes) ? v2.complexes : [];

    // 호환 매핑 — 기존 클라이언트(SearchClient.tsx)가 쓰는 키 그대로 유지
    const compatPosts = v2Posts.map((p: any) => ({
      id: typeof p.id === 'string' && /^\d+$/.test(p.id) ? parseInt(p.id, 10) : p.id,
      title: p.title ?? '',
      content: p.snippet ?? p.content ?? '',
      created_at: p.created_at ?? null,
      category: p.category ?? p.subtitle ?? 'free',
      likes_count: p.likes_count ?? p.likes ?? 0,
      comments_count: p.comments_count ?? 0,
      view_count: p.view_count ?? 0,
      profiles: p.profiles ?? null,
    }));

    const compatBlogs = v2Blogs.map((b: any) => ({
      id: typeof b.id === 'string' && /^\d+$/.test(b.id) ? parseInt(b.id, 10) : b.id,
      slug: b.slug ?? (typeof b.url === 'string' ? b.url.replace(/^\/blog\//, '') : ''),
      title: b.title ?? '',
      excerpt: b.excerpt ?? b.snippet ?? '',
      category: b.category ?? b.subtitle ?? '',
      view_count: b.view_count ?? 0,
      cover_image: b.cover_image ?? null,
    }));

    // apt_sites를 site_type별로 분기 (기존 클라이언트 호환)
    const compatApts = aptSites.filter((a: any) => a.type === 'subscription').map((a: any) => ({
      id: a.id,
      house_nm: a.title ?? a.house_nm ?? '',
      region_nm: a.subtitle ?? a.region_nm ?? '',
      rcept_bgnde: a.rcept_bgnde ?? '',
      rcept_endde: a.rcept_endde ?? '',
    }));

    const compatTransactions = aptSites.filter((a: any) => a.type === 'trade').map((a: any) => ({
      id: a.id,
      apt_name: a.title ?? a.apt_name ?? '',
      region_nm: a.subtitle ?? a.region_nm ?? '',
      deal_amount: a.deal_amount ?? 0,
      exclusive_area: a.exclusive_area ?? 0,
      deal_date: a.deal_date ?? '',
    }));

    const compatUnsolds = aptSites.filter((a: any) => a.type === 'unsold').map((a: any) => ({
      id: a.id,
      house_nm: a.title ?? a.house_nm ?? '',
      region_nm: a.subtitle ?? a.region_nm ?? '',
      sigungu_nm: a.sigungu_nm ?? '',
      tot_unsold_hshld_co: a.tot_unsold_hshld_co ?? 0,
    }));

    const compatRedevelopments = aptSites.filter((a: any) => a.type === 'redevelopment').map((a: any) => ({
      id: a.id,
      district_name: a.title ?? a.district_name ?? '',
      region: a.subtitle ?? a.region ?? '',
      stage: a.stage ?? '',
      project_type: a.project_type ?? '재개발',
      address: a.address ?? '',
      total_households: a.total_households ?? null,
    }));

    const total = compatPosts.length + aptSites.length + compatBlogs.length + v2Stocks.length;
    const dur = Date.now() - startedAt;

    return NextResponse.json({
      // 기존 호환 키 (SearchClient가 사용)
      posts: compatPosts,
      stocks: v2Stocks,
      apts: compatApts,
      blogs: compatBlogs,
      redevelopments: compatRedevelopments,
      unsolds: compatUnsolds,
      transactions: compatTransactions,
      discussions: [], // 추후 별도 RPC 추가 예정
      total,
      query,
      page,
      hasMore: false,
      // 새 통합 키 (priority_order로 부동산 1순위 노출)
      apt_sites: aptSites,
      complexes: v2Complexes,
      priority_order: Array.isArray(v2.priority_order)
        ? v2.priority_order
        : ['apt_sites', 'complexes', 'blogs', 'posts', 'stocks'],
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        'x-search-duration-ms': String(dur),
        'x-search-source': 'unified_v2',
      },
    });
  } catch (err) {
    console.error('[Search GET s186] outer catch:', err);
    const dur = Date.now() - startedAt;
    return NextResponse.json({
      posts: [], total: 0, query: '', page: 1, hasMore: false,
      stocks: [], apts: [], blogs: [], redevelopments: [], unsolds: [], transactions: [], discussions: [],
      apt_sites: [], complexes: [], priority_order: [],
      fallback: 'outer_catch',
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30',
        'x-search-duration-ms': String(dur),
        'x-search-source': 'outer_catch',
      },
    });
  }
}
