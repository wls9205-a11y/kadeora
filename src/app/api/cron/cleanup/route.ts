import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRETT || process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    console.error('[cleanup] Unauthorized attempt:', req.headers.get('x-forwarded-for'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. 30일 지난 읽은 알림 삭제
    const { count: notifCount } = await admin
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('is_read', true)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // 2. page_views 90일 이전 삭제 (데이터 적재량 관리)
    const { count: pvCount } = await admin
      .from('page_views')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    console.log('[cleanup] notifications:', notifCount, 'page_views:', pvCount)

    return NextResponse.json({
      ok: true,
      cleaned: { notifications: notifCount ?? 0, pageViews: pvCount ?? 0 }
    })
  } catch (e: any) {
    console.error('[cleanup] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
