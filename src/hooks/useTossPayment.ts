'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      payment: (options: { customerKey: string }) => {
        requestPayment: (params: TossPaymentParams) => Promise<void>
      }
    }
  }
}

interface TossPaymentParams {
  method: 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE_PHONE'
  amount: { currency: string; value: number }
  orderId: string
  orderName: string
  customerName?: string
  customerEmail?: string
  successUrl: string
  failUrl: string
}

interface UseTossPaymentOptions {
  productId: string
  customerKey: string // 유저 ID (UUID)
}

export function useTossPayment({ productId, customerKey }: UseTossPaymentOptions) {
  const [loading, setLoading] = useState(false)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (scriptLoaded.current) return
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v2/standard'
    script.onload = () => { scriptLoaded.current = true }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  async function requestPayment() {
    setLoading(true)
    try {
      // 1. 주문 생성
      const initRes = await fetch('/api/payments/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const { orderId, amount, orderName, customerName } = await initRes.json()
      if (!orderId) throw new Error('주문 생성 실패')

      // 2. Toss Payments SDK 호출
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      const toss = window.TossPayments(clientKey)
      const payment = toss.payment({ customerKey })

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        customerName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'PAY_PROCESS_CANCELED') {
        throw err
      }
    } finally {
      setLoading(false)
    }
  }

  return { requestPayment, loading }
}
