'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Heart, ThumbsDown, Bookmark, Share2, MoreHorizontal,
  ChevronLeft, Pin, Eye, MessageCircle, Flag
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { cn, timeAgo, formatCount, CATEGORY_LABELS, GRADE_COLORS, getStorageUrl } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { PostWithAuthor } from '@/types/database'

interface PostDetailProps {
  post: PostWithAuthor & {
    profiles: {
      id: string; nickname: string; avatar_url: string | null
      grade: number; grade_title: string; is_premium: boolean
      influence_score: number; bio: string | null
    } | null
  }
  isPinned: boolean
}

export function PostDetail({ post, isPinned }: PostDetailProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [bookmarked, setBookmarked] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { user } = useAuthStore()
  const supabase = createClient()
  const router = useRouter()

  const author = post.profiles
  const isAnonymous = post.is_anonymous
  const authorName = isAnonymous ? '익명' : (author?.nickname ?? '탈퇴한 유저')
  const gradeColor = author?.grade ? GRADE_COLORS[author.grade] : '#9CA3AF'

  async function handleLike() {
    if (!user) { toast.error('로그인이 필요해요'); return }

    if (liked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', user.id)
      setLikeCount(c => c - 1)
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
      setLikeCount(c => c + 1)
    }
    setLiked(!liked)
  }

  async function handleBookmark() {
    if (!user) { toast.error('로그인이 필요해요'); return }

    if (bookmarked) {
      await supabase.from('bookmarks').delete()
        .eq('post_id', post.id).eq('user_id', user.id)
      toast.success('북마크 해제')
    } else {
      await supabase.from('bookmarks').insert({ post_id: post.id, user_id: user.id })
      toast.success('북마크 저장!')
    }
    setBookmarked(!bookmarked)
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: post.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('링크 복사됨!')
    }
    if (user) {
      await supabase.from('share_logs').insert({
        post_id: post.id, user_id: user.id, platform: 'link'
      })
    }
  }

  async function handleReport() {
    if (!user) { toast.error('로그인이 필요해요'); return }
    await supabase.from('reports').insert({ reporter_id: user.id, post_id: post.id, reason: '신고' })
    toast.success('신고가 접수됐어요')
    setShowMenu(false)
  }

  return (
    <article className="pb-4">
      {/* 상단 네비 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={20} className="text-white/70" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="badge-brand text-[11px]">
            {CATEGORY_LABELS[post.category] ?? post.category}
          </span>
          {isPinned && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-400">
              <Pin size={10} />고정
            </span>
          )}
        </div>
        {/* 더보기 메뉴 */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg hover:bg-white/5">
            <MoreHorizontal size={20} className="text-white/50" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#1A1A1A] border border-white/[0.08]
                              rounded-xl shadow-xl z-40 overflow-hidden animate-slide-down">
                {user?.id === post.author_id && (
                  <>
                    <button className="w-full px-4 py-3 text-sm text-left text-white/70 hover:bg-white/5">
                      수정
                    </button>
                    <button
                      onClick={async () => {
                        await supabase.from('posts').update({ is_deleted: true }).eq('id', post.id)
                        toast.success('삭제됐어요')
                        router.back()
                      }}
                      className="w-full px-4 py-3 text-sm text-left text-red-400 hover:bg-white/5"
                    >
                      삭제
                    </button>
                  </>
                )}
                <button
                  onClick={handleReport}
                  className="w-full px-4 py-3 text-sm text-left text-white/50 hover:bg-white/5 flex items-center gap-2"
                >
                  <Flag size={13} /> 신고
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 작성자 정보 */}
      <div className="px-4 py-4 flex items-center gap-3">
        {!isAnonymous && author?.avatar_url ? (
          <Image
            src={author.avatar_url}
            alt={authorName}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ backgroundColor: gradeColor + '20', color: gradeColor }}
          >
            {isAnonymous ? '?' : authorName[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{authorName}</span>
            {!isAnonymous && author?.grade && (
              <span className="text-[11px] font-medium" style={{ color: gradeColor }}>
                {author.grade_title}
              </span>
            )}
            {!isAnonymous && author?.is_premium && (
              <span className="text-yellow-400 text-xs">✦</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-white/30">{timeAgo(post.created_at)}</span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="flex items-center gap-1 text-[12px] text-white/30">
              <Eye size={11} />{formatCount(post.view_count)}
            </span>
          </div>
        </div>
        {!isAnonymous && author && user?.id !== author.id && (
          <button className="btn-outline py-1.5 px-3 text-xs">팔로우</button>
        )}
      </div>

      {/* 본문 */}
      <div className="px-4">
        <h1 className="text-[19px] font-bold text-white leading-snug mb-3">
          {post.title}
        </h1>
        <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* 이미지 */}
        {post.images && post.images.length > 0 && (
          <div className="mt-4 space-y-2">
            {post.images.map((img, idx) => (
              <div key={idx} className="rounded-xl overflow-hidden bg-[#1A1A1A]">
                <Image
                  src={getStorageUrl(img)}
                  alt={`이미지 ${idx + 1}`}
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* 주식 태그 */}
        {post.stock_tags && post.stock_tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-4">
            {post.stock_tags.map(tag => (
              <Link
                key={tag}
                href={`/stocks?q=${tag}`}
                className="text-[12px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* 청약 태그 */}
        {post.apt_tags && post.apt_tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-3">
            {post.apt_tags.map(tag => (
              <span key={tag} className="text-[12px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div className="flex items-center gap-1 px-4 mt-6 pt-4 border-t border-white/[0.06]">
        {/* 좋아요 */}
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
            liked
              ? 'bg-brand/15 text-brand'
              : 'bg-white/[0.06] text-white/50 hover:bg-white/10'
          )}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          {formatCount(likeCount)}
        </button>

        {/* 댓글 수 */}
        <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/30">
          <MessageCircle size={15} />
          {formatCount(post.comments_count)}
        </div>

        <div className="flex-1" />

        {/* 북마크 */}
        <button
          onClick={handleBookmark}
          className={cn(
            'p-2.5 rounded-xl transition-all',
            bookmarked ? 'text-yellow-400 bg-yellow-400/10' : 'text-white/30 hover:bg-white/5'
          )}
        >
          <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>

        {/* 공유 */}
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl text-white/30 hover:bg-white/5 transition-all"
        >
          <Share2 size={18} />
        </button>
      </div>
    </article>
  )
}
