'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { BackIcon } from '@/components/ui/Icons'
import { Badge } from '@/components/ui'

interface SubHeaderProps {
  title?: string
  badge?: string
  right?: ReactNode
  onBack?: () => void
}

export function SubHeader({ title, badge, right, onBack }: SubHeaderProps) {
  const { C } = useTheme()
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 52,
        borderBottom: `1px solid ${C.w05}`,
        flexShrink: 0,
        background: C.bg,
        zIndex: 10,
      }}
    >
      <button
        onClick={handleBack}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 8px 6px 2px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BackIcon />
      </button>
      
      {badge && <Badge>{badge}</Badge>}
      
      {title && (
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.text,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
      )}
      
      {!title && <div style={{ flex: 1 }} />}
      
      {right}
    </div>
  )
}
