import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import webpush from 'web-push';

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@kadeora.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', session.user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, body, url = '/', target = 'all', user_ids } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  // 구독자 조회
  let query = admin.from('push_subscriptions').select('*');
  if (target === 'specific' && user_ids?.length) {
    query = query.in('user_id', user_ids);
  }
  const { data: subs } = await query;

  // 앱 내 알림 저장 (notifications 테이블)
  const { data: allProfiles } = target === 'all'
    ? await admin.from('profiles').select('id').or('is_deleted.is.null,is_deleted.eq.false')
    : { data: (user_ids ?? []).map((id: string) => ({ id })) };

  if (allProfiles?.length) {
    await admin.from('notifications').insert(
      allProfiles.map((p: { id: string }) => ({
        user_id: p.id,
        type: 'system',
        content: `📢 [공지] ${title} — ${body}`,
        is_read: false,
      }))
    );
  }

  // Web Push 발송
  let sent = 0;
  const failed = [];
  if (subs?.length && process.env.VAPID_PRIVATE_KEY) {
    const payload = JSON.stringify({ title, body, url });
    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 86400 }
          );
          sent++;
        } catch (e: unknown) {
          // 만료된 구독 삭제
          const err = e as { statusCode?: number };
          if (err.statusCode === 410 || err.statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('id', sub.id);
          }
          failed.push(sub.id);
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    app_notif: allProfiles?.length ?? 0,
    push_sent: sent,
    push_failed: failed.length,
    push_total: subs?.length ?? 0,
  });
}