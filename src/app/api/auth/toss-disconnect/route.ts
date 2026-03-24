import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const EXPECTED_AUTH =
  process.env.TOSS_DISCONNECT_BASIC_AUTH ||
  'Basic a2FkZW9yYTprYWRlb3JhLXRvc3MtMjAyNg=='

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== EXPECTED_AUTH) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const userId = body.user_id || body.user_ci
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'user_id or user_ci is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('profiles')
      .update({
        is_deleted: true,
        nickname: '탈퇴한 회원',
        avatar_url: null,
        bio: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error('[toss-disconnect] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to process disconnect' }, { status: 500 })
    }

    // 알림 및 푸시 구독 정리
    await admin.from('notifications').delete().eq('user_id', userId)
    await admin.from('push_subscriptions').delete().eq('user_id', userId)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[toss-disconnect] Error:', e.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
