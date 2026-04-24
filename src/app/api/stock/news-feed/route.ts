import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 300;
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

// GET /api/stock/news-feed — 전체 종목 뉴스 최신 30건
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('stock_news')
      .select('id, symbol, title, url, source, published_at, sentiment, sentiment_label, sentiment_score, ai_summary')
      .order('published_at', { ascending: false })
      .limit(30);

    return NextResponse.json(
      { news: data || [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch {
    return NextResponse.json({ news: [] });
  }
}
