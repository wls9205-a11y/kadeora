import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export const dynamic = 'force-dynamic';

/**
 * 블로그 발행 큐 크론
 * 
 * - 하루 최대 3개까지 대기 중인 글을 순차 발행
 * - 발행 = is_published=true + published_at=NOW()
 * - 오전 9시, 오후 1시, 오후 6시에 각 1개씩 발행 (vercel.json에서 3회 호출)
 * - 또는 1회 호출 시 남은 쿼터만큼 발행
 */

const DAILY_PUBLISH_LIMIT = 3;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-publish-queue', async () => {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 오늘 이미 발행된 건수
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await admin
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .gte('published_at', todayStart.toISOString());

    const remaining = DAILY_PUBLISH_LIMIT - (todayCount ?? 0);
    if (remaining <= 0) {
      return {
        processed: 0,
        created: 0,
        failed: 0,
        metadata: { reason: 'daily_limit_reached', today_count: todayCount },
      };
    }

    // 이번 호출에서 1개만 발행 (시간대별 분산)
    const publishCount = 1;

    // 큐에서 가장 오래된 대기 글 가져오기
    const { data: queue } = await admin
      .from('blog_posts')
      .select('id, title, slug, category')
      .eq('is_published', false)
      .is('published_at', null)
      .order('created_at', { ascending: true })
      .limit(publishCount);

    if (!queue || queue.length === 0) {
      return {
        processed: 0,
        created: 0,
        failed: 0,
        metadata: { reason: 'queue_empty' },
      };
    }

    let published = 0;
    for (const post of queue) {
      const { error } = await admin
        .from('blog_posts')
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      if (!error) {
        published++;
        console.log(`[blog-publish-queue] Published: "${post.title}" (${post.slug})`);
      } else {
        console.error(`[blog-publish-queue] Failed to publish ${post.slug}:`, error.message);
      }
    }

    return {
      processed: queue.length,
      created: published,
      failed: queue.length - published,
      metadata: {
        today_total: (todayCount ?? 0) + published,
        daily_limit: DAILY_PUBLISH_LIMIT,
        queue_published: queue.map(p => p.slug),
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({ ok: true, ...result });
}
