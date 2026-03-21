import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '피드',
  description: '주식, 부동산, 청약 관련 소문과 정보를 나누는 카더라 커뮤니티 피드',
  openGraph: {
    title: '피드',
    description: '주식, 부동산, 청약 정보 커뮤니티',
    images: [{ url: 'https://kadeora.app/images/brand/kadeora-hero.png', alt: '카더라 피드' }],
  },
};
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, DEMO_TRENDING } from '@/lib/constants';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import FeedClient from './FeedClient';
import Disclaimer from '@/components/Disclaimer';

// Cache: 60s — 피드 목록 (force-dynamic 제거: revalidate와 충돌)
export const revalidate = 60;

const withTimeout = <T,>(p: Promise<T>, ms = 5000): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

async function getPosts(category: string, region: string = 'all') {
  const sb = await createSupabaseServer();
  let q = sb.from('posts')
    .select('id,title,content,category,created_at,likes_count,comments_count,view_count,is_anonymous,author_id,region_id,images, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
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
    sb.from('trending_keywords').select('*').order('heat_score', { ascending: false }).limit(10)
  );
  return (result as any)?.data as TrendingKeyword[] | null;
}

interface Props { searchParams: Promise<{ category?: string; region?: string }>; }

export default async function FeedPage({ searchParams }: Props) {
  const { category = 'all', region = 'all' } = await searchParams;
  const [postsData, trendingData] = await Promise.allSettled([getPosts(category, region), getTrending()]);
  const posts = postsData.status === 'fulfilled' && postsData.value ? postsData.value : category === 'all' ? DEMO_POSTS : DEMO_POSTS.filter(p => p.category === category);
  const trending = trendingData.status === 'fulfilled' && trendingData.value ? trendingData.value : DEMO_TRENDING;
  return (
    <Suspense>
      <FeedClient posts={posts} activeCategory={category} activeRegion={region} />
      <Disclaimer />
    </Suspense>
  );
}
