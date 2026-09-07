import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';

/* ⛔ 봉인 (2026-09-07 · 지시서_CLOSE_20260907 CL-1③)
 *
 * 이 POST 는 계정의 «유일한 구매 성립 지점» 이다 — 토스 결제를 confirm 하고
 * 프리미엄 30일 활성화·닉네임 변경권 지급까지 여기서 한다.
 * 그 구매를 시작하던 표면(/shop · /shop/megaphone · /premium)이 오늘 301 로 접혔다.
 * 표면이 없어졌는데 성립 지점이 열려 있으면, 남은 주소를 직접 두드리는 요청 하나로
 * «되돌리기 어려운» 결제가 성립한다. 그래서 문을 닫는다.
 *
 * ⛔ 삭제하지 않는다. 410 으로 «없어졌음» 을 명시적으로 말한다 —
 *    404 는 「원래 없었다」고, 500 은 「고장났다」고 말한다. 둘 다 사실이 아니다.
 * ⚠️ GET(아래)은 그대로 둔다. 조회성이고, 지난 결제 내역을 못 보게 만들 이유가 없다.
 * ⚠️ 이 문은 productId 를 가리지 않는다 — premium_badge·premium_monthly 뿐 아니라
 *    nickname_change 도 같이 막힌다. 그 상품을 파는 화면도 /shop 이었으므로 정합한다.
 * ⚠️ 되살리려면: 이 블록을 지우기 «전에» 전자상거래 표기(상호·사업자번호·통신판매업신고)를
 *    먼저 세운다. /premium 을 내린 이유가 그 표기 부재였다.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '판매가 종료된 상품입니다.',
      code: 'SALES_CLOSED',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}

/* eslint-disable-next-line no-unused-vars -- 봉인 뒤의 원본. 되살릴 때 이 함수가 근거다. */
async function _sealed_POST(request: NextRequest) {
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
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabaseAuth.from('profiles').update({ is_premium: true, premium_expires_at: expiresAt }).eq('id', userId);
        }
        if (productId === 'premium_monthly') {
          // 프리미엄 멤버십 30일 활성화
          const { data: profile } = await supabaseAuth.from('profiles').select('premium_expires_at').eq('id', userId).single();
          // 기존 구독이 남아있으면 거기서 30일 연장, 없으면 지금부터 30일
          const baseDate = profile?.premium_expires_at && new Date(profile.premium_expires_at) > new Date()
            ? new Date(profile.premium_expires_at)
            : new Date();
          const expiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabaseAuth.from('profiles').update({
            is_premium: true,
            premium_expires_at: expiresAt,
            nickname_change_tickets: (profile as any)?.nickname_change_tickets
              ? ((profile as any).nickname_change_tickets as number) + 1
              : 1,
          }).eq('id', userId);
        }
        if (productId === 'nickname_change') {
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
