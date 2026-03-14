'use client'

import { useTheme } from '@/lib/theme'
import { Spinner } from '@/components/ui'

export default function Loading() {
  const { C } = useTheme()

  return (
    <div
      className="mobile-container"
      style={{
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spinner size={32} color={C.brand} />
    </div>
  )
}
