import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/features/PostCard'
import { CategoryTabs } from '@/components/features/CategoryTabs'
import { RegionSelector } from '@/components/features/RegionSelector'
import { StockTickerBar } from '@/components/features/StockTickerBar'
import type { PostWithAuthor } from '@/types/database'

interface FeedPageProps {
  searchParams: Promise<{
    category?: string
    region?: string
  }>
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams
  const category = params.category ?? 'hot'
  const region = params.region ?? 'national'

  const supabase = await createClient()

  // 핫 게시글 (기본) 또는 카테고리 필터
  let query = supabase
    .from('posts')
    .select(`
      *,
      profiles:author_id (
        id, nickname, avatar_url, grade, grade_title, is_premium
      )
    `)
    .eq('is_deleted', false)
    .limit(30)

  if (category === 'hot') {
    query = query.order('likes_count', { ascending: false })
  } else if (category !== 'all') {
    query = query.eq('category', category)
  }

  if (region !== 'national') {
    query = query.eq('region_id', region)
  }

  const { data: posts } = await query.order('created_at', { ascending: false })

  return (
    <div className="min-h-screen">
      {/* 주식 티커 */}
      <Suspense fallback={<div className="h-8 bg-[#1A1A1A] animate-pulse" />}>
        <StockTickerBar />
      </Suspense>

      {/* 지역 선택 */}
      <RegionSelector currentRegion={region} />

      {/* 카테고리 탭 */}
      <CategoryTabs currentCategory={category} />

      {/* 게시글 목록 */}
      <div className="divide-y divide-white/[0.04]">
        {posts && posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as PostWithAuthor}
            />
          ))
        ) : (
          <div className="py-20 text-center text-white/30">
            <p className="text-4xl mb-3">🌾</p>
            <p className="text-sm">아직 게시글이 없어요</p>
          </div>
        )}
      </div>
    </div>
  )
}
