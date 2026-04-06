import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers } from '@/lib/push-utils';

export const maxDuration = 30;

/**
 * push-daily-reminder v2 — D+1 웰컴 + 출석 리마인더 통합
 *
 * 1. D+1 웰컴: 가입 24~48시간 유저에게 관심 지역 기반 맞춤 알림
 * 2. 출석 리마인더: 재방문 이력 있는 실유저만 (시드 제외)
 *
 * v1 문제: 시드 포함 전원에게 출석 알림 → system 알림 5,912건 미읽힘
 * v2 개선: 시드 제외 + D+1 웰컴 추가 + 재방문 이력 체크
 */

async function handler(req: NextRequest): Promise<NextResponse> {
  const result = await withCronLogging('push-daily-reminder', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    let welcomeSent = 0;
    let reminderSent = 0;

    // ═══ 1. D+1 웰컴 알림 ═══
    const { data: newUsers } = await sb.from('profiles')
      .select('id, nickname, residence_city')
      .neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true)
      .gte('created_at', twoDaysAgo)
      .lt('created_at', yesterday);

    if (newUsers && newUsers.length > 0) {
      const { data: alreadyWelcomed } = await sb.from('notifications')
        .select('user_id')
        .in('user_id', newUsers.map(u => u.id))
        .ilike('content', '%환영%');
      const welcomedIds = new Set((alreadyWelcomed || []).map((n: any) => n.user_id));

      const notifs: any[] = [];
      for (const u of newUsers) {
        if (welcomedIds.has(u.id)) continue;
        const city = u.residence_city || '전국';
        notifs.push({
          user_id: u.id, type: 'system',
          content: `🎉 ${u.nickname || '회원'}님, 카더라 가입을 환영합니다! ${city} 지역 청약·실거래 분석을 확인해보세요.`,
          link: '/apt',
        });
      }

      if (notifs.length > 0) {
        await sb.from('notifications').insert(notifs);
        welcomeSent = notifs.length;
        await sendPushToUsers(notifs.map(n => n.user_id), {
          title: '🎉 카더라에 오신 것을 환영합니다!',
          body: '관심 지역 청약·실거래 분석을 확인해보세요',
          url: '/apt', tag: `welcome-${today}`,
        });
      }
    }

    // ═══ 2. 출석 리마인더 (재방문 실유저만) ═══
    const { count: alreadySent } = await sb.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'system')
      .gte('created_at', `${today}T00:00:00Z`)
      .ilike('content', '%출석체크%');

    if ((alreadySent ?? 0) === 0) {
      const { data: checkedUsers } = await sb.from('attendance')
        .select('user_id').eq('last_date', today);
      const checkedIds = new Set((checkedUsers ?? []).map((u: any) => u.user_id));

      const { data: optedOut } = await sb.from('notification_settings')
        .select('user_id').eq('push_attendance', false);
      const optedOutIds = new Set((optedOut ?? []).map((s: any) => s.user_id));

      // 실유저 중 재방문 이력 있는 사람만
      const { data: activeUsers } = await sb.from('profiles')
        .select('id')
        .neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true)
        .not('last_active_at', 'is', null);

      const unchecked = (activeUsers ?? []).filter((u: any) => !checkedIds.has(u.id) && !optedOutIds.has(u.id));

      if (unchecked.length > 0) {
        const batch = unchecked.map((u: any) => ({
          user_id: u.id, type: 'system',
          content: '📅 오늘 출석체크 잊지 마세요! +10P',
          link: '/feed',
        }));
        await sb.from('notifications').insert(batch);
        reminderSent = unchecked.length;

        await sendPushToUsers(unchecked.map((u: any) => u.id), {
          title: '📅 출석체크 리마인더',
          body: '오늘 출석체크 잊지 마세요! +10P 적립',
          url: '/feed', tag: `attendance-${today}`,
        });
      }
    }

    return {
      processed: welcomeSent + reminderSent,
      metadata: { welcomeSent, reminderSent, newUsersChecked: newUsers?.length ?? 0 },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
