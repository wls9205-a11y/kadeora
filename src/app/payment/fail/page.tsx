'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function PaymentFailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get('message') ?? '결제가 취소되었습니다'
  const code = searchParams.get('code')

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[#0F0F0F]">
      <XCircle size={64} className="text-red-400 mb-4" />
      <h1 className="text-xl font-bold text-white mb-2">결제 실패</h1>
      <p className="text-white/40 text-sm mb-1">{message}</p>
      {code && <p className="text-white/20 text-xs mb-6">오류 코드: {code}</p>}
      <div className="flex gap-3">
        <button onClick={() => router.back()} className="btn-outline px-5 py-2.5">돌아가기</button>
        <button onClick={() => router.push('/shop')} className="btn-brand px-5 py-2.5">상점으로</button>
      </div>
    </div>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0F0F0F]" />}>
      <PaymentFailContent />
    </Suspense>
  )
}
