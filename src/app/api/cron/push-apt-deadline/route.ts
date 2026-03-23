import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // D-0, D-1 청약 찾기
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: deadlines } = await admin.from('apt_subscriptions')
      .select('id, house_nm, rcept_endde')
      .in('rcept_endde', [today, tomorrow])
      .limit(10);

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No deadlines today/tomorrow' });
    }

    // 알림 생성 (notification_settings에서 push_apt_deadline = true인 유저)
    const { data: settings } = await admin.from('notification_settings')
      .select('user_id')
      .eq('push_apt_deadline', true);
    const optedInIds = new Set((settings ?? []).map(s => s.user_id));

    // notification_settings가 없는 유저는 기본값(true)이므로 전체 유저에서 옵트아웃 제외
    const { data: allUsers } = await admin.from('profiles')
      .select('id')
      .eq('is_deleted', false);

    const { data: optedOut } = await admin.from('notification_settings')
      .select('user_id')
      .eq('push_apt_deadline', false);
    const optedOutIds = new Set((optedOut ?? []).map(s => s.user_id));

    const users = (allUsers ?? []).filter(u => !optedOutIds.has(u.id));

    if (users.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No eligible users' });
    }

    const notifications = [];
    for (const apt of deadlines) {
      const isToday = apt.rcept_endde === today;
      const content = isToday
        ? `오늘 마감! ${apt.house_nm} 접수 마지막 날이에요.`
        : `내일 마감! ${apt.house_nm} 접수가 내일까지에요.`;

      for (const u of users) {
        notifications.push({ user_id: u.id, type: 'system', content });
      }
    }

    // 관심단지 북마크 유저에게 추가 알림
    const aptIds = deadlines.map((d: any) => d.id).filter(Boolean);
    if (aptIds.length > 0) {
      const { data: bookmarks } = await admin.from('apt_bookmarks')
        .select('user_id, apt_id')
        .in('apt_id', aptIds)
        .eq('notify', true);

      if (bookmarks && bookmarks.length > 0) {
        const aptMap = new Map(deadlines.map((d: any) => [d.id, d]));
        for (const bk of bookmarks) {
          const apt = aptMap.get(bk.apt_id) as any;
          if (!apt) continue;
          const isToday = apt.rcept_endde === today;
          notifications.push({
            user_id: bk.user_id,
            type: 'system',
            content: isToday
              ? `🧡 관심단지 ${apt.house_nm} 접수 오늘 마감!`
              : `🧡 관심단지 ${apt.house_nm} 접수가 내일까지에요.`,
          });
        }
      }
    }

    // 배치 INSERT (1000개씩)
    let inserted = 0;
    for (let i = 0; i < notifications.length; i += 1000) {
      const batch = notifications.slice(i, i + 1000);
      await admin.from('notifications').insert(batch);
      inserted += batch.length;
    }

    return NextResponse.json({ sent: inserted, deadlines: deadlines.length, users: users.length });
  } catch (err) {
    console.error('[push-apt-deadline]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
