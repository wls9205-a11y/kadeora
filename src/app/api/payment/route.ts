import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';

export async function POST(request: NextRequest) {
  const rl = await rateLimit(request); if (!rl) return rateLimitResponse();
  try {
    const body = await request.json();
    const { paymentKey, orderId, amount } = body;
    if (!paymentKey || !orderId || !amount) return NextResponse.json({ success: false, error: '필수 파라미터 누락' }, { status: 400 });

    // 인증 필수
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }
    const supabaseAuth = getSupabaseAdmin();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ success: false, error: '유효하지 않은 인증' }, { status: 401 });
    }
    const userId = user.id;

    // 금액 서버 검증
    const productId = body.productId as string | undefined;
    if (productId) {
      const { data: product } = await supabaseAuth
        .from('shop_products')
        .select('price_krw')
        .eq('id', productId)
        .single();
      if (!product) {
        return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다' }, { status: 400 });
      }
      if (product.price_krw !== Number(amount)) {
        return NextResponse.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, { status: 400 });
      }
    }

    if (!TOSS_SECRET_KEY) return NextResponse.json({ success: false, error: 'TOSS_SECRET_KEY 환경변수를 설정하세요' }, { status: 500 });
    const encryptedKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: `Basic ${encryptedKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const tossData = await tossRes.json();
    if (!tossRes.ok) return NextResponse.json({ success: false, error: tossData.message || '결제 승인 실패', code: tossData.code }, { status: tossRes.status });
    try {
      const { error: insertError } = await supabaseAuth.from('shop_orders').insert({
        user_id: userId, order_id: orderId, payment_key: paymentKey,
        amount: amount, status: tossData.status, product_id: productId || null,
        approved_at: tossData.approvedAt, method: tossData.method, raw_response: tossData,
      });
      if (insertError) throw insertError;
    } catch (_dbErr) {
      // DB 저장 실패 시 토스 결제 취소
      try {
        await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Basic ${encryptedKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancelReason: '서버 오류로 인한 자동 취소' }),
        });
      } catch (e) { console.error('[payment] Error:', e); }
      return NextResponse.json({ success: false, error: '결제 처리 중 오류가 발생했습니다. 결제가 자동 취소됩니다.' }, { status: 500 });
    }

    // 결제 성공 후 상품별 후처리
    if (productId && userId) {
      try {
        if (productId === 'premium_badge') {
          await supabaseAuth.from('profiles').update({ is_premium: true }).eq('id', userId);
        }
        if (productId === 'nickname_change') {
          // nickname_change_tickets 필드가 있으면 +1 증가
          const { data: profile } = await supabaseAuth.from('profiles').select('nickname_change_tickets').eq('id', userId).single();
          const current = (profile?.nickname_change_tickets as number) ?? 0;
          await supabaseAuth.from('profiles').update({ nickname_change_tickets: current + 1 }).eq('id', userId);
        }
      } catch (e) {
        console.warn('[payment] post-purchase fulfillment error:', e);
      }
    }

    return NextResponse.json({
      success: true, message: '결제 완료',
      payment: { orderId: tossData.orderId, amount: tossData.totalAmount, method: tossData.method, status: tossData.status, approvedAt: tossData.approvedAt },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(request); if (!rl) return rateLimitResponse();
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }
    const supabaseGet = getSupabaseAdmin();
    const { data: { user: getUser } } = await supabaseGet.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!getUser) {
      return NextResponse.json({ success: false, error: '유효하지 않은 인증' }, { status: 401 });
    }
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
