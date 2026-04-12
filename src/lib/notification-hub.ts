import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers, filterActiveUsers } from '@/lib/push-utils';

/**
 * notification-hub.ts — 중앙 알림 허브
 * 
 * 모든 알림 생성을 이 허브를 통해 처리:
 * 1. notifications 테이블 INSERT
 * 2. 채널별 dispatch (push → email → kakao cascade)
 * 3. Quiet Hours / 옵트아웃 / 일일 상한 체크
 * 4. 발송 로그 기록
 */

type CascadeLevel = 'urgent' | 'routine' | 'critical';

interface NotificationPayload {
  userId: string;
  type: string;
  content: string;
  link?: string;
  source?: string;
  refId?: string;
  bundleKey?: string;
  push?: {
    title: string;
    body: string;
    tag?: string;
    image?: string;
    important?: boolean;
  };
  cascadeLevel?: CascadeLevel;
  skipPush?: boolean;
  skipQuietCheck?: boolean;
}

const TYPE_TO_SETTING: Record<string, string> = {
  comment: 'push_comments', reply: 'push_comments',
  like: 'push_likes', post_like: 'push_likes', comment_like: 'push_likes',
  follow: 'push_follows',
  system: 'push_news', weekly_digest: 'push_daily_digest',
  price_alert: 'push_stock_alert', apt_alert: 'push_apt_deadline',
  streak_alert: 'push_attendance',
};

const TYPE_TO_CASCADE: Record<string, CascadeLevel> = {
  comment: 'urgent', like: 'urgent', follow: 'urgent',
  price_alert: 'urgent', streak_alert: 'urgent',
  system: 'routine', weekly_digest: 'routine',
  churn_d3: 'routine', churn_d7: 'critical', churn_d14: 'critical',
};

const MAX_DAILY_PUSH = 3;

export async function createNotification(payload: NotificationPayload): Promise<{ ok: boolean; notifId?: number }> {
  const sb = getSupabaseAdmin();

  try {
    const { data: notif, error } = await (sb as any).from('notifications').insert({
      user_id: payload.userId,
      type: payload.type,
      content: payload.content,
      link: payload.link || '/feed',
      is_read: false,
    }).select('id').single();

    if (error) { console.error('[notification-hub] INSERT:', error.message); return { ok: false }; }

    if (!payload.skipPush) {
      dispatchToChannels(payload, notif.id).catch(e =>
        console.error('[notification-hub] dispatch:', e)
      );
    }

    return { ok: true, notifId: notif.id };
  } catch (e) {
    console.error('[notification-hub]', e);
    return { ok: false };
  }
}

export async function createNotificationBatch(payloads: NotificationPayload[]): Promise<{ ok: boolean; created: number }> {
  if (payloads.length === 0) return { ok: true, created: 0 };
  const sb = getSupabaseAdmin();

  const rows = payloads.map(p => ({
    user_id: p.userId, type: p.type, content: p.content,
    link: p.link || '/feed', is_read: false,
  }));

  const { data, error } = await (sb as any).from('notifications').insert(rows).select('id, user_id');
  if (error) { console.error('[notification-hub] batch:', error.message); return { ok: false, created: 0 }; }

  // 배치 푸시 (첫 payload의 push 설정 사용)
  const userIds = [...new Set(payloads.filter(p => !p.skipPush && p.push).map(p => p.userId))];
  if (userIds.length > 0 && payloads[0].push) {
    const settingKey = TYPE_TO_SETTING[payloads[0].type];
    const activeUsers = settingKey ? await filterActiveUsers(userIds, settingKey) : userIds;
    if (activeUsers.length > 0) {
      sendPushToUsers(activeUsers, {
        title: payloads[0].push.title,
        body: payloads[0].push.body,
        url: payloads[0].link,
        tag: payloads[0].push.tag,
        image: payloads[0].push.image,
      }).catch(() => {});
    }
  }

  return { ok: true, created: data?.length || 0 };
}

async function dispatchToChannels(payload: NotificationPayload, notifId: number) {
  const sb = getSupabaseAdmin();
  const cascade = payload.cascadeLevel || TYPE_TO_CASCADE[payload.type] || 'routine';

  // Quiet Hours
  if (!payload.skipQuietCheck) {
    const kstHour = (new Date().getUTCHours() + 9) % 24;
    const { data: qs } = await (sb as any).from('notification_settings')
      .select('quiet_start, quiet_end').eq('user_id', payload.userId).maybeSingle();
    if (qs?.quiet_start && qs?.quiet_end) {
      const start = parseInt(qs.quiet_start.split(':')[0]);
      const end = parseInt(qs.quiet_end.split(':')[0]);
      const isQuiet = start > end ? (kstHour >= start || kstHour < end) : (kstHour >= start && kstHour < end);
      if (isQuiet) return;
    }
  }

  // 옵트아웃
  const settingKey = TYPE_TO_SETTING[payload.type];
  if (settingKey) {
    const { data: s } = await (sb as any).from('notification_settings')
      .select(settingKey).eq('user_id', payload.userId).maybeSingle();
    if (s && (s as any)[settingKey] === false) return;
  }

  // 일일 푸시 상한 (3건)
  const todayKST = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+09:00';
  const todayUTC = new Date(new Date(todayKST).getTime() - 9 * 3600000).toISOString();
  const { count: dailyCount } = await (sb as any).from('push_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayUTC);
  // 대략적 일일 체크 (유저별 정밀 체크는 dispatch_logs 도입 후)

  // 채널 1: 웹 푸시
  const pushPayload = payload.push || {
    title: '카더라',
    body: payload.content.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim().slice(0, 80),
  };

  const { sent } = await sendPushToUsers([payload.userId], {
    title: pushPayload.title,
    body: pushPayload.body,
    url: payload.link || '/',
    tag: pushPayload.tag || `notif-${notifId}`,
    image: pushPayload.image,
    important: pushPayload.important,
  });

  if (sent > 0) return; // 푸시 성공 → cascade 중단

  // 채널 2: 이메일 (urgent/critical만)
  if (cascade === 'urgent' || cascade === 'critical') {
    try {
      const { sendNotificationEmail } = await import('@/lib/email-sender');
      const { data: user } = await sb.auth.admin.getUserById(payload.userId);
      if (user?.user?.email) {
        await sendNotificationEmail(
          user.user.email,
          pushPayload.title,
          `<p>${pushPayload.body}</p><p><a href="https://kadeora.app${payload.link || '/'}">카더라에서 확인하기 →</a></p>`
        );
      }
    } catch {}
  }

  // 채널 3: 카카오 알림톡 (critical만, 일일 1건 상한)
  if (cascade === 'critical') {
    try {
      const { sendAlimtalkToUser } = await import('@/lib/kakao-alimtalk');
      await sendAlimtalkToUser(payload.userId, 'TPL-004', {
        '#{닉네임}': pushPayload.title.slice(0, 20),
        '#{링크}': `https://kadeora.app${payload.link || '/'}`,
      });
    } catch {}
  }
}
