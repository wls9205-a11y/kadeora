import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('profile_completed').eq('id', user.id).single();
    
    // 이미 완성된 경우 무시
    if (profile?.profile_completed) return NextResponse.json({ granted: false });

    await admin.rpc('award_points', { p_user_id: user.id, p_amount: 50, p_reason: '프로필완성보너스', p_meta: null });
    return NextResponse.json({ granted: true });
  } catch {
    return NextResponse.json({ granted: false });
  }
}
