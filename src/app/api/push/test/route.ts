import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers } from '@/lib/push-utils';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'auth'))) return rateLimitResponse();
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    // 어드민 세션 인증도 허용
    const admin = getSupabaseAdmin();
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();

    // 모든 관리자의 푸시 구독 확인
    const { data: admins } = await admin
      .from('profiles')
      .select('id, nickname')
      .eq('is_admin', true);

    const adminIds = (admins ?? []).map(a => a.id);

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, created_at')
      .in('user_id', adminIds);

    // 테스트 푸시 발송
    const result = await sendPushToUsers(adminIds, {
      title: '🔔 카더라 테스트 알림',
      body: '푸시 알림이 정상 작동합니다!',
      url: '/admin',
      tag: `test-${Date.now()}`,
    });

    // 인앱 알림도 생성
    for (const id of adminIds) {
      await admin.from('notifications').insert({
        user_id: id,
        type: 'system',
        content: '🔔 테스트 푸시 알림이 발송되었습니다.',
      });
    }

    return NextResponse.json({
      ok: true,
      admins: admins?.map(a => a.nickname),
      subscriptions: subs?.map(s => ({
        user_id: s.user_id,
        platform: s.endpoint?.includes('apple') ? 'iOS' : s.endpoint?.includes('fcm') ? 'Chrome/Android' : 'other',
        created: s.created_at,
      })),
      push_result: result,
    });
  } catch (err) {
    console.error('[push-test]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
