import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentKey, orderId, amount } = body;
    if (!paymentKey || !orderId || !amount) return NextResponse.json({ success: false, error: '필수 파라미터 누락' }, { status: 400 });
    if (!TOSS_SECRET_KEY) return NextResponse.json({ success: false, error: 'TOSS_SECRET_KEY 환경변수를 설정하세요' }, { status: 500 });
    const encryptedKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: `Basic ${encryptedKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const tossData = await tossRes.json();
    if (!tossRes.ok) return NextResponse.json({ success: false, error: tossData.message || '결제 승인 실패', code: tossData.code }, { status: tossRes.status });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    try {
      await supabase.from('shop_orders').insert({
        user_id: userId, order_id: orderId, payment_key: paymentKey,
        amount: amount, status: tossData.status, product_id: body.productId || null,
        approved_at: tossData.approvedAt, method: tossData.method, raw_response: tossData,
      });
    } catch { console.warn('[payment] shop_orders insert skipped'); }
    return NextResponse.json({
      success: true, message: '결제 완료',
      payment: { orderId: tossData.orderId, amount: tossData.totalAmount, method: tossData.method, status: tossData.status, approvedAt: tossData.approvedAt },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId 필요' }, { status: 400 });
    if (!TOSS_SECRET_KEY) return NextResponse.json({ success: false, error: '토스 API 키 미설정' }, { status: 500 });
    const encryptedKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    const res = await fetch(`https://api.tosspayments.com/v1/payments/orders/${orderId}`, { headers: { Authorization: `Basic ${encryptedKey}` } });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ success: false, error: data.message }, { status: res.status });
    return NextResponse.json({ success: true, payment: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}
