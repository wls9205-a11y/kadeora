import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import webpush from 'web-push';

export const maxDuration = 60;

/**
 * push-content-alert — 매일 KST 20:00, 전체 푸시 구독자에게 인기 블로그 알림
 * Layer 3 재방문 엔진. 구독자 없으면 즉시 종료.
 */

function ensureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails('mailto:kadeora.app@gmail.com', pub, priv);
  return true;
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const result = await withCronLogging('push-content-alert', async () => {
    if (!ensureVapid()) {
      return { processed: 0, metadata: { message: 'VAPID keys not configured' } };
    }

    const sb = getSupabaseAdmin();

    // 전체 푸시 구독자 (user_id 유무 불문)
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .limit(500);

    if (!subs || subs.length === 0) {
      return { processed: 0, metadata: { message: 'No subscribers yet' } };
    }

    // 최근 48시간 인기 블로그
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

    const icon = topPost.category === 'stock' ? '📈' : topPost.category === 'apt' ? '🏢' : '📰';
    const payload = JSON.stringify({
      title: `${icon} ${topPost.title}`.slice(0, 60),
      body: '새 분석이 올라왔어요',
      url: `/blog/${topPost.slug}`,
      tag: 'content-alert',
    });

    let sent = 0, failed = 0;
    const expired: number[] = [];

    await Promise.allSettled(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } },
          payload,
          { TTL: 86400 }
        );
        sent++;
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) expired.push(Number(sub.id));
        failed++;
      }
    }));

    if (expired.length > 0) {
      await sb.from('push_subscriptions').delete().in('id', expired);
    }

    return { processed: sent, failed, metadata: { total: subs.length, expired: expired.length, slug: topPost.slug } };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
