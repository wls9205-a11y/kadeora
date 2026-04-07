import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('first_mission_completed, first_mission_progress')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    first_mission_completed: profile?.first_mission_completed || false,
    progress: profile?.first_mission_progress || { watchlist: false, interest: false, post: false, comment: false },
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { mission } = await req.json();
  if (!['watchlist', 'interest', 'post', 'comment'].includes(mission)) {
    return NextResponse.json({ error: 'invalid mission' }, { status: 400 });
  }

  // 현재 진행도 조회
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('first_mission_completed, first_mission_progress, points')
    .eq('id', user.id)
    .single();

  if (profile?.first_mission_completed) {
    return NextResponse.json({ already_completed: true });
  }

  const progress = profile?.first_mission_progress || { watchlist: false, interest: false, post: false, comment: false };
  if (progress[mission]) {
    return NextResponse.json({ already_done: true });
  }

  // 미션 완료 처리
  progress[mission] = true;
  const pointsMap: Record<string, number> = { watchlist: 50, interest: 50, post: 100, comment: 30 };
  const reward = pointsMap[mission] || 0;

  // 포인트 지급
  await (supabase as any).rpc('award_points', { p_user_id: user.id, p_amount: reward, p_reason: `첫 미션: ${mission}` });

  // 2개 이상 완료 시 보너스
  const doneCount = Object.values(progress).filter(Boolean).length;
  const allDone = doneCount >= 2 && !profile?.first_mission_completed;

  if (allDone) {
    await (supabase as any).rpc('award_points', { p_user_id: user.id, p_amount: 200, p_reason: '첫 미션 보너스 (2개+ 완료)' });
  }

  // DB 업데이트
  await (supabase as any).from('profiles').update({
    first_mission_progress: progress,
    first_mission_completed: doneCount >= 2,
  }).eq('id', user.id);

  // 알림
  await (supabase as any).from('notifications').insert({
    user_id: user.id, type: 'system',
    content: `🎁 첫 미션 "${mission}" 완료! +${reward}P${allDone ? ' + 보너스 200P' : ''}`,
    is_read: false, link: '/feed',
  });

  return NextResponse.json({ success: true, reward, bonus: allDone ? 200 : 0, progress });
}
