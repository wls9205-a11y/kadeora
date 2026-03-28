import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, 'search');
  if (!rl.success) return rl.response;

  const q = sanitizeSearchQuery(req.nextUrl.searchParams.get('q') || '', 50);
  if (!q || q.length < 1) return NextResponse.json({ suggestions: [] });

  try {
    const sb = await createSupabaseServer();
    const [stocksR, aptsR, blogsR] = await Promise.all([
      sb.from('stock_quotes').select('symbol, name').ilike('name', `%${q}%`).limit(3),
      sb.from('apt_subscriptions').select('id, house_nm').ilike('house_nm', `%${q}%`).limit(2),
      sb.from('blog_posts').select('slug, title').eq('is_published', true).ilike('title', `%${q}%`).limit(2),
    ]);

    const suggestions = [
      ...(stocksR.data || []).map((s: any) => ({ type: 'stock' as const, label: s.name, href: `/stock/${s.symbol}` })),
      ...(aptsR.data || []).map((a: any) => ({ type: 'apt' as const, label: a.house_nm, href: `/apt/${a.id}` })),
      ...(blogsR.data || []).map((b: any) => ({ type: 'blog' as const, label: b.title, href: `/blog/${b.slug}` })),
    ];

    return NextResponse.json({ suggestions }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
