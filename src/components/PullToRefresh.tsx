'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY < 5) {
      startY.current = e.touches[0].clientY
      pulling.current = true
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0 && dy < 120) {
      setPullY(dy)
    }
  }

  const handleTouchEnd = () => {
    pulling.current = false
    if (pullY > 70) {
      setRefreshing(true)
      router.refresh()
      setTimeout(() => {
        setRefreshing(false)
        setPullY(0)
      }, 800)
    } else {
      setPullY(0)
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {(pullY > 8 || refreshing) && (
        <div style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top) + 56px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 16,
            height: 16,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--brand)',
            borderRadius: '50%',
            ...(refreshing
              ? { animation: 'spin 0.7s linear infinite' }
              : { transform: `rotate(${pullY * 2.5}deg)` })
          }} />
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {children}
    </div>
  )
}
