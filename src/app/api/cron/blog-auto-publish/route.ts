export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

const BATCH = 50;
const SITE_URL = 'https://kadeora.app';

/**
 * 블로그 자동 공개 크론
 * - auto_publish_eligible = true인 비공개 글 → 자동 공개
 * - quality_score >= 65, seo_tier S/A/restore_candidate, content >= 2500자
 * - 공개 후 IndexNow 제출
 * 매시간 50건 처리
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-auto-publish', async () => {
    const sb = getSupabaseAdmin();

    // 자동 공개 대상 조회
    const { data: posts, error } = await sb
      .from('blog_posts')
      .select('id, slug, title, category, quality_score, seo_tier, content_length')
      .eq('is_published', false)
      .eq('auto_publish_eligible', true)
      .gte('quality_score', 65)
      .gte('content_length', 2500)
      .in('seo_tier', ['S', 'A', 'restore_candidate'])
      .order('quality_score', { ascending: false })
      .limit(BATCH);

    if (error) throw new Error(`query error: ${error.message}`);
    if (!posts?.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_eligible' } };

    let published = 0;
    let failed = 0;
    const slugs: string[] = [];

    for (const post of posts) {
      try {
        const { error: updErr } = await sb.from('blog_posts').update({
          is_published: true,
          published_at: new Date().toISOString(),
          auto_publish_eligible: false, // 한 번 공개된 글은 플래그 해제
          updated_at: new Date().toISOString(),
        }).eq('id', post.id);

        if (updErr) { failed++; continue; }

        published++;
        if (post.slug) slugs.push(post.slug);
      } catch {
        failed++;
      }
    }

    // IndexNow 일괄 제출 (공개된 글)
    if (slugs.length > 0) {
      try {
        const urls = slugs.slice(0, 100).map(s => `${SITE_URL}/blog/${s}`);
        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: 'kadeora.app',
            key: process.env.INDEXNOW_KEY || 'kadeora-indexnow-key',
            urlList: urls,
          }),
        }).catch(() => {});
      } catch {}
    }

    return {
      processed: posts.length,
      created: published,
      failed,
      metadata: {
        published_count: published,
        sample_slugs: slugs.slice(0, 5),
        avg_quality: posts.length > 0
          ? Math.round(posts.reduce((s, p) => s + (p.quality_score || 0), 0) / posts.length)
          : 0,
      },
    };
  });

  return NextResponse.json(result);
}
