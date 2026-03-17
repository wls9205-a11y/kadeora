import type { Metadata } from 'next';
export const metadata: Metadata = { title: '피드', description: '카더라 커뮤니티 피드 — 주식, 부동산, 청약, 자유게시판' };
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { unstable_cache } from 'next/cache';
import { CACHE_TTL } from '@/lib/cache-config';
import { DEMO_POSTS, DEMO_TRENDING } from '@/lib/constants';
import type { PostWithProfile, TrendingKeyword } from '@/types/database';
import FeedClient from './FeedClient';
import Disclaimer from '@/components/Disclaimer';

const getPosts = unstable_cache(async (category: string) => {
  const sb = await createSupabaseServer();
  let q = sb.from('posts')
    .select('*, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(30);
  if (category !== 'all') q = q.eq('category', category);
  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;
  return data as PostWithProfile[];
}, ['posts'], { revalidate: CACHE_TTL.short });

const getTrending = unstable_cache(async () => {
  const sb = await createSupabaseServer();
  const { data } = await sb.from('trending_keywords').select('*').order('heat_score', { ascending: false }).limit(10);
  return data as TrendingKeyword[] | null;
}, ['trending'], { revalidate: CACHE_TTL.medium });

interface Props { searchParams: Promise<{ category?: string }>; }

export default async function FeedPage({ searchParams }: Props) {
  const { category = 'all' } = await searchParams;
  const [postsData, trendingData] = await Promise.allSettled([getPosts(category), getTrending()]);
  const posts = postsData.status === 'fulfilled' && postsData.value ? postsData.value : category === 'all' ? DEMO_POSTS : DEMO_POSTS.filter(p => p.category === category);
  const trending = trendingData.status === 'fulfilled' && trendingData.value ? trendingData.value : DEMO_TRENDING;
  return (
    <Suspense>
      <FeedClient posts={posts} trending={trending} activeCategory={category} />
      <Disclaimer />
    </Suspense>
  );
}