'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { WriteIcon } from '@/components/ui/Icons'

export function WriteFAB() {
  const { C } = useTheme()

  return (
    <Link
      href="/write"
      style={{
        position: 'absolute',
        right: 18,
        bottom: 74,
        width: 52,
        height: 52,
        borderRadius: 26,
        border: 'none',
        cursor: 'pointer',
        background: `linear-gradient(135deg, ${C.brand}, ${C.brandDark})`,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 20px ${C.brand}60`,
        zIndex: 15,
        transition: 'transform 0.15s',
      }}
      className="press-effect"
    >
      <WriteIcon color="white" />
    </Link>
  )
}
