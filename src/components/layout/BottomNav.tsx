'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, TrendingUp, Building2, MessageSquare, User, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: '홈' },
  { href: '/stocks', icon: TrendingUp, label: '주식' },
  { href: '/housing', icon: Building2, label: '청약' },
  { href: '/discuss', icon: MessageSquare, label: '토론방' },
  { href: '/shop', icon: ShoppingBag, label: '상점' },
  { href: '/profile', icon: User, label: '내 정보' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuthStore()

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile z-40
                  bg-[#0F0F0F]/95 backdrop-blur-md border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-16 flex items-center">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href)

          // 내 정보 탭은 프로필 아바타 사용 가능
          const isProfile = href === '/profile'

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 h-full',
                'transition-colors duration-150',
                isActive ? 'text-brand' : 'text-white/40 hover:text-white/60'
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className="transition-transform duration-150 active:scale-90"
              />
              <span className={cn(
                'text-[10px] font-medium',
                isActive ? 'text-brand' : 'text-white/40'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
