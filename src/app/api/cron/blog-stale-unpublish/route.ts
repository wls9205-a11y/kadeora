import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('blog-stale-unpublish', async () => {
      const sb = getSupabaseAdmin();
      const currentYear = new Date().getFullYear();
      const now = new Date().toISOString();
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

      const { data: expired } = await (sb as any).from('blog_posts')
        .update({ is_published: false, auto_unpublished_at: now, auto_unpublished_reason: 'expired' })
        .eq('is_published', true)
        .lt('expires_at', now)
        .select('id');

      const { data: oldYear } = await (sb as any).from('blog_posts')
        .update({ is_published: false, auto_unpublished_at: now, auto_unpublished_reason: 'target_year_past' })
        .eq('is_published', true)
        .lt('target_year', currentYear)
        .is('auto_unpublished_at', null)
        .select('id');

      const { data: seasonal } = await (sb as any).from('blog_posts')
        .update({ is_published: false, auto_unpublished_at: now, auto_unpublished_reason: 'seasonal_stale' })
        .eq('is_published', true)
        .eq('is_seasonal', true)
        .lt('published_at', sixMonthsAgo)
        .is('auto_unpublished_at', null)
        .select('id');

      const expiredCnt = expired?.length || 0;
      const oldYearCnt = oldYear?.length || 0;
      const seasonalCnt = seasonal?.length || 0;
      const total = expiredCnt + oldYearCnt + seasonalCnt;

      return {
        processed: total,
        created: 0,
        updated: total,
        failed: 0,
        metadata: { expired: expiredCnt, old_year: oldYearCnt, seasonal: seasonalCnt },
      };
    })
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
