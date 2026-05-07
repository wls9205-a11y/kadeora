import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers, sendPushBroadcast, filterActiveUsers } from '@/lib/push-utils';
import { SITE_URL } from '@/lib/constants';

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

    // 시드 유저 제외
    if (userIds.length > 0) {
      const { data: seeds } = await sb.from('profiles').select('id').in('id', userIds).eq('is_seed', true);
      const seedIds = new Set((seeds || []).map((s: any) => s.id));
      const filtered = userIds.filter(id => !seedIds.has(id));
      if (filtered.length === 0 && userIds.length > 0) {
        // 시드만 구독 중 → broadcast로 fallback
      } else {
        userIds.length = 0;
        userIds.push(...filtered);
      }
    }

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
        image: `${SITE_URL}/api/og?title=${encodeURIComponent(topPost.title)}&category=${topPost.category}&design=${1 + Math.floor(Math.random() * 6)}`,
      });
      return { processed: sent, failed, metadata: { mode: 'broadcast', slug: topPost.slug } };
    }

    // 2. 유저 프로필 (관심사) 조회
    const { data: profiles } = await sb.from('profiles')
      .select('id, interests, residence_city').in('id', userIds);

    // 3. 카테고리별 그룹 분류 (apt는 지역별 서브그룹)
    const groups: Record<string, { uids: string[]; city?: string }> = {};
    for (const p of (profiles || [])) {
      const ints = (p.interests || []) as string[];
      const cat = ints.length > 0 ? (INTEREST_TO_CAT[ints[0]] || 'general') : 'general';
      const city = (p as any).residence_city as string | null;
      // apt 카테고리 + 지역 설정 유저 → 지역별 서브그룹
      const key = cat === 'apt' && city ? `apt:${city}` : cat;
      if (!groups[key]) groups[key] = { uids: [], city: cat === 'apt' && city ? city : undefined };
      groups[key].uids.push(p.id);
    }

    // 4. 그룹별 맞춤 발송
    let totalSent = 0, totalFailed = 0;
    const details: Record<string, { slug: string; users: number; sent: number }> = {};

    for (const [key, group] of Object.entries(groups)) {
      const cat = key.split(':')[0]; // 'apt:부산' → 'apt'
      const uids = group.uids;
      let q = sb.from('blog_posts').select('title, slug, category')
        .eq('is_published', true).gte('published_at', since)
        .order('view_count', { ascending: false }).limit(1);
      if (cat !== 'general') q = q.eq('category', cat);
      // 지역 필터링 (apt 카테고리 + 지역 설정 유저)
      if (group.city) q = q.ilike('title', `%${group.city}%`);
      const { data: post } = await q.maybeSingle();
      if (!post) continue;

      const icon = post.category === 'stock' ? '📈' : post.category === 'apt' ? '🏢' : post.category === 'finance' ? '💰' : '📰';
      // 옵트아웃 + Quiet Hours 필터링
      const activeUids = await filterActiveUsers(uids, 'push_hot_post');
      if (activeUids.length === 0) continue;
      const { sent, failed } = await sendPushToUsers(activeUids, {
        title: `${icon} ${post.title}`.slice(0, 60),
        body: '관심 분야 새 분석이 올라왔어요',
        url: `/blog/${post.slug}`, tag: `content-${cat}`,
        image: `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}&design=${1 + Math.floor(Math.random() * 6)}`,
      });
      totalSent += sent; totalFailed += failed;
      details[cat] = { slug: post.slug, users: uids.length, sent };
    }

    return { processed: totalSent, failed: totalFailed, metadata: { mode: 'personalized', groups: Object.keys(groups).length, details } };
  });
  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
