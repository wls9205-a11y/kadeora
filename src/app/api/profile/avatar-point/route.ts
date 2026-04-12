import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ★ INSERT 먼저 — UNIQUE(user_id) 제약으로 중복 차단 (DB 레벨)
    // 이미 지급된 유저는 UNIQUE 위반 에러 → 포인트 지급 안 함
    const { error: insertErr } = await sb
      .from('avatar_point_granted')
      .insert({ user_id: user.id })

    if (insertErr) {
      // UNIQUE 위반 = 이미 지급됨
      return NextResponse.json({ already: true })
    }

    // INSERT 성공 = 처음 등록 → 포인트 지급
    try {
      await sb.rpc('award_points', {
        p_user_id: user.id,
        p_amount: 30,
        p_reason: '아바타등록',
        p_meta: null,
      })
    } catch {
      // 포인트 지급 실패 시 grant 기록 롤백
      await sb.from('avatar_point_granted').delete().eq('user_id', user.id)
      return NextResponse.json({ error: '포인트 지급 오류' }, { status: 500 })
    }

    // 알림 (link 포함)
    await sb.from('notifications').insert({
      user_id: user.id,
      type: 'system',
      content: '📸 프로필 사진 등록 완료! 30P 지급됐어요.', link: '/profile',
      link: `/profile/${user.id}`,
    })

    return NextResponse.json({ granted: true, points: 30 })

  } catch (e) {
    console.error('[avatar-point]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
