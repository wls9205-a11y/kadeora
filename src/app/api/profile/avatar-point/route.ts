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

  // Get current points
  const { data: profile } = await sb
    .from('profiles')
    .select('points')
    .eq('id', user.id)
    .single()

  // Award 30 points
  await sb
    .from('profiles')
    .update({ points: (profile?.points || 0) + 30 })
    .eq('id', user.id)

  // Record grant
  await sb.from('avatar_point_granted').insert({ user_id: user.id })

  // NOTE: point_history table may need to be created.
  await sb.from('point_history').insert({
    user_id: user.id,
    amount: 30,
    reason: 'avatar_upload',
    description: '프로필 사진 등록 보너스'
  })

  // Notification
  await sb.from('notifications').insert({
    user_id: user.id,
    type: 'system',
    content: '📸 프로필 사진 등록 완료! 30P 지급됐어요.'
  })

  return NextResponse.json({ granted: true, points: 30 })
}
