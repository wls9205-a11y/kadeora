'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

function PaymentSuccessContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = Number(searchParams.get('amount'))
    if (!paymentKey || !orderId || !amount) {
      setStatus('error')
      setMessage('잘못된 접근입니다')
      return
    }
    fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus('success')
          setMessage('결제가 완료됐어요!')
          toast.success('결제 완료! 🎉')
          setTimeout(() => router.push('/shop'), 2000)
        } else {
          setStatus('error')
          setMessage(data.error ?? '결제 처리 실패')
        }
      })
      .catch(() => { setStatus('error'); setMessage('네트워크 오류') })
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[#0F0F0F]">
      {status === 'loading' && <><Loader size={48} className="text-brand animate-spin mb-4" /><p className="text-white/60">결제 확인 중...</p></>}
      {status === 'success' && <><CheckCircle size={64} className="text-green-400 mb-4" /><h1 className="text-xl font-bold text-white mb-2">{message}</h1><p className="text-white/40 text-sm">잠시 후 상점으로 이동합니다</p></>}
      {status === 'error' && <><XCircle size={64} className="text-red-400 mb-4" /><h1 className="text-xl font-bold text-white mb-2">결제 실패</h1><p className="text-white/40 text-sm mb-6">{message}</p><button onClick={() => router.push('/shop')} className="btn-brand px-6 py-3">상점으로 돌아가기</button></>}
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-[#0F0F0F]"><Loader size={48} className="text-brand animate-spin" /></div>}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
