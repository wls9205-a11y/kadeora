'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function LoginContent() {
  const [loading, setLoading] = useState<'kakao' | 'google' | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'
  const supabase = createClient()

  async function handleKakao() {
    setLoading('kakao')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
      })
      if (error) throw error
    } catch {
      toast.error('카카오 로그인 실패')
      setLoading(null)
    }
  }

  async function handleGoogle() {
    setLoading('google')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
      })
      if (error) throw error
    } catch {
      toast.error('구글 로그인 실패')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[#0F0F0F]">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black text-brand mb-2 tracking-tight">카더라</h1>
        <p className="text-white/40 text-sm">동네 소문의 중심</p>
      </div>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={handleKakao}
          disabled={!!loading}
          className={cn(
            'w-full h-14 rounded-2xl font-semibold text-[#191600] text-[15px]',
            'flex items-center justify-center gap-3',
            'bg-[#FEE500] active:brightness-90',
            'transition-all duration-150 active:scale-[0.98]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading === 'kakao' ? (
            <span className="w-5 h-5 border-2 border-[#191600]/30 border-t-[#191600] rounded-full animate-spin" />
          ) : '카카오로 시작하기'}
        </button>
        <button
          onClick={handleGoogle}
          disabled={!!loading}
          className={cn(
            'w-full h-14 rounded-2xl font-semibold text-white text-[15px]',
            'flex items-center justify-center gap-3',
            'bg-white/[0.08] border border-white/[0.1]',
            'hover:bg-white/[0.12] active:bg-white/[0.06]',
            'transition-all duration-150 active:scale-[0.98]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading === 'google' ? (
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : 'Google로 시작하기'}
        </button>
      </div>
      <p className="mt-8 text-center text-[11px] text-white/20 leading-relaxed">
        로그인 시 카더라의 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0F0F0F]" />}>
      <LoginContent />
    </Suspense>
  )
}
