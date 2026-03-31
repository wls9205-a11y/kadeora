import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const maxDuration = 10;

// 토스 미니앱용 공개 피드 API (v2 — 최신 데이터 반영)
export async function GET(req: NextRequest) {
  if (!(await rateLimit(req))) return rateLimitResponse();
  const sb = getSupabaseAdmin();

  try {
    const [postsR, hotR, tickerR, aptR, blogR] = await Promise.all([
      // 최신 게시글
      sb.from('posts')
        .select('id, title, category, likes_count, comments_count, created_at, profiles(nickname)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20),
      // 인기 게시글 (7일)
      sb.from('posts')
        .select('id, title, category, likes_count, comments_count, created_at')
        .eq('is_deleted', false)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('likes_count', { ascending: false })
        .limit(5),
      // 시총 상위 주식 (국내+해외 10종목)
      sb.from('stock_quotes')
        .select('symbol, name, market, price, change_pct, currency, sector')
        .eq('is_active', true)
        .gt('price', 0)
        .neq('sector', '지수')
        .order('market_cap', { ascending: false })
        .limit(10),
      // 최근 청약 (접수중/예정)
      sb.from('apt_subscriptions')
        .select('id, house_nm, region_nm, tot_supply_hshld_co, rcept_bgnde, rcept_endde, constructor_nm, general_supply_total, special_supply_total')
        .gte('rcept_endde', new Date().toISOString().split('T')[0])
        .order('rcept_bgnde', { ascending: true })
        .limit(5),
      // 최신 블로그
      sb.from('blog_posts')
        .select('slug, title, category, excerpt, published_at')
        .eq('is_published', true)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(5),
    ]);

    const res = NextResponse.json({
      posts: (postsR.data || []).map((p: Record<string, any>) => ({
        id: p.id, title: p.title, category: p.category,
        likes: p.likes_count, comments: p.comments_count,
        author: p.profiles?.nickname || '익명',
        time: p.created_at,
      })),
      hot: (hotR.data || []).map((p: Record<string, any>) => ({
        id: p.id, title: p.title, likes: p.likes_count,
      })),
      stocks: (tickerR.data || []).map((s: any) => ({
        symbol: s.symbol, name: s.name, market: s.market,
        price: s.price, change: s.change_pct,
        currency: s.currency, sector: s.sector,
      })),
      subscriptions: (aptR.data || []).map((a: any) => ({
        id: a.id, name: a.house_nm, region: a.region_nm,
        total: a.tot_supply_hshld_co,
        general: a.general_supply_total, special: a.special_supply_total,
        start: a.rcept_bgnde, end: a.rcept_endde,
        builder: a.constructor_nm,
      })),
      blogs: (blogR.data || []).map((b: any) => ({
        slug: b.slug, title: b.title, category: b.category,
        excerpt: b.excerpt, date: b.published_at,
      })),
    });

    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
