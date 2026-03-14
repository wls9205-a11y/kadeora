'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-dvh max-w-mobile mx-auto flex flex-col items-center justify-center px-6 bg-[#0F0F0F]">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
        <AlertTriangle size={32} className="text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">오류가 발생했어요</h1>
      <p className="text-sm text-white/40 text-center mb-8 leading-relaxed">
        일시적인 문제가 발생했습니다.<br />잠시 후 다시 시도해주세요.
      </p>
      {error.digest && (
        <p className="text-[11px] text-white/20 font-mono mb-6">#{error.digest}</p>
      )}
      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={() => router.push('/')}
          className="btn-outline flex-1 h-12 flex items-center justify-center gap-2"
        >
          <Home size={16} />홈으로
        </button>
        <button
          onClick={reset}
          className="btn-brand flex-1 h-12 flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} />다시 시도
        </button>
      </div>
    </div>
  )
}
