'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui'

export default function NotFound() {
  const { C } = useTheme()

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
      <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>
        페이지를 찾을 수 없어요
      </h1>
      <p style={{ fontSize: 14, color: C.w50, marginBottom: 24 }}>
        주소가 올바른지 확인해주세요
      </p>
      <Link href="/feed">
        <Button primary>홈으로 돌아가기</Button>
      </Link>
    </div>
  )
}
