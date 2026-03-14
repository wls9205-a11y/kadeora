'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, MessageCircle, Eye, Bookmark, Share2, ThumbsDown } from 'lucide-react'
import { cn, timeAgo, formatCount, CATEGORY_LABELS, GRADE_COLORS } from '@/lib/utils'
import type { PostWithAuthor } from '@/types/database'

interface PostCardProps {
  post: PostWithAuthor
  showRegion?: boolean
}

export function PostCard({ post, showRegion = false }: PostCardProps) {
  const author = post.profiles
  const isAnonymous = post.is_anonymous
  const hasImages = post.images && post.images.length > 0

  const authorName = isAnonymous ? '익명' : (author?.nickname ?? '탈퇴한 유저')
  const gradeColor = author?.grade ? GRADE_COLORS[author.grade] : '#9CA3AF'

  return (
    <article className="list-item">
      <Link href={`/post/${post.slug ?? post.id}`} className="block">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-2">
          {/* 카테고리 배지 */}
          <span className="badge-brand text-[11px]">
            {CATEGORY_LABELS[post.category] ?? post.category}
          </span>

          {/* 지역 */}
          {showRegion && post.region_id !== 'national' && (
            <span className="text-[11px] text-white/30">{post.city || post.region_id}</span>
          )}

          {/* 고정 표시 */}
          {/* pinned_posts join 시 추가 */}

          <span className="ml-auto text-[11px] text-white/30">{timeAgo(post.created_at)}</span>
        </div>

        {/* 제목 */}
        <h2 className="text-[15px] font-semibold text-white leading-snug mb-1.5 line-clamp-2">
          {post.title}
        </h2>

        {/* 내용 미리보기 */}
        {post.content && (
          <p className="text-[13px] text-white/50 leading-relaxed line-clamp-2 mb-2">
            {post.content}
          </p>
        )}

        {/* 이미지 썸네일 */}
        {hasImages && (
          <div className="flex gap-1.5 mb-2 overflow-hidden">
            {post.images.slice(0, 3).map((img, idx) => (
              <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#252525]">
                <Image
                  src={img}
                  alt=""
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              </div>
            ))}
            {post.images.length > 3 && (
              <div className="w-16 h-16 rounded-lg bg-[#252525] flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-white/40">+{post.images.length - 3}</span>
              </div>
            )}
          </div>
        )}

        {/* 주식 태그 */}
        {post.stock_tags && post.stock_tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2">
            {post.stock_tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 청약 태그 */}
        {post.apt_tags && post.apt_tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2">
            {post.apt_tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center gap-3 mt-2">
          {/* 작성자 */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {!isAnonymous && author?.avatar_url ? (
              <Image
                src={author.avatar_url}
                alt={authorName}
                width={18}
                height={18}
                className="rounded-full"
              />
            ) : (
              <div
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: gradeColor + '20', color: gradeColor }}
              >
                {isAnonymous ? '?' : authorName[0]}
              </div>
            )}
            <span className="text-[12px] text-white/40 truncate">{authorName}</span>
            {!isAnonymous && author?.grade && (
              <span
                className="text-[10px] font-medium flex-shrink-0"
                style={{ color: gradeColor }}
              >
                Lv.{author.grade}
              </span>
            )}
            {!isAnonymous && author?.is_premium && (
              <span className="text-[10px] text-yellow-400 flex-shrink-0">✦</span>
            )}
          </div>

          {/* 통계 */}
          <div className="flex items-center gap-3 text-white/30 text-[12px] flex-shrink-0">
            <span className="flex items-center gap-1">
              <Heart size={12} />
              {formatCount(post.likes_count)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              {formatCount(post.comments_count)}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {formatCount(post.view_count)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
