import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

    const { product_id } = await req.json();
    if (!product_id) return NextResponse.json({ error: '상품 ID가 필요합니다' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // 상품 조회
    const { data: product } = await admin.from('shop_products')
      .select('*')
      .eq('id', product_id)
      .eq('is_active', true)
      .eq('purchase_type', 'points')
      .single();
    if (!product) return NextResponse.json({ error: '상품을 찾을 수 없습니다' }, { status: 404 });

    // 유저 포인트 확인
    const { data: profile } = await admin.from('profiles')
      .select('points, nickname_change_tickets')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 });

    if ((profile.points ?? 0) < product.point_price) {
      return NextResponse.json({ error: `포인트가 부족합니다. ${product.point_price - (profile.points ?? 0)}P 더 필요해요.` }, { status: 400 });
    }

    // 포인트 차감
    await admin.rpc('deduct_points', { p_user_id: user.id, p_amount: product.point_price });

    // 상품 적용
    if (product_id === 'nickname_change') {
      await admin.from('profiles').update({ nickname_change_tickets: (profile.nickname_change_tickets ?? 0) + 1 }).eq('id', user.id);
    }
    // premium_badge, post_boost, megaphone 등은 purchases에 기록만 (별도 적용 로직)

    // 구매 기록
    await admin.from('purchases').insert({
      user_id: user.id,
      product_id: product.id,
      amount: product.point_price,
      payment_method: 'points',
      status: 'completed',
    });

    return NextResponse.json({ success: true, remaining_points: (profile.points ?? 0) - product.point_price });
  } catch (err) {
    console.error('[Shop Exchange]', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
