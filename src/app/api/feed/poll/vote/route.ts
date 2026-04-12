import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// POST /api/feed/poll/vote — 투표 참여
export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { poll_id, option_id } = await req.json();
    if (!poll_id || !option_id) return NextResponse.json({ error: 'poll_id, option_id 필요' }, { status: 400 });

    // 중복 투표 체크 (UNIQUE 제약으로도 방어)
    const { data: existing } = await (sb as any).from('poll_votes')
      .select('id').eq('poll_id', poll_id).eq('user_id', user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: '이미 투표했습니다' }, { status: 409 });

    // 만료 체크
    const { data: poll } = await (sb as any).from('post_polls')
      .select('expires_at').eq('id', poll_id).single();
    if (poll?.expires_at && new Date(poll.expires_at) < new Date()) {
      return NextResponse.json({ error: '투표가 종료되었습니다' }, { status: 410 });
    }

    // 투표
    const { error } = await (sb as any).from('poll_votes').insert({
      poll_id, option_id, user_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 포인트 지급
    await (sb as any).rpc('award_points', {
      p_user_id: user.id, p_amount: 5, p_reason: '투표참여', p_meta: { ref_id: poll_id },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
