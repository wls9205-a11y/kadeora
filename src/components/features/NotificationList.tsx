'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Bell, Heart, MessageCircle, UserPlus, Trophy, Megaphone } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import type { Notification } from '@/types/database'

interface NotificationListProps {
  notifications: Notification[]
}

const TYPE_CONFIG: Record<Notification['type'], { icon: React.ElementType; color: string; label: string }> = {
  post_like: { icon: Heart, color: 'text-red-400', label: '좋아요' },
  comment: { icon: MessageCircle, color: 'text-blue-400', label: '댓글' },
  reply: { icon: MessageCircle, color: 'text-purple-400', label: '답글' },
  follow: { icon: UserPlus, color: 'text-green-400', label: '팔로우' },
  badge: { icon: Trophy, color: 'text-yellow-400', label: '등급 상승' },
  new_post: { icon: Bell, color: 'text-white/60', label: '새 글' },
  comment_like: { icon: Heart, color: 'text-pink-400', label: '댓글 좋아요' },
  system: { icon: Megaphone, color: 'text-brand', label: '시스템' },
}

export function NotificationList({ notifications }: NotificationListProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen max-w-mobile mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] sticky top-14 bg-[#0F0F0F]/95 backdrop-blur-md z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft size={20} className="text-white/70" />
        </button>
        <span className="text-base font-semibold text-white">알림</span>
      </div>

      {/* 알림 목록 */}
      <div className="divide-y divide-white/[0.04]">
        {notifications.length === 0 ? (
          <div className="py-20 text-center text-white/30">
            <Bell size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">알림이 없어요</p>
          </div>
        ) : (
          notifications.map(notif => {
            const config = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system
            const Icon = config.icon

            return (
              <div
                key={notif.id}
                className={cn(
                  'px-4 py-3.5 flex items-start gap-3 transition-colors',
                  !notif.is_read && 'bg-white/[0.02]'
                )}
              >
                {/* 아이콘 */}
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  'bg-white/[0.06]'
                )}>
                  <Icon size={16} className={config.color} />
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-white/40">{config.label}</span>
                    {!notif.is_read && (
                      <span className="w-1.5 h-1.5 bg-brand rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[14px] text-white/80 leading-snug">{notif.content}</p>
                  <p className="text-[11px] text-white/25 mt-1">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
