import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 복원 글 성과 모니터링 크론 (주 1회)
 * 복원 후 30일간 성과 추적
 * - 조회수 5회 이상 → 유지 (seo_tier = 'A')
 * - 조회수 0회 → 재비공개 (6개월 쿨다운)
 */
const MONITOR_DAYS = 30;
const MIN_VIEWS = 5;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-restore-monitor', async () => {
    const admin = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - MONITOR_DAYS * 86400000).toISOString();

    // Find posts that were restored (rewritten_at exists, was previously unpublished)
    // and have been published for at least MONITOR_DAYS
    const { data: toCheck } = await admin.from('blog_posts')
      .select('id, slug, view_count, rewritten_at, seo_score')
      .eq('is_published', true)
      .eq('seo_tier', 'restored')
      .lte('rewritten_at', cutoff)
      .limit(100);

    if (!toCheck || toCheck.length === 0) {
      return { processed: 0, metadata: { reason: 'no_posts_to_monitor' } };
    }

    let kept = 0;
    let unpublished = 0;

    for (const post of toCheck) {
      if ((post.view_count || 0) >= MIN_VIEWS) {
        // Keep — upgrade tier
        await admin.from('blog_posts')
          .update({ seo_tier: 'A' })
          .eq('id', post.id);
        kept++;
      } else {
        // Re-unpublish with cooldown marker
        await admin.from('blog_posts')
          .update({
            is_published: false,
            seo_tier: 'cooldown',
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);
        unpublished++;
      }
    }

    return {
      processed: toCheck.length,
      metadata: { kept, re_unpublished: unpublished },
    };
  });

  return NextResponse.json(result);
}
