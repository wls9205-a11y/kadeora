import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * POST /api/welcome-bonus
 * 가입 보너스 100P 지급 (1회만, 중복 방지)
 */
export async function POST() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ awarded: false }, { status: 401 });

    // 이미 지급 여부 확인 (point_history에서 가입 보너스 확인)
    const { data: existing } = await (sb as any)
      .from('point_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('reason', '가입보너스')
      .limit(1)
      .maybeSingle();

    if (existing) return NextResponse.json({ awarded: false, reason: 'already_awarded' });

    // 포인트 지급
    await (sb as any).rpc('award_points', {
      p_user_id: user.id,
      p_amount: 100,
      p_reason: '가입보너스',
    });

    return NextResponse.json({ awarded: true, points: 100 });
  } catch {
    return NextResponse.json({ awarded: false }, { status: 200 });
  }
}
