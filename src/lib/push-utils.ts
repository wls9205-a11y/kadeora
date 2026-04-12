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

/**
 * Quiet Hours 체크 — 유저가 설정한 방해금지 시간인지 확인
 * 기본값 NULL → 체크 안 함 (항상 발송 가능)
 */
export async function isQuietHours(userId: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('notification_settings')
      .select('quiet_start, quiet_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data?.quiet_start || !data?.quiet_end) return false;

    const kstHour = (new Date().getUTCHours() + 9) % 24;
    const start = parseInt(data.quiet_start.split(':')[0]);
    const end = parseInt(data.quiet_end.split(':')[0]);

    return start > end
      ? (kstHour >= start || kstHour < end)   // 23:00~07:00
      : (kstHour >= start && kstHour < end);
  } catch {
    return false; // 에러 시 발송 허용
  }
}

/**
 * 유저 리스트에서 Quiet Hours + 옵트아웃 유저 필터링
 */
export async function filterActiveUsers(
  userIds: string[],
  settingKey?: string
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const admin = getSupabaseAdmin();

  // 옵트아웃 체크
  let optedOutIds = new Set<string>();
  if (settingKey) {
    const { data: optedOut } = await admin.from('notification_settings')
      .select('user_id')
      .eq(settingKey, false);
    optedOutIds = new Set((optedOut ?? []).map((s: any) => s.user_id));
  }

  // Quiet Hours 체크 (배치 조회)
  const { data: quietSettings } = await admin.from('notification_settings')
    .select('user_id, quiet_start, quiet_end')
    .in('user_id', userIds)
    .not('quiet_start', 'is', null);

  const kstHour = (new Date().getUTCHours() + 9) % 24;
  const quietIds = new Set<string>();
  for (const s of quietSettings ?? []) {
    if (!s.quiet_start || !s.quiet_end) continue;
    const start = parseInt(s.quiet_start.split(':')[0]);
    const end = parseInt(s.quiet_end.split(':')[0]);
    const isQuiet = start > end
      ? (kstHour >= start || kstHour < end)
      : (kstHour >= start && kstHour < end);
    if (isQuiet) quietIds.add(s.user_id);
  }

  return userIds.filter(id => !optedOutIds.has(id) && !quietIds.has(id));
}
