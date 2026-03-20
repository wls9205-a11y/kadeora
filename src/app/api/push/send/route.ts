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
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, body, url = '/', target = 'all', user_ids } = await req.json();
  if (!title || !body) return NextResponse.json({ error: 'title and body required' }, { status: 400 });

  // 구독자 조회
  let query = admin.from('push_subscriptions').select('*');
  if (target === 'specific' && user_ids?.length) {
    query = query.in('user_id', user_ids);
  }
  const { data: rawSubs } = await query;

  // target=web/app 필터링
  let subs = rawSubs ?? [];
  if (target === 'app' || target === 'web') {
    const { data: appInstalls } = await admin.from('pwa_installs').select('user_id').not('user_id', 'is', null);
    const appIds = new Set((appInstalls || []).map((u: any) => u.user_id));
    if (target === 'app') subs = subs.filter((s: any) => s.user_id && appIds.has(s.user_id));
    else subs = subs.filter((s: any) => !s.user_id || !appIds.has(s.user_id));
  }

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

  // 발송 로그 먼저 생성 (log_id를 payload에 포함하기 위해)
  let logId = null;
  try {
    const { data: logData } = await admin.from('push_logs').insert({ title, body, url, target, sent_count: 0 }).select('id').single();
    logId = logData?.id;
  } catch {}

  // Web Push 발송
  let sent = 0;
  const failed = [];
  if (subs?.length && process.env.VAPID_PRIVATE_KEY) {
    const payload = JSON.stringify({ title, body, url, log_id: logId });
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

  // 발송 완료 후 sent_count 업데이트
  if (logId) {
    try {
      await admin.from('push_logs').update({ sent_count: sent }).eq('id', logId);
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    app_notif: allProfiles?.length ?? 0,
    push_sent: sent,
    push_failed: failed.length,
    push_total: subs?.length ?? 0,
    log_id: logId,
  });
}