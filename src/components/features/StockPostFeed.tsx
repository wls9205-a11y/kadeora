import Link from 'next/link'
import { PenSquare } from 'lucide-react'
import { PostCard } from '@/components/features/PostCard'
import type { PostWithAuthor } from '@/types/database'

interface StockPostFeedProps {
  posts: PostWithAuthor[]
  query: string
}

export function StockPostFeed({ posts, query }: StockPostFeedProps) {
  return (
    <div>
      <div className="px-4 py-3 flex items-center justify-between border-t border-white/[0.06]">
        <h2 className="text-[15px] font-semibold text-white">
          {query ? `#${query} 토론` : '주식 토론'}
        </h2>
        <Link href="/post/write?category=stock" className="flex items-center gap-1.5 text-sm text-brand">
          <PenSquare size={14} />글쓰기
        </Link>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {posts.length > 0 ? (
          posts.map(post => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="py-16 text-center text-white/30">
            <p className="text-3xl mb-3">📈</p>
            <p className="text-sm">{query ? `#${query} 관련 글이 없어요` : '아직 글이 없어요'}</p>
            <Link href="/post/write?category=stock" className="mt-3 inline-block text-sm text-brand">
              첫 글 작성하기 →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
