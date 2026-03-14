'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function LoginPage() {
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
      {/* 로고 */}
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black text-brand mb-2 tracking-tight">카더라</h1>
        <p className="text-white/40 text-sm">동네 소문의 중심</p>
      </div>

      {/* 소셜 로그인 버튼 */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {/* 카카오 */}
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
          ) : (
            <>
              <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M10 0C4.477 0 0 3.582 0 8c0 2.833 1.737 5.316 4.354 6.773L3.2 18l4.315-2.83C8.13 15.386 9.051 15.5 10 15.5c5.523 0 10-3.582 10-7.75C20 3.582 15.523 0 10 0z"
                  fill="#191600"
                />
              </svg>
              카카오로 시작하기
            </>
          )}
        </button>

        {/* 구글 */}
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
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Google로 시작하기
            </>
          )}
        </button>
      </div>

      {/* 약관 */}
      <p className="mt-8 text-center text-[11px] text-white/20 leading-relaxed">
        로그인 시 카더라의{' '}
        <a href="/terms" className="underline hover:text-white/40">이용약관</a>
        {' '}및{' '}
        <a href="/privacy" className="underline hover:text-white/40">개인정보처리방침</a>
        에 동의하게 됩니다.
      </p>
    </div>
  )
}
