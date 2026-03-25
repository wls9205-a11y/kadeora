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
    'naver:written_time': new Date().toISOString(),
    'naver:updated_time': new Date().toISOString(),
    'dg:plink': SITE_URL + '/feed',
    'article:section': '커뮤니티',
    'article:tag': '커뮤니티,주식,부동산,청약,토론,카더라',
  },
  twitter: { card: 'summary_large_image', title: '카더라 커뮤니티 피드', description: '주식·부동산·청약 실시간 소식' },
};
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, DEMO_TRENDING } from '@/lib/constants';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import FeedClient from './FeedClient';
import Disclaimer from '@/components/Disclaimer';

// Cache: 60s — 피드 목록 (force-dynamic 제거: revalidate와 충돌)
export const revalidate = 60;

const withTimeout = <T,>(p: PromiseLike<T>, ms = 5000): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

async function getPosts(category: string, region: string = 'all') {
  const sb = await createSupabaseServer();
  let q = sb.from('posts')
    .select('id,title,excerpt,category,created_at,likes_count,comments_count,view_count,is_anonymous,author_id,region_id,images, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
    .eq('is_deleted', false)
    .lte('created_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  if (category !== 'all') q = q.eq('category', category);
  if (category === 'local' && region !== 'all') q = q.eq('region_id', region);
  const result = await withTimeout(q);
  const data = (result as any)?.data;
  if (!data || data.length === 0) return null;
  return data as PostWithProfile[];
}

async function getTrending() {
  const sb = await createSupabaseServer();
  const result = await withTimeout(
    sb.from('trending_keywords').select('id,keyword,category,heat_score,rank,updated_at').order('heat_score', { ascending: false }).limit(10)
  );
  return (result as any)?.data as TrendingKeyword[] | null;
}

interface Props { searchParams: Promise<{ category?: string; region?: string }>; }

export default async function FeedPage({ searchParams }: Props) {
  const { category = 'all', region = 'all' } = await searchParams;
  const [postsData, trendingData] = await Promise.allSettled([getPosts(category, region), getTrending()]);
  const posts = postsData.status === 'fulfilled' && postsData.value ? postsData.value : category === 'all' ? DEMO_POSTS : DEMO_POSTS.filter(p => p.category === category);
  const _trending = trendingData.status === 'fulfilled' && trendingData.value ? trendingData.value : DEMO_TRENDING;
  return (
    <Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '커뮤니티 피드' }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: '카더라 커뮤니티 피드', description: '주식, 부동산, 청약, 재테크 소문과 정보를 나누는 커뮤니티', url: SITE_URL + '/feed', isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL } }) }} />
      <FeedClient posts={posts} activeCategory={category} activeRegion={region} />
      <Disclaimer />
    </Suspense>
  );
}
