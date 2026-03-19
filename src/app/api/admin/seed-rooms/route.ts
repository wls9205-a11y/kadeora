import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_ROOMS = [
  { room_key: 'stock_005930', display_name: '삼성전자 토론방', description: '삼성전자(005930) 실시간 토론', room_type: 'stock' },
  { room_key: 'stock_035720', display_name: '카카오 토론방', description: '카카오(035720) 실시간 토론', room_type: 'stock' },
  { room_key: 'stock_005380', display_name: '현대차 토론방', description: '현대차(005380) 실시간 토론', room_type: 'stock' },
  { room_key: 'local_seoul', display_name: '서울 부동산 토론방', description: '서울 지역 부동산 소식/토론', room_type: 'local' },
  { room_key: 'local_busan', display_name: '부산 부동산 토론방', description: '부산 지역 부동산 소식/토론', room_type: 'local' },
  { room_key: 'local_gyeonggi', display_name: '경기 부동산 토론방', description: '경기 지역 부동산 소식/토론', room_type: 'local' },
]

export async function POST() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let created = 0
  let skipped = 0

  for (const room of DEFAULT_ROOMS) {
    const { data: existing } = await admin
      .from('discussion_rooms')
      .select('id')
      .eq('room_key', room.room_key)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    const { error } = await admin.from('discussion_rooms').insert(room)
    if (!error) created++
  }

  return NextResponse.json({ ok: true, created, skipped, total: DEFAULT_ROOMS.length })
}
