import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // D-0, D-1 청약 찾기
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: deadlines } = await admin.from('apt_subscriptions')
      .select('house_nm, rcept_endde')
      .in('rcept_endde', [today, tomorrow])
      .limit(5);

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No deadlines today/tomorrow' });
    }

    // 알림 생성 (전체 유저 중 마케팅 동의자)
    const { data: users } = await admin.from('profiles')
      .select('id')
      .eq('marketing_agreed', true)
      .eq('is_deleted', false);

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No marketing-agreed users' });
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
