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

    // Use individual count queries per tier (avoids 1000-row limit)
    const tiers = ['S', 'A', 'B', 'C', 'D', 'restore_candidate', 'restored', 'cooldown'] as const;
    const tierPromises = tiers.map(async (tier) => {
      const [pub, unpub] = await Promise.all([
        (sb as any).from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).eq('seo_tier', tier),
        (sb as any).from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', false).eq('seo_tier', tier),
      ]);
      return { tier, published: pub.count || 0, unpublished: unpub.count || 0, cnt: (pub.count || 0) + (unpub.count || 0) };
    });

    const [tierDist, batchRes, publishedRes, unpublishedRes, remainingRes, rewrittenRes, aptAnalysisRes, aptTotalRes, stockAnalysisRes, stockTotalRes, indexnowLogsRes, qualityHighRes, qualityMidRes, qualityLowRes] = await Promise.all([
      Promise.all(tierPromises),
      (sb as any).from('rewrite_batches').select('*').order('created_at', { ascending: false }).limit(10),
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', false),
      (sb as any).from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).in('seo_tier', ['B', 'C']),
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).not('rewritten_at', 'is', null),
      (sb as any).from('apt_sites').select('id', { count: 'exact', head: true }).not('analysis_text', 'is', null),
      (sb as any).from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true),
      (sb as any).from('stock_quotes').select('id', { count: 'exact', head: true }).not('analysis_text', 'is', null),
      (sb as any).from('stock_quotes').select('id', { count: 'exact', head: true }).eq('is_active', true),
      sb.from('cron_logs').select('cron_name, status, records_processed, created_at').in('cron_name', ['indexnow-mass', 'indexnow-new-content']).order('created_at', { ascending: false }).limit(5),
      (sb as any).from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('is_active', true).gte('data_quality_score', 70),
      (sb as any).from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('is_active', true).gte('data_quality_score', 50).lt('data_quality_score', 70),
      (sb as any).from('stock_quotes').select('symbol', { count: 'exact', head: true }).eq('is_active', true).lt('data_quality_score', 50),
    ]);

    return NextResponse.json({
      tierDist: tierDist.filter(t => t.cnt > 0).sort((a, b) => b.cnt - a.cnt),
      batches: batchRes.data || [],
      pruneStatus: {
        published: publishedRes.count || 0,
        unpublished: unpublishedRes.count || 0,
        remaining_prune: remainingRes.count || 0,
        rewritten: rewrittenRes.count || 0,
      },
      indexnowLogs: (indexnowLogsRes.data || []),
      qualityDist: { high: qualityHighRes.count || 0, mid: qualityMidRes.count || 0, low: qualityLowRes.count || 0 },
      analysisStatus: {
        apt_done: aptAnalysisRes.count || 0,
        apt_total: aptTotalRes.count || 0,
        stock_done: stockAnalysisRes.count || 0,
        stock_total: stockTotalRes.count || 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
