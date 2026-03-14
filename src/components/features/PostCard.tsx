'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { formatNumber, getGradeInfo, CATEGORIES } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import { HeartIcon, CommentIcon, EyeIcon, FireIcon } from '@/components/ui/Icons'
import type { Post, Profile } from '@/types/database'

interface PostCardProps {
  post: Post & { author?: Profile }
  showCategory?: boolean
}

export function PostCard({ post, showCategory = true }: PostCardProps) {
  const { C } = useTheme()
  
  const authorName = post.is_anonymous ? '익명' : (post.author?.nickname || '사용자')
  const authorGrade = post.is_anonymous ? 0 : (post.author?.grade || 1)
  const gradeInfo = getGradeInfo(authorGrade)
  const category = CATEGORIES.find(c => c.id === post.category)

  return (
    <Link
      href={`/post/${post.id}`}
      className="fade-in press-effect"
      style={{
        display: 'block',
        padding: '14px 16px',
        borderBottom: `1px solid ${C.w03}`,
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'background 0.1s',
      }}
    >
      {/* 상단: 카테고리, HOT, 프리미엄 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {showCategory && category && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.brand,
              background: `${C.brand}15`,
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {category.icon} {category.label}
          </span>
        )}
        {post.is_hot && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: '#F97316', fontWeight: 700 }}>
            <FireIcon /> HOT
          </span>
        )}
        {post.is_premium && (
          <span style={{ fontSize: 10, color: '#FBBF24' }}>✦</span>
        )}
      </div>

      {/* 제목 */}
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          lineHeight: 1.4,
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {post.title}
      </h3>

      {/* 내용 미리보기 */}
      <p
        style={{
          fontSize: 13,
          color: C.w50,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          marginBottom: 10,
        }}
      >
        {post.content}
      </p>

      {/* 태그 */}
      {post.tags && post.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {post.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(239,68,68,0.1)',
                color: '#EF4444',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 하단: 작성자 + 통계 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={authorName} grade={authorGrade} size={22} isAnon={post.is_anonymous} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.w70 }}>{authorName}</span>
            {!post.is_anonymous && (
              <span style={{ fontSize: 10, color: gradeInfo.color }}>
                {gradeInfo.badge}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.w20 }}>
            <HeartIcon size={12} /> {formatNumber(post.likes_count)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.w20 }}>
            <CommentIcon size={12} /> {formatNumber(post.comments_count)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.w20 }}>
            <EyeIcon size={12} /> {formatNumber(post.views_count)}
          </span>
        </div>
      </div>
    </Link>
  )
}
