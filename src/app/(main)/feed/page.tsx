import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import LoginGate from '@/components/LoginGate';
export const metadata: Metadata = {
  title: '커뮤니티 피드',
  description: '주식, 부동산, 청약, 재테크 소문과 정보를 나누는 카더라 커뮤니티. 실시간 투자 이야기를 나누세요.',
  alternates: { canonical: SITE_URL + '/feed' },
  openGraph: {
    title: '카더라 커뮤니티 피드',
    description: '주식, 부동산, 청약 정보 커뮤니티',
    url: SITE_URL + '/feed',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('카더라 커뮤니티')}&subtitle=${encodeURIComponent('주식 · 부동산 · 재테크')}&design=2`, width: 1200, height: 630, alt: '카더라 피드' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('카더라 커뮤니티')}&category=feed`, width: 630, height: 630, alt: '카더라 피드' },
    ],
  },
  other: {
    'naver:written_time': new Date().toISOString(),
    'naver:updated_time': new Date().toISOString(),
    'naver:author': '카더라',
    'og:updated_time': new Date().toISOString(),
    'dg:plink': SITE_URL + '/feed',
    'article:section': '커뮤니티',
    'article:tag': '커뮤니티,주식,부동산,청약,토론,카더라',
  },
  twitter: { card: 'summary_large_image', title: '카더라 커뮤니티 피드', description: '주식·부동산·청약 실시간 소식' },
};
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DEMO_POSTS } from '@/lib/constants';
import type { PostWithProfile } from '@/types/database';
import FeedClient from './FeedClient';
import AnonymousFeedHero from '@/components/AnonymousFeedHero';
import Disclaimer from '@/components/Disclaimer';
import LiveBar from '@/components/ui/LiveBar';

// Cache: 60s — 피드 목록
export const revalidate = 60;

const withTimeout = <T,>(p: PromiseLike<T>, ms = 5000): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

type SortKey = 'latest' | 'popular' | 'comments';

async function getPosts(category: string, region: string = 'all', sort: SortKey = 'latest', userId?: string) {
  const sb = await createSupabaseServer();

  // 팔로잉 피드: 내가 팔로우하는 유저의 글만
  if (category === 'following') {
    if (!userId) return null;
    const { data: follows } = await sb.from('follows').select('followee_id').eq('follower_id', userId);
    const ids = (follows ?? []).map((f: { followee_id: string }) => f.followee_id);
    if (ids.length === 0) return [] as unknown as PostWithProfile[];
    const { data } = await sb.from('posts')
      .select('id,title,excerpt,category,created_at,likes_count,comments_count,view_count,bookmarks_count,is_pinned,is_anonymous,author_id,region_id,images,tags,stock_tags,apt_tags,post_type,profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
      .eq('is_deleted', false)
      .in('author_id', ids)
      .order('created_at', { ascending: false })
      .limit(30);
    return (data ?? []) as unknown as PostWithProfile[];
  }

  const orderCol = sort === 'popular' ? 'likes_count' : sort === 'comments' ? 'comments_count' : 'created_at';
  let q = sb.from('posts')
    .select('id,title,excerpt,category,created_at,likes_count,comments_count,view_count,bookmarks_count,is_pinned,is_anonymous,author_id,region_id,images,tags,stock_tags,apt_tags,post_type,profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
    .eq('is_deleted', false)
    .order(orderCol, { ascending: false })
    .limit(30);
  if (sort === 'latest') q = q.lte('created_at', new Date().toISOString());
  if (sort === 'popular') q = q.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  if (category !== 'all') q = q.eq('category', category);
  if (category === 'local' && region !== 'all') q = q.eq('region_id', region);
  const result = await withTimeout(q);
  const data = (result as { data?: PostWithProfile[] } | null)?.data;
  if (!data || data.length === 0) return null;
  return data as unknown as PostWithProfile[];
}


interface Props { searchParams: Promise<{ category?: string; region?: string; sort?: string }>; }

export default async function FeedPage({ searchParams }: Props) {
  const { category = 'all', region = 'all', sort = 'latest' } = await searchParams;
  const validSort = (['latest', 'popular', 'comments'] as SortKey[]).includes(sort as SortKey) ? sort as SortKey : 'latest';

  // 로그인 여부 확인 (팔로잉 탭 + AnonymousFeedHero 양쪽에서 사용)
  let userId: string | undefined;
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id;
  } catch { /* 비로그인 OK */ }

  // 비로그인이면 가입 유도 hero 데이터 fetch (RPC — SECURITY DEFINER + EXCEPTION 핸들러)
  let anonHomepageData: any = null;
  if (!userId) {
    try {
      const sbAdmin = getSupabaseAdmin();
      const { data, error } = await (sbAdmin as any).rpc('get_homepage_for_anonymous');
      if (!error && data) anonHomepageData = data;
    } catch (e) {
      console.error('[feed] get_homepage_for_anonymous threw:', e);
      // null이어도 AnonymousFeedHero는 DEFAULT_VALUE_PROPS로 fallback 렌더
    }
  }

  const postsData = await Promise.allSettled([getPosts(category, region, validSort, userId)]);
  const posts = postsData[0].status === 'fulfilled' && postsData[0].value != null ? postsData[0].value : category === 'all' ? DEMO_POSTS : DEMO_POSTS.filter(p => p.category === category);
  return (
    <Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '커뮤니티 피드' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: '카더라 커뮤니티 피드', description: '주식, 부동산, 청약, 재테크 소문과 정보를 나누는 커뮤니티', url: SITE_URL + '/feed', isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL } }) }} />
      {/* Phase 9: 실시간 신선도 시그니처 */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
        <LiveBar text={`피드 · ${posts.length.toLocaleString()}건 노출 · 카테고리 ${category} · 정렬 ${validSort}`} />
      </div>
      {!userId && <AnonymousFeedHero data={anonHomepageData} />}
      <FeedClient posts={posts} activeCategory={category} activeRegion={region} activeSort={validSort} />
      <LoginGate feature="feed_write" blurHeight={60}>
        <div style={{ padding: '8px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>글쓰기 · 댓글 · 투표에 참여하세요</div>
        </div>
      </LoginGate>
      <Disclaimer type="feed" />
    </Suspense>
  );
}
