import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

async function handler() {
  const sb = getSupabaseAdmin();

  // 기한 지난 미판정 예측 조회
  const { data: expired, error } = await (sb as any)
    .from('predictions')
    .select('id, post_id, target, direction, deadline, posts!inner(title)')
    .eq('resolved', false)
    .lt('deadline', new Date().toISOString().split('T')[0]);

  if (error) {
    return { processed: 0, metadata: { error: error.message } };
  }

  if (!expired || expired.length === 0) {
    return { processed: 0, metadata: { message: '만료된 미판정 예측 없음' } };
  }

  // 관리자 알림 생성 (어드민 대시보드에서 수동 판정)
  const adminIds = await sb
    .from('profiles')
    .select('id')
    .eq('is_admin', true);

  const adminUserIds = (adminIds.data ?? []).map((a: { id: string }) => a.id);

  let notifCount = 0;
  for (const pred of expired) {
    const title = (pred as any).posts?.title || pred.target;
    for (const adminId of adminUserIds) {
      await sb.from('notifications').insert({
        user_id: adminId,
        type: 'system',
        content: `⏰ 예측 기한 만료: "${title}" (${pred.direction === 'up' ? '📈상승' : '📉하락'} ${pred.target}, 기한: ${pred.deadline}) — 어드민 커뮤니티탭에서 판정하세요`,
        is_read: false,
      });
      notifCount++;
    }
  }

  return {
    processed: expired.length,
    metadata: {
      expiredPredictions: expired.length,
      notificationsSent: notifCount,
      adminCount: adminUserIds.length,
    },
  };
}

export async function GET() {
  try {
    const result = await withCronLogging('predict-check', handler)();
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, processed: 0 }, { status: 200 });
  }
}
