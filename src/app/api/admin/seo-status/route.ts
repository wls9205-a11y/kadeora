import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isAdmin = authHeader === `Bearer ${cronSecret}`;
  // Also allow from admin page (cookie-based auth checked elsewhere)

  try {
    const sb = getSupabaseAdmin();

    const [tierRes, batchRes, publishedRes, unpublishedRes, remainingRes] = await Promise.all([
      (sb as any).from('blog_posts')
        .select('seo_tier, is_published')
        .not('seo_tier', 'is', null),
      (sb as any).from('rewrite_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      sb.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      sb.from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', false),
      (sb as any).from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .in('seo_tier', ['B', 'C']),
    ]);

    // Aggregate tier distribution
    const tierMap: Record<string, { published: number; unpublished: number }> = {};
    for (const row of (tierRes.data || [])) {
      const t = row.seo_tier || 'unknown';
      if (!tierMap[t]) tierMap[t] = { published: 0, unpublished: 0 };
      if (row.is_published) tierMap[t].published++;
      else tierMap[t].unpublished++;
    }
    const tierDist = Object.entries(tierMap)
      .map(([tier, v]) => ({ tier, cnt: v.published + v.unpublished, published: v.published, unpublished: v.unpublished }))
      .sort((a, b) => b.cnt - a.cnt);

    return NextResponse.json({
      tierDist,
      batches: batchRes.data || [],
      pruneStatus: {
        published: publishedRes.count || 0,
        unpublished: unpublishedRes.count || 0,
        remaining_prune: remainingRes.count || 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
