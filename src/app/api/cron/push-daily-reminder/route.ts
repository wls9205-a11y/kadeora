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
    const today = new Date().toISOString().slice(0, 10);

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
    }));

    // 배치 INSERT
    let inserted = 0;
    for (let i = 0; i < notifications.length; i += 1000) {
      const batch = notifications.slice(i, i + 1000);
      await admin.from('notifications').insert(batch);
      inserted += batch.length;
    }

    return NextResponse.json({ sent: inserted, unchecked: unchecked.length });
  } catch (err) {
    console.error('[push-daily-reminder]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
