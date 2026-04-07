import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('nickname, bio, avatar_url, age_group, region_text, profile_completed, profile_completion_rewarded')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 완성도 체크
  const steps = [
    !!profile.nickname,
    !!profile.region_text,
    !!profile.age_group,
    !!profile.bio && profile.bio.length > 5,
    !!profile.avatar_url,
  ];
  const allDone = steps.every(Boolean);

  // 모두 완성 + 아직 보상 안 받았으면 보상 지급
  if (allDone && !profile.profile_completion_rewarded) {
    await (supabase as any).rpc('award_points', { p_user_id: user.id, p_amount: 200, p_reason: '프로필 완성 보너스' });
    await (supabase as any).from('profiles').update({
      profile_completed: true,
      profile_completion_rewarded: true,
    }).eq('id', user.id);
    
    await (supabase as any).from('notifications').insert({
      user_id: user.id, type: 'system',
      content: '🎉 프로필 완성! 200P가 지급되었습니다.',
      is_read: false, link: `/profile/${user.id}`,
    });

    return NextResponse.json({ profile: { ...profile, profile_completed: true }, rewarded: true });
  }

  return NextResponse.json({ profile, rewarded: false });
}
