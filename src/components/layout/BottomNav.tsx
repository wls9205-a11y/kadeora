'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { HomeIcon, StockIcon, HouseIcon, ChatIcon, UserIcon } from '@/components/ui/Icons'

const NAV_ITEMS = [
  { id: 'feed', label: '홈', href: '/feed', Icon: HomeIcon },
  { id: 'stocks', label: '주식', href: '/stocks', Icon: StockIcon },
  { id: 'housing', label: '부동산', href: '/housing', Icon: HouseIcon },
  { id: 'discuss', label: '토론방', href: '/discuss', Icon: ChatIcon },
  { id: 'profile', label: '내 정보', href: '/profile', Icon: UserIcon },
]

export function BottomNav() {
  const { C } = useTheme()
  const pathname = usePathname()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        borderTop: `1px solid ${C.w05}`,
        background: C.bg,
        zIndex: 20,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        minHeight: 58,
        transition: 'background 0.2s',
      }}
    >
      {NAV_ITEMS.map(({ id, label, href, Icon }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={id}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0',
              transition: 'all 0.15s',
              textDecoration: 'none',
            }}
          >
            <Icon active={isActive} />
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? C.brand : C.w35,
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
