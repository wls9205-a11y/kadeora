export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { sendPushBroadcast } from '@/lib/push-utils';
import { submitIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

/**
 * 블로그 발행 큐 크론 (v2)
 * 
 * DB의 blog_publish_config 테이블에서 설정을 읽어 발행:
 * - daily_publish_limit: 하루 최대 발행 수 (기본 3)
 * - min_content_length: 최소 글자 수 (미달 시 스킵, 기본 1200)
 * - auto_publish_enabled: 자동 발행 on/off
 * 
 * vercel.json에서 하루 3회 호출 (09:00, 13:00, 18:00)
 * 각 호출 시 DB RPC blog_publish_from_queue()로 1개씩 안전 발행
 * 
 * ★ 발행 속도 조절: Supabase에서 blog_publish_config.daily_publish_limit만 변경
 */

export async function GET(req: NextRequest) {
  try {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-publish-queue', async () => {
    const admin = getSupabaseAdmin();

    // DB RPC로 발행 (설정값도 DB에서 읽음 — 코드 배포 없이 속도 조절 가능)
    const { data: publishResult, error: publishError } = await admin.rpc('blog_publish_from_queue');

    if (publishError) {
      console.error('[blog-publish-queue] RPC error:', publishError.message);
      throw new Error(publishError.message);
    }

    // 발행 성공 시 푸시 알림
    const publishedId = (publishResult as Record<string, any>)?.published_id;
    if (publishedId) {
      try {
        const { data: post } = await admin.from('blog_posts')
          .select('title, slug, category')
          .eq('id', publishedId).single();
        if (post) {
          await sendPushBroadcast({
            title: `📝 ${post.title}`,
            body: '카더라 블로그에 새 글이 올라왔어요',
            url: `/blog/${post.slug}`,
            tag: 'blog-new-post',
          });
          // IndexNow 즉시 색인 요청
          try { await submitIndexNow([`/blog/${post.slug}`]); } catch {}
        }
      } catch { /* 푸시 실패해도 발행은 유지 */ }
    }

    // 큐 상태도 조회 (로그용)
    const { data: queueStatus } = await admin.rpc('blog_queue_status');

    const published = (publishResult as Record<string, any>)?.published ?? 0;
    console.info(`[blog-publish-queue] Result: ${JSON.stringify(publishResult)}, Queue: ${JSON.stringify(queueStatus)}`);

    return {
      processed: published,
      created: published,
      failed: 0,
      metadata: { publish_result: publishResult, queue_status: queueStatus },
    };
  });

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({ ok: true, ...result });
} catch (e: unknown) {
    console.error('[cron/blog-publish-queue]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
