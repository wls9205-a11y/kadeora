import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const INDEXNOW_KEY = '3a23def313e1b1283822c54a0f9a5675';
const SITE_URL = 'https://kadeora.app';

async function handler() {
  const sb = getSupabaseAdmin();
  const urls: string[] = [];

  // 1. 최근 24시간 발행/수정된 블로그 글
  const { data: recentPosts } = await sb
    .from('blog_posts')
    .select('slug')
    .eq('is_published', true)
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100);

  if (recentPosts?.length) {
    urls.push(...recentPosts.map((p: any) => `${SITE_URL}/blog/${p.slug}`));
  }

  // 2. 최근 24시간 활성 부동산 페이지
  const { data: activeSites } = await (sb as any).from('page_views')
    .select('path')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .like('path', '/apt/%')
    .limit(50);

  if (activeSites?.length) {
    const uniquePaths = [...new Set(activeSites.map((p: any) => p.path))] as string[];
    urls.push(...uniquePaths.slice(0, 50).map(p => `${SITE_URL}${p}`));
  }

  // 3. 주요 고정 페이지 (월요일)
  if (new Date().getDay() === 1) {
    urls.push(
      `${SITE_URL}/apt`, `${SITE_URL}/stock`, `${SITE_URL}/blog`,
      `${SITE_URL}/calc`, `${SITE_URL}/apt/diagnose`, `${SITE_URL}/feed`,
    );
  }

  if (urls.length === 0) return { submitted: 0, message: 'No URLs to submit' };

  const batch = urls.slice(0, 200);
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'kadeora.app',
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: batch,
      }),
    });
    return { submitted: batch.length, status: res.status, totalCandidates: urls.length };
  } catch (e: any) {
    return { submitted: 0, error: e.message };
  }
}

export const GET = withCronLogging('seo-indexnow-submit', handler);
export const maxDuration = 30;
