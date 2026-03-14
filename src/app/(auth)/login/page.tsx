'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { Logo, Spinner } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface LoginButton {
  id: 'kakao' | 'google' | 'phone'
  label: string
  bg: string
  color: string
  icon: string
  border?: boolean
}

export default function LoginPage() {
  const router = useRouter()
  const { C } = useTheme()
  const [loading, setLoading] = useState<string | null>(null)

  const handleLogin = async (provider: 'kakao' | 'google' | 'phone') => {
    setLoading(provider)
    const supabase = createClient()

    try {
      if (provider === 'phone') {
        router.push('/login/phone')
        return
      }

      const redirectUrl = window.location.origin + '/auth/callback'
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'kakao' ? 'kakao' : 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('Login error:', error)
      setLoading(null)
    }
  }

  const loginButtons: LoginButton[] = [
    { id: 'kakao', label: '카카오로 시작하기', bg: '#FEE500', color: '#191600', icon: '💬' },
    { id: 'google', label: 'Google로 시작하기', bg: 'rgba(255,255,255,0.06)', color: C.text, border: true, icon: '🔍' },
    { id: 'phone', label: '휴대폰 번호로 시작하기', bg: 'rgba(255,255,255,0.03)', color: C.w50, border: true, icon: '📱' },
  ]

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
        gap: 40,
      }}
    >
      <div className="fade-in" style={{ textAlign: 'center' }}>
        <Logo size={60} />
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: -1.5,
            marginTop: 14,
            background: 'linear-gradient(135deg, ' + C.text + ' 20%, ' + C.brandLight + ')',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          카더라
        </h1>
        <p style={{ color: C.w35, fontSize: 14, marginTop: 6, letterSpacing: 2 }}>
          동네 소문의 중심
        </p>
      </div>

      <div
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animationDelay: '0.1s',
        }}
      >
        {loginButtons.map(btn => (
          <button
            key={btn.id}
            onClick={() => handleLogin(btn.id)}
            disabled={loading !== null}
            style={{
              height: 52,
              borderRadius: 14,
              border: btn.border ? '1px solid ' + C.w10 : 'none',
              background: btn.bg,
              color: btn.color,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s',
              opacity: loading && loading !== btn.id ? 0.4 : 1,
            }}
          >
            {loading === btn.id ? (
              <Spinner color={btn.color} />
            ) : (
              <>
                {btn.icon} {btn.label}
              </>
            )}
          </button>
        ))}
      </div>

      <p
        style={{
          marginTop: 28,
          fontSize: 11,
          color: C.w10,
          textAlign: 'center',
          lineHeight: 1.8,
        }}
      >
        로그인 시 카더라의 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </p>
    </div>
  )
}
