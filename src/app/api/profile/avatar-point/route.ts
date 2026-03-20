import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export async function POST() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already granted
  // NOTE: avatar_point_granted table may need to be created.
  // Schema suggestion: id UUID DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT now()
  const { data: existing } = await sb
    .from('avatar_point_granted')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ already: true })
  }

  // 포인트 이상 감지: 1시간 내 200P 이상 적립 시 차단
  const { data: recentPoints } = await sb
    .from('point_history')
    .select('amount')
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .gt('amount', 0)
  const total1h = recentPoints?.reduce((sum, r) => sum + (r.amount ?? 0), 0) ?? 0
  if (total1h >= 200) {
    console.warn('[point-anomaly] suspicious activity:', user.id, 'total1h:', total1h)
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  // Get current points
  const { data: profile } = await sb
    .from('profiles')
    .select('points')
    .eq('id', user.id)
    .single()

  // Award 30 points (award_points RPC handles point_history too)
  await sb.rpc('award_points', {
    p_user_id: user.id,
    p_amount: 30,
    p_reason: '아바타등록',
    p_meta: null,
  })

  // Record grant
  await sb.from('avatar_point_granted').insert({ user_id: user.id })

  // Notification
  await sb.from('notifications').insert({
    user_id: user.id,
    type: 'system',
    content: '📸 프로필 사진 등록 완료! 30P 지급됐어요.'
  })

  return NextResponse.json({ granted: true, points: 30 })
}
