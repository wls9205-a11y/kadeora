import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('seo-content-boost', async () => {
    const sb = getSupabaseAdmin();
    let unpublished = 0;

    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: thinPosts } = await sb
      .from('blog_posts').select('id')
      .eq('is_published', true).lte('view_count', 2)
      .lt('created_at', cutoff).is('rewritten_at', null).limit(100);

    if (thinPosts?.length) {
      const ids = thinPosts.map((p: any) => p.id);
      const { error } = await sb.from('blog_posts')
        .update({ is_published: false }).in('id', ids);
      if (!error) unpublished = ids.length;
    }

    return { processed: unpublished, updated: unpublished };
  });
  return NextResponse.json({ ok: true, ...result });
});
