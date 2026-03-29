export const maxDuration = 15;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers } from '@/lib/push-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // ★ 중복 방지: 오늘 이미 출석 리마인더 발송했으면 스킵
    const { count: alreadySent } = await admin.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'system')
      .gte('created_at', `${today}T00:00:00Z`)
      .ilike('content', '%출석체크%');
    if ((alreadySent ?? 0) > 0) {
      return NextResponse.json({ sent: 0, message: `Already sent ${alreadySent} reminders today — skipping` });
    }

    // 오늘 출석 안 한 유저 중 마케팅 동의자
    const { data: checkedUsers } = await admin.from('attendance')
      .select('user_id')
      .eq('last_date', today);
    const checkedIds = new Set((checkedUsers ?? []).map(u => u.user_id));

    // notification_settings에서 push_attendance=false인 유저 제외
    const { data: optedOut } = await admin.from('notification_settings')
      .select('user_id').eq('push_attendance', false);
    const optedOutIds = new Set((optedOut ?? []).map(s => s.user_id));

    const { data: allUsers } = await admin.from('profiles')
      .select('id').eq('is_deleted', false);

    const unchecked = (allUsers ?? []).filter(u => !checkedIds.has(u.id) && !optedOutIds.has(u.id));
    if (unchecked.length === 0) {
      return NextResponse.json({ sent: 0, message: 'All users checked in or no marketing users' });
    }

    const notifications = unchecked.map(u => ({
      user_id: u.id,
      type: 'system',
      content: '오늘 출석체크 잊지 마세요! +10P',
      link: '/feed',
    }));

    // 배치 INSERT
    let inserted = 0;
    for (let i = 0; i < notifications.length; i += 1000) {
      const batch = notifications.slice(i, i + 1000);
      await admin.from('notifications').insert(batch);
      inserted += batch.length;
    }

    // 웹 푸시 실제 발송
    const userIds = unchecked.map(u => u.id);
    const pushResult = await sendPushToUsers(userIds, {
      title: '📅 출석체크 리마인더',
      body: '오늘 출석체크 잊지 마세요! +10P 적립',
      url: '/feed',
      tag: `attendance-${today}`,
    });

    return NextResponse.json({ sent: inserted, unchecked: unchecked.length, push: pushResult });
  } catch (err) {
    console.error('[push-daily-reminder]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 200 });
  }
}
