export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 프리미엄 구독 만료 처리 크론
 * 매일 0시 실행 — premium_expires_at이 지난 유저의 is_premium을 false로 전환
 */
async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('premium-expire', async () => {
      const sb = getSupabaseAdmin();
      const now = new Date().toISOString();

      // 만료된 프리미엄 유저 조회
      const { data: expired, error } = await sb
        .from('profiles')
        .select('id, nickname, premium_expires_at')
        .eq('is_premium', true)
        .lt('premium_expires_at', now);

      if (error || !expired?.length) {
        return { processed: 0, metadata: { message: '만료된 프리미엄 없음' } };
      }

      // 일괄 해제
      const ids = expired.map(u => u.id);
      const { error: updateError } = await sb
        .from('profiles')
        .update({ is_premium: false })
        .in('id', ids);

      if (updateError) {
        return { processed: 0, failed: ids.length, metadata: { error: updateError.message } };
      }

      // D-3 만료 예정 유저 알림 (추후 푸시 알림 연동)
      const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: expiring } = await sb
        .from('profiles')
        .select('id, nickname, premium_expires_at')
        .eq('is_premium', true)
        .gt('premium_expires_at', now)
        .lt('premium_expires_at', threeDaysLater);

      return {
        processed: ids.length,
        metadata: {
          expired: ids.length,
          expiring_soon: expiring?.length || 0,
          expired_users: expired.map(u => u.nickname).slice(0, 10),
        },
      };
    })
  );
}

export const GET = withCronAuth(handler);
