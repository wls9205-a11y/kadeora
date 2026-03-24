import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:kadeora.app@gmail.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  image?: string;
  important?: boolean;
}

/**
 * 특정 유저들에게 웹 푸시 발송
 * 크론에서 직접 호출 가능 (인증 불필요)
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid() || userIds.length === 0) return { sent: 0, failed: 0 };

  const admin = getSupabaseAdmin();

  // 구독 정보 조회 (배치)
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', userIds);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag ?? 'kadeora-cron',
    image: payload.image,
    important: payload.important,
  });

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' },
          },
          message,
          { TTL: 86400 }
        );
        sent++;
      } catch (e: unknown) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
        }
        failed++;
      }
    })
  );

  return { sent, failed };
}

/**
 * 전체 유저에게 웹 푸시 발송 (옵트아웃 제외)
 */
export async function sendPushBroadcast(
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };

  const admin = getSupabaseAdmin();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id');

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  const allUserIds = subs.map(s => s.user_id).filter(Boolean) as string[];
  return sendPushToUsers(allUserIds, payload);
}
