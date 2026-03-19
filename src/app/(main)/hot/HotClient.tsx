'use client'

import PullToRefresh from '@/components/PullToRefresh'

export default function HotClient({ children }: { children: React.ReactNode }) {
  return (
    <PullToRefresh>
      {children}
    </PullToRefresh>
  )
}
