'use client'

import Link from 'next/link'
import { Bell, Search, PenSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

export function TopBar() {
  const { profile, isAuthenticated } = useAuthStore()

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-mobile z-40
                        bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/[0.06]
                        h-14 flex items-center px-4 gap-3">
      {/* 로고 */}
      <Link href="/" className="flex-1 flex items-center gap-2">
        <span className="text-xl font-black text-brand tracking-tight">카더라</span>
        {profile?.grade_title && (
          <span className="text-[10px] text-white/30 font-medium hidden xs:block">
            {profile.grade_title}
          </span>
        )}
      </Link>

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-1">
        {/* 검색 */}
        <Link href="/search" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <Search size={20} className="text-white/70" />
        </Link>

        {/* 글쓰기 */}
        {isAuthenticated && (
          <Link href="/post/write" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <PenSquare size={20} className="text-white/70" />
          </Link>
        )}

        {/* 알림 */}
        {isAuthenticated ? (
          <Link href="/notifications" className="p-2 rounded-lg hover:bg-white/5 transition-colors relative">
            <Bell size={20} className="text-white/70" />
            {/* 미읽음 뱃지 - 추후 실시간으로 */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full" />
          </Link>
        ) : (
          <Link href="/login"
            className="text-sm font-semibold text-brand px-3 py-1.5 rounded-lg
                       border border-brand/30 hover:bg-brand/10 transition-colors">
            로그인
          </Link>
        )}
      </div>
    </header>
  )
}
