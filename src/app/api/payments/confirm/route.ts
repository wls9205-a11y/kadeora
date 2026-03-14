import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Toss Payments 서버 측 결제 승인
export async function POST(request: NextRequest) {
  const { paymentKey, orderId, amount } = await request.json()

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  try {
    // 1. Toss Payments 서버 승인 요청
    const secretKey = process.env.TOSS_SECRET_KEY!
    const encoded = Buffer.from(`${secretKey}:`).toString('base64')

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })

    const tossData = await tossRes.json()

    if (!tossRes.ok) {
      return NextResponse.json(
        { error: tossData.message ?? '결제 실패' },
        { status: tossRes.status }
      )
    }

    // 2. DB에서 pending 구매 조회
    const { data: purchase, error: purchaseErr } = await supabase
      .from('purchases')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (purchaseErr || !purchase) {
      return NextResponse.json({ error: '구매 정보를 찾을 수 없음' }, { status: 404 })
    }

    // 금액 검증
    if (purchase.amount_krw !== amount) {
      return NextResponse.json({ error: '금액 불일치' }, { status: 400 })
    }

    // 3. 구매 상태 → completed 업데이트
    await supabase
      .from('purchases')
      .update({
        status: 'completed',
        payment_key: paymentKey,
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchase.id)

    // 4. 포인트 충전 (상품이 포인트 충전권인 경우)
    const POINT_PRODUCTS: Record<string, number> = {
      points_1000: 1000,
      points_5000: 5500,   // 보너스 10%
      points_10000: 12000, // 보너스 20%
    }

    const pointsToAdd = POINT_PRODUCTS[purchase.product_id]
    if (pointsToAdd) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single()

      await supabase
        .from('profiles')
        .update({ points: (profile?.points ?? 0) + pointsToAdd })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      purchase: { id: purchase.id, product_id: purchase.product_id },
      tossData: { paymentKey: tossData.paymentKey, method: tossData.method },
    })
  } catch (err) {
    console.error('Payment confirm error:', err)
    return NextResponse.json({ error: '결제 처리 중 오류' }, { status: 500 })
  }
}
