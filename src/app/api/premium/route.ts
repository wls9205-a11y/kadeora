import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkPremiumStatus } from '@/lib/premium';

/**
 * GET /api/premium — 현재 유저의 프리미엄 상태 확인
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ isPremium: false, expiresAt: null, daysLeft: 0 });
  }

  const sb = getSupabaseAdmin();
  const { data: { user } } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return NextResponse.json({ isPremium: false, expiresAt: null, daysLeft: 0 });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('is_premium, premium_expires_at')
    .eq('id', user.id)
    .single();

  const status = checkPremiumStatus(profile);

  // 만료된 프리미엄 자동 해제
  if (profile?.is_premium && !status.isPremium) {
    await sb.from('profiles')
      .update({ is_premium: false })
      .eq('id', user.id);
  }

  return NextResponse.json(status);
}
