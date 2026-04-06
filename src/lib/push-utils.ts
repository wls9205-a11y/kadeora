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
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid() || userIds.length === 0) return { sent: 0, failed: 0 };

  const admin = getSupabaseAdmin();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', userIds);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };
  return deliverPush(subs, payload);
}

/**
 * 전체 구독자에게 웹 푸시 발송 (로그인+비로그인 모두 포함)
 *
 * v1 문제: user_id만 필터 → 비로그인 구독자 누락
 * v2 수정: 전체 push_subscriptions에서 발송
 */
export async function sendPushBroadcast(
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };

  const admin = getSupabaseAdmin();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .limit(500);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };
  return deliverPush(subs, payload);
}

/**
 * 실제 푸시 전송 (내부 공통 함수)
 */
async function deliverPush(
  subs: { id: number; endpoint: string; p256dh: string | null; auth: string | null }[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const admin = getSupabaseAdmin();
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
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } },
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
