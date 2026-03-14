'use client'

import { useState, useOptimistic, useTransition } from 'react'
import Image from 'next/image'
import { Heart, CornerDownRight, ChevronDown, Send, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { cn, timeAgo, formatCount, GRADE_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { CommentWithAuthor } from '@/types/database'

interface CommentSectionProps {
  postId: number
  initialComments: CommentWithAuthor[]
}

export function CommentSection({ postId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments)
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: number; nickname: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [likedComments, setLikedComments] = useState<Set<number>>(new Set())
  const { user, profile } = useAuthStore()
  const supabase = createClient()

  // 댓글을 트리 구조로 변환
  const topLevel = comments.filter(c => !c.parent_id)
  const replies = comments.filter(c => c.parent_id)
  const getReplies = (parentId: number) => replies.filter(r => r.parent_id === parentId)

  async function handleSubmit() {
    if (!user) { toast.error('로그인이 필요해요'); return }
    if (!content.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: content.trim(),
          is_anonymous: isAnonymous,
          parent_id: replyTo?.id ?? null,
        })
        .select(`
          *,
          profiles:author_id (
            id, nickname, avatar_url, grade, grade_title, is_premium
          )
        `)
        .single()

      if (error) throw error

      setComments(prev => [...prev, data as CommentWithAuthor])
      setContent('')
      setReplyTo(null)
    } catch {
      toast.error('댓글 등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLikeComment(commentId: number) {
    if (!user) { toast.error('로그인이 필요해요'); return }

    const isLiked = likedComments.has(commentId)
    if (isLiked) {
      await supabase.from('comment_likes').delete()
        .eq('comment_id', commentId).eq('user_id', user.id)
      setLikedComments(prev => { const s = new Set(prev); s.delete(commentId); return s })
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, likes_count: c.likes_count - 1 } : c
      ))
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
      setLikedComments(prev => new Set(prev).add(commentId))
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, likes_count: c.likes_count + 1 } : c
      ))
    }
  }

  async function handleDeleteComment(commentId: number) {
    await supabase.from('comments').update({ is_deleted: true }).eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
    toast.success('댓글 삭제됨')
  }

  return (
    <section className="border-t border-white/[0.06]">
      {/* 헤더 */}
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-white">댓글</span>
        <span className="text-sm text-white/30">{comments.length}</span>
      </div>

      {/* 댓글 목록 */}
      <div className="divide-y divide-white/[0.04]">
        {topLevel.length === 0 ? (
          <div className="py-10 text-center text-white/30 text-sm">
            첫 댓글을 남겨보세요 👋
          </div>
        ) : (
          topLevel.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              isLiked={likedComments.has(comment.id)}
              currentUserId={user?.id}
              onLike={handleLikeComment}
              onDelete={handleDeleteComment}
              onReply={(id, nickname) => {
                setReplyTo({ id, nickname })
                document.getElementById('comment-input')?.focus()
              }}
            />
          ))
        )}
      </div>

      {/* 댓글 입력 */}
      <div className="sticky bottom-[64px] bg-[#0F0F0F]/95 backdrop-blur-md
                      border-t border-white/[0.06] px-4 py-3"
           style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>

        {/* 답글 대상 표시 */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-brand/10">
            <CornerDownRight size={12} className="text-brand" />
            <span className="text-xs text-brand">{replyTo.nickname}에게 답글</span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-white/30 hover:text-white/60 text-xs">✕</button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* 프로필 */}
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="" width={32} height={32} className="rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand">
              {profile?.nickname?.[0] ?? '?'}
            </div>
          )}

          {/* 입력창 */}
          <div className="flex-1 bg-[#1A1A1A] rounded-2xl border border-white/[0.08] px-3 py-2">
            <textarea
              id="comment-input"
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder={user ? (replyTo ? `${replyTo.nickname}에게 답글...` : '댓글을 입력하세요...') : '로그인 후 댓글을 달 수 있어요'}
              disabled={!user}
              rows={1}
              className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30
                         resize-none focus:outline-none leading-relaxed"
              style={{ maxHeight: '100px', overflowY: 'auto' }}
            />
            {user && (
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/[0.06]">
                <button
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={cn('text-[11px] transition-colors', isAnonymous ? 'text-brand' : 'text-white/30')}
                >
                  {isAnonymous ? '🔒 익명' : '익명으로'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || submitting}
                  className={cn(
                    'flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded-lg transition-all',
                    content.trim() ? 'text-brand hover:bg-brand/10' : 'text-white/20'
                  )}
                >
                  <Send size={12} />등록
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 개별 댓글 아이템 ───────────────────────────────────────

interface CommentItemProps {
  comment: CommentWithAuthor
  replies: CommentWithAuthor[]
  isLiked: boolean
  currentUserId?: string
  onLike: (id: number) => void
  onDelete: (id: number) => void
  onReply: (id: number, nickname: string) => void
  isReply?: boolean
}

function CommentItem({
  comment, replies, isLiked, currentUserId, onLike, onDelete, onReply, isReply = false
}: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(true)
  const author = comment.profiles
  const isAnon = comment.is_anonymous
  const authorName = isAnon ? '익명' : (author?.nickname ?? '탈퇴한 유저')
  const gradeColor = author?.grade ? GRADE_COLORS[author.grade] : '#9CA3AF'

  return (
    <div className={cn('px-4 py-3', isReply && 'pl-10 bg-white/[0.01]')}>
      <div className="flex gap-2.5">
        {/* 아바타 */}
        {!isAnon && author?.avatar_url ? (
          <Image src={author.avatar_url} alt={authorName} width={28} height={28} className="rounded-full flex-shrink-0 mt-0.5" />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
            style={{ backgroundColor: gradeColor + '20', color: gradeColor }}
          >
            {isAnon ? '?' : authorName[0]}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* 작성자 + 시간 */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-white/80">{authorName}</span>
            {!isAnon && author?.grade && (
              <span className="text-[10px]" style={{ color: gradeColor }}>{author.grade_title}</span>
            )}
            <span className="text-[11px] text-white/25 ml-auto">{timeAgo(comment.created_at)}</span>
          </div>

          {/* 본문 */}
          <p className="text-[14px] text-white/75 leading-relaxed break-words">{comment.content}</p>

          {/* 액션 */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onLike(comment.id)}
              className={cn(
                'flex items-center gap-1 text-[12px] transition-colors',
                isLiked ? 'text-brand' : 'text-white/30 hover:text-white/50'
              )}
            >
              <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
              {comment.likes_count > 0 && comment.likes_count}
            </button>

            {!isReply && (
              <button
                onClick={() => onReply(comment.id, authorName)}
                className="text-[12px] text-white/30 hover:text-white/50 transition-colors"
              >
                답글
              </button>
            )}

            {currentUserId === comment.author_id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[12px] text-white/20 hover:text-red-400 transition-colors ml-auto"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 대댓글 */}
      {replies.length > 0 && !isReply && (
        <div className="mt-2">
          {showReplies ? (
            <div className="space-y-0 border-l-2 border-white/[0.06] ml-3.5">
              {replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  replies={[]}
                  isLiked={false}
                  currentUserId={currentUserId}
                  onLike={onLike}
                  onDelete={onDelete}
                  onReply={onReply}
                  isReply
                />
              ))}
            </div>
          ) : null}
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 ml-10 mt-1 text-[12px] text-brand/70 hover:text-brand"
          >
            <ChevronDown size={12} className={cn('transition-transform', showReplies && 'rotate-180')} />
            답글 {replies.length}개 {showReplies ? '숨기기' : '보기'}
          </button>
        </div>
      )}
    </div>
  )
}
