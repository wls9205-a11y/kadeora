import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const category = searchParams.get('category') || 'all';
  const period = searchParams.get('period') || '7d';

  let query = auth.supabase
    .from('blog_posts')
    .select('id, title, slug, category, view_count, published_at')
    .eq('is_published', true);

  if (category !== 'all') query = query.eq('category', category);

  if (period === '7d') {
    query = query.gte('published_at', new Date(Date.now() - 7 * 86400000).toISOString());
  } else if (period === '30d') {
    query = query.gte('published_at', new Date(Date.now() - 30 * 86400000).toISOString());
  }

  const { data } = await query.order('view_count', { ascending: false }).limit(limit);

  return NextResponse.json({ blogs: data || [] });
}
