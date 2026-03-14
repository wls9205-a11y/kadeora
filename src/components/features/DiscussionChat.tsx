'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Send, Users, FileText, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { cn, timeAgo, GRADE_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'
import { PostCard } from '@/components/features/PostCard'
import type { DiscussionRoom, PostWithAuthor } from '@/types/database'

interface Message {
  id: number
  room_id: number
  author_id: string
  content: string
  is_anonymous: boolean
  created_at: string
  profiles: {
    id: string; nickname: string; avatar_url: string | null
    grade: number; grade_title: string
  } | null
}

interface DiscussionChatProps {
  room: DiscussionRoom
  initialMessages: Message[]
  relatedPosts: PostWithAuthor[]
}

const TABS = [{ id: 'chat', label: '채팅' }, { id: 'posts', label: '게시글' }]

export function DiscussionChat({ room, initialMessages, relatedPosts }: DiscussionChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState('chat')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { user, profile } = useAuthStore()
  const supabase = createClient()
  const router = useRouter()

  // 스크롤 하단 고정
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime 구독
  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discussion_messages',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          // 작성자 정보 fetch
          const { data: msg } = await supabase
            .from('discussion_messages')
            .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title)`)
            .eq('id', payload.new.id)
            .single()

          if (msg) {
            setMessages(prev => [...prev, msg as Message])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id])

  // 구독 등록
  useEffect(() => {
    if (!user) return
    supabase.from('room_subscriptions').upsert({ user_id: user.id, room_id: room.id })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, room.id])

  async function handleSend() {
    if (!user) { toast.error('로그인이 필요해요'); return }
    const text = content.trim()
    if (!text) return
    if (text.length > 500) { toast.error('500자 이내로 입력해주세요'); return }

    setSending(true)
    try {
      const { error } = await supabase.from('discussion_messages').insert({
        room_id: room.id,
        author_id: user.id,
        content: text,
        is_anonymous: isAnonymous,
      })
      if (error) throw error
      setContent('')
    } catch {
      toast.error('전송 실패')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06]
                      bg-[#0F0F0F]/95 backdrop-blur-md flex-shrink-0 pt-14">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={20} className="text-white/70" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-white truncate">{room.display_name}</p>
          <div className="flex items-center gap-2 text-[11px] text-white/30">
            <Users size={10} />{room.member_count.toLocaleString()}명
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium border-b-2 transition-all',
              tab === t.id ? 'border-brand text-white' : 'border-transparent text-white/40'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 채팅 탭 */}
      {tab === 'chat' && (
        <>
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, idx) => {
              const isMe = msg.author_id === user?.id
              const isAnon = msg.is_anonymous
              const author = msg.profiles
              const authorName = isAnon ? '익명' : (author?.nickname ?? '알 수 없음')
              const gradeColor = author?.grade ? GRADE_COLORS[author.grade] : '#9CA3AF'
              const prevMsg = messages[idx - 1]
              const showHeader = !prevMsg ||
                prevMsg.author_id !== msg.author_id ||
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 60000

              return (
                <div key={msg.id} className={cn('flex gap-2', isMe && 'flex-row-reverse')}>
                  {/* 아바타 (내 메시지 제외) */}
                  {!isMe && (
                    <div className="flex-shrink-0 w-7 mt-1">
                      {showHeader && (
                        !isAnon && author?.avatar_url ? (
                          <Image src={author.avatar_url} alt={authorName} width={28} height={28} className="rounded-full" />
                        ) : (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: gradeColor + '20', color: gradeColor }}
                          >
                            {isAnon ? '?' : authorName[0]}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className={cn('flex flex-col max-w-[72%]', isMe && 'items-end')}>
                    {showHeader && !isMe && (
                      <span className="text-[11px] text-white/40 mb-1 ml-1">{authorName}</span>
                    )}
                    <div className={cn(
                      'px-3 py-2 rounded-2xl text-[14px] leading-relaxed',
                      isMe
                        ? 'bg-brand text-white rounded-tr-sm'
                        : 'bg-[#1A1A1A] text-white/85 rounded-tl-sm'
                    )}>
                      {msg.content}
                    </div>
                    {showHeader && (
                      <span className="text-[10px] text-white/20 mt-1 px-1">
                        {timeAgo(msg.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div
            className="flex-shrink-0 border-t border-white/[0.06] bg-[#0F0F0F] px-3 py-3"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
          >
            {user ? (
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-[#1A1A1A] rounded-2xl border border-white/[0.08] px-3 py-2">
                  <textarea
                    ref={inputRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="메시지 입력..."
                    rows={1}
                    maxLength={500}
                    className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30
                               resize-none focus:outline-none leading-relaxed"
                    style={{ maxHeight: '80px', overflowY: 'auto' }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <button
                      onClick={() => setIsAnonymous(!isAnonymous)}
                      className={cn('text-[11px] flex items-center gap-1 transition-colors',
                        isAnonymous ? 'text-brand' : 'text-white/25')}
                    >
                      <Lock size={10} />{isAnonymous ? '익명' : '익명으로'}
                    </button>
                    <span className="text-[10px] text-white/20">{content.length}/500</span>
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!content.trim() || sending}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                    content.trim() ? 'bg-brand text-white active:scale-95' : 'bg-white/[0.06] text-white/20'
                  )}
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="block text-center py-3 text-sm text-brand">
                로그인하고 채팅 참여하기 →
              </Link>
            )}
          </div>
        </>
      )}

      {/* 게시글 탭 */}
      {tab === 'posts' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-white/50">{relatedPosts.length}개</span>
            <Link href={`/post/write?room=${room.id}`} className="flex items-center gap-1 text-sm text-brand">
              <FileText size={14} />글쓰기
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {relatedPosts.length > 0 ? (
              relatedPosts.map(p => <PostCard key={p.id} post={p} />)
            ) : (
              <div className="py-16 text-center text-white/30 text-sm">
                이 토론방에 게시된 글이 없어요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
