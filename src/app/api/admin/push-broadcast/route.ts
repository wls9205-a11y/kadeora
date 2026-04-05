import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers } from '@/lib/push-utils';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 인증 + 관리자 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 });

    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return NextResponse.json({ error: '관리자만 접근 가능' }, { status: 403 });

    const { title, body, url, target_city, target_all } = await req.json();
    if (!title || !body) return NextResponse.json({ error: '제목과 내용 필수' }, { status: 400 });

    // 타겟 유저 조회
    let query = supabaseAdmin.from('profiles').select('id', { count: 'exact' }).eq('marketing_agreed', true);
    if (!target_all && target_city) {
      query = query.eq('residence_city', target_city);
    }
    const { data: targetUsers, count } = await query;
    const userIds = (targetUsers ?? []).map((u: { id: string }) => u.id);

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, targeted: 0, sent: 0 });
    }

    // push_subscriptions에서 구독 정보 조회
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', userIds);

    // 인앱 알림 생성 (notifications 테이블: user_id, type, content, is_read)
    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      type: 'marketing',
      content: `${title}\n${body}`,
    }));

    await supabaseAdmin.from('notifications').insert(notifications);

    // 웹 푸시 실제 발송
    const pushResult = await sendPushToUsers(userIds, {
      title: `📢 ${title}`,
      body,
      url: url || '/',
      tag: `broadcast-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      targeted: count ?? 0,
      push_sent: pushResult.sent,
      push_failed: pushResult.failed,
      notifications_created: notifications.length,
    });
  } catch (_err) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
