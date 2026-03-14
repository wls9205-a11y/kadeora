'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { Logo } from '@/components/ui'
import { SearchIcon, BellIcon } from '@/components/ui/Icons'

export function TopBar() {
  const { C, isDark, toggleTheme } = useTheme()

  return (
    <div
      style={{
        height: 52,
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: `1px solid ${C.w05}`,
        flexShrink: 0,
        background: C.bg,
        zIndex: 20,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <Logo size={28} />
      <span
        style={{
          fontSize: 18,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${isDark ? '#fff' : '#111'} 30%, ${C.brandLight})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: -0.5,
        }}
      >
        카더라
      </span>
      
      <div style={{ flex: 1 }} />
      
      <Link
        href="/search"
        style={{
          padding: '8px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <SearchIcon />
      </Link>
      
      <Link
        href="/notifications"
        style={{
          padding: '8px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BellIcon />
        <span
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: 4,
            background: C.brand,
          }}
        />
      </Link>
      
      <Link
        href="/shop"
        style={{
          padding: '8px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 16 }}>🛍️</span>
      </Link>
      
      <button
        onClick={toggleTheme}
        title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        style={{
          padding: '6px 8px',
          background: isDark ? C.w05 : C.w10,
          border: `1px solid ${C.w10}`,
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 15,
          lineHeight: 1,
          transition: 'all 0.2s',
        }}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    </div>
  )
}
