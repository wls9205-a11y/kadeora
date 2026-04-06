import { errMsg } from '@/lib/error-utils';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/cron-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export const GET = withCronAuth(async (_req: NextRequest) => {
  const admin = getSupabaseAdmin()

  try {
    // 1. 30일 지난 읽은 알림 삭제
    const { count: notifCount } = await admin
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('is_read', true)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // 2. page_views 90일 이전 삭제
    const { count: pvCount } = await admin
      .from('page_views')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    // 3. stuck 크론 로그 정리 (1시간 이상 running → failed)
    const { count: stuckCount } = await admin
      .from('cron_logs')
      .update({ status: 'failed', error_message: 'Auto-cleanup: stuck in running' })
      .eq('status', 'running')
      .lt('started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    // 4. cron_logs 30일 이전 삭제 (DB 용량 절약)
    const { count: cronLogCount } = await admin
      .from('cron_logs')
      .delete({ count: 'exact' })
      .lt('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // 5. admin_alerts 30일 이전 + 읽은 것 삭제
    const { count: alertCount } = await admin
      .from('admin_alerts')
      .delete({ count: 'exact' })
      .eq('is_read', true)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    return NextResponse.json({
      ok: true,
      cleaned: {
        notifications: notifCount ?? 0,
        pageViews: pvCount ?? 0,
        stuckCrons: stuckCount ?? 0,
        cronLogs: cronLogCount ?? 0,
        alerts: alertCount ?? 0,
      }
    })
  } catch (e: unknown) {
    console.error('[cleanup] error:', errMsg(e))
    return NextResponse.json({ error: errMsg(e) }, { status: 200 })
  }
})
