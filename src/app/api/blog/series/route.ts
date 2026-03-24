import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const sb = getSupabaseAdmin();

    if (slug) {
      // 특정 시리즈 + 포스트 목록
      const { data: series } = await sb.from('blog_series')
        .select('id,title,slug,description,cover_image,category,post_count,is_active').eq('slug', slug).eq('is_active', true).single();
      if (!series) return NextResponse.json({ error: '시리즈를 찾을 수 없습니다' }, { status: 404 });

      const { data: posts } = await sb.from('blog_posts')
        .select('id,title,slug,excerpt,cover_image,category,published_at,series_order')
        .eq('series_id', series.id)
        .eq('is_published', true)
        .order('series_order', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: true });

      return NextResponse.json({ series, posts: posts || [] }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    // 전체 시리즈 목록
    const { data: seriesList } = await sb.from('blog_series')
      .select('id,title,slug,description,cover_image,category,post_count,is_active')
      .eq('is_active', true)
      .order('post_count', { ascending: false });

    return NextResponse.json({ series: seriesList || [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
