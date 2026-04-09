import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const INDEXNOW_KEY = '3a23def313e1b1283822c54a0f9a5675';
const SITE_URL = 'https://kadeora.app';
export const maxDuration = 30;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('seo-indexnow-submit', async () => {
    const sb = getSupabaseAdmin();
    const urls: string[] = [];

    const { data: recentPosts } = await sb
      .from('blog_posts').select('slug').eq('is_published', true)
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);
    if (recentPosts?.length) urls.push(...recentPosts.map((p: any) => `${SITE_URL}/blog/${p.slug}`));

    const { data: activeSites } = await (sb as any).from('page_views')
      .select('path').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .like('path', '/apt/%').limit(50);
    if (activeSites?.length) {
      const unique = [...new Set(activeSites.map((p: any) => p.path))] as string[];
      urls.push(...unique.slice(0, 50).map(p => `${SITE_URL}${p}`));
    }

    if (new Date().getDay() === 1) {
      urls.push(`${SITE_URL}/apt`, `${SITE_URL}/stock`, `${SITE_URL}/blog`, `${SITE_URL}/calc`, `${SITE_URL}/apt/diagnose`);
    }

    if (!urls.length) return { processed: 0 };

    const batch = urls.slice(0, 200);
    try {
      await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: 'kadeora.app', key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: batch }),
      });
    } catch {}

    return { processed: batch.length, metadata: { total_candidates: urls.length } };
  });
  return NextResponse.json({ ok: true, ...result });
});
