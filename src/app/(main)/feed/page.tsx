import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
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
    images: [{ url: SITE_URL + '/images/brand/kadeora-hero.png', alt: '카더라 피드' }],
  },
  other: {
    'naver:written_time': '2026-01-15T00:00:00Z',
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
import { DEMO_POSTS } from '@/lib/constants';
import type { PostWithProfile } from '@/types/database';
import FeedClient from './FeedClient';
import Disclaimer from '@/components/Disclaimer';

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
      .select('id,title,excerpt,category,created_at,likes_count,comments_count,view_count,bookmarks_count,is_pinned,is_anonymous,author_id,region_id,images,tags,stock_tags,apt_tags,profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
      .eq('is_deleted', false)
      .in('author_id', ids)
      .order('created_at', { ascending: false })
      .limit(20);
    return (data ?? []) as unknown as PostWithProfile[];
  }

  const orderCol = sort === 'popular' ? 'likes_count' : sort === 'comments' ? 'comments_count' : 'created_at';
  let q = sb.from('posts')
    .select('id,title,excerpt,category,created_at,likes_count,comments_count,view_count,bookmarks_count,is_pinned,is_anonymous,author_id,region_id,images,tags,stock_tags,apt_tags,profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
    .eq('is_deleted', false)
    .order(orderCol, { ascending: false })
    .limit(20);
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

  // 팔로잉 탭: 서버에서 유저 id 필요
  let userId: string | undefined;
  if (category === 'following') {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id;
  }

  const postsData = await Promise.allSettled([getPosts(category, region, validSort, userId)]);
  const posts = postsData[0].status === 'fulfilled' && postsData[0].value != null ? postsData[0].value : category === 'all' ? DEMO_POSTS : DEMO_POSTS.filter(p => p.category === category);
  return (
    <Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '커뮤니티 피드' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: '카더라 커뮤니티 피드', description: '주식, 부동산, 청약, 재테크 소문과 정보를 나누는 커뮤니티', url: SITE_URL + '/feed', isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL } }) }} />
      <FeedClient posts={posts} activeCategory={category} activeRegion={region} activeSort={validSort} />
      <Disclaimer />
    </Suspense>
  );
}
