'use client'

import { useTheme } from '@/lib/theme'
import { TopBar, BottomNav, WriteFAB } from '@/components/layout'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { C } = useTheme()

  return (
    <div
      className="mobile-container"
      style={{ background: C.bg, transition: 'background 0.2s' }}
    >
      <TopBar />
      
      <div
        className="scrollable"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {children}
      </div>
      
      <WriteFAB />
      <BottomNav />
    </div>
  )
}
