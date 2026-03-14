'use client'

import { useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { C } = useTheme()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      className="mobile-container"
      style={{
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 48, marginBottom: 16 }}>😵</p>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>
        문제가 발생했어요
      </h1>
      <p style={{ fontSize: 14, color: C.w50, marginBottom: 24 }}>
        잠시 후 다시 시도해주세요
      </p>
      <Button primary onClick={reset}>
        다시 시도
      </Button>
    </div>
  )
}
