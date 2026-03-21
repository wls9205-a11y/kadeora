import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentKey, orderId, amount, planId } = body;
    if (!paymentKey || !orderId || !amount || !planId) {
      return NextResponse.json({ success: false, error: '필수 파라미터 누락' }, { status: 400 });
    }

    // 인증 필수
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ success: false, error: '유효하지 않은 인증' }, { status: 401 });
    }

    // 플랜 검증
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
    if (!plan || plan.price === 0) {
      return NextResponse.json({ success: false, error: '잘못된 플랜' }, { status: 400 });
    }
    if (plan.price !== Number(amount)) {
      return NextResponse.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, { status: 400 });
    }

    // 토스페이먼츠 결제 승인
    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'TOSS_SECRET_KEY 환경변수를 설정하세요' }, { status: 500 });
    }
    const encryptedKey = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: `Basic ${encryptedKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });
    const tossData = await tossRes.json();
    if (!tossRes.ok) {
      return NextResponse.json({ success: false, error: tossData.message || '결제 승인 실패', code: tossData.code }, { status: tossRes.status });
    }

    // 기존 활성 구독 비활성화
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // 구독 기간 계산
    const periodStart = new Date();
    const periodEnd = new Date();
    if (plan.slug === 'pro') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 새 구독 생성
    const { error: subError } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan_id: planId,
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      toss_payment_key: paymentKey,
      toss_order_id: orderId,
    });

    if (subError) {
      console.error('구독 생성 실패:', subError);
      // 구독 DB 실패 시 결제 취소
      try {
        await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Basic ${encryptedKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancelReason: '구독 생성 실패로 인한 자동 취소' }),
        });
      } catch {}
      return NextResponse.json({ success: false, error: '구독 처리 중 오류가 발생했습니다. 결제가 자동 취소됩니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '구독 완료',
      subscription: {
        planName: plan.name,
        periodEnd: periodEnd.toISOString(),
      },
      payment: {
        orderId: tossData.orderId,
        amount: tossData.totalAmount,
        method: tossData.method,
        status: tossData.status,
        approvedAt: tossData.approvedAt,
      },
    });
  } catch (err) {
    console.error('구독 결제 에러:', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 });
  }
}
