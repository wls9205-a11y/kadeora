import { cachedJson } from '@/lib/api-cache';
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('trending_keywords').select('keyword, heat_score, rank').order('heat_score', { ascending: false }).limit(10);
    
    if (data && data.length > 0) {
      return cachedJson(data.map((d: any, i: number) => ({ keyword: d.keyword, heat_score: d.heat_score, rank: d.rank || i + 1 })), 300);
    }

    // 동적 폴백: 인기 블로그 태그에서 생성
    let tagFallback: any[] | null = null;
    try {
      const { data: tagData } = await sb.rpc('blog_popular_tags', { limit_count: 10 });
      tagFallback = tagData;
    } catch { /* silent */ }
    if (tagFallback && tagFallback.length > 0) {
      return cachedJson(tagFallback.map((t: any, i: number) => ({ keyword: t.tag, heat_score: 100 - i * 5, rank: i + 1 })), 300);
    }

    // 최종 폴백: 인기 종목
    const { data: stocks } = await sb.from('stock_quotes').select('name').gt('price', 0).order('change_pct', { ascending: false }).limit(8);
    const fallback = (stocks || []).map((s: any, i: number) => ({ keyword: s.name, heat_score: 80 - i * 5, rank: i + 1 }));
    return cachedJson(fallback, 300);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const authSb = await createSupabaseServer();
    const { data: { user } } = await authSb.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('refresh_trending_keywords');
    if (error) { console.error('[Trend]', error); return NextResponse.json({ error: '트렌딩 갱신 실패' }, { status: 500 }); }
    return cachedJson({ success: true }, 60);
  } catch (err) { console.error('[Trend]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
