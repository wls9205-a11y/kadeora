import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '피드',
  description: '주식, 부동산, 청약 관련 소문과 정보를 나누는 카더라 커뮤니티 피드',
  openGraph: { title: '피드 | 카더라', description: '주식, 부동산, 청약 정보 커뮤니티' },
};
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, DEMO_TRENDING } from '@/lib/constants';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import FeedClient from './FeedClient';
import Disclaimer from '@/components/Disclaimer';

export const dynamic = 'force-dynamic';

async function getPosts(category: string, region: string = 'all') {
  const sb = await createSupabaseServer();
  let q = sb.from('posts')
    .select('id,title,content,category,created_at,likes_count,comments_count,view_count,is_anonymous,author_id,region_id,images, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20);
  if (category !== 'all') q = q.eq('category', category);
  if (category === 'local' && region !== 'all') q = q.eq('region_id', region);
  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;
  return data as PostWithProfile[];
}

async function getTrending() {
  const sb = await createSupabaseServer();
  const { data } = await sb.from('trending_keywords').select('*').order('heat_score', { ascending: false }).limit(10);
  return data as TrendingKeyword[] | null;
}

interface Props { searchParams: Promise<{ category?: string; region?: string }>; }

export default async function FeedPage({ searchParams }: Props) {
  const { category = 'all', region = 'all' } = await searchParams;
  const [postsData, trendingData] = await Promise.allSettled([getPosts(category, region), getTrending()]);
  const posts = postsData.status === 'fulfilled' && postsData.value ? postsData.value : category === 'all' ? DEMO_POSTS : DEMO_POSTS.filter(p => p.category === category);
  const trending = trendingData.status === 'fulfilled' && trendingData.value ? trendingData.value : DEMO_TRENDING;
  return (
    <Suspense>
      <FeedClient posts={posts} trending={trending} activeCategory={category} activeRegion={region} />
      <Disclaimer />
    </Suspense>
  );
}