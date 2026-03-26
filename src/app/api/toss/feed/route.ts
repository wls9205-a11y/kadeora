import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const maxDuration = 10;

// 토스 미니앱용 공개 피드 API (인증 불필요)
export async function GET(req: NextRequest) {
  if (!(await rateLimit(req))) return rateLimitResponse();
  const sb = getSupabaseAdmin();

  try {
    const [postsR, hotR, tickerR] = await Promise.all([
      sb.from('posts')
        .select('id, title, category, likes_count, comments_count, created_at, profiles!inner(nickname)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20),
      sb.from('posts')
        .select('id, title, category, likes_count, comments_count, created_at')
        .eq('is_deleted', false)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('likes_count', { ascending: false })
        .limit(5),
      sb.from('stock_quotes')
        .select('symbol, name, price, change_pct')
        .order('market_cap', { ascending: false })
        .limit(5),
    ]);

    const res = NextResponse.json({
      posts: (postsR.data || []).map((p: any) => ({
        id: p.id, title: p.title, category: p.category,
        likes: p.likes_count, comments: p.comments_count,
        author: p.profiles?.nickname || '익명',
        time: p.created_at,
      })),
      hot: (hotR.data || []).map((p: any) => ({
        id: p.id, title: p.title, likes: p.likes_count,
      })),
      stocks: (tickerR.data || []).map((s: any) => ({
        symbol: s.symbol, name: s.name, price: s.price, change: s.change_pct,
      })),
    });

    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
