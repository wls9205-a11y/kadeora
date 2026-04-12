import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers, filterActiveUsers } from '@/lib/push-utils';

export const maxDuration = 30;

/**
 * streak-alert — 매일 21:00 KST (0 12 * * *)
 * 
 * 오늘 출석 안 한 유저 중 streak ≥ 3인 유저에게
 * "🔥 N일 연속 출석이 끊어질 수 있어요!" 푸시 발송
 * 
 * 일일 1회 제한 (오늘 이미 streak-alert 보낸 유저 제외)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('streak-alert', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // KST today

    // streak ≥ 3 + 오늘 출석 안 한 유저
    const { data: streakUsers } = await (sb as any).from('attendance')
      .select('user_id, streak, last_date')
      .gte('streak', 3)
      .neq('last_date', today);

    if (!streakUsers?.length) return { processed: 0, metadata: { message: 'No at-risk streaks' } };

    // 오늘 이미 streak-alert 보낸 유저 제외
    const userIds = streakUsers.map((u: any) => u.user_id);
    const todayStart = today + 'T00:00:00+09:00';
    const todayUTC = new Date(new Date(todayStart).getTime() - 9 * 3600000).toISOString();
    
    const { data: alreadySent } = await (sb as any).from('notifications')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', todayUTC)
      .ilike('content', '%연속 출석%끊어질%');
    
    const sentIds = new Set((alreadySent || []).map((n: any) => n.user_id));
    const eligible = streakUsers.filter((u: any) => !sentIds.has(u.user_id));

    if (eligible.length === 0) return { processed: 0, metadata: { message: 'All already notified' } };

    // 시드/삭제 유저 제외
    const { data: profiles } = await sb.from('profiles')
      .select('id').in('id', eligible.map((u: any) => u.user_id))
      .neq('is_seed', true).neq('is_deleted', true);
    const realIds = new Set((profiles || []).map((p: any) => p.id));

    // Quiet Hours + 옵트아웃 필터
    const filteredIds = await filterActiveUsers(
      eligible.filter((u: any) => realIds.has(u.user_id)).map((u: any) => u.user_id),
      'push_attendance'
    );

    if (filteredIds.length === 0) return { processed: 0, metadata: { message: 'All filtered out' } };

    // 알림 생성 + 푸시
    const streakMap = new Map(eligible.map((u: any) => [u.user_id, u.streak]));
    const notifs = filteredIds.map(uid => ({
      user_id: uid, type: 'system',
      content: `🔥 ${streakMap.get(uid)}일 연속 출석이 끊어질 수 있어요! 지금 출석 체크하세요`,
      link: '/attendance',
      is_read: false,
    }));

    await (sb as any).from('notifications').insert(notifs);

    const { sent, failed } = await sendPushToUsers(filteredIds, {
      title: '🔥 출석 스트릭 위기!',
      body: '오늘 출석하지 않으면 연속 기록이 끊어져요',
      url: '/attendance',
      tag: `streak-${today}`,
      important: true,
    });

    return { processed: sent, failed, metadata: { eligible: eligible.length, filtered: filteredIds.length } };
  });

  return NextResponse.json({ ok: true, ...result });
}
