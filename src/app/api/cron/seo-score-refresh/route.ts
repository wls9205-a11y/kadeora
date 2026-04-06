import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 월별 seo_score 재계산 크론
 * view_count, helpful_count, comment_count 변화를 반영
 * seo_tier 승격/강등 판단
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('seo-score-refresh', async () => {
    const admin = getSupabaseAdmin();

    // Recalculate scores via SQL for efficiency
    const { error } = await admin.rpc('refresh_seo_scores' as any);
    
    if (error) {
      // Fallback: direct SQL if RPC doesn't exist
      const { error: sqlErr } = await (admin as any).rpc('exec_sql', {
        query: `
          WITH score_calc AS (
            SELECT id,
              CASE WHEN length(content) >= 5000 THEN 25 WHEN length(content) >= 4000 THEN 22 WHEN length(content) >= 3000 THEN 18 WHEN length(content) >= 2000 THEN 10 ELSE 5 END +
              CASE WHEN view_count >= 50 THEN 25 WHEN view_count >= 20 THEN 20 WHEN view_count >= 10 THEN 15 WHEN view_count >= 5 THEN 10 WHEN view_count >= 1 THEN 5 ELSE 0 END +
              CASE WHEN sub_category IS NOT NULL AND sub_category != '' THEN 15 ELSE 0 END +
              CASE WHEN source_ref IS NOT NULL AND source_ref != '' THEN 10 ELSE 0 END +
              LEAST(COALESCE(helpful_count,0)*3 + COALESCE(comment_count,0)*2, 10) +
              CASE WHEN rewritten_at IS NOT NULL AND length(content) >= 3000 THEN 10 WHEN rewritten_at IS NOT NULL THEN 5 ELSE 0 END +
              CASE WHEN title NOT LIKE '%시세 분석%' AND title NOT LIKE '%투자 전망%' THEN 5 ELSE 2 END
              AS new_score
            FROM blog_posts
          )
          UPDATE blog_posts bp SET 
            seo_score = sc.new_score,
            seo_tier = CASE
              WHEN sc.new_score >= 70 THEN 'S'
              WHEN sc.new_score >= 50 THEN 'A'
              WHEN sc.new_score >= 30 THEN 'B'
              WHEN sc.new_score >= 15 THEN 'C'
              ELSE 'D'
            END
          FROM score_calc sc WHERE bp.id = sc.id AND bp.seo_tier NOT IN ('restore_candidate','restored','cooldown')
        `
      });

      if (sqlErr) {
        console.error('[seo-score-refresh] SQL error:', sqlErr.message);
      }
    }

    // Count current distribution
    const { data: dist } = await admin.from('blog_posts')
      .select('seo_tier')
      .eq('is_published', true);

    const counts: Record<string, number> = {};
    for (const d of (dist || [])) {
      counts[d.seo_tier] = (counts[d.seo_tier] || 0) + 1;
    }

    return { processed: 1, metadata: { distribution: counts } };
  });

  return NextResponse.json(result);
}
