import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 결제 전 주문 생성
export async function POST(request: NextRequest) {
  const { productId } = await request.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  // 상품 조회
  const { data: product } = await supabase
    .from('shop_products')
    .select('*')
    .eq('id', productId)
    .eq('is_active', true)
    .single()

  if (!product) return NextResponse.json({ error: '상품 없음' }, { status: 404 })

  // 주문 ID 생성 (Toss 요구: 영문·숫자·-·_ 조합, 6~64자)
  const orderId = `kadeora-${Date.now()}-${user.id.slice(0, 8)}`

  // pending 구매 레코드 생성
  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({
      user_id: user.id,
      product_id: productId,
      amount_krw: product.price_krw,
      order_id: orderId,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: '주문 생성 실패' }, { status: 500 })

  return NextResponse.json({
    orderId,
    amount: product.price_krw,
    orderName: product.name,
    customerName: user.email?.split('@')[0] ?? '고객',
    purchaseId: purchase.id,
  })
}
