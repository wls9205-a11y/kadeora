import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers, sendPushBroadcast } from '@/lib/push-utils';

export const maxDuration = 60;

/**
 * push-content-alert v3 — 관심사 기반 맞춤 푸시
 *
 * v2: 전체 구독자에게 동일한 TOP 1 블로그
 * v3: 유저 관심사에 맞는 카테고리별 블로그 선택 → 개인화 발송
 *     관심사 미설정 유저 → 전체 인기글
 */

const INTEREST_TO_CAT: Record<string, string> = {
  stock: 'stock', apt: 'apt', redev: 'apt',
  crypto: 'stock', news: 'finance', tax: 'finance',
};

async function handler(req: NextRequest): Promise<NextResponse> {
  const result = await withCronLogging('push-content-alert', async () => {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // 1. 푸시 구독자 목록
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('user_id')
      .not('user_id', 'is', null);

    const userIds = [...new Set((subs || []).map(s => s.user_id).filter(Boolean))] as string[];

    if (userIds.length === 0) {
      // 비로그인 구독자만 있으면 기존 방식 (전체 브로드캐스트)
      const { data: topPost } = await sb.from('blog_posts')
        .select('title, slug, category').eq('is_published', true)
        .gte('published_at', since).order('view_count', { ascending: false })
        .limit(1).maybeSingle();
      if (!topPost) return { processed: 0, metadata: { message: 'No recent posts' } };
      const icon = topPost.category === 'stock' ? '📈' : topPost.category === 'apt' ? '🏢' : '📰';
      const { sent, failed } = await sendPushBroadcast({
        title: `${icon} ${topPost.title}`.slice(0, 60),
        body: '새 분석이 올라왔어요', url: `/blog/${topPost.slug}`, tag: 'content-alert',
      });
      return { processed: sent, failed, metadata: { mode: 'broadcast', slug: topPost.slug } };
    }

    // 2. 유저 프로필 (관심사) 조회
    const { data: profiles } = await sb.from('profiles')
      .select('id, interests, residence_city').in('id', userIds);

    // 3. 카테고리별 그룹 분류
    const groups: Record<string, string[]> = {};
    for (const p of (profiles || [])) {
      const ints = (p.interests || []) as string[];
      const cat = ints.length > 0 ? (INTEREST_TO_CAT[ints[0]] || 'general') : 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p.id);
    }

    // 4. 그룹별 맞춤 발송
    let totalSent = 0, totalFailed = 0;
    const details: Record<string, { slug: string; users: number; sent: number }> = {};

    for (const [cat, uids] of Object.entries(groups)) {
      let q = sb.from('blog_posts').select('title, slug, category')
        .eq('is_published', true).gte('published_at', since)
        .order('view_count', { ascending: false }).limit(1);
      if (cat !== 'general') q = q.eq('category', cat);
      const { data: post } = await q.maybeSingle();
      if (!post) continue;

      const icon = post.category === 'stock' ? '📈' : post.category === 'apt' ? '🏢' : post.category === 'finance' ? '💰' : '📰';
      const { sent, failed } = await sendPushToUsers(uids, {
        title: `${icon} ${post.title}`.slice(0, 60),
        body: '관심 분야 새 분석이 올라왔어요',
        url: `/blog/${post.slug}`, tag: `content-${cat}`,
      });
      totalSent += sent; totalFailed += failed;
      details[cat] = { slug: post.slug, users: uids.length, sent };
    }

    return { processed: totalSent, failed: totalFailed, metadata: { mode: 'personalized', groups: Object.keys(groups).length, details } };
  });
  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
