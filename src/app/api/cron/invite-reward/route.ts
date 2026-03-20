import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // CRON_SECRET 검증 — 환경변수 없으면 항상 차단
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Yesterday's date range (UTC)
  const now = new Date()
  const yesterdayStart = new Date(now)
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)
  yesterdayStart.setUTCHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(now)
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() - 1)
  yesterdayEnd.setUTCHours(23, 59, 59, 999)

  // Find invite_codes used yesterday, group by creator_id
  // Table schema: id, code, creator_id, used_by, is_used, created_at, used_at
  const { data: invites } = await sb
    .from('invite_codes')
    .select('creator_id, used_at')
    .gte('used_at', yesterdayStart.toISOString())
    .lte('used_at', yesterdayEnd.toISOString())

  if (!invites || invites.length === 0) {
    return NextResponse.json({ message: 'No invites yesterday', rewarded: false })
  }

  // Count invites per creator
  const counts: Record<string, { count: number; firstUsed: string }> = {}
  for (const inv of invites) {
    if (!counts[inv.creator_id]) {
      counts[inv.creator_id] = { count: 0, firstUsed: inv.used_at }
    }
    counts[inv.creator_id].count++
    if (inv.used_at < counts[inv.creator_id].firstUsed) {
      counts[inv.creator_id].firstUsed = inv.used_at
    }
  }

  // Find winner (most invites, tiebreak by earliest first invite)
  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count
    return a[1].firstUsed.localeCompare(b[1].firstUsed)
  })

  const [winnerId, winnerData] = sorted[0]

  // Award 100 points
  const { data: profile } = await sb
    .from('profiles')
    .select('points')
    .eq('id', winnerId)
    .single()

  if (profile) {
    await sb.rpc('award_points', {
      p_user_id: winnerId,
      p_amount: 100,
      p_reason: '일일초대1등',
      p_meta: { description: `친구초대 일일 1등 (${winnerData.count}명 초대)` }
    })

    // Insert notification
    await sb.from('notifications').insert({
      user_id: winnerId,
      type: 'system',
      content: `🎉 어제 친구 초대 1등! 100P 지급됐어요. (${winnerData.count}명 초대)`
    })
  }

  return NextResponse.json({
    rewarded: true,
    winner: winnerId,
    inviteCount: winnerData.count
  })
}
