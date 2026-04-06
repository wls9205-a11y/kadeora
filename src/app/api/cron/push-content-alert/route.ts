import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushBroadcast } from '@/lib/push-utils';

export const maxDuration = 60;

/**
 * push-content-alert — 매일 KST 22:30, 전체 푸시 구독자에게 인기 블로그 알림
 * Layer 3 재방문 엔진. 구독자 없으면 즉시 종료.
 * v2: push-utils sendPushBroadcast로 중복 코드 제거 (89→46줄)
 */

async function handler(req: NextRequest): Promise<NextResponse> {
  const result = await withCronLogging('push-content-alert', async () => {
    const sb = getSupabaseAdmin();

    const { data: topPost } = await sb
      .from('blog_posts')
      .select('title, slug, category')
      .eq('is_published', true)
      .gte('published_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('view_count', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!topPost) {
      return { processed: 0, metadata: { message: 'No recent posts' } };
    }

    const icon = topPost.category === 'stock' ? '📈' : topPost.category === 'apt' ? '🏢' : topPost.category === 'finance' ? '💰' : '📰';
    const { sent, failed } = await sendPushBroadcast({
      title: `${icon} ${topPost.title}`.slice(0, 60),
      body: '새 분석이 올라왔어요',
      url: `/blog/${topPost.slug}`,
      tag: 'content-alert',
    });

    return { processed: sent, failed, metadata: { slug: topPost.slug } };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
